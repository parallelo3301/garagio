require "test_helper"

class WikiPageTest < ActiveSupport::TestCase
  test "titles are required and unique ignoring case" do
    WikiPage.create!(title: "Drill bits")
    assert_not WikiPage.new(title: " drill BITS ").valid?
    assert_not WikiPage.new(title: "").valid?
  end

  test "search matches title and content and escapes LIKE wildcards" do
    page = WikiPage.create!(title: "Glue", content: "Use 100% epoxy")
    WikiPage.create!(title: "Other", content: "nothing")
    assert_equal [ page ], WikiPage.search("epoxy").to_a
    assert_equal [ page ], WikiPage.search("100%").to_a
    assert_equal [], WikiPage.search("_x_").to_a
  end
end
