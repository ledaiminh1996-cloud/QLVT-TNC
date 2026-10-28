-- Preparation workspace only: deliberately isolated from inventory_documents/stock_movements.
CREATE TABLE document_counters(period TEXT NOT NULL,kind TEXT NOT NULL,last_no INTEGER NOT NULL CHECK(last_no BETWEEN 1 AND 99999),PRIMARY KEY(period,kind));
CREATE TABLE document_drafts(
 id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),code TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('external_repair','proposal','receipt','issue','recovery','liquidation','retread','warehouse_transfer','equipment_transfer','rotation','opening')),
 business_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','returned','rejected','cancelled')),
 warehouse_id TEXT REFERENCES warehouses(id),to_warehouse_id TEXT REFERENCES warehouses(id),supplier_id TEXT REFERENCES suppliers(id),department_id TEXT REFERENCES departments(id),
 header_json TEXT NOT NULL CHECK(json_valid(header_json)),labels_json TEXT NOT NULL CHECK(json_valid(labels_json)),totals_json TEXT NOT NULL CHECK(json_valid(totals_json)),
 search_text TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES app_users(id),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 workflow_json TEXT CHECK(workflow_json IS NULL OR json_valid(workflow_json)),approval_step INTEGER NOT NULL DEFAULT 0,approval_votes TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(approval_votes)),
 create_key TEXT NOT NULL UNIQUE,create_hash TEXT NOT NULL
);
CREATE TABLE document_draft_lines(id TEXT PRIMARY KEY,document_id TEXT NOT NULL REFERENCES document_drafts(id),line_number INTEGER NOT NULL,part_id TEXT NOT NULL REFERENCES parts(id),line_json TEXT NOT NULL CHECK(json_valid(line_json)),UNIQUE(document_id,line_number));
CREATE INDEX idx_draft_kind_date ON document_drafts(kind,business_at DESC,id);
CREATE INDEX idx_draft_kind_status_date ON document_drafts(kind,status,business_at DESC,id);
CREATE INDEX idx_draft_creator ON document_drafts(created_by,kind,business_at DESC);
CREATE INDEX idx_draft_lines_document ON document_draft_lines(document_id,line_number);
CREATE TABLE document_draft_events(id TEXT PRIMARY KEY,document_id TEXT NOT NULL REFERENCES document_drafts(id),actor_id TEXT NOT NULL REFERENCES app_users(id),action TEXT NOT NULL,reason TEXT NOT NULL,before_json TEXT,after_json TEXT NOT NULL,request_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX idx_draft_events ON document_draft_events(document_id,created_at DESC,id);
CREATE TRIGGER draft_event_immutable_update BEFORE UPDATE ON document_draft_events BEGIN SELECT RAISE(ABORT,'DRAFT_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER draft_event_immutable_delete BEFORE DELETE ON document_draft_events BEGIN SELECT RAISE(ABORT,'DRAFT_HISTORY_IMMUTABLE'); END;
CREATE TABLE document_warehouse_access(user_id TEXT NOT NULL REFERENCES app_users(id),warehouse_id TEXT NOT NULL REFERENCES warehouses(id),PRIMARY KEY(user_id,warehouse_id));
CREATE TABLE document_workflows(id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),name TEXT NOT NULL,department_id TEXT NOT NULL REFERENCES departments(id),proposal_type TEXT NOT NULL CHECK(proposal_type IN ('purchase','issue','transfer','repair')),steps_json TEXT NOT NULL CHECK(json_valid(steps_json)),is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),UNIQUE(department_id,proposal_type));
