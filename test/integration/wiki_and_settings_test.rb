require "test_helper"

class WikiAndSettingsTest < ActionDispatch::IntegrationTest
  setup { sign_in }

  test "wiki pages can be created, shown, edited, searched and deleted" do
    post wiki_pages_path, params: { wiki_page: { title: "Bits", content: "**Sharp**" } }
    page = WikiPage.last
    assert_redirected_to wiki_page_path(page)
    item = Item.create!(name: "Drill", wiki_pages: [ page ])

    get wiki_page_path(page)
    assert_select "strong", "Sharp"
    assert_select "a[href=?]", root_path(item: item.id)

    patch wiki_page_path(page), params: { wiki_page: { title: "Drill bits", content: "x" } }
    assert_equal "Drill bits", page.reload.title

    get wiki_pages_path(q: "drill"), headers: { "Turbo-Frame" => "wiki_list" }
    assert_select "turbo-frame#wiki_list a", "Drill bits"

    delete wiki_page_path(page)
    assert_redirected_to wiki_pages_path
    assert_empty item.reload.wiki_pages
  end

  test "invalid wiki page re-renders with 422" do
    post wiki_pages_path, params: { wiki_page: { title: "" } }
    assert_response :unprocessable_entity
  end

  test "markdown preview" do
    post preview_wiki_pages_path, params: { content: "# Hi" }
    assert_equal "<h1>Hi</h1>", response.body.strip
  end

  test "manufacturers can be added and deleted from settings" do
    get settings_path
    assert_response :success
    post manufacturers_path, params: { manufacturer: { name: "Makita" } }
    assert_redirected_to settings_path
    maker = Manufacturer.find_by!(name: "Makita")
    item = Item.create!(name: "Drill", manufacturer: maker)

    post manufacturers_path, params: { manufacturer: { name: "makita" } }
    assert_response :unprocessable_entity

    delete manufacturer_path(maker)
    assert_nil item.reload.manufacturer_id
  end

  test "uploads are stored and served" do
    post uploads_path, params: { photos: [ photo_upload ] }
    assert_response :created
    path = response.parsed_body["paths"].first
    get path
    assert_response :success
    assert_equal "image/png", response.media_type
    assert_match "immutable", response.headers["Cache-Control"]

    post uploads_path, params: { photos: [ fixture_file_upload("photo.png", "text/plain") ] }
    assert_response :bad_request
    get upload_path("#{SecureRandom.uuid}.png")
    assert_response :not_found
  end
end
