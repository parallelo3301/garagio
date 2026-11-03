require "test_helper"

class AiTest < ActionDispatch::IntegrationTest
  setup do
    sign_in
    @requests = []
    @responses = []
    AiClient.transport = lambda do |method, uri, headers, body|
      @requests << { method:, uri: uri.to_s, headers:, body: body && JSON.parse(body) }
      @responses.shift || [ 500, "{}" ]
    end
  end

  teardown { AiClient.transport = nil }

  def configure(provider: "vercel", web_search: "0", **attributes)
    patch ai_settings_path, params: { ai_config: { provider:, base_url: AiConfig::PRESETS[provider][:base_url],
      model: "google/gemini-3.8-flash", api_key: "secret-token-1234", web_search:, language: "Czech", **attributes } }
    assert_redirected_to settings_path(anchor: "ai")
  end

  def answer(content, annotations: nil)
    message = { role: "assistant", content: }
    message[:annotations] = annotations if annotations
    @responses << [ 200, { choices: [ { message: } ] }.to_json ]
  end

  test "settings store the token encrypted and keep or clear it" do
    get settings_path
    assert_select "#ai h2", "AI recognition"

    configure
    raw = Setting[:ai_api_key]
    assert_not_includes raw, "secret-token-1234"
    config = AiConfig.current
    assert_equal "secret-token-1234", config.api_key
    assert_equal "Czech", config.language
    assert config.configured?

    patch ai_settings_path, params: { ai_config: { provider: "vercel", base_url: "https://ai-gateway.vercel.sh/v1", model: "openai/gpt-6.1-terra",
      api_key: "", language: "Czech" } }
    assert_equal "secret-token-1234", AiConfig.current.api_key
    assert_equal "openai/gpt-6.1-terra", AiConfig.current.model

    get settings_path
    assert_select "input[name='ai_config[api_key]'][placeholder*='…1234']"
    assert_select "input[name='ai_config[api_key]'][value='secret-token-1234']", 0

    patch ai_settings_path, params: { ai_config: { provider: "vercel", base_url: "https://ai-gateway.vercel.sh/v1", model: "x",
      api_key: "", clear_api_key: "1", language: "Czech" } }
    assert_nil AiConfig.current.api_key
    assert_not AiConfig.current.configured?
  end

  test "settings reject invalid URLs" do
    patch ai_settings_path, params: { ai_config: { provider: "custom", base_url: "ftp://x", model: "llava", language: "English" } }
    assert_response :unprocessable_entity
    assert_select "#ai [role=alert]", /Base url/
  end

  test "item form offers AI fill only when configured" do
    get new_item_path
    assert_select "[data-controller=ai-fill]", 0
    configure
    get new_item_path
    assert_select "[data-controller=ai-fill]", 1
  end

  test "identifies an item with structured output and matches the manufacturer" do
    makita = Manufacturer.create!(name: "Makita")
    Item.create!(name: "Vrtačka Bosch GSR 12V", tag_list: "aku")
    configure
    photo = Upload.store!([ photo_upload ]).first
    answer({ name: "Aku vrtačka Makita DDF485", manufacturer: "MAKITA", model_number: "DDF485", kind: "tool",
      description: "Aku vrtací šroubovák.\n\n**Specifikace**\n- 18 V", tags: [ "Aku", "vrtačka" ], amount: "",
      confidence: "high", notes: "", sources: [] }.to_json)

    post identify_items_path, params: { photos: [ photo, "/etc/passwd" ] }, as: :json
    assert_response :success
    result = response.parsed_body
    assert_equal "Aku vrtačka Makita DDF485", result["name"]
    assert_equal({ "id" => makita.id, "name" => "Makita" }, result["manufacturer"])
    assert_equal %w[aku vrtačka], result["tags"]
    assert_equal "high", result["confidence"]

    request = @requests.sole
    assert_equal "https://ai-gateway.vercel.sh/v1/chat/completions", request[:uri]
    assert_equal "Bearer secret-token-1234", request[:headers]["Authorization"]
    assert_equal "json_schema", request[:body].dig("response_format", "type")
    assert_nil request[:body]["tools"]
    content = request[:body]["messages"].last["content"]
    assert_equal 1, content.count { |part| part["type"] == "image_url" }
    assert content.find { |part| part["type"] == "image_url" }.dig("image_url", "url").start_with?("data:image/png;base64,")
    assert_includes content.first["text"], "Vrtačka Bosch GSR 12V"
    assert_includes request[:body]["messages"].first["content"], "in Czech"
  end

  test "web search uses the provider's search tool and parses loose JSON with citations" do
    configure(provider: "openrouter", web_search: "1")
    photo = Upload.store!([ photo_upload ]).first
    answer("Here you go:\n```json\n#{{ name: "Hřebíky 40 mm", manufacturer: "Würth", model_number: "", kind: "material",
      description: "Hřebíky", tags: [], amount: "100+", confidence: "medium", notes: "Zkontrolujte délku",
      sources: [ { title: "Würth", url: "https://wurth.example/nails" } ] }.to_json}\n```",
      annotations: [ { type: "url_citation", url_citation: { url: "https://shop.example/nails", title: "Shop" } } ])

    post identify_items_path, params: { photos: [ photo ] }, as: :json
    assert_response :success
    result = response.parsed_body
    assert_equal "material", result["kind"]
    assert_equal "100+", result["amount"]
    assert_equal({ "id" => nil, "name" => "Würth" }, result["manufacturer"])
    assert_equal %w[https://wurth.example/nails https://shop.example/nails], result["sources"].pluck("url")

    body = @requests.sole[:body]
    assert_equal [ { "id" => "web", "max_results" => 5 } ], body["plugins"]
    assert_nil body["response_format"]
    assert_equal "https://github.com/parallelo3301/garagio", @requests.sole[:headers]["HTTP-Referer"]
  end

  test "vercel web search sends the perplexity tool" do
    configure(web_search: "1")
    answer({ name: "X", manufacturer: "", model_number: "", kind: "tool", description: "", tags: [], amount: "",
      confidence: "low", notes: "", sources: [] }.to_json)
    post identify_items_path, params: { photos: [ Upload.store!([ photo_upload ]).first ] }, as: :json
    assert_response :success
    assert_equal "vercel:perplexity_search", @requests.sole[:body].dig("tools", 0, "type")
  end

  test "xai web search uses the responses API with citations" do
    configure(provider: "xai", web_search: "1", model: "grok-4.7")
    json = { name: "Šroubovák DeWalt DCF620D2K", manufacturer: "DeWalt", model_number: "DCF620D2K", kind: "tool", description: "",
      tags: [], amount: "", confidence: "high", notes: "", sources: [ "https://www.dewalt.cz/dcf620d2k" ] }.to_json
    @responses << [ 200, { output: [
      { type: "web_search_call" },
      { type: "message", content: [ { type: "output_text", text: json,
        annotations: [ { type: "url_citation", url: "https://shop.example/dcf620", title: "https://shop.example/dcf620" } ] } ] }
    ] }.to_json ]

    post identify_items_path, params: { photos: [ Upload.store!([ photo_upload ]).first ] }, as: :json
    assert_response :success
    assert_equal "DCF620D2K", response.parsed_body["model_number"]
    assert_equal %w[https://www.dewalt.cz/dcf620d2k https://shop.example/dcf620], response.parsed_body["sources"].pluck("url")

    request = @requests.sole
    assert_equal "https://api.x.ai/v1/responses", request[:uri]
    assert_equal [ { "type" => "web_search" } ], request[:body]["tools"]
    assert_equal false, request[:body]["store"]
    assert_includes request[:body]["instructions"], "web search"
    assert_equal %w[input_text input_image], request[:body]["input"].sole["content"].pluck("type")
  end

  test "drops model-stated sources without web search" do
    configure(provider: "xai", model: "grok-4.7")
    answer({ name: "X", manufacturer: "", model_number: "", kind: "tool", description: "", tags: [], amount: "",
      confidence: "low", notes: "", sources: [ { title: "Made up", url: "https://example.com/guess" } ] }.to_json)
    post identify_items_path, params: { photos: [ Upload.store!([ photo_upload ]).first ] }, as: :json
    assert_response :success
    assert_empty response.parsed_body["sources"]
    assert_equal "https://api.x.ai/v1/chat/completions", @requests.sole[:uri]
  end

  test "per-scan web search choice overrides the default" do
    configure(provider: "xai", model: "grok-4.7")
    photo = Upload.store!([ photo_upload ]).first
    body = { name: "X", manufacturer: "", model_number: "", kind: "tool", description: "", tags: [], amount: "",
      confidence: "low", notes: "", sources: [] }.to_json
    @responses << [ 200, { output: [ { type: "message", content: [ { type: "output_text", text: body } ] } ] }.to_json ]
    post identify_items_path, params: { photos: [ photo ], web_search: true }, as: :json
    assert_response :success
    assert_equal "https://api.x.ai/v1/responses", @requests.last[:uri]

    configure(provider: "xai", model: "grok-4.7", web_search: "1")
    answer(body)
    post identify_items_path, params: { photos: [ photo ], web_search: false }, as: :json
    assert_response :success
    assert_equal "https://api.x.ai/v1/chat/completions", @requests.last[:uri]
  end

  test "identify reports provider errors and missing setup" do
    photo = Upload.store!([ photo_upload ]).first
    post identify_items_path, params: { photos: [ photo ] }, as: :json
    assert_response :unprocessable_entity
    assert_match(/not set up/, response.parsed_body["error"])

    configure
    @responses << [ 401, { error: { message: "Invalid key" } }.to_json ]
    post identify_items_path, params: { photos: [ photo ] }, as: :json
    assert_response :unprocessable_entity
    assert_match(/token was rejected/, response.parsed_body["error"])

    post identify_items_path, params: { photos: [] }, as: :json
    assert_match(/Add at least one photo/, response.parsed_body["error"])
  end

  test "falls back to plain JSON when structured output is unsupported" do
    configure
    @responses << [ 400, { error: { message: "response_format json_schema is not supported" } }.to_json ]
    answer('{"name":"Pila","manufacturer":"","model_number":"","kind":"tool","description":"","tags":[],"amount":"","confidence":"low","notes":"","sources":[]}')
    post identify_items_path, params: { photos: [ Upload.store!([ photo_upload ]).first ] }, as: :json
    assert_response :success
    assert_equal "Pila", response.parsed_body["name"]
    assert_equal 2, @requests.size
    assert_nil @requests.last[:body]["response_format"]
  end

  test "lists vision models" do
    configure
    @responses << [ 200, { data: [ { id: "b/vision", tags: [ "vision" ] }, { id: "a/text", tags: [] },
      { id: "a/vision", tags: %w[vision tool-use] } ] }.to_json ]
    get models_ai_settings_path(provider: "vercel", base_url: "https://ai-gateway.vercel.sh/v1")
    assert_equal %w[a/vision b/vision], response.parsed_body["models"]
    assert_equal "https://ai-gateway.vercel.sh/v1/models", @requests.last[:uri]
  end

  test "saving an item creates a manufacturer suggested by AI" do
    post items_path, params: { item: { name: "Pila", kind: "tool", manufacturer_id: "__new__", manufacturer_name: "Festool" } }
    item = Item.last
    assert_equal "Festool", item.manufacturer.name

    post items_path, params: { item: { name: "Pila 2", kind: "tool", manufacturer_id: "__new__", manufacturer_name: "festool" } }
    assert_equal item.manufacturer, Item.last.manufacturer
    assert_equal 1, Manufacturer.count
  end
end
