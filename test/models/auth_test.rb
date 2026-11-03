require "test_helper"

class AuthTest < ActiveSupport::TestCase
  test "five failed attempts ban an ip for a month" do
    4.times { assert_not LoginAttempt.record_failure("10.0.0.1") }
    assert_not LoginAttempt.banned?("10.0.0.1")
    assert LoginAttempt.record_failure("10.0.0.1")
    assert LoginAttempt.banned?("10.0.0.1")

    travel 32.days do
      assert_not LoginAttempt.banned?("10.0.0.1")
      assert_not LoginAttempt.exists?("10.0.0.1")
    end
  end

  test "sessions expire after 30 days" do
    session = AuthSession.start("10.0.0.2")
    assert_equal session, AuthSession.authenticate(session.session_id)
    assert_nil AuthSession.authenticate("")

    travel 31.days do
      assert_nil AuthSession.authenticate(session.session_id)
      assert_not AuthSession.exists?(session.session_id)
    end
  end
end
