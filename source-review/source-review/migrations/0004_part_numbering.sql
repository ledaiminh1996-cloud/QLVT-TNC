CREATE TABLE part_objects (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(code) BETWEEN 1 AND 20 AND code NOT GLOB '*[^A-Z0-9]*'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE TABLE part_groups (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(code) BETWEEN 1 AND 20 AND code NOT GLOB '*[^A-Z0-9]*'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
ALTER TABLE parts ADD COLUMN item_type TEXT CHECK (item_type IN ('M', 'G', 'T', 'C'));
ALTER TABLE parts ADD COLUMN object_code TEXT COLLATE NOCASE REFERENCES part_objects(code) ON DELETE RESTRICT;
ALTER TABLE parts ADD COLUMN group_code TEXT COLLATE NOCASE REFERENCES part_groups(code) ON DELETE RESTRICT;
CREATE TABLE part_sku_sequences (
  prefix TEXT PRIMARY KEY NOT NULL,
  last_value INTEGER NOT NULL CHECK (last_value BETWEEN 1 AND 9999)
);
CREATE TABLE part_import_batches (
  id TEXT PRIMARY KEY NOT NULL,
  request_hash TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  row_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
