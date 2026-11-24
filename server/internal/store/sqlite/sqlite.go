// Package sqlite implements store.Store with SQLite (modernc.org/sqlite, no CGO). It uses WAL,
// a busy timeout, one connection for all writes and a pool for reads.
package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/store"
	sqlitedrv "modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

// readConns is the size of the read pool; SQLite in WAL mode reads in parallel to the writer.
const readConns = 4

// DB is the SQLite store.
type DB struct {
	write *sql.DB
	read  *sql.DB
	now   func() time.Time
}

var _ store.Store = (*DB)(nil)

// Option changes the behavior of Open.
type Option func(*DB)

// WithClock replaces time.Now, e.g. in tests.
func WithClock(now func() time.Time) Option {
	return func(db *DB) { db.now = now }
}

// Open opens or creates the database file at path and applies missing migrations.
func Open(path string, opts ...Option) (*DB, error) {
	dsn := func(immediate bool) string {
		q := url.Values{}
		q.Add("_pragma", "busy_timeout(5000)")
		q.Add("_pragma", "journal_mode(WAL)")
		q.Add("_pragma", "foreign_keys(1)")
		q.Add("_pragma", "synchronous(NORMAL)")
		if immediate {
			// Take the write lock at BEGIN, so concurrent transactions queue instead of failing.
			q.Add("_txlock", "immediate")
		}
		return "file:" + path + "?" + q.Encode()
	}
	write, err := sql.Open("sqlite", dsn(true))
	if err != nil {
		return nil, err
	}
	write.SetMaxOpenConns(1)
	db := &DB{write: write, now: time.Now}
	for _, opt := range opts {
		opt(db)
	}
	if err := db.migrate(); err != nil {
		_ = write.Close()
		return nil, err
	}
	read, err := sql.Open("sqlite", dsn(false))
	if err != nil {
		_ = write.Close()
		return nil, err
	}
	read.SetMaxOpenConns(readConns)
	db.read = read
	return db, nil
}

// migrate applies the steps of migrations that user_version does not yet count.
func (db *DB) migrate() error {
	var version int
	if err := db.write.QueryRow("PRAGMA user_version").Scan(&version); err != nil {
		return err
	}
	if version > len(migrations) {
		return fmt.Errorf("database schema %d is newer than this server (%d)", version, len(migrations))
	}
	for i := version; i < len(migrations); i++ {
		err := db.tx(context.Background(), func(tx *sql.Tx) error {
			if _, err := tx.Exec(migrations[i]); err != nil {
				return err
			}
			_, err := tx.Exec(fmt.Sprintf("PRAGMA user_version = %d", i+1))
			return err
		})
		if err != nil {
			return fmt.Errorf("migration %d: %w", i+1, err)
		}
	}
	return nil
}

// Close closes both connection pools.
func (db *DB) Close() error {
	return errors.Join(db.read.Close(), db.write.Close())
}

// ms returns the current time in Unix milliseconds.
func (db *DB) ms() int64 { return db.now().UnixMilli() }

