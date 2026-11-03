# Recognizes an item from its photos with the configured AI model.
class ItemIdentificationsController < ApplicationController
  def create
    photos = Array(params[:photos]).map(&:to_s).select { |path| Upload.path?(path) }
    web_search = ActiveModel::Type::Boolean.new.cast(params[:web_search]) unless params[:web_search].nil?
    render json: ItemIdentifier.new.identify(photos, hint: params[:hint].to_s.truncate(300), web_search:)
  rescue ItemIdentifier::Error => error
    render json: { error: error.message }, status: :unprocessable_entity
  end
end
