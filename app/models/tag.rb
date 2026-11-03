class Tag < ApplicationRecord
  has_and_belongs_to_many :items, join_table: :item_tags

  validates :name, presence: true
end
