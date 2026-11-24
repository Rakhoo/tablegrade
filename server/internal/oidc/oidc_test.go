package oidc_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/oidc"
	"github.com/Rakhoo/tablegrade/server/internal/oidc/oidctest"
)

const redirect = "https://app.example/"

func TestExchange(t *testing.T) {
	fake := oidctest.New(t)
	p := fake.Client()
	ctx := context.Background()
	fake.AddCode("good", oidctest.Grant{CodeVerifier: "v", RedirectURI: redirect,
		Claims: map[string]any{"sub": "alice", "email": "alice@example.org", "email_verified": true}})

	id, err := p.Exchange(ctx, "good", "v", redirect)
	if err != nil || id != (oidc.Identity{Subject: "alice", Email: "alice@example.org"}) {
		t.Fatalf("got %+v, %v", id, err)
	}
	// Codes are single use.
	if _, err := p.Exchange(ctx, "good", "v", redirect); !errors.Is(err, oidc.ErrRejected) {
		t.Errorf("reused code: %v", err)
	}
}

func TestExchangeRejects(t *testing.T) {
	fake := oidctest.New(t)
	p := fake.Client()
	ctx := context.Background()
	cases := map[string]struct {
		verifier string
		claims   map[string]any
	}{
		"wrong verifier":     {verifier: "x", claims: map[string]any{"sub": "a"}},
		"wrong issuer":       {verifier: "v", claims: map[string]any{"sub": "a", "iss": "https://evil.example"}},
		"wrong audience":     {verifier: "v", claims: map[string]any{"sub": "a", "aud": "other"}},
		"expired":            {verifier: "v", claims: map[string]any{"sub": "a", "exp": time.Now().Add(-time.Hour).Unix()}},
		"email not verified": {verifier: "v", claims: map[string]any{"sub": "a", "email_verified": false}},
		"no subject":         {verifier: "v", claims: map[string]any{}},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			fake.AddCode(name, oidctest.Grant{CodeVerifier: "v", RedirectURI: redirect, Claims: c.claims})
			if _, err := p.Exchange(ctx, name, c.verifier, redirect); !errors.Is(err, oidc.ErrRejected) {
				t.Errorf("got %v, want ErrRejected", err)
			}
		})
	}
}

func TestExchangeUnreachable(t *testing.T) {
	ep := oidc.Endpoints{TokenURL: "http://127.0.0.1:1/token", JWKSURL: "http://127.0.0.1:1/keys", Issuer: "x"}
	_, err := oidc.New(ep, "c", "", nil).Exchange(context.Background(), "c", "v", redirect)
	if err == nil || errors.Is(err, oidc.ErrRejected) {
		t.Errorf("got %v, want a network error", err)
	}
}
