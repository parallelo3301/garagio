export async function loadEnvironmentFile() {
  if (Deno.env.get('ACCESS_PASSWORD')) return;
  try {
    const content = await Deno.readTextFile(`${Deno.cwd()}/.env`);
    const match = /^\s*ACCESS_PASSWORD\s*=\s*(.+?)\s*$/m.exec(content);
    if (!match) return;
    const value = match[1].replace(/^(['"])(.*)\1$/, '$2');
    Deno.env.set('ACCESS_PASSWORD', value);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}