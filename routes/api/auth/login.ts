import type { HandlerContext } from '$fresh/server.ts';
import {
  clearFailedLogins,
  createSession,
  isIpBanned,
  passwordMatches,
  recordFailedLogin,
} from '../../../config/auth.ts';

export const handler = {
  async POST(request: Request, context: HandlerContext) {
    const ipAddress = context.remoteAddr.hostname;
    if (isIpBanned(ipAddress)) {
      return Response.json({ error: 'Too many failed attempts. Try again in one month.' }, {
        status: 429,
      });
    }
    const { password } = await request.json().catch(() => ({})) as { password?: unknown };
    if (typeof password !== 'string' || !passwordMatches(password)) {
      const result = recordFailedLogin(ipAddress);
      return Response.json(
        {
          error: result.banned
            ? 'Too many failed attempts. Try again in one month.'
            : 'Incorrect password',
        },
        { status: result.banned ? 429 : 401 },
      );
    }
    clearFailedLogins(ipAddress);
    return Response.json({ authenticated: true }, { headers: { 'set-cookie': createSession() } });
  },
};
