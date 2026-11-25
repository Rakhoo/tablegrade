package api

import (
	"bytes"
	"encoding/base64"
	"errors"
	"net/http"
	"regexp"

	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// wrapAlg is the only wrap format for passkey and recovery wraps (docs/protocol.md 3).
const wrapAlg = "A256GCM"

// wrapSize is nonce(12) ‖ encrypted DEK(32) ‖ tag(16).
const wrapSize = 12 + 32 + 16

// uuidPattern matches the lowercase UUIDs the client generates.
var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// errLastRecovery protects the only way back into the account without a passkey.
var errLastRecovery = newError(http.StatusConflict, "conflict",
	"Der Wiederherstellungsschlüssel kann nicht gelöscht werden. Bitte zuerst einen neuen anlegen.")

// wrapJSON is a key wrap as sent and returned by /keys.
type wrapJSON struct {
	ID           string `json:"id"`
	Kind         string `json:"kind"`
	CredentialID string `json:"credentialId,omitempty"`
	Alg          string `json:"alg"`
	Wrapped      string `json:"wrapped"`
	CreatedAt    int64  `json:"createdAt"`
}

// handleListKeys returns all wraps of the account.
func (s *Server) handleListKeys(w http.ResponseWriter, r *http.Request, sess store.Session) {
	wraps, err := s.store.ListKeyWraps(r.Context(), sess.UserID)
	if err != nil {
		writeError(w, err)
		return
	}
	keys := make([]wrapJSON, len(wraps))
	for i, k := range wraps {
		keys[i] = wrapJSON{ID: k.ID, Kind: k.Kind, CredentialID: k.CredentialID, Alg: k.Alg,
			Wrapped: base64.RawURLEncoding.EncodeToString(k.Wrapped), CreatedAt: k.CreatedAt}
	}
	writeJSON(w, http.StatusOK, map[string]any{"keys": keys})
}

// handlePutKey creates or replaces a wrap. The id comes from the path; an id in the body must
// match it.
func (s *Server) handlePutKey(w http.ResponseWriter, r *http.Request, sess store.Session) {
	var body wrapJSON
	if err := readJSON(w, r, maxJSONBody, &body); err != nil {
		writeError(w, err)
		return
	}
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) || (body.ID != "" && body.ID != id) {
		writeError(w, errBadRequest)
		return
	}
	wrapped, err := base64.RawURLEncoding.DecodeString(body.Wrapped)
	if err != nil || len(wrapped) != wrapSize || body.Alg != wrapAlg {
		writeError(w, errBadRequest)
		return
	}
	if err := s.checkWrapKind(r, sess.UserID, body); err != nil {
		writeError(w, err)
		return
	}
	err = s.store.PutKeyWrap(r.Context(), store.KeyWrap{ID: id, UserID: sess.UserID, Kind: body.Kind,
		CredentialID: body.CredentialID, Alg: body.Alg, Wrapped: wrapped})
	if err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// checkWrapKind accepts recovery wraps without and passkey wraps with a credential id of one of
// the account's passkeys. Org wraps come later with their own format.
func (s *Server) checkWrapKind(r *http.Request, userID string, body wrapJSON) error {
	switch body.Kind {
	case store.WrapRecovery:
		if body.CredentialID != "" {
			return errBadRequest
		}
		return nil
	case store.WrapPasskey:
		credID, err := base64.RawURLEncoding.DecodeString(body.CredentialID)
		if err != nil || len(credID) == 0 {
			return errBadRequest
		}
		passkeys, err := s.store.ListPasskeys(r.Context(), userID)
		if err != nil {
			return err
		}
		for _, p := range passkeys {
			if bytes.Equal(p.CredentialID, credID) {
				return nil
			}
		}
		return newError(http.StatusBadRequest, "bad_request", "Der Passkey gehört nicht zu diesem Konto.")
	}
	return errBadRequest
}

// handleDeleteKey removes a wrap, except the last recovery wrap.
func (s *Server) handleDeleteKey(w http.ResponseWriter, r *http.Request, sess store.Session) {
	err := s.store.DeleteKeyWrap(r.Context(), sess.UserID, r.PathValue("id"))
	if errors.Is(err, store.ErrLastRecovery) {
		err = errLastRecovery
	}
	if err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
