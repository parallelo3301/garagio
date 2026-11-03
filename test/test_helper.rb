ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

Rails.configuration.x.access_password = "test-password"
Rails.configuration.x.trust_proxy = false

module ActiveSupport
  class TestCase
    parallelize(workers: :number_of_processors)
  end
end

class ActionDispatch::IntegrationTest
  PASSWORD = "test-password"

  def sign_in
    post login_path, params: { password: PASSWORD }
    assert_redirected_to root_path
  end

  def photo_upload
    fixture_file_upload("photo.png", "image/png")
  end
end
