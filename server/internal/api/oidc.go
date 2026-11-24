package api

import (
	"errors"
	"log/slog"
	"net/http"
	"slices"

	"github.com/Rakhoo/tablegrade/server/internal/config"
	"github.com/Rakhoo/tablegrade/server/internal/oidc"
	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// oidcScopes are requested by the browser. The server keeps only the subject; the email is
// passed on to the device for display.
var oidcScopes = []string{"openid", "email"}

// oidcRedirectPath is appended to an app origin to form the redirect URI (protocol.md 2).
// No query string: Microsoft rejects redirect URIs with one.
const oidcRedirectPath = "/"

// errOIDCFailed answers a refused code or an invalid ID token without details.
var errOIDCFailed = newError(http.StatusUnauthorized, "unauthorized",
	"Die Anmeldung wurde nicht bestätigt. Bitte erneut versuchen.")

// WithOIDCProvider replaces or adds an identity provider, e.g. a fake one in tests.
func WithOIDCProvider(name string, p *oidc.Provider) Option {
	return func(s *Server) { s.oidc[name] = p }
}

// newOIDCProviders returns the providers with a configured client id.
func newOIDCProviders(cfg config.Config) map[string]*oidc.Provider {
	providers := map[string]*oidc.Provider{}
	add := func(name string, ep oidc.Endpoints, c config.OIDCProvider) {
		if c.ClientID != "" {
			providers[name] = oidc.New(ep, c.ClientID, c.ClientSecret, nil)
		}
	}
	add(store.ProviderMicrosoft, oidc.Microsoft, cfg.Microsoft)
	add(store.ProviderGoogle, oidc.Google, cfg.Google)
	return providers
}

// provider returns the enabled provider named in the path.
func (s *Server) provider(r *http.Request) (string, *oidc.Provider, error) {
	name := r.PathValue("provider")
	p, ok := s.oidc[name]
	if !ok {
		return "", nil, errNotFound
	}
	return name, p, nil
}

// redirectURIs returns the allowed redirect URIs, one per app origin.
func (s *Server) redirectURIs() []string {
	uris := make([]string, len(s.cfg.AppOrigins))
	for i, origin := range s.cfg.AppOrigins {
		uris[i] = origin + oidcRedirectPath
	}
	return uris
}

// handleOIDCConfig returns what the browser needs to start the sign-in. The redirect URI
// belongs to the calling app origin, so the dev preview returns to itself.
func (s *Server) handleOIDCConfig(w http.ResponseWriter, r *http.Request) {
	_, p, err := s.provider(r)
	if err != nil {
		writeError(w, err)
		return
	}
	origin := s.cfg.AppOrigins[0]
	if o := r.Header.Get("Origin"); slices.Contains(s.cfg.AppOrigins, o) {
		origin = o
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"clientId":     p.ClientID,
		"authorizeUrl": p.AuthorizeURL,
		"scopes":       oidcScopes,
		"redirectUri":  origin + oidcRedirectPath,
	})
}

// handleOIDCExchange redeems the code and signs in, or creates the account on the first sign-in.
// With a session it refuses: an account has exactly one sign-in method.
func (s *Server) handleOIDCExchange(w http.ResponseWriter, r *http.Request) {
	provider, p, err := s.provider(r)
	if err != nil {
		writeError(w, err)
		return
	}
	sess, err := s.optionalSession(r)
	if err != nil {
		writeError(w, err)
		return
	}
	if sess != nil {
		writeError(w, errOneSignIn)
		return
	}
	var body struct {
		Code         string `json:"code"`
		CodeVerifier string `json:"codeVerifier"`
		RedirectURI  string `json:"redirectUri"`
		DeviceName   string `json:"deviceName"`
	}
	if err := readJSON(w, r, maxJSONBody, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.Code == "" || body.CodeVerifier == "" || !slices.Contains(s.redirectURIs(), body.RedirectURI) {
		writeError(w, errBadRequest)
		return
	}
	name, err := cleanDeviceName(body.DeviceName)
	if err != nil {
		writeError(w, err)
		return
	}
	id, err := p.Exchange(r.Context(), body.Code, body.CodeVerifier, body.RedirectURI)
	if errors.Is(err, oidc.ErrRejected) {
		slog.Info("oidc sign-in rejected", "provider", provider, "err", err)
		writeError(w, errOIDCFailed)
		return
	}
	if err != nil {
		writeError(w, err)
		return
	}
	s.signInWithIdentity(w, r, provider, id, name)
}

// errOneSignIn refuses a second sign-in method: an account has exactly one (protocol.md 2).
var errOneSignIn = newError(http.StatusConflict, "conflict",
	"Ein Konto hat genau einen Anmeldeweg. Zum Wechseln erst abmelden.")

// signInWithIdentity starts a device session for the identity's account, or creates the
// account if the identity is new.
func (s *Server) signInWithIdentity(w http.ResponseWriter, r *http.Request, provider string, id oidc.Identity, deviceName string) {
	found, err := s.store.FindIdentity(r.Context(), provider, id.Subject)
	if err == nil {
		res, err := s.startDeviceSession(r, found.UserID, deviceName, false)
		if err != nil {
			writeError(w, err)
			return
		}
		res.Email = id.Email
		writeJSON(w, http.StatusOK, res)
		return
	}
	if !errors.Is(err, store.ErrNotFound) {
		writeError(w, err)
		return
	}
	user, err := s.store.CreateUser(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	res, err := s.startNewAccount(r, user.ID, provider, id.Subject, deviceName)
	if err != nil {
		_ = s.store.DeleteUser(r.Context(), user.ID)
		writeError(w, err)
		return
	}
	res.Email = id.Email
	writeJSON(w, http.StatusOK, res)
}

// startNewAccount links the first identity of a new account and starts its session.
func (s *Server) startNewAccount(r *http.Request, userID, provider, subject, deviceName string) (signIn, error) {
	err := s.store.AddIdentity(r.Context(), store.Identity{UserID: userID, Provider: provider, Subject: subject})
	if errors.Is(err, store.ErrConflict) {
		// A parallel request created the account first.
		return signIn{}, errConflict
	}
	if err != nil {
		return signIn{}, err
	}
	return s.startDeviceSession(r, userID, deviceName, true)
}
