class Api::WikiPagesController < Api::BaseController
  def index
    render json: WikiPage.ordered
  end

  def show
    render json: WikiPage.find(params[:id])
  end

  def create
    page = WikiPage.new(page_params)
    page.save
    render_record page, status: :created
  end

  def update
    page = WikiPage.find(params[:id])
    page.update(page_params)
    render_record page
  end

  def destroy
    WikiPage.where(id: params[:id]).destroy_all
    head :no_content
  end

  private

  def page_params
    params.permit(:title, :content).with_defaults(title: "")
  end
end
