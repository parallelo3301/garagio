# Server-side login sessions; they survive restarts and expire after 30 days.
class AuthSession < ApplicationRecord
  self.primary_key = :session_id

  LIFETIME = 30.days

  scope :active, -> { where(expires_at: Time.current..) }

  def self.start(ip_address)
    create!(session_id: SecureRandom.uuid, ip_address:, expires_at: LIFETIME.from_now)
  end

  def self.authenticate(session_id)
    return if session_id.blank?

    session = find_by(session_id:)
    return session if session&.expires_at&.future?

    session&.destroy
    nil
  end
end
