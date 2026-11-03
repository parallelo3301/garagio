module ApplicationHelper
  NAV_ITEMS = [
    { section: :inventory, label: "Inventory", path: :root_path },
    { section: :wiki, label: "Wiki", path: :wiki_pages_path },
    { section: :settings, label: "Settings", path: :settings_path }
  ].freeze

  def nav_items
    NAV_ITEMS.map { |item| item.merge(url: public_send(item[:path]), active: current_section == item[:section]) }
  end

  def current_section
    case controller_name
    when "wiki_pages" then :wiki
    when "manufacturers" then :settings
    else :inventory
    end
  end

  STATUS_BADGES = {
    "in_stock" => "badge-success", "borrowed" => "badge-warning", "damaged" => "badge-error",
    "maintenance" => "badge-info", "retired" => "badge-ghost"
  }.freeze

  def status_badge_class(status)
    "badge badge-sm badge-soft font-medium whitespace-nowrap #{STATUS_BADGES.fetch(status, 'badge-ghost')}"
  end
end
