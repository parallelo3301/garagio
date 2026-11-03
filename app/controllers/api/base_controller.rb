# JSON API with the same paths and payloads as the original Garagio API. Authenticated with the
# SameSite=Strict session cookie obtained from POST /api/auth/login.
class Api::BaseController < ActionController::API
  include ActionController::Cookies
  include Authentication

  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "Not found" }, status: :not_found
  end

  rescue_from ActionController::ParameterMissing, ActiveRecord::RecordInvalid do |error|
    message = error.respond_to?(:record) ? error.record.errors.full_messages.to_sentence : error.message
    render json: { error: message }, status: :bad_request
  end

  private

  def render_record(record, status: :ok)
    if record.errors.any?
      render json: { error: record.errors.full_messages.to_sentence }, status: :bad_request
    else
      render json: record, status:
    end
  end
end
