class Item < ApplicationRecord
  STATUSES = %w[in_stock borrowed damaged maintenance retired].freeze

  belongs_to :manufacturer, optional: true
  has_and_belongs_to_many :tags, -> { order(Arel.sql("name COLLATE NOCASE")) }, join_table: :item_tags
  has_and_belongs_to_many :wiki_pages, -> { ordered }, join_table: :item_wiki_pages

  serialize :photos_json, coder: JSON
  serialize :links_json, coder: JSON
  alias_attribute :photos, :photos_json
  alias_attribute :links, :links_json

  normalizes :name, with: ->(name) { name.strip }
  normalizes :location, :description, with: ->(value) { value.to_s.strip }, apply_to_nil: true
  normalizes :borrowed_to, with: ->(value) { value.strip.presence }

  validates :name, presence: true
  validates :quantity, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :status, inclusion: { in: STATUSES }
  validate :photos_are_uploads, :links_are_web_urls

  before_validation :clean_collections

  scope :ordered, -> { order(Arel.sql("items.name COLLATE NOCASE")) }
  scope :with_details, -> { includes(:manufacturer, :tags, :wiki_pages) }

  def self.search(query)
    terms = query.to_s.downcase.strip
    return all.to_a if terms.empty?

    all.select { |item| item.search_text.include?(terms) }
  end

  def search_text
    [ name, description, location, manufacturer&.name, status, borrowed_to, *tag_names,
      *links.flat_map { |link| [ link["label"], link["url"] ] } ].compact.join(" ").downcase
  end

  def tag_names
    tags.map(&:name)
  end

  def tag_list
    tag_names.join(", ")
  end

  def tag_list=(value)
    names = Array(value.is_a?(String) ? value.split(",") : value).map { |name| name.to_s.strip }.compact_blank
    self.tags = names.uniq(&:downcase).map { |name| Tag.find_or_create_by!(name:) }
  end

  def borrowed?
    status == "borrowed"
  end

  def status_label
    status.tr("_", " ")
  end

  def cover_photo
    photos.first
  end

  def as_json(*)
    {
      id:, name:, description:, quantity:, location:,
      manufacturerId: manufacturer_id, manufacturerName: manufacturer&.name,
      status:, borrowedTo: borrowed_to, borrowedAt: borrowed_at&.iso8601,
      tags: tag_names, photos:, links:, wikiPageIds: wiki_page_ids
    }
  end

  private

  def clean_collections
    self.photos = Array(photos).map(&:to_s).compact_blank.uniq
    self.links = Array(links).filter_map do |link|
      link = link.to_h.stringify_keys
      label, url = link["label"].to_s.strip, link["url"].to_s.strip
      { "label" => label.presence || url, "url" => url } if url.present?
    end
  end

  def photos_are_uploads
    errors.add(:photos, "must be uploaded images") unless photos.all? { |path| Upload.path?(path) }
  end

  def links_are_web_urls
    errors.add(:links, "must start with http:// or https://") unless links.all? { |link| link["url"].match?(%r{\Ahttps?://}i) }
  end
end
