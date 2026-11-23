package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Rakhoo/tablegrade/server/internal/oidc/oidctest"
)

// testRedirect is the redirect URI of the test app.
const testRedirect = testOrigin + "/?oidc=callback"

// newOIDCEnv starts a server with a fake "google" provider.
func newOIDCEnv(t *testing.T) (*testEnv, *oidctest.Provider) {
	t.Helper()
	fake := oidctest.New(t)
	return newEnv(t, WithOIDCProvider("google", fake.Client())), fake
}

// exchange registers a code for subject and redeems it, optionally with a session.
func exchange(e *testEnv, fake *oidctest.Provider, code, subject, token string, out any) int {
	e.t.Helper()
	fake.AddCode(code, oidctest.Grant{CodeVerifier: "verifier", RedirectURI: testRedirect,
		Claims: map[string]any{"sub": subject}})
	body, _ := json.Marshal(map[string]string{"code": code, "codeVerifier": "verifier",
		"redirectUri": testRedirect, "deviceName": "iPad"})
	return e.do(http.MethodPost, "/api/v1/auth/oidc/google/exchange", token, string(body), out).Code
}

func TestOIDCConfig(t *testing.T) {
	e, _ := newOIDCEnv(t)
	var cfg struct {
		ClientID     string   `json:"clientId"`
		AuthorizeURL string   `json:"authorizeUrl"`
		Scopes       []string `json:"scopes"`
		RedirectURI  string   `json:"redirectUri"`
	}
	if rec := e.do(http.MethodGet, "/api/v1/auth/oidc/google/config", "", "", &cfg); rec.Code != http.StatusOK {
		t.Fatalf("config: %d", rec.Code)
	}
	if cfg.ClientID != oidctest.ClientID || cfg.AuthorizeURL == "" || cfg.RedirectURI != testRedirect ||
		len(cfg.Scopes) != 1 || cfg.Scopes[0] != "openid" {
		t.Errorf("config: %+v", cfg)
	}
	// Providers without client id are disabled.
	wantError(t, e.do(http.MethodGet, "/api/v1/auth/oidc/microsoft/config", "", "", nil), http.StatusNotFound, "not_found")
}

func TestOIDCSignInAndLink(t *testing.T) {
	e, fake := newOIDCEnv(t)
	var first signIn
	if code := exchange(e, fake, "c1", "alice", "", &first); code != http.StatusOK || !first.IsNewUser {
		t.Fatalf("new account: %d %+v", code, first)
	}
	var again signIn
	if code := exchange(e, fake, "c2", "alice", "", &again); code != http.StatusOK ||
		again.IsNewUser || again.UserID != first.UserID || again.DeviceID == first.DeviceID {
		t.Fatalf("login: %d %+v", code, again)
	}

	// Link a second Google account to the first account; linking it twice is fine.
	if code := exchange(e, fake, "c3", "alice-2", first.SessionToken, nil); code != http.StatusNoContent {
		t.Fatalf("link: %d", code)
	}
	if code := exchange(e, fake, "c4", "alice-2", first.SessionToken, nil); code != http.StatusNoContent {
		t.Fatalf("link again: %d", code)
	}
	var linked signIn
	if exchange(e, fake, "c5", "alice-2", "", &linked); linked.UserID != first.UserID {
		t.Errorf("linked identity signs in to %q, want %q", linked.UserID, first.UserID)
	}
	var sess struct {
		Identities []identityJSON `json:"identities"`
	}
	e.do(http.MethodGet, "/api/v1/auth/session", first.SessionToken, "", &sess)
	if len(sess.Identities) != 2 || sess.Identities[0].Provider != "google" {
		t.Errorf("identities: %+v", sess.Identities)
	}

	// An identity of another account cannot be linked.
	other := e.login("", "PC")
	var res apiError
	if code := exchange(e, fake, "c6", "alice", other.SessionToken, &res); code != http.StatusConflict || res.Code != "conflict" {
		t.Errorf("foreign identity: %d %+v", code, res)
	}
}

func TestOIDCExchangeErrors(t *testing.T) {
	e, fake := newOIDCEnv(t)
	post := func(body string) *apiError {
		var res apiError
		e.do(http.MethodPost, "/api/v1/auth/oidc/google/exchange", "", body, &res)
		return &res
	}
	// Redirect URI of a foreign origin.
	if res := post(`{"code":"c","codeVerifier":"v","redirectUri":"https://evil.example/?oidc=callback","deviceName":"iPad"}`); res.Code != "bad_request" {
		t.Errorf("foreign redirect: %+v", res)
	}
	if res := post(`{"code":"c","codeVerifier":"v","redirectUri":"` + testRedirect + `","deviceName":""}`); res.Code != "bad_request" {
		t.Errorf("no device name: %+v", res)
	}
	// Unknown or reused code.
	var res apiError
	if code := exchange(e, fake, "c1", "bob", "", nil); code != http.StatusOK {
		t.Fatalf("first use: %d", code)
	}
	body := `{"code":"c1","codeVerifier":"verifier","redirectUri":"` + testRedirect + `","deviceName":"iPad"}`
	wantError(t, e.do(http.MethodPost, "/api/v1/auth/oidc/google/exchange", "", body, &res), http.StatusUnauthorized, "unauthorized")
	// An invalid token never creates an account.
	wantError(t, e.do(http.MethodPost, "/api/v1/auth/oidc/google/exchange", "bad", body, nil), http.StatusUnauthorized, "unauthorized")
}
