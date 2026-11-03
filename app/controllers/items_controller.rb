class ItemsController < ApplicationController
  before_action :set_item, only: %i[edit update destroy]
  before_action :load_form_options, only: %i[new create edit update]

  def index
    @query = params[:q].to_s
    @all_count = Item.count
    @items = Item.with_details.ordered.search(@query)
    @open_item = Item.find_by(id: params[:item]) if params[:item].present?
  end

  def new
    @item = Item.new(quantity: 1)
    render_modal_or_redirect(root_path(item: "new"))
  end

  def create
    @item = Item.new(item_params)
    if @item.save
      turbo_redirect_to safe_return_path(root_path), notice: "#{@item.name} added."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    render_modal_or_redirect(root_path(item: @item.id))
  end

  def update
    if @item.update(item_params)
      turbo_redirect_to safe_return_path(root_path), notice: "#{@item.name} saved."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @item.destroy!
    turbo_redirect_to safe_return_path(root_path), notice: "#{@item.name} deleted."
  end

  private

  def set_item
    @item = Item.find(params[:id])
  end

  def load_form_options
    @manufacturers = Manufacturer.ordered
    @wiki_pages = WikiPage.ordered.select(:id, :title)
  end

  # Item forms are shown in a modal turbo frame; direct visits open the modal on the inventory page.
  def render_modal_or_redirect(fallback)
    redirect_to fallback unless turbo_frame_request?
  end

  def item_params
    permitted = params.expect(item: [ :name, :description, :quantity, :location, :manufacturer_id, :status,
      :borrowed_to, :borrowed_at, :tag_list, photos: [], wiki_page_ids: [], links: [ [ :label, :url ] ] ])
    permitted[:photos] ||= []
    permitted[:links] = Array(permitted[:links]).map(&:to_h)
    permitted[:wiki_page_ids] = Array(permitted[:wiki_page_ids]).compact_blank
    unless permitted[:status] == "borrowed"
      permitted[:borrowed_to] = nil
      permitted[:borrowed_at] = nil
    end
    permitted
  end
end
