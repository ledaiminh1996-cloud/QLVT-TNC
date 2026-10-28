-- A warehouse contains multiple tanks; each tank has a required warehouse.
CREATE TABLE fuel_tanks (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(code)) > 0),
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  capacity_milli INTEGER NOT NULL CHECK(typeof(capacity_milli) = 'integer' AND capacity_milli > 0),
  location TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0)
);
CREATE INDEX idx_fuel_tanks_warehouse ON fuel_tanks(warehouse_id,is_active);
CREATE TRIGGER fuel_tank_parent_insert BEFORE INSERT ON fuel_tanks
WHEN NEW.is_active=1 AND NOT EXISTS(SELECT 1 FROM warehouses WHERE id=NEW.warehouse_id AND is_active=1 AND kind!='fuel_tank')
BEGIN SELECT RAISE(ABORT,'TANK_WAREHOUSE_INACTIVE'); END;
CREATE TRIGGER fuel_tank_parent_update BEFORE UPDATE OF warehouse_id,is_active ON fuel_tanks
WHEN NEW.is_active=1 AND NOT EXISTS(SELECT 1 FROM warehouses WHERE id=NEW.warehouse_id AND is_active=1 AND kind!='fuel_tank')
BEGIN SELECT RAISE(ABORT,'TANK_WAREHOUSE_INACTIVE'); END;
CREATE TRIGGER warehouse_active_tanks BEFORE UPDATE OF is_active,kind ON warehouses
WHEN (NEW.is_active=0 OR NEW.kind='fuel_tank') AND EXISTS(SELECT 1 FROM fuel_tanks WHERE warehouse_id=NEW.id AND is_active=1)
BEGIN SELECT RAISE(ABORT,'WAREHOUSE_HAS_ACTIVE_TANKS'); END;
