import { clearSession } from '../../../config/auth.ts';

export const handler = {
  POST(request: Request) {
    return Response.json({ authenticated: false }, { headers: { 'set-cookie': clearSession(request) } });
  },
};