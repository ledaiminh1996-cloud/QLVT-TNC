-- Catalog reference price (VND) and minimum quantity (thousandths of base unit).
ALTER TABLE parts ADD COLUMN unit_price_vnd INTEGER NOT NULL DEFAULT 0 CHECK (typeof(unit_price_vnd) = 'integer' AND unit_price_vnd >= 0);
ALTER TABLE parts ADD COLUMN min_stock_milli INTEGER NOT NULL DEFAULT 0 CHECK (typeof(min_stock_milli) = 'integer' AND min_stock_milli >= 0);
