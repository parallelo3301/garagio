import InventoryApp from '../islands/InventoryApp.tsx';
import { listItems } from '../db/repository.ts';

export default function Home() {
  return <InventoryApp initialItems={listItems()} />;
}