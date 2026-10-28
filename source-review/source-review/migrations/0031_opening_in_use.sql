-- Mounted opening balances are usage sources, never warehouse receipts or issues.
CREATE TABLE opening_usage_lines (
 inventory_line_id TEXT PRIMARY KEY REFERENCES inventory_document_lines(id),
 part_id TEXT NOT NULL REFERENCES parts(id),
 target_type TEXT NOT NULL CHECK(target_type IN ('vehicle','equipment')),
 target_id TEXT NOT NULL,
 position TEXT NOT NULL DEFAULT '',
 is_serialized INTEGER NOT NULL CHECK(is_serialized IN (0,1)),
 declared_at TEXT NOT NULL,
 installed_at TEXT,
 original_unit_price_known INTEGER NOT NULL CHECK(original_unit_price_known IN (0,1))
);
CREATE UNIQUE INDEX idx_opening_usage_quantity_once ON opening_usage_lines(part_id,target_type,target_id,position) WHERE is_serialized=0;

-- A mounted declaration is not warehouse movement history.
DROP TRIGGER opening_no_prior_stock;
CREATE TRIGGER opening_no_prior_stock BEFORE INSERT ON opening_groups WHEN EXISTS(SELECT 1 FROM inventory_document_lines l JOIN inventory_documents d ON d.id=l.document_id WHERE l.part_id=NEW.part_id AND (l.to_warehouse_id=NEW.warehouse_id OR l.from_warehouse_id=NEW.warehouse_id) AND d.status='posted' AND d.id<>NEW.document_id AND NOT EXISTS(SELECT 1 FROM opening_usage_lines ou WHERE ou.inventory_line_id=l.id)) BEGIN SELECT RAISE(ABORT,'OPENING_HAS_HISTORY'); END;
