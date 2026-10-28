-- Editable personnel rank; independent of employee/driver grouping and access roles.
ALTER TABLE staff ADD COLUMN staff_rank TEXT CHECK (staff_rank IS NULL OR length(staff_rank) <= 256);
