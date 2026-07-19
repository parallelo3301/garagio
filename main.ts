import { start } from '$fresh/server.ts';
import manifest from './fresh.gen.ts';
import { migrate } from './db/migrate.ts';
import { loadEnvironmentFile } from './config/env.ts';

await loadEnvironmentFile();
await migrate();
await start(manifest);