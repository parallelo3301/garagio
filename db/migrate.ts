import { openDatabase } from './database.ts';

const migrationsDirectory = new URL('./migrations/', import.meta.url);

function migrationVersion(fileName: string) {
  const match = /^(\d+)_.*\.sql$/.exec(fileName);
  return match ? Number(match[1]) : undefined;
}

export async function migrate() {
  const migrations: Array<{ version: number; file: URL }> = [];
  for await (const entry of Deno.readDir(migrationsDirectory)) {
    const version = entry.isFile ? migrationVersion(entry.name) : undefined;
    if (version !== undefined) migrations.push({ version, file: new URL(entry.name, migrationsDirectory) });
  }
  migrations.sort((left, right) => left.version - right.version);

  const database = openDatabase();
  try {
    database.exec('CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    const applied = new Set(
      database.prepare<{ version: number }>('SELECT version FROM migrations').all().map(({ version }) => version),
    );
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      const sql = await Deno.readTextFile(migration.file);
      database.transaction(() => {
        database.exec(sql);
        database.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(
          migration.version,
          new Date().toISOString(),
        );
      })();
    }
  } finally {
    database.close();
  }
}