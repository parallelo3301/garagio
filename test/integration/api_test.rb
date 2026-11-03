require "test_helper"

class ApiTest < ActionDispatch::IntegrationTest
  setup { post api_auth_login_path, params: { password: PASSWORD }, as: :json }

  test "items CRUD with camelCase payloads" do
    maker = Manufacturer.create!(name: "Bosch")
    page = WikiPage.create!(title: "Manual")
    post api_items_path, params: { name: "Drill", manufacturerId: maker.id, tags: [ "power" ], wikiPageIds: [ page.id ],
      links: [ { label: "Docs", url: "https://example.com" } ], status: "borrowed", borrowedTo: "Ann" }, as: :json
    assert_response :created
    body = response.parsed_body
    assert_equal "Bosch", body["manufacturerName"]
    assert_equal [ "power" ], body["tags"]
    assert_equal [ page.id ], body["wikiPageIds"]
    assert_equal 1, body["quantity"]

    patch api_item_path(body["id"]), params: { name: "Drill 2", quantity: 3 }, as: :json
    assert_equal "Drill 2", response.parsed_body["name"]
    assert_equal "in_stock", response.parsed_body["status"]

    get api_items_path
    assert_equal [ "Drill 2" ], response.parsed_body.map { |item| item["name"] }
    get api_item_path(body["id"])
    assert_equal 3, response.parsed_body["quantity"]

    post api_items_path, params: { name: "" }, as: :json
    assert_response :bad_request
    assert response.parsed_body["error"].present?

    delete api_item_path(body["id"])
    assert_response :no_content
    get api_item_path(body["id"])
    assert_response :not_found
  end

  test "manufacturers and wiki endpoints" do
    post api_manufacturers_path, params: { name: "Makita", website: "https://makita.example" }, as: :json
    assert_response :created
    id = response.parsed_body["id"]
    patch api_manufacturer_path(id), params: { name: "Makita EU" }, as: :json
    assert_equal "Makita EU", response.parsed_body["name"]
    get api_manufacturers_path
    assert_equal [ "Makita EU" ], response.parsed_body.map { |maker| maker["name"] }
    delete api_manufacturer_path(id)
    assert_response :no_content

    post api_wiki_pages_path, params: { title: "Bits", content: "x" }, as: :json
    assert_response :created
    assert_equal %w[content id title], response.parsed_body.keys.sort
    get api_wiki_pages_path
    assert_equal 1, response.parsed_body.size
  end

  test "uploads" do
    post api_uploads_path, params: { photos: [ photo_upload ] }
    assert_response :created
    assert Upload.path?(response.parsed_body["paths"].first)
  end
end
