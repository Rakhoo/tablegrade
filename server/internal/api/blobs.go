package api

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/blob"
	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// maxBlobSize is the upload limit of one encrypted photo (docs/protocol.md 5).
const maxBlobSize = 2 << 20

// orphanLifetime is how long a photo without references is kept.
const orphanLifetime = 30 * 24 * time.Hour

// handlePutBlob stores an encrypted photo. Blob ids derive from the content, so an existing
// blob is left unchanged.
func (s *Server) handlePutBlob(w http.ResponseWriter, r *http.Request, sess store.Session) {
	id := r.PathValue("id")
	if !validShortID(id) {
		writeError(w, errBadRequest)
		return
	}
	exists, err := s.store.HasBlob(r.Context(), sess.UserID, id)
	if err != nil {
		writeError(w, err)
		return
	}
	if exists {
		w.WriteHeader(http.StatusOK)
		return
	}
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBlobSize))
	var tooLarge *http.MaxBytesError
	switch {
	case errors.As(err, &tooLarge):
		writeError(w, errTooLarge)
		return
	case err != nil:
		writeError(w, errBadRequest)
		return
	case len(data) < minCiphertext:
		writeError(w, errBadRequest)
		return
	}
	if err := s.blobs.Put(r.Context(), sess.UserID, id, bytes.NewReader(data)); err != nil {
		writeError(w, err)
		return
	}
	if _, err := s.store.PutBlob(r.Context(), sess.UserID, id, int64(len(data))); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// handleGetBlob streams an encrypted photo of the account.
func (s *Server) handleGetBlob(w http.ResponseWriter, r *http.Request, sess store.Session) {
	id := r.PathValue("id")
	if !validShortID(id) {
		writeError(w, errNotFound)
		return
	}
	exists, err := s.store.HasBlob(r.Context(), sess.UserID, id)
	if err == nil && !exists {
		err = errNotFound
	}
	if err != nil {
		writeError(w, err)
		return
	}
	f, err := s.blobs.Open(r.Context(), sess.UserID, id)
	if errors.Is(err, blob.ErrNotFound) {
		slog.Error("registered blob is missing", "user", sess.UserID, "blob", id)
		err = errNotFound
	}
	if err != nil {
		writeError(w, err)
		return
	}
	defer func() { _ = f.Close() }()
	h := w.Header()
	h.Set("Content-Type", "application/octet-stream")
	// The id derives from the content, so a blob never changes.
	h.Set("Cache-Control", "private, max-age=31536000, immutable")
	_, _ = io.Copy(w, f)
}

// purgeOrphanedBlobs deletes photos that no record has referenced for 30 days. The file goes
// first, so a failure leaves a registration that the next run retries.
func (s *Server) purgeOrphanedBlobs(ctx context.Context) error {
	orphans, err := s.store.OrphanedBlobs(ctx, s.now().Add(-orphanLifetime).UnixMilli())
	if err != nil {
		return err
	}
	for _, b := range orphans {
		if err := s.blobs.Delete(ctx, b.UserID, b.ID); err != nil {
			return err
		}
		if err := s.store.DeleteBlob(ctx, b.UserID, b.ID); err != nil {
			return err
		}
	}
	if len(orphans) > 0 {
		slog.Info("deleted orphaned blobs", "count", len(orphans))
	}
	return nil
}
