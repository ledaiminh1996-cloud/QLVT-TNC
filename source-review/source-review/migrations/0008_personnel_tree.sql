CREATE TABLE org_units (
 id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(code))>0), name TEXT NOT NULL CHECK(length(trim(name))>0), is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE departments (
 id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(code))>0), name TEXT NOT NULL CHECK(length(trim(name))>0), unit_id TEXT NOT NULL REFERENCES org_units(id) ON DELETE RESTRICT, kind TEXT NOT NULL DEFAULT 'employee' CHECK(kind IN ('employee','driver')), is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
ALTER TABLE staff ADD COLUMN staff_type TEXT NOT NULL DEFAULT 'employee' CHECK(staff_type IN ('employee','driver'));
ALTER TABLE staff ADD COLUMN unit_id TEXT REFERENCES org_units(id) ON DELETE RESTRICT;
ALTER TABLE staff ADD COLUMN department_id TEXT REFERENCES departments(id) ON DELETE RESTRICT;
UPDATE staff SET staff_type='driver' WHERE job_title LIKE '%lái xe%' OR job_title LIKE '%tài xế%' OR id IN (SELECT assigned_driver_id FROM vehicles WHERE assigned_driver_id IS NOT NULL);
CREATE INDEX idx_departments_unit ON departments(unit_id,is_active);
CREATE INDEX idx_staff_department ON staff(unit_id,department_id,staff_type,is_active);
CREATE TRIGGER department_parent_insert BEFORE INSERT ON departments WHEN NEW.is_active=1 AND NOT EXISTS(SELECT 1 FROM org_units WHERE id=NEW.unit_id AND is_active=1) BEGIN SELECT RAISE(ABORT,'ORG_INVALID_PARENT'); END;
CREATE TRIGGER department_parent_update BEFORE UPDATE OF unit_id,is_active,kind ON departments WHEN (NEW.is_active=1 AND NOT EXISTS(SELECT 1 FROM org_units WHERE id=NEW.unit_id AND is_active=1)) OR EXISTS(SELECT 1 FROM staff WHERE department_id=NEW.id AND (unit_id!=NEW.unit_id OR staff_type!=NEW.kind OR (is_active=1 AND NEW.is_active=0))) BEGIN SELECT RAISE(ABORT,'ORG_HAS_MEMBERS'); END;
CREATE TRIGGER org_unit_children BEFORE UPDATE OF is_active ON org_units WHEN NEW.is_active=0 AND (EXISTS(SELECT 1 FROM departments WHERE unit_id=NEW.id AND is_active=1) OR EXISTS(SELECT 1 FROM staff WHERE unit_id=NEW.id AND is_active=1)) BEGIN SELECT RAISE(ABORT,'ORG_HAS_MEMBERS'); END;
CREATE TRIGGER staff_org_insert BEFORE INSERT ON staff WHEN (NEW.department_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM departments WHERE id=NEW.department_id AND unit_id=NEW.unit_id AND kind=NEW.staff_type AND (NEW.is_active=0 OR is_active=1))) OR (NEW.is_active=1 AND NEW.unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM org_units WHERE id=NEW.unit_id AND is_active=1)) BEGIN SELECT RAISE(ABORT,'ORG_INVALID_PARENT'); END;
CREATE TRIGGER staff_org_update BEFORE UPDATE OF unit_id,department_id,staff_type,is_active ON staff WHEN (NEW.department_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM departments WHERE id=NEW.department_id AND unit_id=NEW.unit_id AND kind=NEW.staff_type AND (NEW.is_active=0 OR is_active=1))) OR (NEW.is_active=1 AND NEW.unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM org_units WHERE id=NEW.unit_id AND is_active=1)) OR (NEW.staff_type!='driver' AND EXISTS(SELECT 1 FROM vehicles WHERE assigned_driver_id=NEW.id)) BEGIN SELECT RAISE(ABORT,'ORG_INVALID_PARENT'); END;

CREATE TRIGGER vehicle_driver_insert BEFORE INSERT ON vehicles WHEN NEW.assigned_driver_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM staff WHERE id=NEW.assigned_driver_id AND is_active=1 AND staff_type='driver') BEGIN SELECT RAISE(ABORT,'ORG_INVALID_PARENT'); END;
CREATE TRIGGER vehicle_driver_update BEFORE UPDATE OF assigned_driver_id ON vehicles WHEN NEW.assigned_driver_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM staff WHERE id=NEW.assigned_driver_id AND is_active=1 AND staff_type='driver') BEGIN SELECT RAISE(ABORT,'ORG_INVALID_PARENT'); END;
