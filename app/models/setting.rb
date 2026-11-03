# Key/value application settings stored in the database.
class Setting < ApplicationRecord
  validates :key, presence: true, uniqueness: true

  def self.[](key)
    find_by(key: key.to_s)&.value
  end

  def self.[]=(key, value)
    find_or_initialize_by(key: key.to_s).update!(value:)
  end
end
