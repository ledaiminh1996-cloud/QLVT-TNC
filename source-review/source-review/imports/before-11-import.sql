PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_inventory_core.sql','2026-10-20 02:50:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_catalog_versions.sql','2026-10-20 02:50:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_directory_details.sql','2026-10-20 06:54:41');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_part_numbering.sql','2026-10-20 07:32:27');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'0005_part_price_min_stock.sql','2026-10-20 08:02:57');
CREATE TABLE app_users (
  id TEXT PRIMARY KEY NOT NULL,
  auth_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'warehouse', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
, version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0));
INSERT INTO "app_users" ("id","auth_subject","email","display_name","role","is_active","created_at","version") VALUES('ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','66c56070-d702-558f-a6af-aea19b73d419','ledaiminh1996@gmail.com','Lê Đại Minh','admin',1,'2026-10-20T06:40:43.994Z',1);
CREATE TABLE staff (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  phone TEXT,
  email TEXT,
  department TEXT,
  job_title TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
, version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0), vehicle_plate TEXT, trailer_plate TEXT);
CREATE TABLE warehouses (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('parts', 'fuel_tank', 'recovered', 'other')),
  location TEXT NOT NULL DEFAULT '',
  capacity_milli INTEGER CHECK (capacity_milli IS NULL OR (typeof(capacity_milli) = 'integer' AND capacity_milli > 0)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
, version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0), type_label TEXT);
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  tax_code TEXT,
  phone TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
