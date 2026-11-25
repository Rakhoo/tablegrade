package api

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/hub"
	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// Device link rules (docs/protocol.md 6).
const (
	linkLifetime    = 10 * time.Minute
	maxLinkFailures = 5
	// linkCodeTries bounds retries when a random code is already in use.
	linkCodeTries = 5
)

// crockford is the Crockford Base32 alphabet (docs/protocol.md 1).
const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// errLinkNotFound covers unknown, expired and foreign links alike.
var errLinkNotFound = newError(http.StatusNotFound, "not_found",
	"Der Code ist ungültig oder abgelaufen. Bitte am neuen Gerät einen neuen Code anzeigen.")

// newLinkCode returns 8 Crockford Base32 characters from 40 random bits.
func newLinkCode() string {
	var b [5]byte
	_, _ = rand.Read(b[:])
	n := uint64(b[0])<<32 | uint64(b[1])<<24 | uint64(b[2])<<16 | uint64(b[3])<<8 | uint64(b[4])
	code := make([]byte, 8)
	for i := 7; i >= 0; i-- {
		code[i] = crockford[n&31]
		n >>= 5
	}
	return string(code)
}

// normalizeCode applies the input rules of docs/protocol.md 1 to a typed code.
func normalizeCode(code string) string {
	code = strings.ToUpper(strings.NewReplacer(" ", "", "-", "").Replace(code))
	return strings.NewReplacer("O", "0", "I", "1", "L", "1").Replace(code)
}

// decodePublicKey reads a base64url P-256 key in raw uncompressed form and checks the point.
func decodePublicKey(s string) ([]byte, bool) {
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil, false
	}
	_, err = ecdh.P256().NewPublicKey(raw)
	return raw, err == nil && len(raw) == 65
}

// handleCreateLink starts a link on the new device and returns the code it shows.
func (s *Server) handleCreateLink(w http.ResponseWriter, r *http.Request, sess store.Session) {
	var body struct {
		PublicKey string `json:"publicKey"`
	}
	if err := readJSON(w, r, maxJSONBody, &body); err != nil {
		writeError(w, err)
		return
	}
	key, ok := decodePublicKey(body.PublicKey)
	if !ok {
		writeError(w, errBadRequest)
		return
	}
	now := s.now()
	l := store.Link{ID: store.NewID(), UserID: sess.UserID, PublicKey: key,
		CreatedAt: now.UnixMilli(), ExpiresAt: now.Add(linkLifetime).UnixMilli()}
	err := store.ErrConflict
	for range linkCodeTries {
		l.Code = newLinkCode()
		if err = s.store.CreateLink(r.Context(), l); !errors.Is(err, store.ErrConflict) {
			break
		}
	}
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"linkId": l.ID, "code": l.Code})
}

// handleLinkByCode returns the new device's key to the old device. Wrong codes count; after
// maxLinkFailures the account's open links expire.
func (s *Server) handleLinkByCode(w http.ResponseWriter, r *http.Request, sess store.Session) {
	l, err := s.store.GetLinkByCode(r.Context(), sess.UserID, normalizeCode(r.PathValue("code")))
	if errors.Is(err, store.ErrNotFound) {
		if _, err := s.store.AddLinkFailure(r.Context(), sess.UserID, maxLinkFailures); err != nil {
			writeError(w, err)
			return
		}
		writeError(w, errLinkNotFound)
		return
	}
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"linkId": l.ID, "publicKey": base64.RawURLEncoding.EncodeToString(l.PublicKey),
	})
}

// handleLinkKey stores the old device's public key, so the new device can show the check code
// before the old device sends the data key (docs/protocol.md 6).
func (s *Server) handleLinkKey(w http.ResponseWriter, r *http.Request, sess store.Session) {
	var body struct {
		PublicKey string `json:"publicKey"`
	}
	if err := readJSON(w, r, maxJSONBody, &body); err != nil {
		writeError(w, err)
		return
	}
	key, ok := decodePublicKey(body.PublicKey)
	if !ok {
		writeError(w, errBadRequest)
		return
	}
	id := r.PathValue("linkId")
	if err := linkStoreError(s.store.SetLinkKey(r.Context(), sess.UserID, id, key)); err != nil {
		writeError(w, err)
		return
	}
	s.hub.Publish(sess.UserID, "", hub.Link(id))
	w.WriteHeader(http.StatusNoContent)
}

// linkStoreError maps store errors of a link update to API errors.
func linkStoreError(err error) error {
	switch {
	case errors.Is(err, store.ErrNotFound):
		return errLinkNotFound
	case errors.Is(err, store.ErrConflict):
		return newError(http.StatusConflict, "conflict", "Diese Kopplung ist schon abgeschlossen.")
	}
	return err
}

// handleCompleteLink stores the wrapped data key from the old device and tells the account's
// devices; the new device recognizes its linkId.
func (s *Server) handleCompleteLink(w http.ResponseWriter, r *http.Request, sess store.Session) {
	var body struct {
		PublicKey string `json:"publicKey"`
		Wrapped   string `json:"wrapped"`
	}
	if err := readJSON(w, r, maxJSONBody, &body); err != nil {
		writeError(w, err)
		return
	}
	key, ok := decodePublicKey(body.PublicKey)
	wrapped, err := base64.RawURLEncoding.DecodeString(body.Wrapped)
	if !ok || err != nil || len(wrapped) != wrapSize {
		writeError(w, errBadRequest)
		return
	}
	id := r.PathValue("linkId")
	if err := linkStoreError(s.store.CompleteLink(r.Context(), sess.UserID, id, key, wrapped)); err != nil {
		writeError(w, err)
		return
	}
	s.hub.Publish(sess.UserID, "", hub.Link(id))
	w.WriteHeader(http.StatusNoContent)
}

// handleGetLink returns the state of a link to the new device. A finished link is deleted
// after this answer, so the wrapped key is handed out once.
func (s *Server) handleGetLink(w http.ResponseWriter, r *http.Request, sess store.Session) {
	l, err := s.store.GetLink(r.Context(), sess.UserID, r.PathValue("linkId"))
	if errors.Is(err, store.ErrNotFound) {
		err = errLinkNotFound
	}
	if err != nil {
		writeError(w, err)
		return
	}
	if !l.Done() && l.OtherPublicKey == nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "waiting"})
		return
	}
	if !l.Done() {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "keyed", "publicKey": base64.RawURLEncoding.EncodeToString(l.OtherPublicKey),
		})
		return
	}
	if err := s.store.DeleteLink(r.Context(), sess.UserID, l.ID); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"status":    "done",
		"publicKey": base64.RawURLEncoding.EncodeToString(l.OtherPublicKey),
		"wrapped":   base64.RawURLEncoding.EncodeToString(l.Wrapped),
	})
}
