# Tracks failed password attempts per client IP; five failures ban the IP for a month.
class LoginAttempt < ApplicationRecord
  self.primary_key = :ip_address

  MAX_FAILED_ATTEMPTS = 5
  BAN_DURATION = 1.month

  def self.banned?(ip_address)
    attempt = find_by(ip_address:)
    return false unless attempt&.banned_until
    return true if attempt.banned_until.future?

    attempt.destroy
    false
  end

  # Returns true when this failure caused a ban.
  def self.record_failure(ip_address)
    attempt = find_or_initialize_by(ip_address:)
    attempt.failed_attempts += 1
    attempt.banned_until = BAN_DURATION.from_now if attempt.failed_attempts >= MAX_FAILED_ATTEMPTS
    attempt.save!
    attempt.banned_until.present?
  end

  def self.clear(ip_address)
    where(ip_address:).delete_all
  end
end
