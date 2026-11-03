class Api::UploadsController < Api::BaseController
  def create
    render json: { paths: Upload.store!(params[:photos]) }, status: :created
  rescue Upload::Invalid => error
    render json: { error: error.message }, status: :bad_request
  end
end
