const sessions = new Set<string>();
const cookieName = 'garagio_session';
import { openDatabase } from '../db/database.ts';

function configuredPassword() {
  const environmentValue = Deno.env.get('ACCESS_PASSWORD');
  if (environmentValue) return environmentValue;
  try {
    const content = Deno.readTextFileSync(`${Deno.cwd()}/.env`);
    const match = /^\s*ACCESS_PASSWORD\s*=\s*(.+?)\s*$/m.exec(content);
    return match?.[1].replace(/^(['"])(.*)\1$/, '$2');
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

function sessionFrom(request: Request) {
  return request.headers.get('cookie')?.split(';').map((value) => value.trim()).find((value) =>
    value.startsWith(`${cookieName}=`)
  )?.slice(cookieName.length + 1);
}

export function isAuthenticated(request: Request) {
  const session = sessionFrom(request);
  return Boolean(session && sessions.has(session));
}

export function passwordMatches(password: string) {
  const configured = configuredPassword();
  return Boolean(configured && password && password === configured);
}

function banExpiry() {
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + 1);
  return expiry.toISOString();
}

export function isIpBanned(ipAddress: string) {
  const database = openDatabase();
  try {
    const attempt = database.prepare<{ banned_until: string | null }>(
      'SELECT banned_until FROM login_attempts WHERE ip_address = ?',
    ).get(ipAddress);
    if (!attempt?.banned_until) return false;
    if (new Date(attempt.banned_until) > new Date()) return true;
    database.prepare('DELETE FROM login_attempts WHERE ip_address = ?').run(ipAddress);
    return false;
  } finally {
    database.close();
  }
}

export function recordFailedLogin(ipAddress: string) {
  const database = openDatabase();
  try {
    const attempt = database.prepare<{ failed_attempts: number }>(
      'SELECT failed_attempts FROM login_attempts WHERE ip_address = ?',
    ).get(ipAddress);
    const failedAttempts = (attempt?.failed_attempts ?? 0) + 1;
    const bannedUntil = failedAttempts >= 5 ? banExpiry() : null;
    database.prepare(
      `INSERT INTO login_attempts (ip_address, failed_attempts, banned_until, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ip_address) DO UPDATE SET failed_attempts=excluded.failed_attempts, banned_until=excluded.banned_until, updated_at=CURRENT_TIMESTAMP`,
    ).run(ipAddress, failedAttempts, bannedUntil);
    return { banned: bannedUntil !== null, bannedUntil };
  } finally {
    database.close();
  }
}

export function clearFailedLogins(ipAddress: string) {
  const database = openDatabase();
  try {
    database.prepare('DELETE FROM login_attempts WHERE ip_address = ?').run(ipAddress);
  } finally {
    database.close();
  }
}

export function createSession() {
  const session = crypto.randomUUID();
  sessions.add(session);
  return `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`;
}

export function clearSession(request: Request) {
  const session = sessionFrom(request);
  if (session) sessions.delete(session);
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
