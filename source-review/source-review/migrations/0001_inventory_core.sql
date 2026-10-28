-- TNC: inventory core, step 1. No production data or sample balances.
-- Apply with the D1 migration runner; do not add BEGIN/COMMIT here.
-- Quantity scale: 1000. Price scale: 1000 VND. Amount: whole VND.

CREATE TABLE app_users (
  id TEXT PRIMARY KEY NOT NULL,
  auth_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'warehouse', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE staff (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  phone TEXT,
  email TEXT,
  department TEXT,
  job_title TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE warehouses (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('parts', 'fuel_tank', 'recovered', 'other')),
  location TEXT NOT NULL DEFAULT '',
  capacity_milli INTEGER CHECK (capacity_milli IS NULL OR (typeof(capacity_milli) = 'integer' AND capacity_milli > 0)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  tax_code TEXT,
  phone TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY NOT NULL,
  plate_number TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(plate_number)) > 0),
  type TEXT NOT NULL CHECK (type IN ('tractor', 'trailer', 'office_car', 'rented_truck')),
  brand_model TEXT NOT NULL DEFAULT '',
  manufacture_year INTEGER,
  current_odo_km INTEGER NOT NULL DEFAULT 0 CHECK (typeof(current_odo_km) = 'integer' AND current_odo_km >= 0),
  assigned_driver_id TEXT REFERENCES staff(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'stopped')),
  has_reefer INTEGER NOT NULL DEFAULT 0 CHECK (has_reefer IN (0, 1)),
  notes TEXT
);

CREATE TABLE parts (
  id TEXT PRIMARY KEY NOT NULL,
  sku TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(sku)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  category TEXT NOT NULL CHECK (category IN ('tires', 'lubricants', 'filters', 'brake', 'suspension', 'coupling', 'electrical', 'engine_trans', 'accessories')),
  unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
  applicable_for TEXT NOT NULL CHECK (applicable_for IN ('tractor', 'trailer', 'both')),
  specifications TEXT NOT NULL DEFAULT '',
  lifespan_km_limit INTEGER CHECK (lifespan_km_limit IS NULL OR lifespan_km_limit > 0),
  lifespan_days_limit INTEGER CHECK (lifespan_days_limit IS NULL OR lifespan_days_limit > 0),
  is_serialized INTEGER NOT NULL DEFAULT 0 CHECK (is_serialized IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  notes TEXT
);

-- Location and reorder point belong to a part at a particular warehouse.
-- Current stock and cost are derived from stock_movements, not entered here.
CREATE TABLE part_warehouse_settings (
  part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  bin_location TEXT NOT NULL DEFAULT '',
  min_stock_milli INTEGER NOT NULL DEFAULT 0 CHECK (typeof(min_stock_milli) = 'integer' AND min_stock_milli >= 0),
  PRIMARY KEY (part_id, warehouse_id)
);

CREATE TABLE accounting_periods (
  period TEXT PRIMARY KEY NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND substr(period, 6, 2) BETWEEN '01' AND '12'),
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  locked_by TEXT REFERENCES app_users(id) ON DELETE RESTRICT,
  locked_at TEXT,
  notes TEXT,
  CHECK ((is_locked = 0 AND locked_by IS NULL AND locked_at IS NULL) OR (is_locked = 1 AND locked_by IS NOT NULL AND locked_at IS NOT NULL))
);

CREATE TABLE inventory_documents (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(code)) > 0),
  type TEXT NOT NULL CHECK (type IN ('OPENING', 'IN', 'OUT', 'TRANSFER', 'RECOVERY', 'SCRAP', 'ADJUSTMENT', 'REVERSAL')),
  business_date TEXT NOT NULL CHECK (business_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE RESTRICT,
  receiver_staff_id TEXT REFERENCES staff(id) ON DELETE RESTRICT,
  partner_name_snapshot TEXT NOT NULL DEFAULT '',
  invoice_number TEXT,
  created_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  posted_by TEXT REFERENCES app_users(id) ON DELETE RESTRICT,
  posted_at TEXT,
  reverses_document_id TEXT UNIQUE REFERENCES inventory_documents(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(trim(idempotency_key)) > 0),
  request_hash TEXT NOT NULL CHECK (length(trim(request_hash)) > 0),
  source_reference TEXT UNIQUE,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((status = 'posted' AND posted_by IS NOT NULL AND posted_at IS NOT NULL) OR (status != 'posted' AND posted_by IS NULL AND posted_at IS NULL)),
  CHECK ((type = 'REVERSAL' AND reverses_document_id IS NOT NULL) OR (type != 'REVERSAL' AND reverses_document_id IS NULL)),
  CHECK (reverses_document_id IS NULL OR reverses_document_id != id)
);

