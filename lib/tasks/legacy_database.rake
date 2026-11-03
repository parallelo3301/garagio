namespace :garagio do
  # A database created by the original Deno version has its own `migrations` table but no
  # `schema_migrations`. db:prepare would treat it as empty and load db/schema.rb over it, wiping the
  # data, so mark it as migratable instead; the first migration then adopts the legacy tables.
  desc "Prepare a database created by the original Deno version for Rails migrations"
  task adopt_legacy_database: :environment do
    pool = ActiveRecord::Base.connection_pool
    next unless File.exist?(pool.db_config.database)

    pool.with_connection do |connection|
      legacy = connection.table_exists?("migrations") && connection.table_exists?("items")
      pool.schema_migration.create_table if legacy && !pool.schema_migration.table_exists?
    end
  end
end

Rake::Task["db:prepare"].enhance([ "garagio:adopt_legacy_database" ]) if Rake::Task.task_defined?("db:prepare")
