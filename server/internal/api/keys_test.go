package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// Wrap ids of the tests.
const (
	wrapRecovery1 = "00000000-0000-4000-8000-000000000001"
	wrapRecovery2 = "00000000-0000-4000-8000-000000000002"
	wrapPasskey   = "00000000-0000-4000-8000-000000000003"
)

// wrapBody returns a valid PUT body with a fake 60-byte wrap.
func wrapBody(kind, credentialID string) string {
	b, _ := json.Marshal(map[string]string{"kind": kind, "credentialId": credentialID,
		"alg": "A256GCM", "wrapped": b64(make([]byte, 60))})
	return string(b)
}

// listKeys returns the wraps of the account.
func (e *testEnv) listKeys(token string) []wrapJSON {
	e.t.Helper()
	var res struct {
		Keys []wrapJSON `json:"keys"`
	}
	if rec := e.do(http.MethodGet, "/api/v1/keys", token, "", &res); rec.Code != http.StatusOK {
		e.t.Fatalf("list keys: %d", rec.Code)
	}
	return res.Keys
}

func TestKeysLifecycle(t *testing.T) {
	e := newEnv(t)
	a := newAuthenticator(t, true)
	s := e.registerApproved(a, "iPad")
	put := func(id, body string) int {
		return e.do(http.MethodPut, "/api/v1/keys/"+id, s.SessionToken, body, nil).Code
	}
	if code := put(wrapRecovery1, wrapBody("recovery", "")); code != http.StatusNoContent {
		t.Fatalf("put recovery: %d", code)
	}
	if code := put(wrapPasskey, wrapBody("passkey", b64(a.credID))); code != http.StatusNoContent {
		t.Fatalf("put passkey: %d", code)
	}
	keys := e.listKeys(s.SessionToken)
	if len(keys) != 2 || keys[0].Kind != "recovery" || keys[1].CredentialID != b64(a.credID) ||
		keys[1].Wrapped != b64(make([]byte, 60)) || keys[1].CreatedAt == 0 {
		t.Fatalf("keys: %+v", keys)
	}

	// The last recovery wrap stays; a new one replaces it via PUT then DELETE.
	wantError(t, e.do(http.MethodDelete, "/api/v1/keys/"+wrapRecovery1, s.SessionToken, "", nil), http.StatusConflict, "conflict")
	if code := put(wrapRecovery2, wrapBody("recovery", "")); code != http.StatusNoContent {
		t.Fatalf("put second recovery: %d", code)
	}
	if code := e.do(http.MethodDelete, "/api/v1/keys/"+wrapRecovery1, s.SessionToken, "", nil).Code; code != http.StatusNoContent {
		t.Fatalf("delete old recovery: %d", code)
	}
	if code := e.do(http.MethodDelete, "/api/v1/keys/"+wrapPasskey, s.SessionToken, "", nil).Code; code != http.StatusNoContent {
		t.Fatalf("delete passkey wrap: %d", code)
	}
	if keys := e.listKeys(s.SessionToken); len(keys) != 1 || keys[0].ID != wrapRecovery2 {
		t.Errorf("after delete: %+v", keys)
	}

	// Wraps of other accounts are invisible and cannot be overwritten.
	other := e.login("", "PC")
	if keys := e.listKeys(other.SessionToken); len(keys) != 0 {
		t.Errorf("other account sees %+v", keys)
	}
	wantError(t, e.do(http.MethodPut, "/api/v1/keys/"+wrapRecovery2, other.SessionToken, wrapBody("recovery", ""), nil), http.StatusConflict, "conflict")
	wantError(t, e.do(http.MethodDelete, "/api/v1/keys/"+wrapRecovery2, other.SessionToken, "", nil), http.StatusNotFound, "not_found")
}

func TestPutKeyValidation(t *testing.T) {
	e := newEnv(t)
	s := e.login("", "iPad")
	foreign := b64([]byte("not-a-passkey-of-this-account"))
	cases := map[string]struct{ id, body string }{
		"id not a uuid":        {"w1", wrapBody("recovery", "")},
		"id mismatch":          {wrapRecovery1, `{"id":"` + wrapRecovery2 + `","kind":"recovery","alg":"A256GCM","wrapped":"` + b64(make([]byte, 60)) + `"}`},
		"unknown kind":         {wrapRecovery1, wrapBody("org", "")},
		"wrong alg":            {wrapRecovery1, strings.Replace(wrapBody("recovery", ""), "A256GCM", "RSA-OAEP", 1)},
		"short wrap":           {wrapRecovery1, `{"kind":"recovery","alg":"A256GCM","wrapped":"` + b64(make([]byte, 59)) + `"}`},
		"recovery with cred":   {wrapRecovery1, wrapBody("recovery", foreign)},
		"passkey without cred": {wrapRecovery1, wrapBody("passkey", "")},
		"foreign passkey":      {wrapRecovery1, wrapBody("passkey", foreign)},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			wantError(t, e.do(http.MethodPut, "/api/v1/keys/"+c.id, s.SessionToken, c.body, nil), http.StatusBadRequest, "bad_request")
		})
	}
	wantError(t, e.do(http.MethodGet, "/api/v1/keys", "", "", nil), http.StatusUnauthorized, "unauthorized")
}
