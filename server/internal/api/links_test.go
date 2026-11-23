package api

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"
)

// ecdhKey returns a fresh raw P-256 public key in base64url.
func ecdhKey(t *testing.T) string {
	t.Helper()
	k, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return b64(k.PublicKey().Bytes())
}

// linkStart is the answer of POST /link.
type linkStart struct {
	LinkID string `json:"linkId"`
	Code   string `json:"code"`
}

// startLink creates a link for the device of token.
func (e *testEnv) startLink(token, key string) linkStart {
	e.t.Helper()
	var res linkStart
	if rec := e.do(http.MethodPost, "/api/v1/link", token, `{"publicKey":"`+key+`"}`, &res); rec.Code != http.StatusOK {
		e.t.Fatalf("start link: %d %s", rec.Code, rec.Body.String())
	}
	return res
}

// completeBody is a valid body of POST /link/{id}/complete.
func completeBody(key string) string {
	b, _ := json.Marshal(map[string]string{"publicKey": key, "wrapped": b64(make([]byte, 60))})
	return string(b)
}

func TestLinkFlow(t *testing.T) {
	e := newWSEnv(t, time.Minute)
	old := e.login("", "iPad")
	fresh := e.login(old.UserID, "PC")
	conn, _ := e.dial(fresh.SessionToken, testOrigin)
	read(t, conn) // hello

	newKey, oldKey := ecdhKey(t), ecdhKey(t)
	l := e.startLink(fresh.SessionToken, newKey)
	if len(l.Code) != 8 || strings.Trim(l.Code, crockford) != "" {
		t.Fatalf("code %q", l.Code)
	}
	var status map[string]string
	e.do(http.MethodGet, "/api/v1/link/"+l.LinkID, fresh.SessionToken, "", &status)
	if status["status"] != "waiting" {
		t.Errorf("before complete: %v", status)
	}

	// The old device types the code in lower case with a separator.
	typed := strings.ToLower(l.Code[:4] + "-" + l.Code[4:])
	var found map[string]string
	if rec := e.do(http.MethodGet, "/api/v1/link/by-code/"+typed, old.SessionToken, "", &found); rec.Code != http.StatusOK ||
		found["linkId"] != l.LinkID || found["publicKey"] != newKey {
		t.Fatalf("by code: %d %v", rec.Code, found)
	}
	if code := e.do(http.MethodPost, "/api/v1/link/"+l.LinkID+"/complete", old.SessionToken, completeBody(oldKey), nil).Code; code != http.StatusNoContent {
		t.Fatalf("complete: %d", code)
	}
	if msg := read(t, conn); msg["type"] != "link" || msg["linkId"] != l.LinkID {
		t.Errorf("ws: %v", msg)
	}
	wantError(t, e.do(http.MethodPost, "/api/v1/link/"+l.LinkID+"/complete", old.SessionToken, completeBody(oldKey), nil),
		http.StatusConflict, "conflict")

	e.do(http.MethodGet, "/api/v1/link/"+l.LinkID, fresh.SessionToken, "", &status)
	if status["status"] != "done" || status["publicKey"] != oldKey || status["wrapped"] != b64(make([]byte, 60)) {
		t.Errorf("done: %v", status)
	}
	// The wrapped key is handed out once.
	wantError(t, e.do(http.MethodGet, "/api/v1/link/"+l.LinkID, fresh.SessionToken, "", nil), http.StatusNotFound, "not_found")
}

func TestLinkOnlyWithinAccount(t *testing.T) {
	e := newEnv(t)
	fresh := e.login("", "PC")
	stranger := e.login("", "Fremd")
	l := e.startLink(fresh.SessionToken, ecdhKey(t))
	wantError(t, e.do(http.MethodGet, "/api/v1/link/by-code/"+l.Code, stranger.SessionToken, "", nil), http.StatusNotFound, "not_found")
	wantError(t, e.do(http.MethodPost, "/api/v1/link/"+l.LinkID+"/complete", stranger.SessionToken, completeBody(ecdhKey(t)), nil),
		http.StatusNotFound, "not_found")
	wantError(t, e.do(http.MethodGet, "/api/v1/link/"+l.LinkID, stranger.SessionToken, "", nil), http.StatusNotFound, "not_found")
}

func TestLinkExpires(t *testing.T) {
	e := newEnv(t)
	old := e.login("", "iPad")
	fresh := e.login(old.UserID, "PC")
	l := e.startLink(fresh.SessionToken, ecdhKey(t))
	e.clock.Advance(linkLifetime + time.Second)
	wantError(t, e.do(http.MethodGet, "/api/v1/link/by-code/"+l.Code, old.SessionToken, "", nil), http.StatusNotFound, "not_found")
	wantError(t, e.do(http.MethodPost, "/api/v1/link/"+l.LinkID+"/complete", old.SessionToken, completeBody(ecdhKey(t)), nil),
		http.StatusNotFound, "not_found")
}

func TestLinkWrongCodes(t *testing.T) {
	e := newEnv(t)
	old := e.login("", "iPad")
	fresh := e.login(old.UserID, "PC")
	l := e.startLink(fresh.SessionToken, ecdhKey(t))
	for range maxLinkFailures {
		wantError(t, e.do(http.MethodGet, "/api/v1/link/by-code/ZZZZZZZZ", old.SessionToken, "", nil), http.StatusNotFound, "not_found")
	}
	// After 5 wrong codes the open links of the account are gone.
	wantError(t, e.do(http.MethodGet, "/api/v1/link/by-code/"+l.Code, old.SessionToken, "", nil), http.StatusNotFound, "not_found")
}

func TestLinkValidation(t *testing.T) {
	e := newEnv(t)
	s := e.login("", "iPad")
	notOnCurve := make([]byte, 65)
	notOnCurve[0] = 4
	for _, key := range []string{"", b64(notOnCurve), b64(make([]byte, 33))} {
		wantError(t, e.do(http.MethodPost, "/api/v1/link", s.SessionToken, `{"publicKey":"`+key+`"}`, nil), http.StatusBadRequest, "bad_request")
	}
	l := e.startLink(s.SessionToken, ecdhKey(t))
	short := `{"publicKey":"` + ecdhKey(t) + `","wrapped":"` + b64(make([]byte, 59)) + `"}`
	wantError(t, e.do(http.MethodPost, "/api/v1/link/"+l.LinkID+"/complete", s.SessionToken, short, nil), http.StatusBadRequest, "bad_request")
}

func TestNormalizeCode(t *testing.T) {
	if got := normalizeCode(" ab-cd oil "); got != "ABCD011" {
		t.Errorf("got %q", got)
	}
}
