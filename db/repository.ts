import { openDatabase } from './database.ts';

export type Link = { label: string; url: string };
export type InventoryItem = {
  id: number; name: string; description: string; quantity: number; location: string;
  manufacturerId: number | null; manufacturerName: string | null; status: string;
  borrowedTo: string | null; borrowedAt: string | null; tags: string[]; photos: string[];
  links: Link[]; wikiPageIds: number[];
};
export type ItemInput = Omit<InventoryItem, 'id' | 'manufacturerName'>;
export type Manufacturer = { id: number; name: string; website: string | null; notes: string | null };
export type WikiPage = { id: number; title: string; content: string };

type ItemRow = Omit<InventoryItem, 'tags' | 'photos' | 'links' | 'wikiPageIds' | 'manufacturerId' | 'manufacturerName' | 'borrowedTo' | 'borrowedAt'> & {
  manufacturer_id: number | null; manufacturer_name: string | null; borrowed_to: string | null; borrowed_at: string | null;
  photos_json: string; links_json: string;
};

const itemColumns = `i.id, i.name, i.description, i.quantity, i.location, i.manufacturer_id, m.name AS manufacturer_name,
  i.status, i.borrowed_to, i.borrowed_at, i.photos_json, i.links_json`;

function enrichItem(database: ReturnType<typeof openDatabase>, row: ItemRow): InventoryItem {
  return {
    id: row.id, name: row.name, description: row.description, quantity: row.quantity, location: row.location,
    manufacturerId: row.manufacturer_id, manufacturerName: row.manufacturer_name, status: row.status,
    borrowedTo: row.borrowed_to, borrowedAt: row.borrowed_at,
    photos: JSON.parse(row.photos_json), links: JSON.parse(row.links_json),
    tags: database.prepare<{ name: string }>('SELECT t.name FROM tags t JOIN item_tags it ON it.tag_id = t.id WHERE it.item_id = ? ORDER BY t.name').all(row.id).map(({ name }) => name),
    wikiPageIds: database.prepare<{ wiki_page_id: number }>('SELECT wiki_page_id FROM item_wiki_pages WHERE item_id = ?').all(row.id).map(({ wiki_page_id }) => wiki_page_id),
  };
}

export function listItems() {
  const database = openDatabase();
  try {
    return database.prepare<ItemRow>(`SELECT ${itemColumns} FROM items i LEFT JOIN manufacturers m ON m.id = i.manufacturer_id ORDER BY i.name COLLATE NOCASE`).all().map((row) => enrichItem(database, row));
  } finally { database.close(); }
}

export function getItem(id: number) {
  const database = openDatabase();
  try {
    const row = database.prepare<ItemRow>(`SELECT ${itemColumns} FROM items i LEFT JOIN manufacturers m ON m.id = i.manufacturer_id WHERE i.id = ?`).get(id);
    return row ? enrichItem(database, row) : null;
  } finally { database.close(); }
}

function saveRelations(database: ReturnType<typeof openDatabase>, itemId: number, input: ItemInput) {
  database.prepare('DELETE FROM item_tags WHERE item_id = ?').run(itemId);
  database.prepare('DELETE FROM item_wiki_pages WHERE item_id = ?').run(itemId);
  const tagId = database.prepare<{ id: number }>('SELECT id FROM tags WHERE name = ?');
  const addTag = database.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const attachTag = database.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)');
  for (const tag of input.tags.map((value) => value.trim()).filter(Boolean)) {
    addTag.run(tag);
    attachTag.run(itemId, tagId.get(tag)?.id);
  }
  const attachPage = database.prepare('INSERT OR IGNORE INTO item_wiki_pages (item_id, wiki_page_id) VALUES (?, ?)');
  for (const pageId of input.wikiPageIds) attachPage.run(itemId, pageId);
}

export function createItem(input: ItemInput) {
  const database = openDatabase();
  try {
    const create = database.transaction(() => {
      const id = database.prepare<{ id: number }>(`INSERT INTO items (name, description, quantity, location, manufacturer_id, status, borrowed_to, borrowed_at, photos_json, links_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(input.name, input.description, input.quantity, input.location, input.manufacturerId, input.status, input.borrowedTo, input.borrowedAt, JSON.stringify(input.photos), JSON.stringify(input.links))!.id;
      saveRelations(database, id, input);
      return id;
    });
    return getItemFromDatabase(database, create());
  } finally { database.close(); }
}

function getItemFromDatabase(database: ReturnType<typeof openDatabase>, id: number) {
  const row = database.prepare<ItemRow>(`SELECT ${itemColumns} FROM items i LEFT JOIN manufacturers m ON m.id = i.manufacturer_id WHERE i.id = ?`).get(id);
  if (!row) throw new Error('Item not found');
  return enrichItem(database, row);
}

export function updateItem(id: number, input: ItemInput) {
  const database = openDatabase();
  try {
    const update = database.transaction(() => {
      const result = database.prepare(`UPDATE items SET name=?, description=?, quantity=?, location=?, manufacturer_id=?, status=?, borrowed_to=?, borrowed_at=?, photos_json=?, links_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(input.name, input.description, input.quantity, input.location, input.manufacturerId, input.status, input.borrowedTo, input.borrowedAt, JSON.stringify(input.photos), JSON.stringify(input.links), id);
      if (!result) throw new Error('Item not found');
      saveRelations(database, id, input);
    });
    update();
    return getItemFromDatabase(database, id);
  } finally { database.close(); }
}

export function deleteItem(id: number) { const database = openDatabase(); try { return database.prepare('DELETE FROM items WHERE id = ?').run(id); } finally { database.close(); } }

export function listManufacturers() { const database = openDatabase(); try { return database.prepare<Manufacturer>('SELECT id, name, website, notes FROM manufacturers ORDER BY name COLLATE NOCASE').all(); } finally { database.close(); } }
export function createManufacturer(input: Omit<Manufacturer, 'id'>) { const database = openDatabase(); try { return database.prepare<Manufacturer>('INSERT INTO manufacturers (name, website, notes) VALUES (?, ?, ?) RETURNING id, name, website, notes').get(input.name, input.website, input.notes); } finally { database.close(); } }
export function updateManufacturer(id: number, input: Omit<Manufacturer, 'id'>) { const database = openDatabase(); try { return database.prepare<Manufacturer>('UPDATE manufacturers SET name=?, website=?, notes=? WHERE id=? RETURNING id, name, website, notes').get(input.name, input.website, input.notes, id); } finally { database.close(); } }
export function deleteManufacturer(id: number) { const database = openDatabase(); try { return database.prepare('DELETE FROM manufacturers WHERE id = ?').run(id); } finally { database.close(); } }
export function listWikiPages() { const database = openDatabase(); try { return database.prepare<WikiPage>('SELECT id, title, content FROM wiki_pages ORDER BY title COLLATE NOCASE').all(); } finally { database.close(); } }
export function createWikiPage(input: Omit<WikiPage, 'id'>) { const database = openDatabase(); try { return database.prepare<WikiPage>('INSERT INTO wiki_pages (title, content) VALUES (?, ?) RETURNING id, title, content').get(input.title, input.content); } finally { database.close(); } }
export function updateWikiPage(id: number, input: Omit<WikiPage, 'id'>) { const database = openDatabase(); try { return database.prepare<WikiPage>('UPDATE wiki_pages SET title=?, content=?, updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING id, title, content').get(input.title, input.content, id); } finally { database.close(); } }
export function deleteWikiPage(id: number) { const database = openDatabase(); try { return database.prepare('DELETE FROM wiki_pages WHERE id = ?').run(id); } finally { database.close(); } }