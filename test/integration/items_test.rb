require "test_helper"

class ItemsTest < ActionDispatch::IntegrationTest
  setup { sign_in }

  test "inventory lists and searches items" do
    Item.create!(name: "Cordless drill", location: "Garage")
    Item.create!(name: "Hammer")
    get root_path
    assert_response :success
    assert_select "h1", "Inventory"
    assert_select "#items a[id^=item_]", 2
    get root_path(q: "garage")
    assert_select "#items a[id^=item_]", 1
    assert_select "#items", /Cordless drill/
  end

  test "inventory with item param preloads the modal" do
    item = Item.create!(name: "Drill")
    get root_path(item: item.id)
    assert_select "turbo-frame#modal[src=?]", edit_item_path(item)
    get root_path(item: "new")
    assert_select "turbo-frame#modal[src=?]", new_item_path
  end

  test "new and edit outside a frame redirect to the inventory modal" do
    item = Item.create!(name: "Drill")
    get new_item_path
    assert_redirected_to root_path(item: "new")
    get edit_item_path(item)
    assert_redirected_to root_path(item: item.id)
    get edit_item_path(item), headers: { "Turbo-Frame" => "modal" }
    assert_select "turbo-frame#modal form#item_form"
  end

  test "creates an item with tags, links, photos and wiki pages" do
    page = WikiPage.create!(title: "Manual")
    photo = Upload.store!([ photo_upload ]).first
    assert_difference "Item.count" do
      post items_path, params: { return_to: "/?q=drill", item: {
        name: "Drill", quantity: 2, status: "borrowed", borrowed_to: "Ann", borrowed_at: "2024-01-02",
        tag_list: "power, tools", photos: [ "", photo ], wiki_page_ids: [ "", page.id ],
        links: [ { label: "Docs", url: "https://example.com" } ]
      } }, as: :turbo_stream
    end
    assert_response :success
    assert_match %(action="redirect"), response.body
    assert_match "/?q=drill", response.body

    item = Item.last
    assert_equal [ "power", "tools" ], item.tag_names
    assert_equal [ photo ], item.photos
    assert_equal [ page ], item.wiki_pages
    assert_equal "Ann", item.borrowed_to
    assert_equal [ { "label" => "Docs", "url" => "https://example.com" } ], item.links
  end

  test "invalid item re-renders the modal with 422" do
    post items_path, params: { item: { name: "" } }, headers: { "Turbo-Frame" => "modal" }
    assert_response :unprocessable_entity
    assert_select "turbo-frame#modal form#item_form"
  end

  test "updating clears borrowed fields when not borrowed and can remove all photos" do
    item = Item.create!(name: "Drill", status: "borrowed", borrowed_to: "Ann", photos: Upload.store!([ photo_upload ]))
    patch item_path(item), params: { item: { name: "Drill", status: "in_stock", borrowed_to: "Ann", photos: [ "" ] } }
    assert_redirected_to root_path
    item.reload
    assert_nil item.borrowed_to
    assert_empty item.photos
  end

  test "external return_to is ignored" do
    item = Item.create!(name: "Drill")
    delete item_path(item, return_to: "//evil.example")
    assert_redirected_to root_path
    assert_not Item.exists?(item.id)
  end
end
