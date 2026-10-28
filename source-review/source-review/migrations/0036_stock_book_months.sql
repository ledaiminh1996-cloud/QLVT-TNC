-- Derived monthly quantities only. Existing ledger and document history are unchanged.
CREATE VIEW stock_book_flow AS SELECT m.id,m.part_id,m.warehouse_id,m.quantity_delta_milli,d.id AS document_id,d.business_date AS day,d.status,
 coalesce(json_extract(dl.line_json,'$.stock_state'),CASE WHEN d.type='RECOVERY' THEN 'recovered' ELSE 'new' END) AS stock_state
 FROM stock_movements m JOIN inventory_document_lines l ON l.id=m.document_line_id JOIN inventory_documents d ON d.id=l.document_id
 LEFT JOIN document_drafts dd ON dd.posted_inventory_id=d.id OR (substr(d.source_reference,1,16)='retread-receive:' AND dd.id=substr(d.source_reference,17))
 LEFT JOIN document_draft_lines dl ON dl.document_id=dd.id AND dl.line_number=l.line_number;
CREATE TABLE stock_book_months(
 period TEXT NOT NULL,part_id TEXT NOT NULL REFERENCES parts(id),warehouse_id TEXT NOT NULL REFERENCES warehouses(id),stock_state TEXT NOT NULL CHECK(stock_state IN ('new','recovered','pending_scrap')),
 quantity_milli INTEGER NOT NULL CHECK(typeof(quantity_milli)='integer'),movement_count INTEGER NOT NULL CHECK(movement_count>=0),
 PRIMARY KEY(part_id,warehouse_id,stock_state,period));
CREATE INDEX idx_stock_book_month_period ON stock_book_months(period);
INSERT INTO stock_book_months(period,part_id,warehouse_id,stock_state,quantity_milli,movement_count)
 SELECT substr(day,1,7),part_id,warehouse_id,stock_state,sum(quantity_delta_milli),count(*) FROM stock_book_flow WHERE status='posted' AND 1
 GROUP BY substr(day,1,7),part_id,warehouse_id,stock_state
 ON CONFLICT(period,part_id,warehouse_id,stock_state) DO UPDATE SET quantity_milli=quantity_milli+excluded.quantity_milli,movement_count=movement_count+excluded.movement_count;
CREATE TRIGGER stock_book_movement_insert AFTER INSERT ON stock_movements BEGIN
INSERT INTO stock_book_months(period,part_id,warehouse_id,stock_state,quantity_milli,movement_count)
 SELECT substr(day,1,7),part_id,warehouse_id,stock_state,sum(quantity_delta_milli),count(*) FROM stock_book_flow WHERE status='posted' AND id=NEW.id
 GROUP BY substr(day,1,7),part_id,warehouse_id,stock_state
 ON CONFLICT(period,part_id,warehouse_id,stock_state) DO UPDATE SET quantity_milli=quantity_milli+excluded.quantity_milli,movement_count=movement_count+excluded.movement_count;
END;
CREATE TRIGGER stock_book_movement_delete BEFORE DELETE ON stock_movements BEGIN
UPDATE stock_book_months SET
 quantity_milli=quantity_milli-coalesce((SELECT sum(f.quantity_delta_milli) FROM stock_book_flow f WHERE f.status='posted' AND f.id=OLD.id AND substr(f.day,1,7)=period AND f.part_id=stock_book_months.part_id AND f.warehouse_id=stock_book_months.warehouse_id AND f.stock_state=stock_book_months.stock_state),0),
 movement_count=movement_count-coalesce((SELECT count(*) FROM stock_book_flow f WHERE f.status='posted' AND f.id=OLD.id AND substr(f.day,1,7)=period AND f.part_id=stock_book_months.part_id AND f.warehouse_id=stock_book_months.warehouse_id AND f.stock_state=stock_book_months.stock_state),0)
 WHERE part_id=OLD.part_id AND warehouse_id=OLD.warehouse_id AND stock_state=(SELECT stock_state FROM stock_book_flow WHERE id=OLD.id) AND period=(SELECT substr(day,1,7) FROM stock_book_flow WHERE id=OLD.id) AND EXISTS(SELECT 1 FROM stock_book_flow f WHERE f.status='posted' AND f.id=OLD.id AND substr(f.day,1,7)=period AND f.part_id=stock_book_months.part_id AND f.warehouse_id=stock_book_months.warehouse_id AND f.stock_state=stock_book_months.stock_state);
 DELETE FROM stock_book_months WHERE movement_count=0 AND part_id=OLD.part_id AND warehouse_id=OLD.warehouse_id;
