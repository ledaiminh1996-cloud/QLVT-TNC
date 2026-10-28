-- Explicit valuation state. Numeric ledger fields on pending lines are provisional, not a known zero value.
CREATE TABLE inventory_valuation_flags (
 inventory_line_id TEXT PRIMARY KEY REFERENCES inventory_document_lines(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')),
 reason TEXT NOT NULL,
 origin_line_id TEXT REFERENCES inventory_document_lines(id),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_inventory_valuation_status ON inventory_valuation_flags(status,inventory_line_id);