// tx runs fn in a write transaction and commits if it returns nil.
func (db *DB) tx(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := db.write.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// exec runs one write statement and maps zero affected rows to store.ErrNotFound.
func (db *DB) exec(ctx context.Context, query string, args ...any) error {
	res, err := db.write.ExecContext(ctx, query, args...)
	if err != nil {
		return mapErr(err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return store.ErrNotFound
	}
	return nil
}

// mapErr turns driver errors into store errors.
func mapErr(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return store.ErrNotFound
	}
	var se *sqlitedrv.Error
	if errors.As(err, &se) {
		switch se.Code() {
		case sqlite3.SQLITE_CONSTRAINT_PRIMARYKEY, sqlite3.SQLITE_CONSTRAINT_UNIQUE:
			return store.ErrConflict
		case sqlite3.SQLITE_CONSTRAINT_FOREIGNKEY:
			return store.ErrNotFound
		}
	}
	return err
}

// boolInt stores a bool as 0 or 1.
func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// CreateUser implements store.Store.
func (db *DB) CreateUser(ctx context.Context) (store.User, error) {
	return db.CreateUserWithID(ctx, store.NewID())
}

// CreateUserWithID implements store.Store.
func (db *DB) CreateUserWithID(ctx context.Context, userID string) (store.User, error) {
	u := store.User{ID: userID, CreatedAt: db.ms()}
	_, err := db.write.ExecContext(ctx, `INSERT INTO users (id, created_at) VALUES (?, ?)`, u.ID, u.CreatedAt)
	return u, mapErr(err)
}

// GetUser implements store.Store.
func (db *DB) GetUser(ctx context.Context, userID string) (store.User, error) {
	u := store.User{ID: userID}
	err := db.read.QueryRowContext(ctx,
		`SELECT created_at, approved_at, contact_email, access_note FROM users WHERE id = ?`, userID).
		Scan(&u.CreatedAt, &u.ApprovedAt, &u.ContactEmail, &u.AccessNote)
	return u, mapErr(err)
}

// ListUsers implements store.Store.
func (db *DB) ListUsers(ctx context.Context) ([]store.User, error) {
	rows, err := db.read.QueryContext(ctx,
		`SELECT id, created_at, approved_at, contact_email, access_note FROM users ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var users []store.User
	for rows.Next() {
		var u store.User
		if err := rows.Scan(&u.ID, &u.CreatedAt, &u.ApprovedAt, &u.ContactEmail, &u.AccessNote); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// SetApproved implements store.Store.
func (db *DB) SetApproved(ctx context.Context, userID string, approvedAt int64) error {
	return db.exec(ctx, `UPDATE users SET approved_at = ? WHERE id = ?`, approvedAt, userID)
}

// SetContact implements store.Store.
func (db *DB) SetContact(ctx context.Context, userID, email, note string) error {
	return db.exec(ctx, `UPDATE users SET contact_email = ?, access_note = ? WHERE id = ?`,
		email, note, userID)
}

// DeleteUser implements store.Store. Foreign keys cascade to all other tables.
func (db *DB) DeleteUser(ctx context.Context, userID string) error {
	return db.exec(ctx, `DELETE FROM users WHERE id = ?`, userID)
}

// AddIdentity implements store.Store.
func (db *DB) AddIdentity(ctx context.Context, id store.Identity) error {
	_, err := db.write.ExecContext(ctx,
		`INSERT INTO identities (user_id, provider, subject, created_at) VALUES (?, ?, ?, ?)`,
		id.UserID, id.Provider, id.Subject, db.ms())
	return mapErr(err)
}

// FindIdentity implements store.Store.
func (db *DB) FindIdentity(ctx context.Context, provider, subject string) (store.Identity, error) {
	id := store.Identity{Provider: provider, Subject: subject}
	err := db.read.QueryRowContext(ctx,
		`SELECT user_id, created_at FROM identities WHERE provider = ? AND subject = ?`,
		provider, subject).Scan(&id.UserID, &id.CreatedAt)
	return id, mapErr(err)
}

// ListIdentities implements store.Store.
func (db *DB) ListIdentities(ctx context.Context, userID string) ([]store.Identity, error) {
	return queryAll(ctx, db.read, func(rows *sql.Rows) (store.Identity, error) {
		id := store.Identity{UserID: userID}
		return id, rows.Scan(&id.Provider, &id.Subject, &id.CreatedAt)
	}, `SELECT provider, subject, created_at FROM identities WHERE user_id = ? ORDER BY created_at, rowid`, userID)
}

// queryAll runs a query and scans every row with scan.
func queryAll[T any](ctx context.Context, q interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}, scan func(*sql.Rows) (T, error), query string, args ...any) ([]T, error) {
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []T
	for rows.Next() {
		v, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// AddPasskey implements store.Store.
func (db *DB) AddPasskey(ctx context.Context, p store.Passkey) error {
	now := db.ms()
	return db.tx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO passkeys
			(credential_id, user_id, public_key, sign_count, transports, prf_capable, name, data, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			p.CredentialID, p.UserID, p.PublicKey, p.SignCount, strings.Join(p.Transports, ","),
			boolInt(p.PRFCapable), p.Name, p.Data, now)
		if err != nil {
			return mapErr(err)
		}
		_, err = tx.ExecContext(ctx,
			`INSERT INTO identities (user_id, provider, subject, created_at) VALUES (?, ?, ?, ?)`,
			p.UserID, store.ProviderPasskey, store.EncodeID(p.CredentialID), now)
		return mapErr(err)
	})
}

// passkeyColumns are the columns scanned by scanPasskey.
const passkeyColumns = `credential_id, user_id, public_key, sign_count, transports, prf_capable, name, data, created_at`

// scanPasskey reads one row with passkeyColumns.
func scanPasskey(row interface{ Scan(...any) error }) (store.Passkey, error) {
	var p store.Passkey
	var transports string
	var prf int
	err := row.Scan(&p.CredentialID, &p.UserID, &p.PublicKey, &p.SignCount, &transports, &prf, &p.Name, &p.Data, &p.CreatedAt)
	if transports != "" {
		p.Transports = strings.Split(transports, ",")
	}
	p.PRFCapable = prf == 1
	return p, mapErr(err)
}

// GetPasskey implements store.Store.
func (db *DB) GetPasskey(ctx context.Context, credentialID []byte) (store.Passkey, error) {
	return scanPasskey(db.read.QueryRowContext(ctx,
		`SELECT `+passkeyColumns+` FROM passkeys WHERE credential_id = ?`, credentialID))
}

// ListPasskeys implements store.Store.
func (db *DB) ListPasskeys(ctx context.Context, userID string) ([]store.Passkey, error) {
	return queryAll(ctx, db.read, func(rows *sql.Rows) (store.Passkey, error) { return scanPasskey(rows) },
		`SELECT `+passkeyColumns+` FROM passkeys WHERE user_id = ? ORDER BY created_at, rowid`, userID)
}

// UpdatePasskey implements store.Store.
func (db *DB) UpdatePasskey(ctx context.Context, credentialID []byte, signCount uint32, data []byte) error {
	return db.exec(ctx, `UPDATE passkeys SET sign_count = ?, data = ? WHERE credential_id = ?`,
		signCount, data, credentialID)
}

// CreateDevice implements store.Store.
func (db *DB) CreateDevice(ctx context.Context, userID, name string) (store.Device, error) {
	now := db.ms()
	d := store.Device{ID: store.NewID(), UserID: userID, Name: name, CreatedAt: now, LastSeenAt: now}
	_, err := db.write.ExecContext(ctx,
		`INSERT INTO devices (id, user_id, name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)`,
		d.ID, d.UserID, d.Name, d.CreatedAt, d.LastSeenAt)
	return d, mapErr(err)
}

// deviceColumns are the columns scanned by scanDevice.
const deviceColumns = `id, user_id, name, created_at, last_seen_at, revoked_at`

// scanDevice reads one row with deviceColumns.
func scanDevice(row interface{ Scan(...any) error }) (store.Device, error) {
	var d store.Device
	err := row.Scan(&d.ID, &d.UserID, &d.Name, &d.CreatedAt, &d.LastSeenAt, &d.RevokedAt)
	return d, mapErr(err)
}

// GetDevice implements store.Store.
func (db *DB) GetDevice(ctx context.Context, userID, deviceID string) (store.Device, error) {
	return scanDevice(db.read.QueryRowContext(ctx,
		`SELECT `+deviceColumns+` FROM devices WHERE id = ? AND user_id = ?`, deviceID, userID))
}

// ListDevices implements store.Store.
func (db *DB) ListDevices(ctx context.Context, userID string) ([]store.Device, error) {
	return queryAll(ctx, db.read, func(rows *sql.Rows) (store.Device, error) { return scanDevice(rows) },
		`SELECT `+deviceColumns+` FROM devices WHERE user_id = ? ORDER BY created_at, rowid`, userID)
}

// RenameDevice implements store.Store.
func (db *DB) RenameDevice(ctx context.Context, userID, deviceID, name string) error {
	return db.exec(ctx, `UPDATE devices SET name = ? WHERE id = ? AND user_id = ?`, name, deviceID, userID)
}

// RevokeDevice implements store.Store. Revoking twice keeps the first time.
func (db *DB) RevokeDevice(ctx context.Context, userID, deviceID string) error {
	return db.exec(ctx, `UPDATE devices SET revoked_at = CASE WHEN revoked_at = 0 THEN ? ELSE revoked_at END
		WHERE id = ? AND user_id = ?`, db.ms(), deviceID, userID)
}

// CreateSession implements store.Store.
func (db *DB) CreateSession(ctx context.Context, s store.Session) error {
	_, err := db.write.ExecContext(ctx, `INSERT INTO sessions
		(token_hash, user_id, device_id, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
		s.TokenHash, s.UserID, s.DeviceID, s.CreatedAt, s.LastUsedAt, s.ExpiresAt)
	return mapErr(err)
}

// GetSession implements store.Store.
func (db *DB) GetSession(ctx context.Context, tokenHash []byte) (store.Session, store.Device, error) {
	s := store.Session{TokenHash: tokenHash}
	var d store.Device
	err := db.read.QueryRowContext(ctx, `SELECT s.user_id, s.device_id, s.created_at, s.last_used_at, s.expires_at,
			d.name, d.created_at, d.last_seen_at, d.revoked_at
		FROM sessions s JOIN devices d ON d.id = s.device_id WHERE s.token_hash = ?`, tokenHash).
		Scan(&s.UserID, &s.DeviceID, &s.CreatedAt, &s.LastUsedAt, &s.ExpiresAt,
			&d.Name, &d.CreatedAt, &d.LastSeenAt, &d.RevokedAt)
	d.ID, d.UserID = s.DeviceID, s.UserID
	return s, d, mapErr(err)
}

// TouchSession implements store.Store.
func (db *DB) TouchSession(ctx context.Context, tokenHash []byte, expiresAt int64) error {
	now := db.ms()
	return db.tx(ctx, func(tx *sql.Tx) error {
		var deviceID string
		err := tx.QueryRowContext(ctx, `UPDATE sessions SET last_used_at = ?, expires_at = ?
			WHERE token_hash = ? RETURNING device_id`, now, expiresAt, tokenHash).Scan(&deviceID)
		if err != nil {
			return mapErr(err)
		}
		_, err = tx.ExecContext(ctx, `UPDATE devices SET last_seen_at = ? WHERE id = ?`, now, deviceID)
		return err
	})
}

// DeleteSession implements store.Store.
func (db *DB) DeleteSession(ctx context.Context, tokenHash []byte) error {
	return db.exec(ctx, `DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
}

// DeleteExpiredSessions implements store.Store.
func (db *DB) DeleteExpiredSessions(ctx context.Context) (int64, error) {
	res, err := db.write.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at < ?`, db.ms())
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// ListKeyWraps implements store.Store.
func (db *DB) ListKeyWraps(ctx context.Context, userID string) ([]store.KeyWrap, error) {
	return queryAll(ctx, db.read, func(rows *sql.Rows) (store.KeyWrap, error) {
		w := store.KeyWrap{UserID: userID}
		var cred sql.NullString
		err := rows.Scan(&w.ID, &w.Kind, &cred, &w.Alg, &w.Wrapped, &w.CreatedAt)
		w.CredentialID = cred.String
		return w, err
	}, `SELECT id, kind, credential_id, alg, wrapped, created_at FROM key_wraps
		WHERE user_id = ? ORDER BY created_at, rowid`, userID)
}

// PutKeyWrap implements store.Store.
func (db *DB) PutKeyWrap(ctx context.Context, w store.KeyWrap) error {
	cred := sql.NullString{String: w.CredentialID, Valid: w.CredentialID != ""}
	res, err := db.write.ExecContext(ctx, `INSERT INTO key_wraps
		(id, user_id, kind, credential_id, alg, wrapped, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, credential_id = excluded.credential_id,
			alg = excluded.alg, wrapped = excluded.wrapped, created_at = excluded.created_at
		WHERE key_wraps.user_id = excluded.user_id`,
		w.ID, w.UserID, w.Kind, cred, w.Alg, w.Wrapped, db.ms())
	if err != nil {
		return mapErr(err)
	}
	// The upsert skips ids of other accounts; nothing changed then.
	if n, _ := res.RowsAffected(); n == 0 {
		return store.ErrConflict
	}
	return nil
}

// DeleteKeyWrap implements store.Store.
func (db *DB) DeleteKeyWrap(ctx context.Context, userID, wrapID string) error {
	return db.tx(ctx, func(tx *sql.Tx) error {
		var kind string
		err := tx.QueryRowContext(ctx, `SELECT kind FROM key_wraps WHERE id = ? AND user_id = ?`,
			wrapID, userID).Scan(&kind)
		if err != nil {
			return mapErr(err)
		}
		if kind == store.WrapRecovery {
			var n int
			err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM key_wraps WHERE user_id = ? AND kind = ?`,
				userID, store.WrapRecovery).Scan(&n)
			if err != nil {
				return err
			}
			if n <= 1 {
				return store.ErrLastRecovery
			}
		}
		_, err = tx.ExecContext(ctx, `DELETE FROM key_wraps WHERE id = ?`, wrapID)
		return err
	})
}
