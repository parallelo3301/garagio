class ApplicationController < ActionController::Base
  include Authentication

  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  private

  # Closes the modal (if any) and navigates the whole page; used for forms submitted inside turbo frames.
  def turbo_redirect_to(url, notice: nil)
    flash[:notice] = notice if notice
    respond_to do |format|
      format.turbo_stream { render turbo_stream: turbo_stream.action(:redirect, url) }
      format.html { redirect_to url, status: :see_other }
    end
  end

  def safe_return_path(fallback)
    path = params[:return_to].to_s
    path.start_with?("/") && !path.start_with?("//") ? path : fallback
  end
end
