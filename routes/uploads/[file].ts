import type { HandlerContext } from '$fresh/server.ts';

const mimeTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' };

export const handler = {
  async GET(_request: Request, context: HandlerContext) {
    const filename = context.params.file;
    if (!/^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i.test(filename)) return new Response('Not found', { status: 404 });
    try {
      const content = await Deno.readFile(`${Deno.cwd()}/uploads/${filename}`);
      const extension = filename.split('.').pop()?.toLowerCase() ?? '';
      return new Response(content, { headers: { 'content-type': mimeTypes[extension] ?? 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return new Response('Not found', { status: 404 });
      throw error;
    }
  },
};