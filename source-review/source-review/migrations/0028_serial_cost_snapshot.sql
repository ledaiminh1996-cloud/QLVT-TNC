-- Preserve each serial's incoming unit cost when its current source changes during warehouse transfers.
ALTER TABLE inventory_serials ADD COLUMN cost_vnd_milli INTEGER CHECK(cost_vnd_milli IS NULL OR (typeof(cost_vnd_milli)='integer' AND cost_vnd_milli>=0));
UPDATE inventory_serials SET cost_vnd_milli=(SELECT CAST(round(l.original_value_vnd*1000000.0/l.initial_quantity_milli) AS INTEGER) FROM stock_lots l WHERE l.source_line_id=inventory_serials.document_line_id) WHERE status='in_stock';
