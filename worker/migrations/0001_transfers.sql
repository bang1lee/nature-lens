CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  read_hash TEXT NOT NULL,
  delete_hash TEXT NOT NULL,
  payload BLOB NOT NULL,
  size INTEGER NOT NULL CHECK (size BETWEEN 33 AND 1048576 AND size = length(payload)),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX transfers_expires ON transfers(expires_at);
CREATE TABLE creations (
  id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX creations_time ON creations(created_at);
CREATE INDEX creations_ip ON creations(ip_hash, created_at);
CREATE TABLE read_failures (ip_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX read_failures_ip ON read_failures(ip_hash, created_at);
CREATE INDEX read_failures_time ON read_failures(created_at);
