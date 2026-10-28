-- Separate serial rows; opening a draft never creates stock.
CREATE TABLE document_draft_serials (
 document_id TEXT NOT NULL,line_id TEXT NOT NULL,part_id TEXT NOT NULL REFERENCES parts(id),
 serial_number TEXT NOT NULL CHECK(length(serial_number) BETWEEN 1 AND 128),serial_key TEXT NOT NULL,
 stock_state TEXT NOT NULL CHECK(stock_state IN ('new','recovered','pending_scrap')),
 PRIMARY KEY(document_id,part_id,serial_key),
 FOREIGN KEY(document_id,line_id) REFERENCES document_draft_lines(document_id,id) ON DELETE CASCADE
);
CREATE INDEX idx_draft_serial_line ON document_draft_serials(document_id,line_id);
-- Keep legacy single-serial drafts, including leading zeroes, intact.
INSERT INTO document_draft_serials(document_id,line_id,part_id,serial_number,serial_key,stock_state)
 SELECT document_id,id,part_id,json_extract(line_json,'$.serial'),upper(trim(json_extract(line_json,'$.serial'))),json_extract(line_json,'$.stock_state') FROM document_draft_lines WHERE coalesce(json_extract(line_json,'$.serial'),'')!='';
-- Stock ledger foundation. Only a future posting transaction may update this table.
CREATE TABLE inventory_serials (
 part_id TEXT NOT NULL REFERENCES parts(id),serial_key TEXT NOT NULL,serial_number TEXT NOT NULL,
 warehouse_id TEXT REFERENCES warehouses(id),stock_state TEXT NOT NULL CHECK(stock_state IN ('new','recovered','pending_scrap')),
 status TEXT NOT NULL CHECK(status IN ('in_stock','mounted','out','scrapped')),
 document_line_id TEXT REFERENCES inventory_document_lines(id),PRIMARY KEY(part_id,serial_key)
);
CREATE INDEX idx_inventory_serial_warehouse ON inventory_serials(warehouse_id,part_id,status);
