# Single shared-password access gate backed by server-side sessions (see AuthSession).
module Authentication
  extend ActiveSupport::Concern

  COOKIE_NAME = "garagio_session"

  included do
    before_action :require_authentication
    helper_method :authenticated? if respond_to?(:helper_method)
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private

  def authenticated?
    current_auth_session.present?
  end

  def current_auth_session
    return @current_auth_session if defined?(@current_auth_session)

    @current_auth_session = AuthSession.authenticate(cookies[COOKIE_NAME])
  end

  def require_authentication
    return if authenticated?

    if request.format.html? && !request.path.start_with?("/api/", "/uploads/")
      redirect_to login_path
    else
      render json: { error: "Authentication required" }, status: :unauthorized
    end
  end

  # Returns :ok, :invalid or :banned.
  def attempt_login(password)
    ip_address = client_ip
    return :banned if LoginAttempt.banned?(ip_address)

    unless password_matches?(password)
      return LoginAttempt.record_failure(ip_address) ? :banned : :invalid
    end

    LoginAttempt.clear(ip_address)
    auth_session = AuthSession.start(ip_address)
    cookies[COOKIE_NAME] = {
      value: auth_session.session_id, httponly: true, same_site: :strict,
      secure: request.ssl?, expires: AuthSession::LIFETIME.from_now
    }
    :ok
  end

  def terminate_session
    current_auth_session&.destroy
    cookies.delete(COOKIE_NAME)
  end

  def password_matches?(password)
    configured = Rails.configuration.x.access_password
    configured.present? && password.is_a?(String) && password.present? &&
      ActiveSupport::SecurityUtils.secure_compare(password, configured)
  end

  # Forwarded headers are only honoured with TRUST_PROXY=true, otherwise they could be forged to dodge bans.
  def client_ip
    if Rails.configuration.x.trust_proxy
      forwarded = request.headers["X-Forwarded-For"].to_s.split(",").first.to_s.strip
      real_ip = request.headers["X-Real-IP"].to_s.strip
      forwarded.presence || real_ip.presence || request.remote_addr
    else
      request.remote_addr
    end
  end

  def login_error_message(result)
    result == :banned ? "Too many failed attempts. Try again in one month." : "Incorrect password"
  end
end
