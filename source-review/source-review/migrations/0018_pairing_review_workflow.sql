ALTER TABLE pairing_set_versions ADD COLUMN reviewed_version INTEGER;
ALTER TABLE pairing_set_versions ADD COLUMN reviewed_by TEXT REFERENCES app_users(id);
ALTER TABLE pairing_set_versions ADD COLUMN reviewed_at TEXT;
CREATE TABLE pairing_change_events (
 id TEXT PRIMARY KEY NOT NULL,
 parent_id TEXT NOT NULL REFERENCES vehicles(id),
 action TEXT NOT NULL,
 effective_at TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason))>0),
 actor_id TEXT NOT NULL REFERENCES app_users(id),
 before_json TEXT NOT NULL,
 after_json TEXT NOT NULL,
 request_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_pairing_changes_parent ON pairing_change_events(parent_id,created_at DESC);
CREATE TRIGGER pairing_driver_guard BEFORE UPDATE OF assigned_driver_id ON vehicles
WHEN NEW.assigned_driver_id IS NOT OLD.assigned_driver_id AND NEW.assigned_driver_id IS NOT NULL
AND EXISTS(SELECT 1 FROM vehicles WHERE id!=NEW.id AND assigned_driver_id=NEW.assigned_driver_id AND type='tractor')
BEGIN SELECT RAISE(ABORT,'DRIVER_PAIRING_IN_USE'); END;
CREATE TRIGGER pairing_vehicle_state AFTER UPDATE OF assigned_driver_id,status ON vehicles
WHEN NEW.assigned_driver_id IS NOT OLD.assigned_driver_id OR NEW.status IS NOT OLD.status
BEGIN
 UPDATE pairing_set_versions SET version=version+1 WHERE parent_id=NEW.id OR parent_id IN
 (SELECT v.id FROM vehicles v JOIN equipment_pairing_drafts d ON d.parent_code=v.plate_number WHERE d.child_code=NEW.plate_number AND d.pairing_type='trailer' AND d.is_active=1);
END;
CREATE TRIGGER pairing_equipment_state AFTER UPDATE OF status ON equipment WHEN NEW.status IS NOT OLD.status BEGIN
 UPDATE pairing_set_versions SET version=version+1 WHERE parent_id IN
 (SELECT v.id FROM vehicles v JOIN equipment_pairing_drafts d ON d.parent_code=v.plate_number WHERE d.child_code=NEW.code AND d.pairing_type IN ('generator','container') AND d.is_active=1);
END;
CREATE TRIGGER pairing_staff_state AFTER UPDATE OF is_active,name,code ON staff
WHEN NEW.is_active IS NOT OLD.is_active OR NEW.name IS NOT OLD.name OR NEW.code IS NOT OLD.code
BEGIN UPDATE pairing_set_versions SET version=version+1 WHERE parent_id IN (SELECT id FROM vehicles WHERE assigned_driver_id=NEW.id); END;
CREATE TRIGGER pairing_change_immutable_update BEFORE UPDATE ON pairing_change_events BEGIN SELECT RAISE(ABORT,'PAIRING_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER pairing_change_immutable_delete BEFORE DELETE ON pairing_change_events BEGIN SELECT RAISE(ABORT,'PAIRING_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER pairing_driver_guard_insert BEFORE INSERT ON vehicles
WHEN NEW.type='tractor' AND NEW.assigned_driver_id IS NOT NULL AND EXISTS(SELECT 1 FROM vehicles WHERE assigned_driver_id=NEW.assigned_driver_id AND type='tractor')
BEGIN SELECT RAISE(ABORT,'DRIVER_PAIRING_IN_USE'); END;