END;
CREATE TRIGGER stock_book_movement_update_before BEFORE UPDATE OF document_line_id,part_id,warehouse_id,quantity_delta_milli ON stock_movements BEGIN
UPDATE stock_book_months SET
 quantity_milli=quantity_milli-coalesce((SELECT sum(f.quantity_delta_milli) FROM stock_book_flow f WHERE f.status='posted' AND f.id=OLD.id AND substr(f.day,1,7)=period AND f.part_id=stock_book_months.part_id AND f.warehouse_id=stock_book_months.warehouse_id AND f.stock_state=stock_book_months.stock_state),0),
 movement_count=movement_count-coalesce((SELECT count(*) FROM stock_book_flow f WHERE f.status='posted' AND f.id=OLD.id AND substr(f.day,1,7)=period AND f.part_id=stock_book_months.part_id AND f.warehouse_id=stock_book_months.warehouse_id AND f.stock_state=stock_book_months.stock_state),0)
 WHERE part_id=OLD.part_id AND warehouse_id=OLD.warehouse_id AND stock_state=(SELECT stock_state FROM stock_book_flow WHERE id=OLD.id) AND period=(SELECT substr(day,1,7) FROM stock_book_flow WHERE id=OLD.id) AND EXISTS(SELECT 1 FROM stock_book_flow f WHERE f.status='posted' AND f.id=OLD.id AND substr(f.day,1,7)=period AND f.part_id=stock_book_months.part_id AND f.warehouse_id=stock_book_months.warehouse_id AND f.stock_state=stock_book_months.stock_state);
 DELETE FROM stock_book_months WHERE movement_count=0 AND part_id=OLD.part_id AND warehouse_id=OLD.warehouse_id;
END;
CREATE TRIGGER stock_book_movement_update_after AFTER UPDATE OF document_line_id,part_id,warehouse_id,quantity_delta_milli ON stock_movements BEGIN
INSERT INTO stock_book_months(period,part_id,warehouse_id,stock_state,quantity_milli,movement_count)
 SELECT substr(day,1,7),part_id,warehouse_id,stock_state,sum(quantity_delta_milli),count(*) FROM stock_book_flow WHERE status='posted' AND id=NEW.id
 GROUP BY substr(day,1,7),part_id,warehouse_id,stock_state
 ON CONFLICT(period,part_id,warehouse_id,stock_state) DO UPDATE SET quantity_milli=quantity_milli+excluded.quantity_milli,movement_count=movement_count+excluded.movement_count;
END;
CREATE TRIGGER stock_book_document_before BEFORE UPDATE OF business_date,status ON inventory_documents WHEN OLD.status='posted' AND (NEW.business_date<>OLD.business_date OR NEW.status<>OLD.status) BEGIN
UPDATE stock_book_months SET
 quantity_milli=quantity_milli-coalesce((SELECT sum(f.quantity_delta_milli) FROM stock_book_flow f WHERE f.status='posted' AND f.document_id=OLD.id AND substr(f.day,1,7)=period AND f.part_id=stock_book_months.part_id AND f.warehouse_id=stock_book_months.warehouse_id AND f.stock_state=stock_book_months.stock_state),0),
 movement_count=movement_count-coalesce((SELECT count(*) FROM stock_book_flow f WHERE f.status='posted' AND f.document_id=OLD.id AND substr(f.day,1,7)=period AND f.part_id=stock_book_months.part_id AND f.warehouse_id=stock_book_months.warehouse_id AND f.stock_state=stock_book_months.stock_state),0)
 WHERE period=substr(OLD.business_date,1,7) AND EXISTS(SELECT 1 FROM stock_book_flow f WHERE f.status='posted' AND f.document_id=OLD.id AND substr(f.day,1,7)=period AND f.part_id=stock_book_months.part_id AND f.warehouse_id=stock_book_months.warehouse_id AND f.stock_state=stock_book_months.stock_state);
 DELETE FROM stock_book_months WHERE movement_count=0 AND period=substr(OLD.business_date,1,7);
END;
CREATE TRIGGER stock_book_document_after AFTER UPDATE OF business_date,status ON inventory_documents WHEN NEW.status='posted' AND (NEW.business_date<>OLD.business_date OR NEW.status<>OLD.status) BEGIN
INSERT INTO stock_book_months(period,part_id,warehouse_id,stock_state,quantity_milli,movement_count)
 SELECT substr(day,1,7),part_id,warehouse_id,stock_state,sum(quantity_delta_milli),count(*) FROM stock_book_flow WHERE status='posted' AND document_id=NEW.id
 GROUP BY substr(day,1,7),part_id,warehouse_id,stock_state
 ON CONFLICT(period,part_id,warehouse_id,stock_state) DO UPDATE SET quantity_milli=quantity_milli+excluded.quantity_milli,movement_count=movement_count+excluded.movement_count;
END;
