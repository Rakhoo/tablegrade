// Package oidc signs in with Microsoft and Google: it redeems the authorization code the
// browser got via PKCE and verifies the returned ID token (docs/protocol.md 2).
package oidc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
)

// Endpoints are the URLs and the expected issuer of one identity provider.
type Endpoints struct {
	AuthorizeURL string
	TokenURL     string
	JWKSURL      string
	Issuer       string
}

// Microsoft allows personal accounts only (tenant "consumers"). Their tokens carry the fixed
// tenant id of the Microsoft account directory as issuer.
var Microsoft = Endpoints{
	AuthorizeURL: "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize",
	TokenURL:     "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
	JWKSURL:      "https://login.microsoftonline.com/consumers/discovery/v2.0/keys",
	Issuer:       "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
}

// Google is the endpoint set of Google accounts.
var Google = Endpoints{
	AuthorizeURL: "https://accounts.google.com/o/oauth2/v2/auth",
	TokenURL:     "https://oauth2.googleapis.com/token",
	JWKSURL:      "https://www.googleapis.com/oauth2/v3/certs",
	Issuer:       "https://accounts.google.com",
}

// ErrRejected means the provider refused the code or the ID token is invalid. Other errors
// mean the provider could not be reached.
var ErrRejected = errors.New("oidc: sign-in rejected")

// maxTokenResponse limits the token endpoint answer.
const maxTokenResponse = 1 << 20

// Provider is one configured identity provider.
type Provider struct {
	ClientID     string
	AuthorizeURL string
	clientSecret string
	tokenURL     string
	client       *http.Client
	verifier     *gooidc.IDTokenVerifier
}

// New returns a provider. client is used for the code exchange and the key download; nil means
// a client with a 10 second timeout. Keys are loaded on first use, so New needs no network.
func New(ep Endpoints, clientID, clientSecret string, client *http.Client) *Provider {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	keys := gooidc.NewRemoteKeySet(gooidc.ClientContext(context.Background(), client), ep.JWKSURL)
	return &Provider{
		ClientID:     clientID,
		AuthorizeURL: ep.AuthorizeURL,
		clientSecret: clientSecret,
		tokenURL:     ep.TokenURL,
		client:       client,
		verifier:     gooidc.NewVerifier(ep.Issuer, keys, &gooidc.Config{ClientID: clientID}),
	}
}

// Identity is the verified result of a sign-in.
type Identity struct {
	// Subject is the "sub" claim, the stable id of the provider account.
	Subject string
	// Email is the "email" claim, empty if the provider sent none. Only shown to the user,
	// never stored on the server.
	Email string
}

// Exchange redeems an authorization code and returns the verified identity.
func (p *Provider) Exchange(ctx context.Context, code, codeVerifier, redirectURI string) (Identity, error) {
	raw, err := p.redeem(ctx, code, codeVerifier, redirectURI)
	if err != nil {
		return Identity{}, err
	}
	token, err := p.verifier.Verify(ctx, raw)
	if err != nil {
		return Identity{}, fmt.Errorf("%w: %v", ErrRejected, err)
	}
	var claims struct {
		Email         string `json:"email"`
		EmailVerified *bool  `json:"email_verified"`
	}
	if err := token.Claims(&claims); err != nil {
		return Identity{}, fmt.Errorf("%w: %v", ErrRejected, err)
	}
	// If a provider sends the claim as false, the account is not confirmed by its owner and
	// is not trusted.
	if claims.EmailVerified != nil && !*claims.EmailVerified {
		return Identity{}, fmt.Errorf("%w: email not verified", ErrRejected)
	}
	if token.Subject == "" {
		return Identity{}, fmt.Errorf("%w: no subject", ErrRejected)
	}
	return Identity{Subject: token.Subject, Email: claims.Email}, nil
}

// redeem posts the code to the token endpoint and returns the raw ID token.
func (p *Provider) redeem(ctx context.Context, code, codeVerifier, redirectURI string) (string, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"code_verifier": {codeVerifier},
		"redirect_uri":  {redirectURI},
		"client_id":     {p.ClientID},
	}
	if p.clientSecret != "" {
		form.Set("client_secret", p.clientSecret)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	res, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("oidc: token request: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	var body struct {
		IDToken string `json:"id_token"`
		Error   string `json:"error"`
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, maxTokenResponse))
	if err != nil {
		return "", fmt.Errorf("oidc: token response: %w", err)
	}
	_ = json.Unmarshal(data, &body)
	switch {
	case res.StatusCode >= 500:
		return "", fmt.Errorf("oidc: token endpoint status %d", res.StatusCode)
	case res.StatusCode != http.StatusOK:
		// Codes are single use and short-lived; a wrong or reused code is the user's problem.
		return "", fmt.Errorf("%w: token endpoint %d %s", ErrRejected, res.StatusCode, body.Error)
	case body.IDToken == "":
		return "", fmt.Errorf("%w: no id_token", ErrRejected)
	}
	return body.IDToken, nil
}
