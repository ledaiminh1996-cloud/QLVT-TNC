-- Import metadata and editable parameter/pairing draft catalogs. No operational pairing is activated.
ALTER TABLE vehicles ADD COLUMN source_group TEXT;
ALTER TABLE vehicles ADD COLUMN chassis_number TEXT;
ALTER TABLE vehicles ADD COLUMN engine_number TEXT;
ALTER TABLE vehicles ADD COLUMN load_spec TEXT;
ALTER TABLE vehicles ADD COLUMN container_spec TEXT;
ALTER TABLE vehicles ADD COLUMN ownership_source TEXT;
ALTER TABLE vehicles ADD COLUMN lessor_name TEXT;
ALTER TABLE vehicles ADD COLUMN contract_number TEXT;
ALTER TABLE vehicles ADD COLUMN route_group TEXT;
ALTER TABLE vehicles ADD COLUMN location_unit TEXT;
ALTER TABLE vehicles ADD COLUMN generator_type TEXT;
ALTER TABLE vehicles ADD COLUMN original_status TEXT;
ALTER TABLE equipment ADD COLUMN source_group TEXT;
ALTER TABLE equipment ADD COLUMN chassis_number TEXT;
ALTER TABLE equipment ADD COLUMN engine_number TEXT;
ALTER TABLE equipment ADD COLUMN load_spec TEXT;
ALTER TABLE equipment ADD COLUMN container_spec TEXT;
ALTER TABLE equipment ADD COLUMN ownership_source TEXT;
ALTER TABLE equipment ADD COLUMN lessor_name TEXT;
ALTER TABLE equipment ADD COLUMN contract_number TEXT;
ALTER TABLE equipment ADD COLUMN route_group TEXT;
ALTER TABLE equipment ADD COLUMN location_unit TEXT;
ALTER TABLE equipment ADD COLUMN generator_type TEXT;
ALTER TABLE equipment ADD COLUMN original_status TEXT;
CREATE TABLE equipment_parameters (
 id TEXT PRIMARY KEY NOT NULL,
 group_key TEXT NOT NULL CHECK(group_key IN ('route','equipment_type','source','condition')),
 code TEXT NOT NULL COLLATE NOCASE,
 name TEXT NOT NULL CHECK(length(trim(name))>0),
 notes TEXT,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(group_key,code)
);
CREATE TABLE equipment_pairing_drafts (
 id TEXT PRIMARY KEY NOT NULL,
 parent_code TEXT NOT NULL COLLATE NOCASE,
 child_code TEXT NOT NULL COLLATE NOCASE,
 pairing_type TEXT NOT NULL CHECK(pairing_type IN ('trailer','generator','container')),
 effective_from TEXT,
 updated_by_name TEXT,
 notes TEXT,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK(parent_code!=child_code)
);
CREATE UNIQUE INDEX idx_pairing_draft_child ON equipment_pairing_drafts(child_code) WHERE is_active=1;
CREATE INDEX idx_vehicle_source_group ON vehicles(source_group,status);
CREATE TRIGGER pairing_draft_insert BEFORE INSERT ON equipment_pairing_drafts WHEN NOT EXISTS(SELECT 1 FROM vehicles WHERE plate_number=NEW.parent_code AND type='tractor') OR (NEW.pairing_type='trailer' AND NOT EXISTS(SELECT 1 FROM vehicles WHERE plate_number=NEW.child_code AND type='trailer')) OR (NEW.pairing_type IN ('generator','container') AND NOT EXISTS(SELECT 1 FROM equipment WHERE code=NEW.child_code AND type=NEW.pairing_type)) BEGIN SELECT RAISE(ABORT,'PAIRING_INVALID_REFERENCE'); END;
CREATE TRIGGER pairing_draft_update BEFORE UPDATE ON equipment_pairing_drafts WHEN NOT EXISTS(SELECT 1 FROM vehicles WHERE plate_number=NEW.parent_code AND type='tractor') OR (NEW.pairing_type='trailer' AND NOT EXISTS(SELECT 1 FROM vehicles WHERE plate_number=NEW.child_code AND type='trailer')) OR (NEW.pairing_type IN ('generator','container') AND NOT EXISTS(SELECT 1 FROM equipment WHERE code=NEW.child_code AND type=NEW.pairing_type)) BEGIN SELECT RAISE(ABORT,'PAIRING_INVALID_REFERENCE'); END;
CREATE TRIGGER pairing_draft_preserve_vehicles BEFORE UPDATE OF plate_number,type ON vehicles WHEN (NEW.plate_number!=OLD.plate_number OR NEW.type!=OLD.type) AND EXISTS(SELECT 1 FROM equipment_pairing_drafts WHERE parent_code=OLD.plate_number OR child_code=OLD.plate_number) BEGIN SELECT RAISE(ABORT,'PAIRING_REFERENCED_CODE'); END;
CREATE TRIGGER pairing_draft_preserve_equipment BEFORE UPDATE OF code,type ON equipment WHEN (NEW.code!=OLD.code OR NEW.type!=OLD.type) AND EXISTS(SELECT 1 FROM equipment_pairing_drafts WHERE parent_code=OLD.code OR child_code=OLD.code) BEGIN SELECT RAISE(ABORT,'PAIRING_REFERENCED_CODE'); END;
