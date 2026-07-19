import { Database } from 'jsr:@db/sqlite@0.13.0';

export const DATABASE_PATH = `${Deno.cwd()}/db.sqlite`;

export function openDatabase() {
  return new Database(DATABASE_PATH);
}