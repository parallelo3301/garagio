class Api::AuthController < Api::BaseController
  allow_unauthenticated_access

  def login
    result = attempt_login(params[:password])
    if result == :ok
      render json: { authenticated: true }
    else
      render json: { error: login_error_message(result) }, status: result == :banned ? :too_many_requests : :unauthorized
    end
  end

  def logout
    terminate_session
    render json: { authenticated: false }
  end
end
