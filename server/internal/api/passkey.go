package api

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/Rakhoo/tablegrade/server/internal/auth"
	"github.com/Rakhoo/tablegrade/server/internal/config"
	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// maxPasskeys is the limit per account (docs/protocol.md 8).
const maxPasskeys = 20

// rpName is shown by the browser and the password manager.
const rpName = "Notenfeder"

// prfSalt is the fixed PRF input SHA-256("notenfeder/prf/v1") (docs/protocol.md 3).
var prfSalt = sha256.Sum256([]byte("notenfeder/prf/v1"))

// prfExtension asks for the PRF output with the fixed salt. In registration options it also
// makes the client report whether the passkey supports PRF.
var prfExtension = protocol.AuthenticationExtensions{
	"prf": map[string]any{"eval": map[string]any{"first": base64.RawURLEncoding.EncodeToString(prfSalt[:])}},
}

// passkeyCeremony is a pending registration or login.
type passkeyCeremony struct {
	session webauthn.SessionData
	// userID is the account of a registration; with newUser it does not exist yet.
	userID  string
	newUser bool
	login   bool
}

// errPasskeyFailed answers every failed WebAuthn check without details.
var errPasskeyFailed = newError(http.StatusUnauthorized, "unauthorized",
	"Der Passkey konnte nicht geprüft werden. Bitte erneut versuchen.")

// newWebAuthn configures go-webauthn for the RP ID and app origins.
func newWebAuthn(cfg config.Config) (*webauthn.WebAuthn, error) {
	return webauthn.New(&webauthn.Config{
		RPID:          cfg.RPID,
		RPDisplayName: rpName,
		RPOrigins:     cfg.AppOrigins,
		Timeouts: webauthn.TimeoutsConfig{
			Login:        webauthn.TimeoutConfig{Timeout: auth.ChallengeLifetime},
			Registration: webauthn.TimeoutConfig{Timeout: auth.ChallengeLifetime},
		},
	})
}

// waUser adapts an account and its passkeys to webauthn.User. The user handle is the account id.
type waUser struct {
	id    string
	creds []webauthn.Credential
}

func (u waUser) WebAuthnID() []byte                         { return []byte(u.id) }
func (u waUser) WebAuthnName() string                       { return rpName }
func (u waUser) WebAuthnDisplayName() string                { return rpName }
func (u waUser) WebAuthnCredentials() []webauthn.Credential { return u.creds }

// loadWAUser reads the passkeys of an account into a waUser.
func (s *Server) loadWAUser(r *http.Request, userID string) (waUser, []store.Passkey, error) {
	keys, err := s.store.ListPasskeys(r.Context(), userID)
	if err != nil {
		return waUser{}, nil, err
	}
	u := waUser{id: userID}
	for _, k := range keys {
		var c webauthn.Credential
		if err := json.Unmarshal(k.Data, &c); err != nil {
			return waUser{}, nil, err
		}
		u.creds = append(u.creds, c)
	}
	return u, keys, nil
}

