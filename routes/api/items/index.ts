import { createItem, listItems, type ItemInput } from '../../../db/repository.ts';

export const handler = {
  GET: () => Response.json(listItems()),
  async POST(request: Request) {
    const input = await request.json() as ItemInput;
    if (!input.name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 });
    return Response.json(createItem(input), { status: 201 });
  },
};