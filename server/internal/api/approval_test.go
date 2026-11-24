package api

import (
	"context"
	"net/http"
	"strings"
	"testing"
)

func TestApprovalAndContact(t *testing.T) {
	e := newEnv(t)
	s := e.registerPasskey(newAuthenticator(t, true), "iPad")
	var info struct {
		Approved     bool    `json:"approved"`
		ContactEmail *string `json:"contactEmail"`
		AccessNote   *string `json:"accessNote"`
	}
	e.do(http.MethodGet, "/api/v1/auth/session", s.SessionToken, "", &info)
	if info.Approved || info.ContactEmail != nil || info.AccessNote != nil {
		t.Fatalf("new account: %+v", info)
	}

	// A pending account can sign in and leave its contact, but cannot store or read data.
	wantError(t, e.do(http.MethodGet, "/api/v1/keys", s.SessionToken, "", nil), http.StatusForbidden, "not_approved")
	wantError(t, e.do(http.MethodGet, "/api/v1/records/pull?after=0", s.SessionToken, "", nil), http.StatusForbidden, "not_approved")
	put := func(body string) int {
		return e.do(http.MethodPut, "/api/v1/account/contact", s.SessionToken, body, nil).Code
	}
	if code := put(`{"email":" anna@example.org ","note":"Empfohlen von Frau M."}`); code != http.StatusNoContent {
		t.Fatalf("contact: %d", code)
	}
	for _, body := range []string{
		`{"email":"Anna <anna@example.org>"}`,
		`{"email":"anna@localhost"}`,
		`{"email":"anna@example.org","note":"` + strings.Repeat("x", 501) + `"}`,
	} {
		if code := put(body); code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", body, code)
		}
	}

	if err := e.store.SetApproved(context.Background(), s.UserID, 1); err != nil {
		t.Fatal(err)
	}
	e.do(http.MethodGet, "/api/v1/auth/session", s.SessionToken, "", &info)
	if !info.Approved || *info.ContactEmail != "anna@example.org" || *info.AccessNote != "Empfohlen von Frau M." {
		t.Errorf("approved account: %+v", info)
	}
	if rec := e.do(http.MethodGet, "/api/v1/keys", s.SessionToken, "", nil); rec.Code != http.StatusOK {
		t.Errorf("keys after approval: %d", rec.Code)
	}
}
