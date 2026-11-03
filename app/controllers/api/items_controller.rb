class Api::ItemsController < Api::BaseController
  def index
    render json: Item.with_details.ordered
  end

  def show
    render json: Item.with_details.find(params[:id])
  end

  def create
    item = Item.new(item_attributes)
    item.save
    render_record item, status: :created
  end

  def update
    item = Item.find(params[:id])
    item.update(item_attributes)
    render_record item
  end

  def destroy
    Item.where(id: params[:id]).destroy_all
    head :no_content
  end

  private

  # Accepts the camelCase payload of the original API.
  def item_attributes
    input = params.permit(:name, :description, :quantity, :location, :manufacturerId, :status, :borrowedTo,
      :borrowedAt, tags: [], photos: [], wikiPageIds: [], links: [ [ :label, :url ] ])
    {
      name: input[:name], description: input[:description], quantity: input.fetch(:quantity, 1),
      location: input[:location], manufacturer_id: input[:manufacturerId], status: input[:status].presence || "in_stock",
      borrowed_to: input[:borrowedTo], borrowed_at: input[:borrowedAt], tag_list: Array(input[:tags]),
      photos: Array(input[:photos]), links: Array(input[:links]).map(&:to_h), wiki_page_ids: Array(input[:wikiPageIds])
    }
  end
end
