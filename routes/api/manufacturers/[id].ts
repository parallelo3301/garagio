import type { HandlerContext } from '$fresh/server.ts';
import { deleteManufacturer, type Manufacturer, updateManufacturer } from '../../../db/repository.ts';

export const handler = {
  async PUT(request: Request, context: HandlerContext) {
    const manufacturer = updateManufacturer(Number(context.params.id), await request.json() as Omit<Manufacturer, 'id'>);
    return manufacturer ? Response.json(manufacturer) : Response.json({ error: 'Not found' }, { status: 404 });
  },
  DELETE(_request: Request, context: HandlerContext) {
    deleteManufacturer(Number(context.params.id));
    return new Response(null, { status: 204 });
  },
};