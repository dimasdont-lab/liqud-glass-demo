CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_credential TEXT,
  credential_iv TEXT,
  external_connection_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authorization_states (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  connection_id TEXT,
  provider TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  account_type TEXT,
  currency TEXT NOT NULL,
  current_balance REAL NOT NULL,
  available_balance REAL,
  external_account_ref TEXT,
  last_synced_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_connections_user ON bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);


