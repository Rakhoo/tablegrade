package api

import (
	"log/slog"
	"net/http"

	"github.com/Rakhoo/tablegrade/server/internal/hub"
	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// handleDeleteAccount removes the account with all data. Connected devices get "revoked", so
// their WebSockets close.
func (s *Server) handleDeleteAccount(w http.ResponseWriter, r *http.Request, sess store.Session) {
	if err := s.store.DeleteUser(r.Context(), sess.UserID); err != nil {
		writeError(w, err)
		return
	}
	// The database is the source of truth; leftover files are only logged, as the account is
	// already gone and a retry would fail with unauthorized.
	if err := s.blobs.DeleteUser(r.Context(), sess.UserID); err != nil {
		slog.Error("deleting blobs of a deleted account failed", "user", sess.UserID, "err", err)
	}
	s.hub.Publish(sess.UserID, "", hub.Revoked())
	slog.Info("account deleted", "user", sess.UserID)
	w.WriteHeader(http.StatusNoContent)
}
