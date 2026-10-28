-- Existing Access subjects remain linked; newly provisioned emails bind once after verified Access login.
ALTER TABLE app_users ADD COLUMN access_linked INTEGER NOT NULL DEFAULT 1 CHECK(access_linked IN (0,1));
ALTER TABLE app_users ADD COLUMN access_linked_at TEXT;
