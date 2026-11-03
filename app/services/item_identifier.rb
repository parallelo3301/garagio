# Identifies a tool or material from item photos with a vision model and returns form-ready attributes.
class ItemIdentifier
  class Error < StandardError; end

  MAX_PHOTOS = 4
  MAX_PHOTO_BYTES = 8.megabytes

  SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: %w[name manufacturer model_number kind description tags amount confidence notes sources],
    properties: {
      name: { type: "string", description: "Short item name, e.g. product type + brand + model number" },
      manufacturer: { type: "string", description: "Brand as commonly written, empty if unknown" },
      model_number: { type: "string", description: "Exact model / type number, empty if unknown" },
      kind: { type: "string", enum: %w[tool material] },
      description: { type: "string", description: "Markdown description" },
      tags: { type: "array", items: { type: "string" } },
      amount: { type: "string", description: "Rough amount for materials, otherwise empty" },
      confidence: { type: "string", enum: %w[high medium low] },
      notes: { type: "string", description: "What is uncertain or should be checked, empty if nothing" },
      sources: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: %w[title url],
                 properties: { title: { type: "string" }, url: { type: "string" } } }
      }
    }
  }.freeze

  def initialize(config: AiConfig.current, client: nil)
    @config = config
    @client = client || AiClient.new(config)
  end

  # web_search: nil uses the configured default; it only applies when the provider supports search.
  def identify(photo_paths, hint: nil, web_search: nil)
    @web_search = config.web_search_supported? && (web_search.nil? ? config.web_search : web_search)
    raise Error, "AI recognition is not set up. Add an API token in Settings." unless config.configured?

    images = photo_paths.filter_map { |path| data_url(path) }.first(MAX_PHOTOS)
    raise Error, "Add at least one photo first." if images.empty?

    text, annotations = xai_web_search? ? search_with_responses(images, hint) : chat(images, hint)
    normalize(parse(text), citations(annotations))
  rescue AiClient::Error => error
    raise Error, error.message
  end

  private

  attr_reader :config, :client

  def chat(images, hint)
    message = chat_request(images, hint).dig("choices", 0, "message") || {}
    [ message["content"], message["annotations"] ]
  end

  # xAI offers web search only through its Responses API.
  def web_search?
    @web_search
  end

  def xai_web_search?
    web_search? && config.provider == "xai"
  end

  def search_with_responses(images, hint)
    response = client.responses(
      model: config.model,
      instructions: system_prompt,
      input: [ { role: "user", content: [ { type: "input_text", text: user_prompt(hint) }, *images.map { |url| { type: "input_image", image_url: url } } ] } ],
      tools: [ { type: "web_search" } ],
      # The default (high) effort takes over a minute with search; low is just as accurate at reading type plates.
      reasoning: { effort: "low" },
      store: false
    )
    parts = Array(response["output"]).select { |item| item["type"] == "message" }.flat_map { |item| Array(item["content"]) }
      .select { |part| part["type"] == "output_text" }
    [ parts.map { |part| part["text"] }.join, parts.flat_map { |part| Array(part["annotations"]) } + Array(response["citations"]) ]
  end

  def chat_request(images, hint)
    payload = {
      model: config.model,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: [ { type: "text", text: user_prompt(hint) }, *images.map { |url| { type: "image_url", image_url: { url: } } } ] }
      ]
    }
    if web_search?
      # Search tools and strict JSON output don't combine reliably across models; the prompt asks for JSON instead.
      payload.merge!(web_search_options)
      client.chat(payload)
    else
      begin
        client.chat(payload.merge(response_format: { type: "json_schema", json_schema: { name: "item", strict: true, schema: SCHEMA } }))
      rescue AiClient::Error => error
        raise unless error.message.match?(/response_format|json_schema|structured/i)

        client.chat(payload)
      end
    end
  end

  def web_search_options
    case config.provider
    when "openrouter" then { plugins: [ { id: "web", max_results: 5 } ] }
    when "vercel" then { tools: [ { type: "vercel:perplexity_search", config: { max_results: 5 } } ] }
    else {}
    end
  end

  def system_prompt
    <<~PROMPT
      You catalogue items for a home workshop inventory. From the photos, identify the exact product:
      read brand logos, type plates, labels, model numbers and packaging text.
      #{web_search? ? "Use web search to confirm the exact model and its key specifications, and list the pages you used as sources." : "You have no web access: only state specifications you are confident about."}

      Rules:
      - Write the name, description, tags and notes in #{config.language}. Keep brand names and model numbers exactly as printed.
      - name: short and specific, like "<product type> <brand> <model>". Follow the naming style of existing items when given.
      - kind: "tool" for tools, machines and equipment; "material" for consumables (screws, nails, glue, sandpaper, wood...).
      - amount: for materials only, a rough amount if visible (e.g. "100+", "half a box"); otherwise "".
      - description: Markdown. One or two sentences about what it is and what it's for, then a bold "Specifications" heading (translated) and a bullet list
        of key specs (power, voltage, capacity, dimensions...) and accessories visible in the photos. Never invent specifications.
      - manufacturer: prefer the exact spelling of a known manufacturer when it matches.
      - tags: 1–4 short lowercase tags; prefer existing tags when they fit.
      - confidence: "high" only when the model number is readable or confirmed.
      - If you cannot identify the product, describe what is visible, set confidence to "low" and explain in notes.

      Answer with a single JSON object only, no other text, with keys:
      name, manufacturer, model_number, kind, description, tags (array), amount, confidence (high|medium|low), notes,
      sources (array of {title, url}#{web_search? ? " of pages you used" : "; always empty"}).
    PROMPT
  end

  def user_prompt(hint)
    context = []
    context << "Known manufacturers: #{Manufacturer.ordered.pluck(:name).join(", ")}" if Manufacturer.exists?
    tags = Tag.order(Arel.sql("name COLLATE NOCASE")).limit(60).pluck(:name)
    context << "Existing tags: #{tags.join(", ")}" if tags.any?
    names = Item.order(updated_at: :desc).limit(12).pluck(:name)
    context << "Existing item names (naming style):\n#{names.map { |name| "- #{name}" }.join("\n")}" if names.any?
    context << "Hint from the user: #{hint}" if hint.present?
    [ "Identify the item in these photos.", *context ].join("\n\n")
  end

  def data_url(path)
    return unless Upload.path?(path)

    filename = path.delete_prefix("/uploads/")
    file = Upload.file_for(filename)
    return if file.nil? || file.size > MAX_PHOTO_BYTES

    "data:#{Upload.content_type_for(filename)};base64,#{Base64.strict_encode64(file.binread)}"
  end

  def parse(content)
    text = Array(content).map { |part| part.is_a?(Hash) ? part["text"] : part }.join if content.is_a?(Array)
    text ||= content.to_s
    json = text[/\{.*\}/m]
    raise Error, "The AI answer could not be read. Try again or choose another model." unless json

    JSON.parse(json)
  rescue JSON::ParserError
    raise Error, "The AI answer could not be read. Try again or choose another model."
  end

  def citations(annotations)
    Array(annotations).filter_map { |annotation| source(annotation.is_a?(Hash) ? annotation["url_citation"] || annotation : annotation) }
  end

  def source(value)
    title, url = value.is_a?(Hash) ? [ value["title"], value["url"] ] : [ nil, value ]
    url = url.to_s.strip
    { title: title.to_s.strip.presence || url, url: } if url.match?(%r{\Ahttps?://\S+\z}i)
  end

  def normalize(result, citations)
    manufacturer_name = result["manufacturer"].to_s.strip
    manufacturer = match_manufacturer(manufacturer_name)
    # Without web access, models tend to make up plausible-looking links, so only searched sources are kept.
    stated = web_search? ? Array(result["sources"]).filter_map { |value| source(value) } : []
    sources = (stated + citations).uniq { |value| value[:url] }.first(6)
    {
      name: result["name"].to_s.strip.truncate(200),
      kind: Item::KINDS.include?(result["kind"]) ? result["kind"] : "tool",
      description: result["description"].to_s.strip,
      tags: Array(result["tags"]).map { |tag| tag.to_s.strip.downcase.tr(",", " ") }.compact_blank.uniq.first(6),
      amount: result["amount"].to_s.strip.truncate(60),
      manufacturer: manufacturer_name.presence && { id: manufacturer&.id, name: manufacturer&.name || manufacturer_name },
      model_number: result["model_number"].to_s.strip,
      confidence: %w[high medium low].include?(result["confidence"]) ? result["confidence"] : "low",
      notes: result["notes"].to_s.strip,
      sources:,
      model: config.model
    }
  end

  def match_manufacturer(name)
    return if name.blank?

    key = ->(value) { value.downcase.gsub(/[^[:alnum:]]/, "") }
    Manufacturer.all.find { |manufacturer| key.(manufacturer.name) == key.(name) }
  end
end