CREATE TABLE inventory_document_lines (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES inventory_documents(id) ON DELETE RESTRICT,
  line_number INTEGER NOT NULL CHECK (typeof(line_number) = 'integer' AND line_number > 0),
  part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  sku_snapshot TEXT NOT NULL,
  part_name_snapshot TEXT NOT NULL,
  unit_snapshot TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL CHECK (typeof(quantity_milli) = 'integer' AND quantity_milli > 0),
  unit_price_vnd_milli INTEGER NOT NULL CHECK (typeof(unit_price_vnd_milli) = 'integer' AND unit_price_vnd_milli >= 0),
  amount_vnd INTEGER NOT NULL CHECK (typeof(amount_vnd) = 'integer' AND amount_vnd >= 0),
  from_warehouse_id TEXT REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id TEXT REFERENCES warehouses(id) ON DELETE RESTRICT,
  vehicle_id TEXT REFERENCES vehicles(id) ON DELETE RESTRICT,
  vehicle_plate_snapshot TEXT,
  driver_id TEXT REFERENCES staff(id) ON DELETE RESTRICT,
  vehicle_odo_km INTEGER CHECK (vehicle_odo_km IS NULL OR (typeof(vehicle_odo_km) = 'integer' AND vehicle_odo_km >= 0)),
  mount_position TEXT,
  serial_number_snapshot TEXT,
  fuel_target TEXT CHECK (fuel_target IN ('engine', 'reefer', 'other')),
  UNIQUE (document_id, line_number),
  UNIQUE (id, part_id),
  CHECK (from_warehouse_id IS NOT NULL OR to_warehouse_id IS NOT NULL),
  CHECK (from_warehouse_id IS NULL OR to_warehouse_id IS NULL OR from_warehouse_id != to_warehouse_id)
);

-- Signed quantity and signed carrying value. One entry per line/warehouse.
-- API posting must enforce sign, costing, period lock, and nonnegative stock.
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY NOT NULL,
  document_line_id TEXT NOT NULL,
  part_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  quantity_delta_milli INTEGER NOT NULL CHECK (typeof(quantity_delta_milli) = 'integer' AND quantity_delta_milli != 0),
  value_delta_vnd INTEGER NOT NULL CHECK (typeof(value_delta_vnd) = 'integer'),
  FOREIGN KEY (document_line_id, part_id) REFERENCES inventory_document_lines(id, part_id) ON DELETE RESTRICT,
  UNIQUE (document_line_id, warehouse_id),
  CHECK ((quantity_delta_milli > 0 AND value_delta_vnd >= 0) OR (quantity_delta_milli < 0 AND value_delta_vnd <= 0))
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_documents_date_status ON inventory_documents(business_date, status);
CREATE INDEX idx_documents_creator ON inventory_documents(created_by);
CREATE INDEX idx_lines_document ON inventory_document_lines(document_id);
CREATE INDEX idx_lines_part ON inventory_document_lines(part_id);
CREATE INDEX idx_lines_vehicle ON inventory_document_lines(vehicle_id);
CREATE INDEX idx_movements_stock ON stock_movements(part_id, warehouse_id);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id, created_at);

CREATE VIEW current_stock AS
SELECT m.part_id, m.warehouse_id,
       SUM(m.quantity_delta_milli) AS quantity_milli,
       SUM(m.value_delta_vnd) AS carrying_value_vnd
FROM stock_movements m
JOIN inventory_document_lines l ON l.id = m.document_line_id
JOIN inventory_documents d ON d.id = l.document_id
WHERE d.status = 'posted'
GROUP BY m.part_id, m.warehouse_id;
