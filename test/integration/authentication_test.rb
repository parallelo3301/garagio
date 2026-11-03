require "test_helper"

class AuthenticationTest < ActionDispatch::IntegrationTest
  test "pages redirect to login and api returns 401 when signed out" do
    get root_path
    assert_redirected_to login_path
    get api_items_path
    assert_response :unauthorized
    assert_equal "Authentication required", response.parsed_body["error"]
    get upload_path("#{SecureRandom.uuid}.png")
    assert_response :unauthorized
  end

  test "health check is public" do
    get rails_health_check_path
    assert_response :success
  end

  test "login sets a strict httponly session cookie and logout clears it" do
    get login_path
    assert_response :success
    post login_path, params: { password: PASSWORD }
    assert_redirected_to root_path
    cookie = response.headers["Set-Cookie"].then { |value| Array(value).join("\n") }
    assert_match(/garagio_session=/, cookie)
    assert_match(/httponly/i, cookie)
    assert_match(/samesite=strict/i, cookie)
    get root_path
    assert_response :success

    delete logout_path
    assert_redirected_to login_path
    get root_path
    assert_redirected_to login_path
  end

  test "wrong passwords are rejected and ban after five attempts" do
    4.times do
      post login_path, params: { password: "nope" }
      assert_response :unauthorized
      assert_match "Incorrect password", response.body
    end
    post login_path, params: { password: "nope" }
    assert_response :too_many_requests
    post login_path, params: { password: PASSWORD }
    assert_response :too_many_requests
  end

  test "forwarded headers only count with TRUST_PROXY" do
    5.times { post login_path, params: { password: "nope" }, headers: { "X-Forwarded-For" => "203.0.113.9" } }
    assert LoginAttempt.banned?("127.0.0.1")
    assert_not LoginAttempt.exists?("203.0.113.9")

    LoginAttempt.delete_all
    Rails.configuration.x.trust_proxy = true
    post login_path, params: { password: "nope" }, headers: { "X-Forwarded-For" => "203.0.113.9, 10.0.0.1" }
    assert LoginAttempt.exists?("203.0.113.9")
  ensure
    Rails.configuration.x.trust_proxy = false
  end

  test "api login and logout" do
    post api_auth_login_path, params: { password: "nope" }, as: :json
    assert_response :unauthorized
    post api_auth_login_path, params: { password: PASSWORD }, as: :json
    assert_equal({ "authenticated" => true }, response.parsed_body)
    get api_items_path
    assert_response :success
    post api_auth_logout_path
    assert_equal({ "authenticated" => false }, response.parsed_body)
    get api_items_path
    assert_response :unauthorized
  end
end
