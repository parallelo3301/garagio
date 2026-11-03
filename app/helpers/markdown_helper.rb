module MarkdownHelper
  MARKDOWN_OPTIONS = {
    parse: { smart: false },
    render: { unsafe: false, hardbreaks: true, escape: true },
    extension: { autolink: true, strikethrough: true, table: true, tasklist: true, tagfilter: true, header_ids: nil }
  }.freeze

  # GitHub-flavoured Markdown; raw HTML is escaped and unsafe URLs are dropped by Commonmarker.
  def markdown(text)
    html = Commonmarker.to_html(text.to_s, options: MARKDOWN_OPTIONS, plugins: { syntax_highlighter: nil })
    fragment = Nokogiri::HTML5.fragment(html)
    fragment.css("a[href]").each do |link|
      next if link["href"].start_with?("/", "#")

      link["target"] = "_blank"
      link["rel"] = "noreferrer"
    end
    fragment.css("img").each { |image| image["loading"] = "lazy" }
    fragment.to_html.html_safe # rubocop:disable Rails/OutputSafety
  end
end
