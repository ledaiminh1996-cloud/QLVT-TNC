-- Preserve maintenance duration in operating hours and a separate reorder unit.
ALTER TABLE parts ADD COLUMN lifespan_hours_limit INTEGER CHECK (lifespan_hours_limit IS NULL OR (typeof(lifespan_hours_limit) = 'integer' AND lifespan_hours_limit > 0));
ALTER TABLE parts ADD COLUMN min_stock_unit TEXT CHECK (min_stock_unit IS NULL OR length(trim(min_stock_unit)) BETWEEN 1 AND 32);
