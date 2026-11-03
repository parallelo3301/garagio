class ItemsController < ApplicationController
  NEW_MANUFACTURER = "__new__"

  before_action :set_item, only: %i[show edit update destroy]
  before_action :load_form_options, only: %i[new create edit update]

  def index
    return redirect_to(legacy_item_path) if params[:item].present?

    @kind = Item::KINDS.include?(params[:kind]) ? params[:kind] : "tool"
    @query = params[:q].to_s
    matches = Item.with_details.ordered.search(@query)
    @counts = Item::KINDS.index_with { |kind| matches.count { |item| item.kind == kind } }
    @items = matches.select { |item| item.kind == @kind }
  end

  def show
  end

  def new
    @item = copy_source&.then { |source| duplicate(source) } || Item.new(kind: kind_param || "tool", quantity: 1)
  end

  def create
    @item = Item.new(item_params)
    if @item.save
      redirect_to item_path(@item), notice: "#{@item.name} added."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @item.update(item_params)
      redirect_to item_path(@item), notice: "#{@item.name} saved."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @item.destroy!
    redirect_to root_path(kind: @item.kind), notice: "#{@item.name} deleted.", status: :see_other
  end

  private

  def set_item
    @item = Item.with_details.find(params[:id])
  end

  # Manufacturers suggested by AI recognition are created when the item is saved.
  def find_or_create_manufacturer(name)
    return if name.blank?

    Manufacturer.where("LOWER(name) = ?", name.downcase).first || Manufacturer.create(name: name.truncate(100))
  end

  def load_form_options
    @ai_config = AiConfig.current
    @ai_configured = @ai_config.configured?
    @manufacturers = Manufacturer.ordered
    @wiki_pages = WikiPage.ordered.select(:id, :title)
    @tag_suggestions = Tag.order(Arel.sql("name COLLATE NOCASE")).pluck(:name)
    @location_suggestions = Item.locations
  end

  # Old links opened the item sheet with /?item=<id|new>.
  def legacy_item_path
    params[:item] == "new" ? new_item_path : item_path(params[:item])
  end

  def kind_param
    params[:kind] if Item::KINDS.include?(params[:kind])
  end

  def copy_source
    Item.with_details.find_by(id: params[:copy]) if params[:copy].present?
  end

  def duplicate(source)
    source.dup.tap do |copy|
      copy.assign_attributes(status: "in_stock", borrowed_to: nil, borrowed_at: nil)
      copy.tags = source.tags
      copy.wiki_pages = source.wiki_pages
    end
  end

  def item_params
    permitted = params.expect(item: [ :name, :kind, :description, :quantity, :amount, :location, :manufacturer_id, :status,
      :borrowed_to, :borrowed_at, :tag_list, :manufacturer_name, photos: [], wiki_page_ids: [], links: [ [ :label, :url ] ] ])
    new_manufacturer = permitted.delete(:manufacturer_name).to_s.strip
    permitted[:manufacturer_id] = find_or_create_manufacturer(new_manufacturer)&.id if permitted[:manufacturer_id] == NEW_MANUFACTURER
    permitted[:photos] ||= []
    permitted[:links] = Array(permitted[:links]).map(&:to_h)
    permitted[:wiki_page_ids] = Array(permitted[:wiki_page_ids]).compact_blank
    permitted[:quantity] = 1 if permitted[:kind] == "tool"
    unless permitted[:status] == "borrowed"
      permitted[:borrowed_to] = nil
      permitted[:borrowed_at] = nil
    end
    permitted
  end
end
