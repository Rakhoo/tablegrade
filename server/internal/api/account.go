package api

import (
	"log/slog"
	"net/http"
	"net/mail"
	"strings"
	"unicode/utf8"

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

// Limits of the contact data.
const (
	maxEmail      = 254
	maxAccessNote = 500
)

// errBadEmail is returned for a contact address that is not a plain email address.
var errBadEmail = newError(http.StatusBadRequest, "bad_request", "Die E-Mail-Adresse ist ungültig.")

// handlePutContact stores the contact address and the note of the access request. Pending
// accounts may use it, so the operator knows whom to approve and how to reach them.
func (s *Server) handlePutContact(w http.ResponseWriter, r *http.Request, sess store.Session) {
	var body struct {
		Email string `json:"email"`
		Note  string `json:"note"`
	}
	if err := readJSON(w, r, maxJSONBody, &body); err != nil {
		writeError(w, err)
		return
	}
	email, note := strings.TrimSpace(body.Email), strings.TrimSpace(body.Note)
	if email != "" && !validEmail(email) {
		writeError(w, errBadEmail)
		return
	}
	if utf8.RuneCountInString(note) > maxAccessNote {
		writeError(w, newError(http.StatusBadRequest, "bad_request", "Der Text ist zu lang (höchstens 500 Zeichen)."))
		return
	}
	if err := s.store.SetContact(r.Context(), sess.UserID, email, note); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// validEmail accepts a bare address like "name@example.org", without display name.
func validEmail(email string) bool {
	if len(email) > maxEmail {
		return false
	}
	addr, err := mail.ParseAddress(email)
	return err == nil && addr.Address == email && strings.Contains(email[strings.IndexByte(email, '@'):], ".")
}
