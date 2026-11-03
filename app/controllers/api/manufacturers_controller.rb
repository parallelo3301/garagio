class Api::ManufacturersController < Api::BaseController
  def index
    render json: Manufacturer.ordered
  end

  def create
    manufacturer = Manufacturer.new(manufacturer_params)
    manufacturer.save
    render_record manufacturer, status: :created
  end

  def update
    manufacturer = Manufacturer.find(params[:id])
    manufacturer.update(manufacturer_params)
    render_record manufacturer
  end

  def destroy
    Manufacturer.where(id: params[:id]).destroy_all
    head :no_content
  end

  private

  def manufacturer_params
    params.permit(:name, :website, :notes).with_defaults(name: "")
  end
end
