CREATE TABLE equipment (
 id TEXT PRIMARY KEY NOT NULL,
 code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(code))>0),
 name TEXT NOT NULL CHECK(length(trim(name))>0),
 type TEXT NOT NULL CHECK(type IN ('generator','container')),
 brand_model TEXT NOT NULL DEFAULT '',
 serial_number TEXT,
 manufacture_year INTEGER CHECK(manufacture_year IS NULL OR manufacture_year BETWEEN 1900 AND 2100),
 operating_hours INTEGER NOT NULL DEFAULT 0 CHECK(typeof(operating_hours)='integer' AND operating_hours>=0),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','maintenance','stopped')),
 notes TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE INDEX idx_equipment_type_status ON equipment(type,status);
CREATE INDEX idx_vehicles_type_status ON vehicles(type,status);
