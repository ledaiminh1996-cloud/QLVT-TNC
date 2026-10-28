-- Native authentication; existing user IDs and inventory history remain unchanged.
CREATE TABLE native_credentials(user_id TEXT PRIMARY KEY REFERENCES app_users(id),password_hash TEXT NOT NULL,credential_version INTEGER NOT NULL DEFAULT 1 CHECK(credential_version>0),must_change INTEGER NOT NULL DEFAULT 1 CHECK(must_change IN(0,1)),updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE native_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),credential_version INTEGER NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,idle_expires_at INTEGER NOT NULL);
CREATE INDEX native_sessions_user ON native_sessions(user_id);
CREATE INDEX native_sessions_expiry ON native_sessions(expires_at);
CREATE TABLE native_login_limits(bucket TEXT PRIMARY KEY,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL);
CREATE TABLE native_activation_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id),expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0 CHECK(used IN(0,1)),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0));