// optionalSession returns the session if the request carries a token. A sent but invalid
// token is an error, so a client never creates a new account by accident.
func (s *Server) optionalSession(r *http.Request) (*store.Session, error) {
	if r.Header.Get("Authorization") == "" {
		return nil, nil
	}
	sess, err := s.authenticate(r)
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

// beginResponse is the answer of register/begin and login/begin.
type beginResponse struct {
	ChallengeID string `json:"challengeId"`
	Options     any    `json:"options"`
}

// putCeremony stores a ceremony and writes its challenge id with the options.
func (s *Server) putCeremony(w http.ResponseWriter, c passkeyCeremony, options any) {
	id, ok := s.challenges.Put(c)
	if !ok {
		writeError(w, rateLimited(60))
		return
	}
	writeJSON(w, http.StatusOK, beginResponse{ChallengeID: id, Options: options})
}

// handlePasskeyRegisterBegin returns creation options for a new account, or with a session for
// a further passkey of the account.
func (s *Server) handlePasskeyRegisterBegin(w http.ResponseWriter, r *http.Request) {
	sess, err := s.optionalSession(r)
	if err != nil {
		writeError(w, err)
		return
	}
	c := passkeyCeremony{userID: store.NewID(), newUser: true}
	user := waUser{id: c.userID}
	if sess != nil {
		var keys []store.Passkey
		if user, keys, err = s.loadWAUser(r, sess.UserID); err != nil {
			writeError(w, err)
			return
		}
		if len(keys) >= maxPasskeys {
			writeError(w, newError(http.StatusConflict, "conflict", "Es gibt schon 20 Passkeys für dieses Konto."))
			return
		}
		c.userID, c.newUser = sess.UserID, false
	}
	creation, data, err := s.webauthn.BeginRegistration(user,
		webauthn.WithResidentKeyRequirement(protocol.ResidentKeyRequirementRequired),
		webauthn.WithExclusions(webauthn.Credentials(user.creds).CredentialDescriptors()),
		webauthn.WithExtensions(prfExtension))
	if err != nil {
		writeError(w, err)
		return
	}
	c.session = *data
	s.putCeremony(w, c, creation.Response)
}

// finishRequest is the body of register/finish and login/finish.
type finishRequest struct {
	ChallengeID string          `json:"challengeId"`
	Credential  json.RawMessage `json:"credential"`
	DeviceName  string          `json:"deviceName"`
}

// readFinish reads a finish body and takes its ceremony. login tells which kind is expected.
func (s *Server) readFinish(w http.ResponseWriter, r *http.Request, login bool) (finishRequest, passkeyCeremony, error) {
	var body finishRequest
	if err := readJSON(w, r, maxJSONBody, &body); err != nil {
		return body, passkeyCeremony{}, err
	}
	c, ok := s.challenges.Take(body.ChallengeID)
	if !ok || c.login != login {
		return body, c, newError(http.StatusBadRequest, "bad_request",
			"Die Anmeldung ist abgelaufen. Bitte erneut versuchen.")
	}
	return body, c, nil
}

// handlePasskeyRegisterFinish stores the new passkey. Without session it creates the account,
// a device and a session; with session it answers 204.
func (s *Server) handlePasskeyRegisterFinish(w http.ResponseWriter, r *http.Request) {
	sess, err := s.optionalSession(r)
	if err != nil {
		writeError(w, err)
		return
	}
	body, c, err := s.readFinish(w, r, false)
	if err != nil {
		writeError(w, err)
		return
	}
	// A ceremony started with a session must finish with a session of the same account.
	if c.newUser != (sess == nil) || (sess != nil && sess.UserID != c.userID) {
		writeError(w, errBadRequest)
		return
	}
	name := ""
	if c.newUser {
		if name, err = cleanDeviceName(body.DeviceName); err != nil {
			writeError(w, err)
			return
		}
	}
	parsed, err := protocol.ParseCredentialCreationResponseBytes(body.Credential)
	if err != nil {
		writeError(w, errPasskeyFailed)
		return
	}
	user := waUser{id: c.userID}
	if !c.newUser {
		if user, _, err = s.loadWAUser(r, c.userID); err != nil {
			writeError(w, err)
			return
		}
	}
	cred, err := s.webauthn.CreateCredential(user, c.session, parsed)
	if err != nil {
		slog.Info("passkey registration rejected", "err", err)
		writeError(w, errPasskeyFailed)
		return
	}
	if c.newUser {
		if _, err := s.store.CreateUserWithID(r.Context(), c.userID); err != nil {
			writeError(w, err)
			return
		}
	}
	if err := s.addPasskey(r, c.userID, cred, prfEnabled(parsed.ClientExtensionResults), body.DeviceName); err != nil {
		if c.newUser {
			_ = s.store.DeleteUser(r.Context(), c.userID)
		}
		writeError(w, err)
		return
	}
	if !c.newUser {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	res, err := s.startDeviceSession(r, c.userID, name, true)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// addPasskey stores a verified credential with its library data.
func (s *Server) addPasskey(r *http.Request, userID string, cred *webauthn.Credential, prf bool, name string) error {
	data, err := json.Marshal(cred)
	if err != nil {
		return err
	}
	transports := make([]string, len(cred.Transport))
	for i, t := range cred.Transport {
		transports[i] = string(t)
	}
	err = s.store.AddPasskey(r.Context(), store.Passkey{
		UserID: userID, CredentialID: cred.ID, PublicKey: cred.PublicKey,
		SignCount: cred.Authenticator.SignCount, Transports: transports, PRFCapable: prf,
		Name: passkeyLabel(name), Data: data,
	})
	if errors.Is(err, store.ErrConflict) {
		return newError(http.StatusConflict, "conflict", "Dieser Passkey ist schon gespeichert.")
	}
	return err
}

// passkeyLabel keeps the passkey label within the device name limit; it is only informative.
func passkeyLabel(name string) string {
	clean, err := cleanDeviceName(name)
	if err != nil {
		return ""
	}
	return clean
}

// prfEnabled reads clientExtensionResults.prf.enabled. Some clients return PRF results at
// creation instead, which also proves support.
func prfEnabled(results protocol.AuthenticationExtensionsClientOutputs) bool {
	prf, _ := results["prf"].(map[string]any)
	enabled, _ := prf["enabled"].(bool)
	_, hasResults := prf["results"]
	return enabled || hasResults
}

// handlePasskeyLoginBegin returns request options for a discoverable login.
func (s *Server) handlePasskeyLoginBegin(w http.ResponseWriter, _ *http.Request) {
	assertion, data, err := s.webauthn.BeginDiscoverableLogin(webauthn.WithAssertionExtensions(prfExtension))
	if err != nil {
		writeError(w, err)
		return
	}
	s.putCeremony(w, passkeyCeremony{session: *data, login: true}, assertion.Response)
}

// handlePasskeyLoginFinish checks the assertion and creates a device and session.
func (s *Server) handlePasskeyLoginFinish(w http.ResponseWriter, r *http.Request) {
	body, c, err := s.readFinish(w, r, true)
	if err != nil {
		writeError(w, err)
		return
	}
	name, err := cleanDeviceName(body.DeviceName)
	if err != nil {
		writeError(w, err)
		return
	}
	parsed, err := protocol.ParseCredentialRequestResponseBytes(body.Credential)
	if err != nil {
		writeError(w, errPasskeyFailed)
		return
	}
	var userID string
	handler := func(rawID, _ []byte) (webauthn.User, error) {
		key, err := s.store.GetPasskey(r.Context(), rawID)
		if err != nil {
			return nil, err
		}
		userID = key.UserID
		user, _, err := s.loadWAUser(r, key.UserID)
		return user, err
	}
	cred, err := s.webauthn.ValidateDiscoverableLogin(handler, c.session, parsed)
	if err != nil {
		slog.Info("passkey login rejected", "err", err)
		writeError(w, errPasskeyFailed)
		return
	}
	if cred.Authenticator.CloneWarning {
		slog.Warn("passkey sign count went backwards", "user", userID)
	}
	data, err := json.Marshal(cred)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.store.UpdatePasskey(r.Context(), cred.ID, cred.Authenticator.SignCount, data); err != nil {
		writeError(w, err)
		return
	}
	res, err := s.startDeviceSession(r, userID, name, false)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}
