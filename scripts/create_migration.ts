const name = Deno.args[0]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
if (!name) throw new Error('Usage: deno task migrate:create <name>');

const directory = new URL('../db/migrations/', import.meta.url);
const files = [];
for await (const entry of Deno.readDir(directory)) if (entry.isFile) files.push(entry.name);
const highest = Math.max(0, ...files.map((file) => Number(/^(\d+)/.exec(file)?.[1] ?? 0)));
const fileName = `${String(highest + 1).padStart(3, '0')}_${name}.sql`;
await Deno.writeTextFile(new URL(fileName, directory), '-- Write this migration as a transactional SQL change.\n');
console.log(`Created db/migrations/${fileName}`);