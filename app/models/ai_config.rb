# Connection settings for AI item recognition. Any OpenAI-compatible chat completions endpoint works;
# presets fill in the URL and a default vision model. The API token is stored encrypted.
class AiConfig
  include ActiveModel::Model
  include ActiveModel::Attributes

  PRESETS = {
    "vercel" => { label: "Vercel AI Gateway", base_url: "https://ai-gateway.vercel.sh/v1", model: "google/gemini-3.8-flash", web_search: true },
    "openrouter" => { label: "OpenRouter", base_url: "https://openrouter.ai/api/v1", model: "google/gemini-3.8-flash", web_search: true },
    "openai" => { label: "OpenAI", base_url: "https://api.openai.com/v1", model: "gpt-6.1-terra" },
    "xai" => { label: "xAI (Grok)", base_url: "https://api.x.ai/v1", model: "grok-4.7", web_search: true },
    "gemini" => { label: "Google Gemini", base_url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash" },
    "custom" => { label: "Custom (OpenAI-compatible, e.g. Ollama)", base_url: "http://localhost:11434/v1", model: "" }
  }.freeze
  LANGUAGES = %w[English Czech Slovak German Polish Spanish French].freeze
  KEYS = %i[provider base_url model web_search language].freeze

  attribute :provider, :string, default: "vercel"
  attribute :base_url, :string
  attribute :model, :string
  attribute :web_search, :boolean, default: false
  attribute :language, :string, default: "English"
  attribute :api_key, :string

  validates :provider, inclusion: { in: PRESETS.keys }
  validates :model, presence: true
  validates :language, presence: true
  validate :base_url_is_http

  def self.current
    stored = Setting.where(key: KEYS.map { |key| "ai_#{key}" }).pluck(:key, :value).to_h { |key, value| [ key.delete_prefix("ai_"), value ] }
    new(**stored.symbolize_keys.compact).tap do |config|
      config.base_url ||= config.preset[:base_url]
      config.model ||= config.preset[:model]
      config.api_key = decrypt(Setting[:ai_api_key])
    end
  end

  def self.encryptor
    ActiveSupport::MessageEncryptor.new(Rails.application.key_generator.generate_key("garagio ai api key", 32))
  end

  def self.decrypt(value)
    encryptor.decrypt_and_verify(value) if value.present?
  rescue ActiveSupport::MessageEncryptor::InvalidMessage
    nil
  end

  # A blank api_key keeps the stored token; clear_api_key removes it.
  def update(attributes)
    attributes = attributes.to_h.symbolize_keys
    new_key = attributes.delete(:api_key).to_s.strip
    clear_key = ActiveModel::Type::Boolean.new.cast(attributes.delete(:clear_api_key))
    assign_attributes(attributes.slice(*KEYS))
    self.base_url = base_url.to_s.strip.delete_suffix("/")
    self.model = model.to_s.strip
    return false unless valid?

    Setting.transaction do
      KEYS.each { |key| Setting["ai_#{key}"] = public_send(key).to_s }
      if new_key.present?
        Setting[:ai_api_key] = self.class.encryptor.encrypt_and_sign(new_key)
        self.api_key = new_key
      elsif clear_key
        Setting.where(key: "ai_api_key").delete_all
        self.api_key = nil
      end
    end
    true
  end

  def preset
    PRESETS.fetch(provider, PRESETS["custom"])
  end

  def configured?
    base_url.present? && model.present? && (api_key.present? || provider == "custom")
  end

  def web_search_supported?
    preset[:web_search] == true
  end

  def web_search?
    web_search_supported? && web_search
  end

  def masked_api_key
    "…#{api_key.last(4)}" if api_key.present?
  end

  private

  def base_url_is_http
    errors.add(:base_url, "must be an http(s) URL") unless base_url.to_s.match?(%r{\Ahttps?://[^\s/]+}i)
  end
end
