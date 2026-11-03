class WikiPage < ApplicationRecord
  has_and_belongs_to_many :items, join_table: :item_wiki_pages

  normalizes :title, with: ->(title) { title.strip }
  normalizes :content, with: ->(content) { content.to_s }, apply_to_nil: true

  validates :title, presence: true, uniqueness: { case_sensitive: false }

  scope :ordered, -> { order(Arel.sql("title COLLATE NOCASE")) }

  def self.search(query)
    return all if query.blank?

    pattern = "%#{sanitize_sql_like(query.strip)}%"
    where("title LIKE :pattern ESCAPE '\\' OR content LIKE :pattern ESCAPE '\\'", pattern:)
  end

  def as_json(*)
    { id:, title:, content: }
  end
end
