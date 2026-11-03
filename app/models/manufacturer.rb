class Manufacturer < ApplicationRecord
  has_many :items, dependent: :nullify

  normalizes :name, with: ->(name) { name.strip }
  normalizes :website, :notes, with: ->(value) { value.strip.presence }

  validates :name, presence: true, uniqueness: { case_sensitive: false }

  scope :ordered, -> { order(Arel.sql("name COLLATE NOCASE")) }

  def as_json(*)
    { id:, name:, website:, notes: }
  end
end
