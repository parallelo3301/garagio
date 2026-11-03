class ManufacturersController < ApplicationController
  def index
    @manufacturers = Manufacturer.ordered
    @manufacturer = Manufacturer.new
    @ai_config = AiConfig.current
  end

  def create
    @manufacturer = Manufacturer.new(params.expect(manufacturer: [ :name ]))
    if @manufacturer.save
      redirect_to settings_path, notice: "#{@manufacturer.name} added.", status: :see_other
    else
      @manufacturers = Manufacturer.ordered
      @ai_config = AiConfig.current
      render :index, status: :unprocessable_entity
    end
  end

  def destroy
    manufacturer = Manufacturer.find(params[:id])
    manufacturer.destroy!
    redirect_to settings_path, notice: "#{manufacturer.name} deleted.", status: :see_other
  end
end
