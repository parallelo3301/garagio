require "test_helper"
require "open3"

# Opening a database created by the original Deno version must keep all data.
class LegacyDatabaseTest < ActiveSupport::TestCase
  parallelize(workers: 1)

  test "db:prepare adopts a legacy database" do
    Dir.mktmpdir do |dir|
      db = SQLite3::Database.new(File.join(dir, "db.sqlite"))
      db.execute_batch(file_fixture("legacy_schema.sql").read)
      db.execute_batch(<<~SQL)
        INSERT INTO manufacturers (id, name) VALUES (1, 'Bosch');
        INSERT INTO items (id, name, quantity, manufacturer_id, status, borrowed_to, borrowed_at, photos_json, links_json, created_at)
          VALUES (7, 'Drill', 2, 1, 'borrowed', 'Ann', '2024-05-01', '["/uploads/00000000-0000-0000-0000-000000000000.png"]',
                  '[{"label":"Docs","url":"https://example.com"}]', '2024-01-02T03:04:05.000Z');
        INSERT INTO tags (id, name) VALUES (1, 'power');
        INSERT INTO item_tags VALUES (7, 1);
        INSERT INTO wiki_pages (id, title, content) VALUES (3, 'Bits', '# Bits');
        INSERT INTO item_wiki_pages VALUES (7, 3);
        INSERT INTO login_attempts (ip_address, failed_attempts) VALUES ('10.0.0.1', 2);
      SQL
      db.close

      env = { "RAILS_ENV" => "development", "GARAGIO_DATA_DIR" => dir }
      script = <<~RUBY
        item = Item.find(7)
        puts [ item.name, item.quantity, item.manufacturer.name, item.borrowed_to, item.borrowed_at.to_s, item.created_at.year,
          item.tag_list, item.photos.size, item.links.first["label"], item.wiki_pages.first.title,
          LoginAttempt.find("10.0.0.1").failed_attempts ].join("|")
        puts ActiveRecord::Base.connection.tables.grep(/legacy|\\Amigrations\\z/).inspect
      RUBY
      output, status = Open3.capture2e(env, "bin/rails", "db:prepare", chdir: Rails.root.to_s)
      assert status.success?, output
      output, status = Open3.capture2e(env, "bin/rails", "runner", script, chdir: Rails.root.to_s)
      assert status.success?, output
      assert_equal "Drill|2|Bosch|Ann|2024-05-01|2024|power|1|Docs|Bits|2\n[]\n", output
    end
  end
end
