require "test_helper"

class MarkdownHelperTest < ActionView::TestCase
  test "renders GFM, strips raw html and hardens external links" do
    html = markdown("# Title\n\n<script>alert(1)</script>\n\n[ext](https://example.com) ![img](/uploads/a.png)\n\n- [ ] task")
    assert_includes html, "<h1>Title</h1>"
    assert_not_includes html, "<script>"
    assert_includes html, 'target="_blank"'
    assert_includes html, 'rel="noreferrer"'
    assert_includes html, 'loading="lazy"'
    assert_includes html, 'type="checkbox"'
    assert html.html_safe?
  end

  test "drops javascript links" do
    assert_not_includes markdown("[x](javascript:alert(1))"), "javascript:"
  end
end
