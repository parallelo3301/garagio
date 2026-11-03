class WikiPagesController < ApplicationController
  before_action :set_page, only: %i[show edit update destroy]
  before_action :load_sidebar, except: %i[preview destroy]

  def index
    render partial: "wiki_pages/list", locals: { pages: @pages, current: WikiPage.find_by(id: params[:current]) } if turbo_frame_request_id == "wiki_list"
  end

  def show
    @linked_items = @page.items.includes(:manufacturer).ordered
  end

  def new
    @page = WikiPage.new
  end

  def create
    @page = WikiPage.new(page_params)
    if @page.save
      redirect_to wiki_page_path(@page), notice: "Page created.", status: :see_other
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit; end

  def update
    if @page.update(page_params)
      redirect_to wiki_page_path(@page), notice: "Page saved.", status: :see_other
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @page.destroy!
    redirect_to wiki_pages_path, notice: "#{@page.title} deleted.", status: :see_other
  end

  def preview
    render html: helpers.markdown(params[:content].to_s)
  end

  private

  def set_page
    @page = WikiPage.find(params[:id])
  end

  def load_sidebar
    @query = params[:q].to_s
    @pages = WikiPage.ordered.search(@query).select(:id, :title)
    @any_pages = @query.blank? ? @pages.any? : WikiPage.exists?
  end

  def page_params
    params.expect(wiki_page: [ :title, :content ])
  end
end
