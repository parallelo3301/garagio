class AiSettingsController < ApplicationController
  def update
    @ai_config = AiConfig.current
    if @ai_config.update(params.expect(ai_config: [ :provider, :base_url, :model, :web_search, :language, :api_key, :clear_api_key ]))
      redirect_to settings_path(anchor: "ai"), notice: "AI settings saved.", status: :see_other
    else
      @manufacturers = Manufacturer.ordered
      @manufacturer = Manufacturer.new
      render "manufacturers/index", status: :unprocessable_entity
    end
  end

  # Vision-capable models offered by the provider, for the model picker.
  def models
    config = AiConfig.current
    config.assign_attributes(params.permit(:provider, :base_url).to_h.compact_blank)
    config.base_url = config.base_url.to_s.delete_suffix("/")
    models = AiClient.new(config).models
    vision = models.select { |model| vision?(model) }
    list = (vision.presence || models).filter_map { |model| model["id"] }.sort
    render json: { models: list }
  rescue AiClient::Error => error
    render json: { error: error.message, models: [] }, status: :unprocessable_entity
  end

  private

  def vision?(model)
    Array(model["tags"]).include?("vision") ||
      Array(model.dig("architecture", "input_modalities")).include?("image")
  end
end
