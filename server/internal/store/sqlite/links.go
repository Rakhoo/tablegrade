package sqlite

import (
	"context"
	"database/sql"

	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// CreateLink implements store.Store.
func (db *DB) CreateLink(ctx context.Context, l store.Link) error {
	_, err := db.write.ExecContext(ctx, `INSERT INTO links (id, user_id, code, public_key, created_at, expires_at)
		VALUES (?, ?, ?, ?, ?, ?)`, l.ID, l.UserID, l.Code, l.PublicKey, l.CreatedAt, l.ExpiresAt)
	return mapErr(err)
}

// linkColumns are the columns scanned by scanLink.
const linkColumns = `id, user_id, code, public_key, other_public_key, wrapped, created_at, expires_at`

// scanLink reads one row with linkColumns.
func scanLink(row *sql.Row) (store.Link, error) {
	var l store.Link
	err := row.Scan(&l.ID, &l.UserID, &l.Code, &l.PublicKey, &l.OtherPublicKey, &l.Wrapped, &l.CreatedAt, &l.ExpiresAt)
	return l, mapErr(err)
}

// GetLink implements store.Store. Expired links count as not found.
func (db *DB) GetLink(ctx context.Context, userID, linkID string) (store.Link, error) {
	return scanLink(db.read.QueryRowContext(ctx, `SELECT `+linkColumns+` FROM links
		WHERE id = ? AND user_id = ? AND expires_at >= ?`, linkID, userID, db.ms()))
}

// GetLinkByCode implements store.Store.
func (db *DB) GetLinkByCode(ctx context.Context, userID, code string) (store.Link, error) {
	return scanLink(db.read.QueryRowContext(ctx, `SELECT `+linkColumns+` FROM links
		WHERE code = ? AND user_id = ? AND expires_at >= ?`, code, userID, db.ms()))
}

// CompleteLink implements store.Store.
func (db *DB) CompleteLink(ctx context.Context, userID, linkID string, otherPublicKey, wrapped []byte) error {
	return db.tx(ctx, func(tx *sql.Tx) error {
		var done bool
		err := tx.QueryRowContext(ctx, `SELECT wrapped IS NOT NULL FROM links
			WHERE id = ? AND user_id = ? AND expires_at >= ?`, linkID, userID, db.ms()).Scan(&done)
		if err != nil {
			return mapErr(err)
		}
		if done {
			return store.ErrConflict
		}
		_, err = tx.ExecContext(ctx, `UPDATE links SET other_public_key = ?, wrapped = ? WHERE id = ?`,
			otherPublicKey, wrapped, linkID)
		return err
	})
}

// DeleteLink implements store.Store.
func (db *DB) DeleteLink(ctx context.Context, userID, linkID string) error {
	return db.exec(ctx, `DELETE FROM links WHERE id = ? AND user_id = ?`, linkID, userID)
}

// AddLinkFailure implements store.Store.
func (db *DB) AddLinkFailure(ctx context.Context, userID string, maxFailures int) (int, error) {
	var n int
	err := db.tx(ctx, func(tx *sql.Tx) error {
		err := tx.QueryRowContext(ctx, `UPDATE users SET link_failures = link_failures + 1
			WHERE id = ? RETURNING link_failures`, userID).Scan(&n)
		if err != nil || n < maxFailures {
			return mapErr(err)
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM links WHERE user_id = ? AND wrapped IS NULL`, userID); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `UPDATE users SET link_failures = 0 WHERE id = ?`, userID)
		return err
	})
	return n, err
}

// DeleteExpiredLinks implements store.Store.
func (db *DB) DeleteExpiredLinks(ctx context.Context) (int64, error) {
	res, err := db.write.ExecContext(ctx, `DELETE FROM links WHERE expires_at < ?`, db.ms())
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
