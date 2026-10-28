-- Preserve fields already editable in the original directory screens.
ALTER TABLE staff ADD COLUMN vehicle_plate TEXT;
ALTER TABLE staff ADD COLUMN trailer_plate TEXT;
ALTER TABLE suppliers ADD COLUMN supplied_items TEXT;
ALTER TABLE warehouses ADD COLUMN type_label TEXT;
