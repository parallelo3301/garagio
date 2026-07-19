import { deleteWikiPage, type WikiPage, updateWikiPage } from '../../../db/repository.ts';
import type { HandlerContext } from '$fresh/server.ts';
export const handler = {
  async PUT(request: Request, context: HandlerContext) {
    const page = updateWikiPage(Number(context.params.id), await request.json() as Omit<WikiPage, 'id'>);
    return page ? Response.json(page) : Response.json({ error: 'Not found' }, { status: 404 });
  },
  DELETE(_request: Request, context: HandlerContext) {
    deleteWikiPage(Number(context.params.id));
    return new Response(null, { status: 204 });
  },
};