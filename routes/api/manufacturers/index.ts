import { createManufacturer, listManufacturers, type Manufacturer } from '../../../db/repository.ts';
export const handler = {
  GET: () => Response.json(listManufacturers()),
  async POST(request: Request) {
    const input = await request.json() as Omit<Manufacturer, 'id'>;
    if (!input.name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 });
    return Response.json(createManufacturer(input), { status: 201 });
  },
};