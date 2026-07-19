import { Database } from 'jsr:@db/sqlite@0.13.0';

export const DATABASE_PATH = new URL('../db.sqlite', import.meta.url).pathname;

export function openDatabase() {
  return new Database(DATABASE_PATH);
}