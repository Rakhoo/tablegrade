// Package oidctest is a fake OpenID provider for tests: a token endpoint and a JWKS, both
// served by httptest, with ID tokens signed by a fresh RSA key.
package oidctest

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	jose "github.com/go-jose/go-jose/v4"

	"github.com/Rakhoo/tablegrade/server/internal/oidc"
)

// Client credentials the fake provider expects.
const (
	ClientID     = "test-client"
	ClientSecret = "test-secret"
)

// Grant is what the token endpoint expects for a code and which claims it returns.
type Grant struct {
	CodeVerifier string
	RedirectURI  string
	// Claims of the ID token. Missing iss, aud, iat and exp are filled with valid values.
	Claims map[string]any
}

// Provider is a running fake identity provider.
type Provider struct {
	t      *testing.T
	server *httptest.Server
	signer jose.Signer
	mu     sync.Mutex
	grants map[string]Grant
}

// New starts a fake provider; it stops when the test ends.
func New(t *testing.T) *Provider {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", "test"))
	if err != nil {
		t.Fatal(err)
	}
	p := &Provider{t: t, signer: signer, grants: map[string]Grant{}}
	jwks := jose.JSONWebKeySet{Keys: []jose.JSONWebKey{
		{Key: &key.PublicKey, KeyID: "test", Algorithm: string(jose.RS256), Use: "sig"},
	}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /keys", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(jwks)
	})
	mux.HandleFunc("POST /token", p.handleToken)
	p.server = httptest.NewServer(mux)
	t.Cleanup(p.server.Close)
	return p
}

// Endpoints returns the URLs of the fake provider.
func (p *Provider) Endpoints() oidc.Endpoints {
	return oidc.Endpoints{
		AuthorizeURL: p.server.URL + "/authorize",
		TokenURL:     p.server.URL + "/token",
		JWKSURL:      p.server.URL + "/keys",
		Issuer:       p.Issuer(),
	}
}

// Issuer is the expected "iss" claim.
func (p *Provider) Issuer() string { return p.server.URL }

// Client returns an oidc.Provider configured for this fake.
func (p *Provider) Client() *oidc.Provider {
	return oidc.New(p.Endpoints(), ClientID, ClientSecret, p.server.Client())
}

// AddCode registers a single-use authorization code.
func (p *Provider) AddCode(code string, g Grant) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.grants[code] = g
}

// handleToken redeems a code like a real token endpoint, including PKCE and client checks.
func (p *Provider) handleToken(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	f := r.PostForm
	p.mu.Lock()
	g, ok := p.grants[f.Get("code")]
	delete(p.grants, f.Get("code"))
	p.mu.Unlock()
	if !ok || f.Get("grant_type") != "authorization_code" || f.Get("client_id") != ClientID ||
		f.Get("client_secret") != ClientSecret || f.Get("code_verifier") != g.CodeVerifier ||
		f.Get("redirect_uri") != g.RedirectURI {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_grant"})
		return
	}
	claims := map[string]any{"iss": p.Issuer(), "aud": ClientID,
		"iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix()}
	for k, v := range g.Claims {
		claims[k] = v
	}
	payload, _ := json.Marshal(claims)
	sig, err := p.signer.Sign(payload)
	if err != nil {
		p.t.Error(err)
		return
	}
	token, _ := sig.CompactSerialize()
	_ = json.NewEncoder(w).Encode(map[string]string{"id_token": token, "token_type": "Bearer"})
}
