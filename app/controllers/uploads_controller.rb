class UploadsController < ApplicationController
  def create
    render json: { paths: Upload.store!(params[:photos]) }, status: :created
  rescue Upload::Invalid => error
    render json: { error: error.message }, status: :bad_request
  end

  def show
    file = Upload.file_for(params[:filename])
    return head :not_found unless file

    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    send_file file, type: Upload.content_type_for(file.basename.to_s), disposition: :inline
  end
end
