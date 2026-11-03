class SessionsController < ApplicationController
  allow_unauthenticated_access only: %i[new create]
  layout "auth"

  def new
    redirect_to root_path if authenticated?
  end

  def create
    result = attempt_login(params[:password])
    if result == :ok
      redirect_to root_path, status: :see_other
    else
      flash.now[:alert] = login_error_message(result)
      render :new, status: result == :banned ? :too_many_requests : :unauthorized
    end
  end

  def destroy
    terminate_session
    redirect_to login_path, status: :see_other
  end
end
