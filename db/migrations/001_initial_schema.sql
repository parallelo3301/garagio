CREATE TABLE manufacturers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  website TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  location TEXT NOT NULL DEFAULT '',
  manufacturer_id INTEGER REFERENCES manufacturers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_stock',
  borrowed_to TEXT,
  borrowed_at TEXT,
  photos_json TEXT NOT NULL DEFAULT '[]',
  links_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE item_tags (
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE wiki_pages (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE item_wiki_pages (
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  wiki_page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, wiki_page_id)
);

CREATE INDEX items_name_idx ON items(name);
CREATE INDEX items_location_idx ON items(location);