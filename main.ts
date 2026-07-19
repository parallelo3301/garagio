import { start } from '$fresh/server.ts';
import manifest from './fresh.gen.ts';
import { migrate } from './db/migrate.ts';

await migrate();
await start(manifest);