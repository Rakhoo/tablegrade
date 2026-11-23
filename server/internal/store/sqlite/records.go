package sqlite

import (
	"context"
	"database/sql"
	"slices"

	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// PushRecords implements store.Store. The write connection runs one transaction at a time, so
// the seq counter in users.latest_seq cannot be read twice by parallel pushes.
func (db *DB) PushRecords(ctx context.Context, userID, deviceID string, recs []store.PushRecord) ([]store.PushResult, error) {
	now := db.ms()
	results := make([]store.PushResult, 0, len(recs))
	err := db.tx(ctx, func(tx *sql.Tx) error {
		var seq int64
		err := tx.QueryRowContext(ctx, `SELECT latest_seq FROM users WHERE id = ?`, userID).Scan(&seq)
		if err != nil {
			return mapErr(err)
		}
		var dropped []string
		for _, r := range recs {
			seq++
			_, err := tx.ExecContext(ctx, `INSERT INTO records
				(user_id, id, seq, updated_at, deleted, schema, ciphertext, device_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (user_id, id) DO UPDATE SET seq = excluded.seq, updated_at = excluded.updated_at,
					deleted = excluded.deleted, schema = excluded.schema, ciphertext = excluded.ciphertext,
					device_id = excluded.device_id`,
				userID, r.ID, seq, now, boolInt(r.Deleted), r.Schema, r.Ciphertext, deviceID)
			if err != nil {
				return err
			}
			old, err := replaceBlobRefs(ctx, tx, userID, r.ID, r.Blobs)
			if err != nil {
				return err
			}
			dropped = append(dropped, old...)
			results = append(results, store.PushResult{ID: r.ID, Seq: seq, UpdatedAt: now})
		}
		if err := markOrphans(ctx, tx, userID, dropped, now); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `UPDATE users SET latest_seq = ? WHERE id = ?`, seq, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return results, nil
}

// replaceBlobRefs sets the photo references of a record and returns the ids it no longer has.
func replaceBlobRefs(ctx context.Context, tx *sql.Tx, userID, recordID string, blobs []string) ([]string, error) {
	old, err := queryAll(ctx, tx, func(rows *sql.Rows) (string, error) {
		var id string
		return id, rows.Scan(&id)
	}, `DELETE FROM record_blobs WHERE user_id = ? AND record_id = ? RETURNING blob_id`, userID, recordID)
	if err != nil {
		return nil, err
	}
	for _, b := range blobs {
		_, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO record_blobs (user_id, record_id, blob_id) VALUES (?, ?, ?)`,
			userID, recordID, b)
		if err != nil {
			return nil, err
		}
		_, err = tx.ExecContext(ctx, `UPDATE blobs SET orphaned_at = 0 WHERE user_id = ? AND id = ?`, userID, b)
		if err != nil {
			return nil, err
		}
	}
	return slices.DeleteFunc(old, func(id string) bool { return slices.Contains(blobs, id) }), nil
}

// markOrphans starts the cleanup timer of the given photos that no record refers to any more.
func markOrphans(ctx context.Context, tx *sql.Tx, userID string, blobIDs []string, now int64) error {
	for _, b := range blobIDs {
		_, err := tx.ExecContext(ctx, `UPDATE blobs SET orphaned_at = ?
			WHERE user_id = ? AND id = ? AND orphaned_at = 0
			AND NOT EXISTS (SELECT 1 FROM record_blobs WHERE user_id = blobs.user_id AND blob_id = blobs.id)`,
			now, userID, b)
		if err != nil {
			return err
		}
	}
	return nil
}

// PullRecords implements store.Store.
func (db *DB) PullRecords(ctx context.Context, userID string, after int64, limit int) (store.Pull, error) {
	var p store.Pull
	tx, err := db.read.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return p, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := tx.QueryRowContext(ctx, `SELECT latest_seq FROM users WHERE id = ?`, userID).Scan(&p.LatestSeq); err != nil {
		return p, mapErr(err)
	}
	// One extra row tells whether more records follow.
	p.Records, err = queryAll(ctx, tx, func(rows *sql.Rows) (store.Record, error) {
		var r store.Record
		var deleted int
		err := rows.Scan(&r.ID, &r.Seq, &r.UpdatedAt, &deleted, &r.Schema, &r.Ciphertext, &r.DeviceID)
		r.Deleted = deleted == 1
		return r, err
	}, `SELECT id, seq, updated_at, deleted, schema, ciphertext, device_id FROM records
		WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?`, userID, after, limit+1)
	if err != nil {
		return p, err
	}
	if len(p.Records) > limit {
		p.Records, p.More = p.Records[:limit], true
	}
	return p, nil
}

// PurgedSeq implements store.Store.
func (db *DB) PurgedSeq(ctx context.Context, userID string) (int64, error) {
	var seq int64
	err := db.read.QueryRowContext(ctx, `SELECT purged_seq FROM users WHERE id = ?`, userID).Scan(&seq)
	return seq, mapErr(err)
}

// PurgeTombstones implements store.Store.
func (db *DB) PurgeTombstones(ctx context.Context, before int64) (int64, error) {
	var n int64
	err := db.tx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `UPDATE users SET purged_seq = MAX(purged_seq,
				(SELECT MAX(seq) FROM records WHERE user_id = users.id AND deleted = 1 AND updated_at < ?1))
			WHERE id IN (SELECT user_id FROM records WHERE deleted = 1 AND updated_at < ?1)`, before)
		if err != nil {
			return err
		}
		// Tombstones normally carry no photos; drop stray references anyway.
		_, err = tx.ExecContext(ctx, `DELETE FROM record_blobs WHERE (user_id, record_id) IN
			(SELECT user_id, id FROM records WHERE deleted = 1 AND updated_at < ?)`, before)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `UPDATE blobs SET orphaned_at = ? WHERE orphaned_at = 0
			AND NOT EXISTS (SELECT 1 FROM record_blobs WHERE user_id = blobs.user_id AND blob_id = blobs.id)`, db.ms())
		if err != nil {
			return err
		}
		res, err := tx.ExecContext(ctx, `DELETE FROM records WHERE deleted = 1 AND updated_at < ?`, before)
		if err != nil {
			return err
		}
		n, err = res.RowsAffected()
		return err
	})
	return n, err
}

// PutBlob implements store.Store. A new photo without references starts orphaned, so an upload
// that is never followed by a push is cleaned up as well.
func (db *DB) PutBlob(ctx context.Context, userID, blobID string, size int64) (bool, error) {
	res, err := db.write.ExecContext(ctx, `INSERT INTO blobs (user_id, id, size, created_at, orphaned_at)
		VALUES (?1, ?2, ?3, ?4, CASE WHEN EXISTS
			(SELECT 1 FROM record_blobs WHERE user_id = ?1 AND blob_id = ?2) THEN 0 ELSE ?4 END)
		ON CONFLICT DO NOTHING`, userID, blobID, size, db.ms())
	if err != nil {
		return false, mapErr(err)
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// HasBlob implements store.Store.
func (db *DB) HasBlob(ctx context.Context, userID, blobID string) (bool, error) {
	var ok bool
	err := db.read.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM blobs WHERE user_id = ? AND id = ?)`,
		userID, blobID).Scan(&ok)
	return ok, err
}

// OrphanedBlobs implements store.Store.
func (db *DB) OrphanedBlobs(ctx context.Context, before int64) ([]store.BlobRef, error) {
	return queryAll(ctx, db.read, func(rows *sql.Rows) (store.BlobRef, error) {
		var b store.BlobRef
		return b, rows.Scan(&b.UserID, &b.ID)
	}, `SELECT user_id, id FROM blobs WHERE orphaned_at > 0 AND orphaned_at < ?`, before)
}

// DeleteBlob implements store.Store.
func (db *DB) DeleteBlob(ctx context.Context, userID, blobID string) error {
	return db.exec(ctx, `DELETE FROM blobs WHERE user_id = ? AND id = ?`, userID, blobID)
}

// Backup implements store.Store with VACUUM INTO, which writes a compact, consistent copy.
func (db *DB) Backup(ctx context.Context, path string) error {
	_, err := db.write.ExecContext(ctx, `VACUUM INTO ?`, path)
	return err
}
