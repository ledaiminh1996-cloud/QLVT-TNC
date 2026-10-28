-- Exact source price is text/rational; the legacy milli column remains a rounded compatibility projection.
ALTER TABLE inventory_document_lines ADD COLUMN unit_price_numerator TEXT;
ALTER TABLE inventory_document_lines ADD COLUMN unit_price_denominator TEXT;
UPDATE inventory_document_lines SET unit_price_numerator=cast(unit_price_vnd_milli AS TEXT),unit_price_denominator='1000';
ALTER TABLE receipt_line_details ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'unit_net' CHECK(pricing_mode IN ('unit_net','unit_gross','line_gross'));
ALTER TABLE receipt_line_details ADD COLUMN pricing_value TEXT NOT NULL DEFAULT '';
UPDATE receipt_line_details SET pricing_value=coalesce((SELECT json_extract(x.line_json,'$.unit_price') FROM document_draft_lines x JOIN document_drafts d ON d.id=x.document_id JOIN inventory_document_lines l ON l.document_id=d.posted_inventory_id AND l.line_number=x.line_number WHERE l.id=inventory_line_id),'');

ALTER TABLE receipt_line_details ADD COLUMN stock_before_quantity_milli INTEGER;
ALTER TABLE receipt_line_details ADD COLUMN stock_before_value_vnd INTEGER;

-- Reconstruct old snapshots only where posting order is unambiguous and no cancelled history intervenes.
UPDATE receipt_line_details SET
stock_before_quantity_milli=(SELECT coalesce(sum(m.quantity_delta_milli),0) FROM inventory_document_lines own JOIN inventory_documents d ON d.id=own.document_id JOIN stock_movements m ON m.part_id=own.part_id AND m.warehouse_id=own.to_warehouse_id JOIN inventory_document_lines x ON x.id=m.document_line_id JOIN inventory_documents earlier ON earlier.id=x.document_id WHERE own.id=inventory_line_id AND earlier.status='posted' AND earlier.posted_at<d.posted_at),
stock_before_value_vnd=(SELECT coalesce(sum(m.value_delta_vnd),0) FROM inventory_document_lines own JOIN inventory_documents d ON d.id=own.document_id JOIN stock_movements m ON m.part_id=own.part_id AND m.warehouse_id=own.to_warehouse_id JOIN inventory_document_lines x ON x.id=m.document_line_id JOIN inventory_documents earlier ON earlier.id=x.document_id WHERE own.id=inventory_line_id AND earlier.status='posted' AND earlier.posted_at<d.posted_at)
WHERE NOT EXISTS(SELECT 1 FROM inventory_document_lines own JOIN inventory_documents d ON d.id=own.document_id JOIN inventory_document_lines other ON other.part_id=own.part_id AND (other.from_warehouse_id=own.to_warehouse_id OR other.to_warehouse_id=own.to_warehouse_id) JOIN inventory_documents history ON history.id=other.document_id WHERE own.id=inventory_line_id AND history.id<>d.id AND (history.status='cancelled' OR history.posted_at=d.posted_at));
