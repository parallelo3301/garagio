CREATE TABLE auth_sessions (
  session_id TEXT PRIMARY KEY,
  ip_address TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);