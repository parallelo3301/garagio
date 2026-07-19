import { deleteItem, getItem, type ItemInput, updateItem } from '../../../db/repository.ts';
import type { HandlerContext } from '$fresh/server.ts';

const idFrom = (context: HandlerContext) => Number(context.params.id);
export const handler = {
  GET(_request: Request, context: HandlerContext) {
    const item = getItem(idFrom(context));
    return item ? Response.json(item) : Response.json({ error: 'Not found' }, { status: 404 });
  },
  async PUT(request: Request, context: HandlerContext) {
    try { return Response.json(updateItem(idFrom(context), await request.json() as ItemInput)); }
    catch { return Response.json({ error: 'Not found' }, { status: 404 }); }
  },
  DELETE(_request: Request, context: HandlerContext) { deleteItem(idFrom(context)); return new Response(null, { status: 204 }); },
};