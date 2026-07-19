import type { MiddlewareHandler } from '$fresh/server.ts';
import { isAuthenticated } from '../config/auth.ts';

const publicPaths = new Set(['/api/auth/login', '/api/auth/logout', '/styles.css']);

export const handler: MiddlewareHandler = (request, context) => {
  const path = new URL(request.url).pathname;
  if (publicPaths.has(path) || path.startsWith('/_frsh/')) return context.next();
  if (path.startsWith('/api/') || path.startsWith('/uploads/')) {
    if (!isAuthenticated(request)) return Response.json({ error: 'Authentication required' }, { status: 401 });
  }
  return context.next();
};