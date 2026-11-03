require "net/http"

# Minimal client for OpenAI-compatible APIs (chat completions, responses and model listing).
class AiClient
  class Error < StandardError; end

  OPEN_TIMEOUT = 10
  READ_TIMEOUT = 90

  # Tests replace this with a lambda(method, uri, headers, body) returning [status, body].
  cattr_accessor :transport

  def initialize(config)
    @config = config
  end

  def chat(payload)
    request(:post, "chat/completions", payload)
  end

  def responses(payload)
    request(:post, "responses", payload)
  end

  def models
    Array(request(:get, "models")["data"])
  end

  private

  attr_reader :config

  def request(method, path, payload = nil)
    uri = URI.join("#{config.base_url}/", path)
    headers = { "Content-Type" => "application/json", "Accept" => "application/json" }
    headers["Authorization"] = "Bearer #{config.api_key}" if config.api_key.present?
    headers.merge!("HTTP-Referer" => "https://github.com/parallelo3301/garagio", "X-Title" => "Garagio") if config.provider == "openrouter"
    status, body = perform(method, uri, headers, payload&.to_json)
    parsed = JSON.parse(body.presence || "{}") rescue {}
    raise Error, error_message(status, parsed, body) unless (200..299).cover?(status)

    parsed
  rescue Timeout::Error, Net::OpenTimeout, Net::ReadTimeout
    raise Error, "The AI service did not answer in time. Try again or choose a faster model."
  rescue SocketError, SystemCallError, OpenSSL::SSL::SSLError, IOError => error
    raise Error, "Could not reach #{uri&.host}: #{error.message}"
  end

  def perform(method, uri, headers, body)
    return transport.call(method, uri, headers, body) if transport

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = OPEN_TIMEOUT
    http.read_timeout = READ_TIMEOUT
    request = (method == :post ? Net::HTTP::Post : Net::HTTP::Get).new(uri, headers)
    request.body = body if body
    response = http.request(request)
    [ response.code.to_i, response.body.to_s ]
  end

  def error_message(status, parsed, body)
    detail = parsed.dig("error", "message") || parsed["error"].presence&.then { |error| error.is_a?(String) ? error : nil } || body.to_s.truncate(200)
    case status
    when 401, 403 then "The API token was rejected (#{status}). Check it in Settings."
    when 404 then "Not found (404): check the API URL and model name. #{detail}".strip
    when 429 then "Rate limited or out of credits (429). #{detail}".strip
    else "AI request failed (#{status}): #{detail}"
    end
  end
end
