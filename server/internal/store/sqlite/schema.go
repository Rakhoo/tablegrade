package sqlite

// migrations are the schema steps of the server database. PRAGMA user_version holds the number
// of applied steps. Append only: never change a step that has been released.
var migrations = []string{
	`
CREATE TABLE users (
	id          TEXT PRIMARY KEY,
	created_at  INTEGER NOT NULL,
	latest_seq  INTEGER NOT NULL DEFAULT 0,
	purged_seq  INTEGER NOT NULL DEFAULT 0,
	link_failures INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE identities (
	user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	provider   TEXT NOT NULL,
	subject    TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (provider, subject)
) STRICT;
CREATE INDEX identities_user ON identities(user_id);

CREATE TABLE passkeys (
	credential_id BLOB PRIMARY KEY,
	user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	public_key    BLOB NOT NULL,
	sign_count    INTEGER NOT NULL,
	transports    TEXT NOT NULL,
	prf_capable   INTEGER NOT NULL,
	name          TEXT NOT NULL,
	data          BLOB,
	created_at    INTEGER NOT NULL
) STRICT;
CREATE INDEX passkeys_user ON passkeys(user_id);

CREATE TABLE devices (
	id           TEXT PRIMARY KEY,
	user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	name         TEXT NOT NULL,
	created_at   INTEGER NOT NULL,
	last_seen_at INTEGER NOT NULL,
	revoked_at   INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX devices_user ON devices(user_id);

CREATE TABLE sessions (
	token_hash   BLOB PRIMARY KEY,
	user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	device_id    TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
	created_at   INTEGER NOT NULL,
	last_used_at INTEGER NOT NULL,
	expires_at   INTEGER NOT NULL
) STRICT;
CREATE INDEX sessions_device ON sessions(device_id);
CREATE INDEX sessions_expires ON sessions(expires_at);

CREATE TABLE key_wraps (
	id            TEXT PRIMARY KEY,
	user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	kind          TEXT NOT NULL,
	credential_id TEXT,
	alg           TEXT NOT NULL,
	wrapped       BLOB NOT NULL,
	created_at    INTEGER NOT NULL
) STRICT;
CREATE INDEX key_wraps_user ON key_wraps(user_id);

CREATE TABLE records (
	user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	id         TEXT NOT NULL,
	seq        INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	deleted    INTEGER NOT NULL,
	schema     INTEGER NOT NULL,
	ciphertext BLOB NOT NULL,
	device_id  TEXT NOT NULL,
	PRIMARY KEY (user_id, id)
) STRICT;
CREATE UNIQUE INDEX records_seq ON records(user_id, seq);
CREATE INDEX records_tombstones ON records(deleted, updated_at) WHERE deleted = 1;

CREATE TABLE blobs (
	user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	id            TEXT NOT NULL,
	size          INTEGER NOT NULL,
	created_at    INTEGER NOT NULL,
	-- time the last reference disappeared; 0 while a record refers to the blob
	orphaned_at   INTEGER NOT NULL,
	PRIMARY KEY (user_id, id)
) STRICT;
CREATE INDEX blobs_orphaned ON blobs(orphaned_at) WHERE orphaned_at > 0;

CREATE TABLE record_blobs (
	user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	record_id TEXT NOT NULL,
	blob_id   TEXT NOT NULL,
	PRIMARY KEY (user_id, record_id, blob_id)
) STRICT;
CREATE INDEX record_blobs_blob ON record_blobs(user_id, blob_id);

CREATE TABLE links (
	id               TEXT PRIMARY KEY,
	user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	code             TEXT NOT NULL UNIQUE,
	public_key       BLOB NOT NULL,
	other_public_key BLOB,
	wrapped          BLOB,
	created_at       INTEGER NOT NULL,
	expires_at       INTEGER NOT NULL
) STRICT;
CREATE INDEX links_user ON links(user_id);
`,
}
