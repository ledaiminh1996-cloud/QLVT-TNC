CREATE TABLE pairing_set_versions (
 parent_id TEXT PRIMARY KEY NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1)
);
INSERT INTO pairing_set_versions(parent_id,version) SELECT id,1 FROM vehicles WHERE type='tractor';
CREATE TRIGGER pairing_set_new_tractor AFTER INSERT ON vehicles WHEN NEW.type='tractor' BEGIN INSERT OR IGNORE INTO pairing_set_versions(parent_id,version) VALUES(NEW.id,1); END;
CREATE TRIGGER pairing_set_insert AFTER INSERT ON equipment_pairing_drafts BEGIN
 INSERT INTO pairing_set_versions(parent_id,version) SELECT id,1 FROM vehicles WHERE plate_number=NEW.parent_code ON CONFLICT(parent_id) DO UPDATE SET version=version+1;
END;
CREATE TRIGGER pairing_set_update AFTER UPDATE ON equipment_pairing_drafts BEGIN
 INSERT INTO pairing_set_versions(parent_id,version) SELECT id,1 FROM vehicles WHERE plate_number=OLD.parent_code OR plate_number=NEW.parent_code ON CONFLICT(parent_id) DO UPDATE SET version=version+1;
END;
CREATE TRIGGER pairing_set_delete AFTER DELETE ON equipment_pairing_drafts BEGIN
 UPDATE pairing_set_versions SET version=version+1 WHERE parent_id=(SELECT id FROM vehicles WHERE plate_number=OLD.parent_code);
END;

CREATE TRIGGER pairing_draft_active_insert BEFORE INSERT ON equipment_pairing_drafts WHEN NEW.is_active=1 AND (NOT EXISTS(SELECT 1 FROM vehicles WHERE plate_number=NEW.parent_code AND status='active') OR (NEW.pairing_type='trailer' AND NOT EXISTS(SELECT 1 FROM vehicles WHERE plate_number=NEW.child_code AND status='active')) OR (NEW.pairing_type='generator' AND NOT EXISTS(SELECT 1 FROM equipment WHERE code=NEW.child_code AND status='active'))) BEGIN SELECT RAISE(ABORT,'PAIRING_INVALID_REFERENCE'); END;

CREATE TRIGGER pairing_set_changed_tractor AFTER UPDATE OF type ON vehicles WHEN NEW.type='tractor' BEGIN INSERT OR IGNORE INTO pairing_set_versions(parent_id,version) VALUES(NEW.id,1); END;
