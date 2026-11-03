# Creates the Garagio schema. When pointed at a database created by the former Deno version of
# Garagio (recognised by its `migrations` bookkeeping table), the legacy tables are rebuilt with
# Rails column types and all data, including sessions and login bans, is carried over.
class CreateGaragioSchema < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  LEGACY_TABLES = %w[manufacturers items tags item_tags wiki_pages item_wiki_pages login_attempts auth_sessions].freeze

  def up
    legacy = table_exists?(:migrations) && table_exists?(:items)
    execute "PRAGMA foreign_keys = OFF"
    transaction do
      LEGACY_TABLES.each { |table| rename_table table, "legacy_#{table}" } if legacy
      create_schema
      if legacy
        copy_legacy_data
        LEGACY_TABLES.reverse_each { |table| drop_table "legacy_#{table}" }
        drop_table :migrations
      end
    end
  ensure
    execute "PRAGMA foreign_keys = ON"
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end

  private

  def create_schema
    create_table :manufacturers do |t|
      t.string :name, null: false, index: { unique: true }
      t.string :website
      t.text :notes
      t.datetime :created_at, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end

    create_table :items do |t|
      t.string :name, null: false, index: true
      t.text :description, null: false, default: ""
      t.integer :quantity, null: false, default: 0
      t.string :location, null: false, default: "", index: true
      t.references :manufacturer, foreign_key: { on_delete: :nullify }
      t.string :status, null: false, default: "in_stock"
      t.string :borrowed_to
      t.date :borrowed_at
      t.text :photos_json, null: false, default: "[]"
      t.text :links_json, null: false, default: "[]"
      t.timestamps default: -> { "CURRENT_TIMESTAMP" }
      t.check_constraint "quantity >= 0", name: "items_quantity_non_negative"
    end

    create_table :tags do |t|
      t.string :name, null: false, collation: "NOCASE", index: { unique: true }
    end

    create_table :item_tags, primary_key: %i[item_id tag_id] do |t|
      t.references :item, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :tag, null: false, foreign_key: { on_delete: :cascade }
    end

    create_table :wiki_pages do |t|
      t.string :title, null: false, index: { unique: true }
      t.text :content, null: false, default: ""
      t.timestamps default: -> { "CURRENT_TIMESTAMP" }
    end

    create_table :item_wiki_pages, primary_key: %i[item_id wiki_page_id] do |t|
      t.references :item, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :wiki_page, null: false, foreign_key: { on_delete: :cascade }
    end

    create_table :login_attempts, primary_key: :ip_address, id: :string do |t|
      t.integer :failed_attempts, null: false, default: 0
      t.datetime :banned_until
      t.datetime :updated_at, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end

    create_table :auth_sessions, primary_key: :session_id, id: :string do |t|
      t.string :ip_address, null: false
      t.datetime :expires_at, null: false, index: true
      t.datetime :created_at, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end
  end

  # Legacy timestamps are SQLite CURRENT_TIMESTAMP text or ISO-8601 strings; normalise them to the
  # format Rails writes so that SQL comparisons keep working.
  def timestamp(column)
    "strftime('%Y-%m-%d %H:%M:%f', #{column})"
  end

  def copy_legacy_data
    execute <<~SQL
      INSERT INTO manufacturers (id, name, website, notes, created_at)
      SELECT id, name, website, notes, #{timestamp('created_at')} FROM legacy_manufacturers
    SQL
    execute <<~SQL
      INSERT INTO items (id, name, description, quantity, location, manufacturer_id, status, borrowed_to,
        borrowed_at, photos_json, links_json, created_at, updated_at)
      SELECT id, name, description, quantity, location,
        CASE WHEN manufacturer_id IN (SELECT id FROM legacy_manufacturers) THEN manufacturer_id END,
        status, borrowed_to, NULLIF(borrowed_at, ''), photos_json, links_json,
        #{timestamp('created_at')}, #{timestamp('updated_at')}
      FROM legacy_items
    SQL
    execute "INSERT INTO tags (id, name) SELECT id, name FROM legacy_tags"
    execute <<~SQL
      INSERT INTO item_tags (item_id, tag_id)
      SELECT item_id, tag_id FROM legacy_item_tags
      WHERE item_id IN (SELECT id FROM items) AND tag_id IN (SELECT id FROM tags)
    SQL
    execute <<~SQL
      INSERT INTO wiki_pages (id, title, content, created_at, updated_at)
      SELECT id, title, content, #{timestamp('created_at')}, #{timestamp('updated_at')} FROM legacy_wiki_pages
    SQL
    execute <<~SQL
      INSERT INTO item_wiki_pages (item_id, wiki_page_id)
      SELECT item_id, wiki_page_id FROM legacy_item_wiki_pages
      WHERE item_id IN (SELECT id FROM items) AND wiki_page_id IN (SELECT id FROM wiki_pages)
    SQL
    execute <<~SQL
      INSERT INTO login_attempts (ip_address, failed_attempts, banned_until, updated_at)
      SELECT ip_address, failed_attempts, #{timestamp('banned_until')}, #{timestamp('updated_at')} FROM legacy_login_attempts
    SQL
    execute <<~SQL
      INSERT INTO auth_sessions (session_id, ip_address, expires_at, created_at)
      SELECT session_id, ip_address, #{timestamp('expires_at')}, #{timestamp('created_at')} FROM legacy_auth_sessions
    SQL
  end
end
