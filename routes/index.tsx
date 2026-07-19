import type { HandlerContext, PageProps } from '$fresh/server.ts';
import InventoryApp from '../islands/InventoryApp.tsx';
import { listItems } from '../db/repository.ts';
import { isAuthenticated } from '../config/auth.ts';

type HomeData = { authenticated: boolean; items: ReturnType<typeof listItems> };

export const handler = {
  GET(request: Request, context: HandlerContext<HomeData>) {
    const authenticated = isAuthenticated(request);
    return context.render({ authenticated, items: authenticated ? listItems() : [] });
  },
};

export default function Home({ data }: PageProps<HomeData>) {
  return <InventoryApp authenticated={data.authenticated} initialItems={data.items} />;
}