CREATE INDEX idx_audit_catalog_history ON audit_events(entity_type,entity_id,created_at DESC,id DESC);
