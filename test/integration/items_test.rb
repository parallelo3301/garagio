require "test_helper"

class ItemsTest < ActionDispatch::IntegrationTest
  setup { sign_in }

  test "inventory splits tools and materials into tabs and searches within them" do
    Item.create!(name: "Cordless drill", location: "Garage")
    Item.create!(name: "Hammer")
    Item.create!(name: "Nails 40 mm", kind: "material", amount: "100+", location: "Garage")

    get root_path
    assert_response :success
    assert_select "h1", "Inventory"
    assert_select "#items a[id^=item_]", 2
    assert_select "[role=tab][aria-selected=true]", /Tools\s+2/

    get root_path(kind: "material")
    assert_select "#items a[id^=item_]", 1
    assert_select "#items", /Nails 40 mm.*100\+/m

    get root_path(q: "garage")
    assert_select "#items a[id^=item_]", 1
    assert_select "#items", /Cordless drill/
    assert_select "#items a[href=?]", root_path(kind: "material", q: "garage"), text: "1 in materials"
  end

  test "item page shows details, description and photos" do
    item = Item.create!(name: "Router", description: "Line one\nLine two", location: "Shelf",
      tag_list: "wood", photos: Upload.store!([ photo_upload, photo_upload ]))
    get item_path(item)
    assert_response :success
    assert_select "h1", "Router"
    assert_select ".markdown", /Line one\s*Line two/
    assert_select ".markdown br"
    assert_select "[data-controller=gallery] img[src=?]", item.photos.first
    assert_select "dialog.lightbox img", 2
    assert_select "a[href=?]", edit_item_path(item), text: /Edit/
    assert_select "a[href=?]", new_item_path(copy: item.id)
  end

  test "legacy item links redirect to the item pages" do
    item = Item.create!(name: "Drill")
    get root_path(item: item.id)
    assert_redirected_to item_path(item)
    get root_path(item: "new")
    assert_redirected_to new_item_path
  end

  test "new and edit render full page forms with suggestions" do
    Item.create!(name: "Saw", location: "Garage", tag_list: "wood")
    get new_item_path(kind: "material")
    assert_response :success
    assert_select "form#item_form input[type=radio][value=material][checked]"
    assert_select "[data-controller=chips][data-chips-suggestions-value=?]", [ "Garage" ].to_json
    assert_select "[data-controller=chips][data-chips-suggestions-value=?]", [ "wood" ].to_json

    item = Item.last
    get edit_item_path(item)
    assert_select "form#item_form input[name='item[location]'][value=Garage]"
    assert_select "form#item_form input[name='item[tag_list]'][value=wood]"
  end

  test "duplicate prefills a new item from an existing one" do
    original = Item.create!(name: "Clamp", tag_list: "wood", status: "borrowed", borrowed_to: "Ann",
      photos: Upload.store!([ photo_upload ]))
    get new_item_path(copy: original.id)
    assert_select "input[name='item[name]'][value=Clamp]"
    assert_select "input[name='item[tag_list]'][value=wood]"
    assert_select "input[name='item[photos][]'][value=?]", original.photos.first
    assert_select "select[name='item[status]'] option[selected][value=in_stock]"
  end

  test "creates an item with tags, links, photos and wiki pages" do
    page = WikiPage.create!(title: "Manual")
    photos = Upload.store!([ photo_upload, photo_upload ])
    assert_difference "Item.count" do
      post items_path, params: { item: {
        name: "Drill", kind: "tool", quantity: 5, status: "borrowed", borrowed_to: "Ann", borrowed_at: "2024-01-02",
        tag_list: "power, tools", photos: [ "", photos.second, photos.first ], wiki_page_ids: [ "", page.id ],
        links: [ { label: "Docs", url: "https://example.com" } ]
      } }
    end
    item = Item.last
    assert_redirected_to item_path(item)
    assert_equal [ "power", "tools" ], item.tag_names
    assert_equal photos.second, item.cover_photo
    assert_equal 1, item.quantity, "tools are tracked one per item"
    assert_equal [ page ], item.wiki_pages
    assert_equal "Ann", item.borrowed_to
    assert_equal [ { "label" => "Docs", "url" => "https://example.com" } ], item.links
  end

  test "creates a material with an approximate amount" do
    post items_path, params: { item: { name: "Screws 4x40", kind: "material", amount: " 100–500 " } }
    item = Item.last
    assert item.material?
    assert_equal "100–500", item.amount_label
  end

  test "invalid item re-renders the form with 422" do
    post items_path, params: { item: { name: "" } }
    assert_response :unprocessable_entity
    assert_select "form#item_form"
    assert_select "[role=alert]", /Name can't be blank/
  end

  test "updating clears borrowed fields when not borrowed and can remove all photos" do
    item = Item.create!(name: "Drill", status: "borrowed", borrowed_to: "Ann", photos: Upload.store!([ photo_upload ]))
    patch item_path(item), params: { item: { name: "Drill", status: "in_stock", borrowed_to: "Ann", photos: [ "" ] } }
    assert_redirected_to item_path(item)
    item.reload
    assert_nil item.borrowed_to
    assert_empty item.photos
  end

  test "deleting returns to the item's tab" do
    item = Item.create!(name: "Glue", kind: "material")
    delete item_path(item)
    assert_redirected_to root_path(kind: "material")
    assert_not Item.exists?(item.id)
  end
end
