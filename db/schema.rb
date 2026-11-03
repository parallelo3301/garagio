# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_03_160000) do
  create_table "auth_sessions", primary_key: "session_id", id: :string, force: :cascade do |t|
    t.string "ip_address", null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.index ["expires_at"], name: "index_auth_sessions_on_expires_at"
  end

  create_table "item_tags", primary_key: ["item_id", "tag_id"], force: :cascade do |t|
    t.integer "item_id", null: false
    t.integer "tag_id", null: false
    t.index ["tag_id"], name: "index_item_tags_on_tag_id"
  end

  create_table "item_wiki_pages", primary_key: ["item_id", "wiki_page_id"], force: :cascade do |t|
    t.integer "item_id", null: false
    t.integer "wiki_page_id", null: false
    t.index ["wiki_page_id"], name: "index_item_wiki_pages_on_wiki_page_id"
  end

  create_table "items", force: :cascade do |t|
    t.string "name", null: false
    t.text "description", default: "", null: false
    t.integer "quantity", default: 0, null: false
    t.string "location", default: "", null: false
    t.integer "manufacturer_id"
    t.string "status", default: "in_stock", null: false
    t.string "borrowed_to"
    t.date "borrowed_at"
    t.text "photos_json", default: "[]", null: false
    t.text "links_json", default: "[]", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.index ["location"], name: "index_items_on_location"
    t.index ["manufacturer_id"], name: "index_items_on_manufacturer_id"
    t.index ["name"], name: "index_items_on_name"
    t.check_constraint "quantity >= 0", name: "items_quantity_non_negative"
  end

  create_table "login_attempts", primary_key: "ip_address", id: :string, force: :cascade do |t|
    t.integer "failed_attempts", default: 0, null: false
    t.datetime "banned_until"
    t.datetime "updated_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
  end

  create_table "manufacturers", force: :cascade do |t|
    t.string "name", null: false
    t.string "website"
    t.text "notes"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.index ["name"], name: "index_manufacturers_on_name", unique: true
  end

  create_table "tags", force: :cascade do |t|
    t.string "name", null: false, collation: "NOCASE"
    t.index ["name"], name: "index_tags_on_name", unique: true
  end

  create_table "wiki_pages", force: :cascade do |t|
    t.string "title", null: false
    t.text "content", default: "", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.index ["title"], name: "index_wiki_pages_on_title", unique: true
  end

  add_foreign_key "item_tags", "items", on_delete: :cascade
  add_foreign_key "item_tags", "tags", on_delete: :cascade
  add_foreign_key "item_wiki_pages", "items", on_delete: :cascade
  add_foreign_key "item_wiki_pages", "wiki_pages", on_delete: :cascade
  add_foreign_key "items", "manufacturers", on_delete: :nullify
end
