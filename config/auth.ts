import { openDatabase } from '../db/database.ts';

const cookieName = 'garagio_session';
const sessionLifetimeSeconds = 60 * 60 * 24 * 30;

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

export function clientIp(request: Request, directIpAddress: string) {
  if (Deno.env.get('TRUST_PROXY') !== 'true') return directIpAddress;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || directIpAddress;
}

export function isAuthenticated(request: Request) {
  const session = sessionFrom(request);
  if (!session) return false;
  const database = openDatabase();
  try {
    const storedSession = database.prepare<{ expires_at: string }>(
      'SELECT expires_at FROM auth_sessions WHERE session_id = ?',
    ).get(session);
    if (storedSession && new Date(storedSession.expires_at) > new Date()) return true;
    database.prepare('DELETE FROM auth_sessions WHERE session_id = ?').run(session);
    return false;
  } finally {
    database.close();
  }
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

export function createSession(ipAddress: string) {
  const session = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000).toISOString();
  const database = openDatabase();
  try {
    database.prepare(
      'INSERT INTO auth_sessions (session_id, ip_address, expires_at) VALUES (?, ?, ?)',
    ).run(session, ipAddress, expiresAt);
  } finally {
    database.close();
  }
  return `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetimeSeconds}`;
}

export function clearSession(request: Request) {
  const session = sessionFrom(request);
  if (session) {
    const database = openDatabase();
    try {
      database.prepare('DELETE FROM auth_sessions WHERE session_id = ?').run(session);
    } finally {
      database.close();
    }
  }
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
