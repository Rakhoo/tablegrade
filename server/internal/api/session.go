package api

import (
	"errors"
	"net"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/Rakhoo/tablegrade/server/internal/auth"
	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// maxDeviceName is the longest device name in characters.
const maxDeviceName = 80

// authed is a handler that runs with a valid session.
type authed func(w http.ResponseWriter, r *http.Request, sess store.Session)

// withSession checks the bearer token and passes the session to next.
func (s *Server) withSession(next authed) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sess, err := s.authenticate(r)
		if err != nil {
			writeError(w, err)
			return
		}
		next(w, r, sess)
	})
}

// withApproved is withSession for endpoints that store or return account data. Accounts that
// the operator has not approved yet get not_approved.
func (s *Server) withApproved(next authed) http.Handler {
	return s.withSession(func(w http.ResponseWriter, r *http.Request, sess store.Session) {
		if err := s.checkApproved(r, sess.UserID); err != nil {
			writeError(w, err)
			return
		}
		next(w, r, sess)
	})
}

// checkApproved returns errNotApproved for an account without approval.
func (s *Server) checkApproved(r *http.Request, userID string) error {
	u, err := s.store.GetUser(r.Context(), userID)
	if err != nil {
		return err
	}
	if u.ApprovedAt == 0 {
		return errNotApproved
	}
	return nil
}

// authenticate checks the bearer token of a request and maps failures to API errors.
func (s *Server) authenticate(r *http.Request) (store.Session, error) {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return store.Session{}, errUnauthorized
	}
	return s.checkToken(r, token)
}

// checkToken validates a session token from the header or, for WebSockets, the query.
func (s *Server) checkToken(r *http.Request, token string) (store.Session, error) {
	sess, _, err := s.sessions.Authenticate(r.Context(), token)
	switch {
	case errors.Is(err, auth.ErrUnauthorized):
		return sess, errUnauthorized
	case errors.Is(err, auth.ErrRevoked):
		return sess, errSessionRevoked
	}
	return sess, err
}

// withAuthLimit applies the per-IP rate limit of the auth endpoints.
func (s *Server) withAuthLimit(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ok, wait := s.authLimit.Allow(s.clientIP(r)); !ok {
			writeError(w, rateLimited(wait))
			return
		}
		next(w, r)
	})
}

// clientIP returns the IP used for rate limits. Behind a proxy the last X-Forwarded-For entry
// is the one the proxy added; earlier entries come from the client and can be forged.
func (s *Server) clientIP(r *http.Request) string {
	if s.cfg.TrustForwardedFor {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			return strings.TrimSpace(parts[len(parts)-1])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// signIn is the response of every successful sign-in (docs/protocol.md 2).
type signIn struct {
	SessionToken string `json:"sessionToken"`
	UserID       string `json:"userId"`
	DeviceID     string `json:"deviceId"`
	IsNewUser    bool   `json:"isNewUser"`
	// Email of an OIDC sign-in, for display on the device only (not stored).
	Email string `json:"email,omitempty"`
}

// startDeviceSession creates a device and its session for a sign-in without session.
func (s *Server) startDeviceSession(r *http.Request, userID, deviceName string, isNew bool) (signIn, error) {
	devices, err := s.store.ListDevices(r.Context(), userID)
	if err != nil {
		return signIn{}, err
	}
	active := 0
	for _, d := range devices {
		if d.RevokedAt == 0 {
			active++
		}
	}
	if active >= maxDevices {
		return signIn{}, newError(http.StatusConflict, "conflict",
			"Es sind schon 10 Geräte angemeldet. Bitte zuerst ein Gerät sperren.")
	}
	dev, err := s.store.CreateDevice(r.Context(), userID, deviceName)
	if err != nil {
		return signIn{}, err
	}
	token, err := s.sessions.Create(r.Context(), userID, dev.ID)
	if err != nil {
		return signIn{}, err
	}
	return signIn{SessionToken: token, UserID: userID, DeviceID: dev.ID, IsNewUser: isNew}, nil
}

// cleanDeviceName trims a device name and rejects empty or long ones.
func cleanDeviceName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > maxDeviceName {
		return "", newError(http.StatusBadRequest, "bad_request", "Der Gerätename fehlt oder ist zu lang.")
	}
	return name, nil
}

// handleDevLogin signs in without credentials (DEV_AUTH=1 only). With userId it adds a device
// to that account, so tests can sync two devices.
func (s *Server) handleDevLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID     string `json:"userId"`
		DeviceName string `json:"deviceName"`
	}
	if err := readJSON(w, r, maxJSONBody, &body); err != nil {
		writeError(w, err)
		return
	}
	name, err := cleanDeviceName(body.DeviceName)
	if err != nil {
		writeError(w, err)
		return
	}
	userID, isNew := body.UserID, body.UserID == ""
	if isNew {
		u, err := s.store.CreateUser(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		userID = u.ID
		// Test accounts skip the approval step.
		if err := s.store.SetApproved(r.Context(), userID, s.now().UnixMilli()); err != nil {
			writeError(w, err)
			return
		}
	} else if _, err := s.store.GetUser(r.Context(), userID); err != nil {
		writeError(w, err)
		return
	}
	res, err := s.startDeviceSession(r, userID, name, isNew)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// identityJSON is one sign-in method in GET /auth/session. The subject stays on the server.
type identityJSON struct {
	Provider  string `json:"provider"`
	CreatedAt int64  `json:"createdAt"`
}

// handleSession returns the account overview of the current session.
func (s *Server) handleSession(w http.ResponseWriter, r *http.Request, sess store.Session) {
	user, err := s.store.GetUser(r.Context(), sess.UserID)
	if err != nil {
		writeError(w, err)
		return
	}
	ids, err := s.store.ListIdentities(r.Context(), sess.UserID)
	if err != nil {
		writeError(w, err)
		return
	}
	devices, err := s.devicesJSON(r, sess)
	if err != nil {
		writeError(w, err)
		return
	}
	identities := make([]identityJSON, len(ids))
	for i, id := range ids {
		identities[i] = identityJSON{Provider: id.Provider, CreatedAt: id.CreatedAt}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"userId":     sess.UserID,
		"deviceId":   sess.DeviceID,
		"identities": identities,
		"devices":    devices,
		"approved":   user.ApprovedAt != 0,
		// Passkey requests outside a server ceremony need it; the dev preview runs on a
		// subdomain, where the browser would otherwise default to the wrong id.
		"rpId": s.cfg.RPID,
		// Empty values are sent as null, so the app tells "none yet" from an empty field.
		"contactEmail": nullIfEmpty(user.ContactEmail),
		"accessNote":   nullIfEmpty(user.AccessNote),
	})
}

// handleLogout ends the current session.
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request, sess store.Session) {
	if err := s.store.DeleteSession(r.Context(), sess.TokenHash); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// nullIfEmpty turns "" into a JSON null.
func nullIfEmpty(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}
