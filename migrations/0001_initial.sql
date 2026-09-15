CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions(id TEXT PRIMARY KEY,login TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS generations(row_id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,generation_id TEXT NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL,model TEXT NOT NULL,prompt_version TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(user_id,generation_id));
CREATE INDEX IF NOT EXISTS generations_created_at_idx ON generations(created_at DESC);
CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY AUTOINCREMENT,created_at INTEGER NOT NULL,event_type TEXT NOT NULL,actor TEXT,request_id TEXT,details TEXT);