, version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0), supplied_items TEXT);
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
, version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0));
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
, version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0), item_type TEXT CHECK (item_type IN ('M', 'G', 'T', 'C')), object_code TEXT COLLATE NOCASE REFERENCES part_objects(code) ON DELETE RESTRICT, group_code TEXT COLLATE NOCASE REFERENCES part_groups(code) ON DELETE RESTRICT, unit_price_vnd INTEGER NOT NULL DEFAULT 0 CHECK (typeof(unit_price_vnd) = 'integer' AND unit_price_vnd >= 0), min_stock_milli INTEGER NOT NULL DEFAULT 0 CHECK (typeof(min_stock_milli) = 'integer' AND min_stock_milli >= 0));
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
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('824cb72f-3284-481f-96b6-8e4db9a9383f','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','user.bootstrap','users','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc',NULL,'{"id":"ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc","role":"admin"}',NULL,'f56ce287-6e74-4b07-99de-474e5bfb0c21','2026-10-20T06:40:43.994Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('fd7c7482-51f4-4616-b7ac-3520410d9cee','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','d0de1695-186d-4b64-9e20-81dea85b0635',NULL,'{"code":"RM","name":"RƠMOOC","is_active":1,"id":"d0de1695-186d-4b64-9e20-81dea85b0635","version":1}',NULL,'9b69dee5-b784-4d1f-947b-bb55993d513c','2026-10-20T07:34:54.662Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('c33341de-9515-4cbd-8819-ebb498aaaef0','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','a8c14d17-ef1a-4650-8167-b921a8cc02de',NULL,'{"code":"MI","name":"MÁY LẠNH/INTERNATIONAL","is_active":1,"id":"a8c14d17-ef1a-4650-8167-b921a8cc02de","version":1}',NULL,'8f3049c9-98c4-4454-9394-2f17e7f40113','2026-10-20T07:35:25.141Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('fc37ce55-dc7f-4a32-9fc5-8e5672763ba8','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','ab8829e0-aa21-4c2e-870e-3adeb8efe144',NULL,'{"code":"IN","name":"INTERNATIONAL","is_active":1,"id":"ab8829e0-aa21-4c2e-870e-3adeb8efe144","version":1}',NULL,'439013bc-ca8d-4728-a414-1ec7bfc5b1c9','2026-10-20T07:35:32.357Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('477cf9fa-2059-401f-9594-29f0d2be7c49','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','92dde1b3-666e-4ff7-a484-e99a16e64a51',NULL,'{"code":"MP","name":"MÁY PHÁT","is_active":1,"id":"92dde1b3-666e-4ff7-a484-e99a16e64a51","version":1}',NULL,'f85dd70c-5f63-467e-9a08-3a3520691fde','2026-10-20T07:35:40.127Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('0239969c-39a3-4a38-96bf-9e662308efeb','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','e2bd46d4-a7b6-456d-bf54-081309ba32f7',NULL,'{"code":"DC","name":"DÙNG CHUNG","is_active":1,"id":"e2bd46d4-a7b6-456d-bf54-081309ba32f7","version":1}',NULL,'3e5e220c-2f9c-4f1d-afdd-0f260e062fe6','2026-10-20T07:35:46.699Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('8adc4901-b5e3-4786-a0bb-a9dd9aad8d16','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','5e4229f9-f24c-4b69-8649-3ec95d5166b5',NULL,'{"code":"FL","name":"FREIGHTLINER","is_active":1,"id":"5e4229f9-f24c-4b69-8649-3ec95d5166b5","version":1}',NULL,'5fc280df-df0d-4105-aef1-80a921d31d74','2026-10-20T07:35:52.097Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('5cc58377-45b9-4f92-a9b6-068780639b67','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','1022cc12-ce3a-4d4c-9ece-3e7c2a6c82c2',NULL,'{"code":"CL","name":"CHENGLONG","is_active":1,"id":"1022cc12-ce3a-4d4c-9ece-3e7c2a6c82c2","version":1}',NULL,'9f80a7b1-39a4-48f6-94db-cfd8f0ac3195','2026-10-20T07:35:57.400Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('65d8e634-393c-4265-a6fd-53a27da9f074','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','e637a4e5-e0d0-4262-8348-f4e4bbffe99e',NULL,'{"code":"IR","name":"INTERNATIONAL/RƠMOOC","is_active":1,"id":"e637a4e5-e0d0-4262-8348-f4e4bbffe99e","version":1}',NULL,'9050c2e4-c357-464d-8276-dda6ff01203b','2026-10-20T07:36:03.799Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('82a30658-932a-49a0-b5da-78b3b5d73506','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','f700e12d-bff6-4bdf-9d4e-f87b10cb0101',NULL,'{"code":"ML","name":"MÁY LẠNH","is_active":1,"id":"f700e12d-bff6-4bdf-9d4e-f87b10cb0101","version":1}',NULL,'5088f2c4-a67f-4c0e-9057-e9efcc58127a','2026-10-20T07:36:09.022Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('5c3e04b3-148c-443a-96ca-f3e87e82a120','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','125c3f07-d0d6-4f5d-9f37-fc70a2c915bf',NULL,'{"code":"IC","name":"INTERNATIONAL/CHENGLONG","is_active":1,"id":"125c3f07-d0d6-4f5d-9f37-fc70a2c915bf","version":1}',NULL,'1285dfe2-120c-4f67-8058-05314b02e5f3','2026-10-20T07:36:13.857Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('e33ea293-d51e-428a-9ed7-b6a5dba4cb61','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','05f24600-d094-4126-81cb-2e740256f7b2',NULL,'{"code":"MC","name":"MITSUBISHI CANTER","is_active":1,"id":"05f24600-d094-4126-81cb-2e740256f7b2","version":1}',NULL,'b67a7771-60dc-40a2-9ecd-a51ba21f0d5c','2026-10-20T07:36:20.439Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('f121c5af-31f7-42fa-a398-caca7155c760','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','e27c32f8-735f-4cc6-bcff-90cf3ce8f8bc',NULL,'{"code":"IM","name":"INTERNATIONAL/MITSUBISHI CANTER","is_active":1,"id":"e27c32f8-735f-4cc6-bcff-90cf3ce8f8bc","version":1}',NULL,'d4d56495-7b8f-44de-9d1e-647832dad0ee','2026-10-20T07:36:26.096Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('58a6dd8e-53f6-4d36-a73f-955c7092bb87','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','47cee4b6-861f-462a-a3bc-830d903fe6b8',NULL,'{"code":"DK","name":"INTERNATIONAL/CHENGLONG/MITSHUBISHI","is_active":1,"id":"47cee4b6-861f-462a-a3bc-830d903fe6b8","version":1}',NULL,'2e7b4b5a-cb17-485a-a23e-573dfef9da98','2026-10-20T07:36:32.780Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('4f18a1c9-d205-4704-b22c-65a8f6616ca5','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-objects','7eba5494-4163-439b-8429-c902d4f64cd2',NULL,'{"code":"TC","name":"XE TẢI/XE VP/XE CON","is_active":1,"id":"7eba5494-4163-439b-8429-c902d4f64cd2","version":1}',NULL,'0bf13f3a-2177-4c64-b586-b255cf709d1d','2026-10-20T07:36:39.044Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('a49e987e-f0e9-4fe5-80f7-3e60dd1c5632','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','32a67595-5620-44e6-b9ae-81f0a8c44f01',NULL,'{"code":"TREO","name":"Hệ thống treo","is_active":1,"id":"32a67595-5620-44e6-b9ae-81f0a8c44f01","version":1}',NULL,'03029bfe-8d8b-420b-b2ea-2deffe83438b','2026-10-20T07:40:25.932Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('e5dd6ca5-2526-42df-b83b-119f50b9ef96','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','53d2b19e-d438-4c44-af25-859104334af9',NULL,'{"code":"DHOA","name":"Hệ thống điều hòa không khí","is_active":1,"id":"53d2b19e-d438-4c44-af25-859104334af9","version":1}',NULL,'f90159c5-fcce-451f-a1ff-85c112904447','2026-10-20T07:40:38.089Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('6974dc28-4280-4d43-bfc4-596c2f7dc238','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','09c96bb4-72c1-47e1-9ff7-bd8f4acd4d20',NULL,'{"code":"TDONG","name":"Hệ thống truyền động","is_active":1,"id":"09c96bb4-72c1-47e1-9ff7-bd8f4acd4d20","version":1}',NULL,'e3563723-40b4-4b72-b6b0-de9358886220','2026-10-20T07:40:44.457Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('fdf7b790-ba96-4924-ba02-424f91fbcb8b','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','89409ab3-4532-494f-a73e-c9b690d24f80',NULL,'{"code":"CBXE","name":"Hệ thống cầu & bánh xe","is_active":1,"id":"89409ab3-4532-494f-a73e-c9b690d24f80","version":1}',NULL,'a4f9f654-1080-428e-a6d1-f1552f0b52a5','2026-10-20T07:40:50.836Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('74b18f32-e538-4570-acb1-deca16618931','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','f574f5d3-3e51-46b5-9db4-2027c80ea552',NULL,'{"code":"LYHP","name":"Hệ thống ly hợp","is_active":1,"id":"f574f5d3-3e51-46b5-9db4-2027c80ea552","version":1}',NULL,'130d428e-a352-4c00-b96a-fbcb9b9b0eec','2026-10-20T07:40:59.057Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('c286a8f6-5b22-4e0c-9e41-31e39cffad5c','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','936a6d2c-5228-41b9-80c9-e34c0ca2b7e3',NULL,'{"code":"LAI","name":"Hệ thống lái (trợ lực)","is_active":1,"id":"936a6d2c-5228-41b9-80c9-e34c0ca2b7e3","version":1}',NULL,'13205d98-9656-4b5c-a8c5-29a3ff6ddb43','2026-10-20T07:41:09.247Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('0dbd081c-759d-409a-864a-eb4bf0040234','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','d0024f71-e373-4b60-a5e3-46c496d23ff7',NULL,'{"code":"DIEN","name":"Hệ thống điện","is_active":1,"id":"d0024f71-e373-4b60-a5e3-46c496d23ff7","version":1}',NULL,'ab974e2a-5f21-42d6-8216-5e7bf2ad3049','2026-10-20T07:41:14.089Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('75fa835a-46c4-4008-aa5e-c19976bf3918','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','e691af55-fe37-4191-8125-f5e3e09e7613',NULL,'{"code":"DCO","name":"Hệ thống động cơ","is_active":1,"id":"e691af55-fe37-4191-8125-f5e3e09e7613","version":1}',NULL,'ebee7d8f-5906-4260-99a9-53c13eaeb73c','2026-10-20T07:41:18.410Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('252edb95-14b9-4041-a8e5-a5cd6b77c012','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','54c5d57b-6b2c-400c-b7e0-6b1d7a2a8103',NULL,'{"code":"PHANH","name":"Hệ thống phanh (khí nén)","is_active":1,"id":"54c5d57b-6b2c-400c-b7e0-6b1d7a2a8103","version":1}',NULL,'52678aaa-66f4-4d95-9bab-e5fcfbe626ac','2026-10-20T07:41:22.886Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('2c8f367b-1de1-4836-bf7d-41f2da7c98d5','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','fb272691-fbcd-450b-8f1e-6a1b68e7f5e1',NULL,'{"code":"TIEU","name":"Vật tư tiêu hao","is_active":1,"id":"fb272691-fbcd-450b-8f1e-6a1b68e7f5e1","version":1}',NULL,'6b884492-26c4-43a8-b55f-379ad059b249','2026-10-20T07:41:27.941Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('87b4d50a-74ff-43b8-9f39-77302bef41c3','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','059d8176-97d8-41cb-8e5e-d68c5fee7d86',NULL,'{"code":"CAB","name":"Cabin (phần đầu)","is_active":1,"id":"059d8176-97d8-41cb-8e5e-d68c5fee7d86","version":1}',NULL,'35256a81-48d7-4eb9-b06b-05b9c398a4e7','2026-10-20T07:41:33.764Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('eb5512d5-d6b4-44cc-84e5-876bc5e761d0','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','32be76f9-bca9-42ba-b948-1774989d49f2',NULL,'{"code":"LMAT","name":"Hệ thống làm mát","is_active":1,"id":"32be76f9-bca9-42ba-b948-1774989d49f2","version":1}',NULL,'35ccdc29-dcde-46a1-a498-450b8554a029','2026-10-20T07:41:40.638Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('8f90e111-24fc-4ae2-a228-3da02961fc5b','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','d69de031-e2f8-4c70-896f-1dbd7bf585f5',NULL,'{"code":"KTHAI","name":"Hệ thống khí thải","is_active":1,"id":"d69de031-e2f8-4c70-896f-1dbd7bf585f5","version":1}',NULL,'0dc41a80-cbfc-4e97-861a-8ca3a3c49127','2026-10-20T07:41:46.184Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('24c575d2-4cf1-4060-87e8-e583c897843a','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','5972bf6e-9bda-4804-9bae-246046baf1d8',NULL,'{"code":"KGM","name":"Khung gầm","is_active":1,"id":"5972bf6e-9bda-4804-9bae-246046baf1d8","version":1}',NULL,'f7fa15c7-8552-41ef-b285-adc6ff3f95ac','2026-10-20T07:41:51.021Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('8fb8f9cb-6879-4628-8132-f3e1d2c49d31','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','92c5c6f9-9680-4b87-bb65-404bfffdb399',NULL,'{"code":"NOIT","name":"Hệ thống nội thất","is_active":1,"id":"92c5c6f9-9680-4b87-bb65-404bfffdb399","version":1}',NULL,'33f24d19-6e71-46ee-81e4-f4702ce65d2a','2026-10-20T07:41:56.719Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('7f8f5c6d-35aa-4268-ab7e-61b9b2730b5f','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','32a4c812-a52b-488a-8426-cb55bd57d96d',NULL,'{"code":"NGOAIT","name":"Hệ thống ngoại thất","is_active":1,"id":"32a4c812-a52b-488a-8426-cb55bd57d96d","version":1}',NULL,'10daceba-1167-48cd-9879-c451a25f9b7f','2026-10-20T07:42:02.668Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('86a31b23-b6b7-4cee-8fd6-99ef21dd0ad4','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','b1c32b61-1e0c-4dec-ab28-1446a7fd5d6f',NULL,'{"code":"DCU","name":"Dụng cụ","is_active":1,"id":"b1c32b61-1e0c-4dec-ab28-1446a7fd5d6f","version":1}',NULL,'a22fdbd5-614a-4ce9-8d51-1f165b383939','2026-10-20T07:42:08.306Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('2208b6df-af8d-41f0-ae22-2b47e8bf1125','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','46d23523-0bdc-4392-9945-a559a48defde',NULL,'{"code":"NGOAI","name":"Phí ngoài","is_active":1,"id":"46d23523-0bdc-4392-9945-a559a48defde","version":1}',NULL,'938fb7e4-62f3-46f5-85ee-bbb85cbf5177','2026-10-20T07:42:15.329Z');
INSERT INTO "audit_events" ("id","actor_id","action","entity_type","entity_id","before_json","after_json","reason","request_id","created_at") VALUES('f81a4e40-5f05-4313-829a-8884c76fb335','ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.create','part-groups','2b7d6454-d77e-4725-b883-5a7575ace793',NULL,'{"code":"TLY","name":"Thanh lý","is_active":1,"id":"2b7d6454-d77e-4725-b883-5a7575ace793","version":1}',NULL,'91ca1348-c866-44b1-9bb2-07f8e1b0cfcd','2026-10-20T07:42:19.450Z');
CREATE TABLE part_objects (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(code) BETWEEN 1 AND 20 AND code NOT GLOB '*[^A-Z0-9]*'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('d0de1695-186d-4b64-9e20-81dea85b0635','RM','RƠMOOC',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('a8c14d17-ef1a-4650-8167-b921a8cc02de','MI','MÁY LẠNH/INTERNATIONAL',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('ab8829e0-aa21-4c2e-870e-3adeb8efe144','IN','INTERNATIONAL',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('92dde1b3-666e-4ff7-a484-e99a16e64a51','MP','MÁY PHÁT',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('e2bd46d4-a7b6-456d-bf54-081309ba32f7','DC','DÙNG CHUNG',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('5e4229f9-f24c-4b69-8649-3ec95d5166b5','FL','FREIGHTLINER',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('1022cc12-ce3a-4d4c-9ece-3e7c2a6c82c2','CL','CHENGLONG',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('e637a4e5-e0d0-4262-8348-f4e4bbffe99e','IR','INTERNATIONAL/RƠMOOC',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('f700e12d-bff6-4bdf-9d4e-f87b10cb0101','ML','MÁY LẠNH',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('125c3f07-d0d6-4f5d-9f37-fc70a2c915bf','IC','INTERNATIONAL/CHENGLONG',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('05f24600-d094-4126-81cb-2e740256f7b2','MC','MITSUBISHI CANTER',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('e27c32f8-735f-4cc6-bcff-90cf3ce8f8bc','IM','INTERNATIONAL/MITSUBISHI CANTER',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('47cee4b6-861f-462a-a3bc-830d903fe6b8','DK','INTERNATIONAL/CHENGLONG/MITSHUBISHI',1,1);
INSERT INTO "part_objects" ("id","code","name","is_active","version") VALUES('7eba5494-4163-439b-8429-c902d4f64cd2','TC','XE TẢI/XE VP/XE CON',1,1);
CREATE TABLE part_groups (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(code) BETWEEN 1 AND 20 AND code NOT GLOB '*[^A-Z0-9]*'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('32a67595-5620-44e6-b9ae-81f0a8c44f01','TREO','Hệ thống treo',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('53d2b19e-d438-4c44-af25-859104334af9','DHOA','Hệ thống điều hòa không khí',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('09c96bb4-72c1-47e1-9ff7-bd8f4acd4d20','TDONG','Hệ thống truyền động',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('89409ab3-4532-494f-a73e-c9b690d24f80','CBXE','Hệ thống cầu & bánh xe',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('f574f5d3-3e51-46b5-9db4-2027c80ea552','LYHP','Hệ thống ly hợp',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('936a6d2c-5228-41b9-80c9-e34c0ca2b7e3','LAI','Hệ thống lái (trợ lực)',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('d0024f71-e373-4b60-a5e3-46c496d23ff7','DIEN','Hệ thống điện',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('e691af55-fe37-4191-8125-f5e3e09e7613','DCO','Hệ thống động cơ',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('54c5d57b-6b2c-400c-b7e0-6b1d7a2a8103','PHANH','Hệ thống phanh (khí nén)',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('fb272691-fbcd-450b-8f1e-6a1b68e7f5e1','TIEU','Vật tư tiêu hao',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('059d8176-97d8-41cb-8e5e-d68c5fee7d86','CAB','Cabin (phần đầu)',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('32be76f9-bca9-42ba-b948-1774989d49f2','LMAT','Hệ thống làm mát',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('d69de031-e2f8-4c70-896f-1dbd7bf585f5','KTHAI','Hệ thống khí thải',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('5972bf6e-9bda-4804-9bae-246046baf1d8','KGM','Khung gầm',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('92c5c6f9-9680-4b87-bb65-404bfffdb399','NOIT','Hệ thống nội thất',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('32a4c812-a52b-488a-8426-cb55bd57d96d','NGOAIT','Hệ thống ngoại thất',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('b1c32b61-1e0c-4dec-ab28-1446a7fd5d6f','DCU','Dụng cụ',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('46d23523-0bdc-4392-9945-a559a48defde','NGOAI','Phí ngoài',1,1);
INSERT INTO "part_groups" ("id","code","name","is_active","version") VALUES('2b7d6454-d77e-4725-b883-5a7575ace793','TLY','Thanh lý',1,1);
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
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',5);
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
