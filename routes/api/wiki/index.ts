import { createWikiPage, listWikiPages, type WikiPage } from '../../../db/repository.ts';
export const handler = {
  GET: () => Response.json(listWikiPages()),
  async POST(request: Request) {
    const input = await request.json() as Omit<WikiPage, 'id'>;
    if (!input.title?.trim()) return Response.json({ error: 'Title is required' }, { status: 400 });
    return Response.json(createWikiPage(input), { status: 201 });
  },
};