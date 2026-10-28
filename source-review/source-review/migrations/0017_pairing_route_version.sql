-- Route belongs to the tractor; catalog edits must invalidate open pairing forms.
CREATE TRIGGER pairing_set_route_update AFTER UPDATE OF route_group ON vehicles
WHEN NEW.type='tractor' AND NEW.route_group IS NOT OLD.route_group
BEGIN
 UPDATE pairing_set_versions SET version=version+1 WHERE parent_id=NEW.id;
END;
