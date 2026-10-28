-- Receipt-only posting, linked atomically to its prepared metadata.
ALTER TABLE document_drafts ADD COLUMN posted_inventory_id TEXT REFERENCES inventory_documents(id);
CREATE UNIQUE INDEX idx_prepared_posted_document ON document_drafts(posted_inventory_id) WHERE posted_inventory_id IS NOT NULL;
CREATE TABLE receipt_line_details (
 inventory_line_id TEXT PRIMARY KEY REFERENCES inventory_document_lines(id),
 invoice_quantity_milli INTEGER NOT NULL CHECK(invoice_quantity_milli>=0 AND invoice_quantity_milli<=9000000000000000),vat_rate_hundredths INTEGER NOT NULL CHECK(vat_rate_hundredths BETWEEN 0 AND 10000),
 net_vnd INTEGER NOT NULL CHECK(net_vnd>=0),vat_vnd INTEGER NOT NULL CHECK(vat_vnd>=0),gross_vnd INTEGER NOT NULL CHECK(gross_vnd=net_vnd+vat_vnd),
 tank_id TEXT REFERENCES fuel_tanks(id),data_package TEXT NOT NULL DEFAULT ''
);
CREATE TABLE stock_balances (
 part_id TEXT NOT NULL REFERENCES parts(id),warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
 quantity_milli INTEGER NOT NULL CHECK(typeof(quantity_milli)='integer' AND quantity_milli>=0 AND quantity_milli<=9000000000000000),
 value_vnd INTEGER NOT NULL CHECK(typeof(value_vnd)='integer' AND value_vnd>=0 AND value_vnd<=9000000000000000),PRIMARY KEY(part_id,warehouse_id)
);
INSERT INTO stock_balances SELECT part_id,warehouse_id,quantity_milli,carrying_value_vnd FROM current_stock;
CREATE TRIGGER receipt_post_locked BEFORE INSERT ON inventory_documents WHEN NEW.status='posted' AND substr(NEW.business_date,1,7)<=(SELECT max(period) FROM accounting_periods WHERE is_locked=1) BEGIN SELECT RAISE(ABORT,'RECEIPT_PERIOD_LOCKED'); END;
CREATE TRIGGER posted_prepared_update BEFORE UPDATE ON document_drafts WHEN OLD.posted_inventory_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'POSTED_DOCUMENT_IMMUTABLE'); END;
CREATE TRIGGER posted_prepared_delete BEFORE DELETE ON document_drafts WHEN OLD.posted_inventory_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'POSTED_DOCUMENT_IMMUTABLE'); END;
CREATE TRIGGER posted_document_draft_lines_insert BEFORE INSERT ON document_draft_lines WHEN (SELECT posted_inventory_id FROM document_drafts WHERE id=NEW.document_id) IS NOT NULL BEGIN SELECT RAISE(ABORT,'POSTED_DOCUMENT_IMMUTABLE'); END;
CREATE TRIGGER posted_document_draft_lines_update BEFORE UPDATE ON document_draft_lines WHEN (SELECT posted_inventory_id FROM document_drafts WHERE id=OLD.document_id) IS NOT NULL BEGIN SELECT RAISE(ABORT,'POSTED_DOCUMENT_IMMUTABLE'); END;
CREATE TRIGGER posted_document_draft_lines_delete BEFORE DELETE ON document_draft_lines WHEN (SELECT posted_inventory_id FROM document_drafts WHERE id=OLD.document_id) IS NOT NULL BEGIN SELECT RAISE(ABORT,'POSTED_DOCUMENT_IMMUTABLE'); END;
CREATE TRIGGER posted_document_draft_serials_insert BEFORE INSERT ON document_draft_serials WHEN (SELECT posted_inventory_id FROM document_drafts WHERE id=NEW.document_id) IS NOT NULL BEGIN SELECT RAISE(ABORT,'POSTED_DOCUMENT_IMMUTABLE'); END;
CREATE TRIGGER posted_document_draft_serials_update BEFORE UPDATE ON document_draft_serials WHEN (SELECT posted_inventory_id FROM document_drafts WHERE id=OLD.document_id) IS NOT NULL BEGIN SELECT RAISE(ABORT,'POSTED_DOCUMENT_IMMUTABLE'); END;
CREATE TRIGGER posted_document_draft_serials_delete BEFORE DELETE ON document_draft_serials WHEN (SELECT posted_inventory_id FROM document_drafts WHERE id=OLD.document_id) IS NOT NULL BEGIN SELECT RAISE(ABORT,'POSTED_DOCUMENT_IMMUTABLE'); END;

