require "test_helper"

class ItemTest < ActiveSupport::TestCase
  test "requires name, non-negative quantity and known status" do
    item = Item.new(name: " ", quantity: -1, status: "lost")
    assert_not item.valid?
    assert_includes item.errors.attribute_names, :name
    assert_includes item.errors.attribute_names, :quantity
    assert_includes item.errors.attribute_names, :status
  end

  test "assigns tags from a comma separated list, reusing existing tags" do
    Tag.create!(name: "drill")
    item = Item.create!(name: "Drill", tag_list: "drill, Power tools, , power tools")
    assert_equal [ "drill", "Power tools" ], item.reload.tag_names
    assert_equal 1, Tag.where(name: "drill").count
  end

  test "cleans links and photos and validates them" do
    item = Item.new(name: "Saw", photos: [ "", "/uploads/#{SecureRandom.uuid}.jpg" ],
      links: [ { "label" => "", "url" => "https://example.com" }, { "label" => "x", "url" => "" } ])
    assert item.valid?
    assert_equal [ { "label" => "https://example.com", "url" => "https://example.com" } ], item.links
    assert_equal 1, item.photos.size

    item.links = [ { "label" => "bad", "url" => "javascript:alert(1)" } ]
    item.photos = [ "https://elsewhere.test/a.jpg" ]
    assert_not item.valid?
    assert_includes item.errors.attribute_names, :links
    assert_includes item.errors.attribute_names, :photos
  end

  test "search matches name, manufacturer, tags and links case-insensitively" do
    bosch = Manufacturer.create!(name: "Bosch")
    drill = Item.create!(name: "Drill", manufacturer: bosch, tag_list: "power", location: "Shelf A")
    saw = Item.create!(name: "Saw", links: [ { "label" => "Manual", "url" => "https://saw.example" } ])

    assert_equal [ drill ], Item.with_details.search("BOSCH")
    assert_equal [ drill ], Item.with_details.search("power")
    assert_equal [ drill ], Item.with_details.search("shelf a")
    assert_equal [ saw ], Item.with_details.search("manual")
    assert_equal 2, Item.search("").size
  end

  test "serializes to the original camelCase API shape" do
    page = WikiPage.create!(title: "Notes")
    item = Item.create!(name: "Drill", status: "borrowed", borrowed_to: "Ann", borrowed_at: Date.new(2024, 5, 1),
      tag_list: "a", wiki_pages: [ page ])
    json = item.as_json
    assert_equal %i[id name description quantity location manufacturerId manufacturerName status borrowedTo borrowedAt tags photos links wikiPageIds].sort, json.keys.sort
    assert_equal "2024-05-01", json[:borrowedAt]
    assert_equal [ page.id ], json[:wikiPageIds]
  end
end
