-- Management scopes for materials mounted at opening; no warehouse movements.
ALTER TABLE vehicles ADD COLUMN managing_unit_id TEXT REFERENCES org_units(id);
ALTER TABLE equipment ADD COLUMN managing_unit_id TEXT REFERENCES org_units(id);
ALTER TABLE opening_usage_lines ADD COLUMN managing_unit_id TEXT REFERENCES org_units(id);
CREATE TABLE document_unit_access(user_id TEXT NOT NULL REFERENCES app_users(id),unit_id TEXT NOT NULL REFERENCES org_units(id),PRIMARY KEY(user_id,unit_id));
CREATE INDEX idx_opening_usage_unit ON opening_usage_lines(managing_unit_id);

-- Allow mounted opening roots without manufacturing a warehouse association.
PRAGMA defer_foreign_keys=ON;
DROP INDEX "idx_lines_document";
DROP INDEX "idx_lines_part";
DROP INDEX "idx_lines_vehicle";
DROP VIEW "current_stock";
DROP TRIGGER "receipt_mutation_dependencies";
DROP TRIGGER "opening_no_prior_stock";
CREATE TABLE inventory_document_lines_new (
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
  fuel_target TEXT CHECK (fuel_target IN ('engine', 'reefer', 'other')), unit_price_numerator TEXT, unit_price_denominator TEXT,
  is_opening_usage INTEGER NOT NULL DEFAULT 0 CHECK(is_opening_usage IN (0,1)),
  UNIQUE (document_id, line_number),
  UNIQUE (id, part_id),
  CHECK (from_warehouse_id IS NOT NULL OR to_warehouse_id IS NOT NULL OR is_opening_usage=1),
  CHECK (from_warehouse_id IS NULL OR to_warehouse_id IS NULL OR from_warehouse_id != to_warehouse_id)
);
INSERT INTO inventory_document_lines_new(id,document_id,line_number,part_id,sku_snapshot,part_name_snapshot,unit_snapshot,quantity_milli,unit_price_vnd_milli,amount_vnd,from_warehouse_id,to_warehouse_id,vehicle_id,vehicle_plate_snapshot,driver_id,vehicle_odo_km,mount_position,serial_number_snapshot,fuel_target,unit_price_numerator,unit_price_denominator) SELECT id,document_id,line_number,part_id,sku_snapshot,part_name_snapshot,unit_snapshot,quantity_milli,unit_price_vnd_milli,amount_vnd,from_warehouse_id,to_warehouse_id,vehicle_id,vehicle_plate_snapshot,driver_id,vehicle_odo_km,mount_position,serial_number_snapshot,fuel_target,unit_price_numerator,unit_price_denominator FROM inventory_document_lines;
DROP TABLE inventory_document_lines;
ALTER TABLE inventory_document_lines_new RENAME TO inventory_document_lines;
CREATE INDEX idx_lines_document ON inventory_document_lines(document_id);
CREATE INDEX idx_lines_part ON inventory_document_lines(part_id);
CREATE INDEX idx_lines_vehicle ON inventory_document_lines(vehicle_id);
CREATE VIEW current_stock AS
SELECT m.part_id, m.warehouse_id,
       SUM(m.quantity_delta_milli) AS quantity_milli,
       SUM(m.value_delta_vnd) AS carrying_value_vnd
FROM stock_movements m
JOIN inventory_document_lines l ON l.id = m.document_line_id
JOIN inventory_documents d ON d.id = l.document_id
WHERE d.status = 'posted'
GROUP BY m.part_id, m.warehouse_id;
CREATE TRIGGER receipt_mutation_dependencies BEFORE INSERT ON receipt_mutation_locks WHEN NEW.mode<>'receive' AND (
 EXISTS(SELECT 1 FROM stock_source_allocations a JOIN inventory_document_lines l ON l.id=a.source_line_id JOIN document_drafts d ON d.posted_inventory_id=l.document_id WHERE d.id=NEW.document_id)
 OR EXISTS(SELECT 1 FROM stock_cost_dependencies a JOIN inventory_document_lines l ON l.id=a.source_line_id JOIN document_drafts d ON d.posted_inventory_id=l.document_id WHERE d.id=NEW.document_id)
 OR EXISTS(SELECT 1 FROM inventory_document_lines l JOIN document_drafts d ON d.posted_inventory_id=l.document_id LEFT JOIN stock_lots s ON s.source_line_id=l.id WHERE d.id=NEW.document_id AND (s.source_line_id IS NULL OR s.remaining_quantity_milli<>s.initial_quantity_milli))
 OR EXISTS(SELECT 1 FROM document_draft_lines x JOIN inventory_document_lines l ON l.id=json_extract(x.line_json,'$.source_line_id') JOIN document_drafts d ON d.posted_inventory_id=l.document_id JOIN document_drafts other ON other.id=x.document_id WHERE d.id=NEW.document_id AND other.id<>d.id AND other.status<>'cancelled' AND other.deleted_at IS NULL)
) BEGIN SELECT RAISE(ABORT,'RECEIPT_HAS_DEPENDENCIES'); END;
CREATE TRIGGER opening_no_prior_stock BEFORE INSERT ON opening_groups WHEN EXISTS(SELECT 1 FROM inventory_document_lines l JOIN inventory_documents d ON d.id=l.document_id WHERE l.part_id=NEW.part_id AND (l.to_warehouse_id=NEW.warehouse_id OR l.from_warehouse_id=NEW.warehouse_id) AND d.status='posted' AND d.id<>NEW.document_id AND NOT EXISTS(SELECT 1 FROM opening_usage_lines ou WHERE ou.inventory_line_id=l.id)) BEGIN SELECT RAISE(ABORT,'OPENING_HAS_HISTORY'); END;
CREATE TRIGGER opening_line_scope BEFORE INSERT ON inventory_document_lines WHEN NEW.is_opening_usage=1 AND (NEW.from_warehouse_id IS NOT NULL OR NEW.to_warehouse_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM inventory_documents d WHERE d.id=NEW.document_id AND d.type='OPENING')) BEGIN SELECT RAISE(ABORT,'INVALID_OPENING_SCOPE'); END;
-- Verify the rebuilt graph before clearing deferred DROP/recreate counters.
CREATE TABLE opening_unit_migration_guard(valid INTEGER NOT NULL CHECK(valid=1));
INSERT INTO opening_unit_migration_guard SELECT CASE WHEN count(*)=0 THEN 1 ELSE 0 END FROM pragma_foreign_key_check;
DROP TABLE opening_unit_migration_guard;
PRAGMA defer_foreign_keys=OFF;
