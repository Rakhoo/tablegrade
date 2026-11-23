package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/auth"
	"github.com/Rakhoo/tablegrade/server/internal/config"
	"github.com/Rakhoo/tablegrade/server/internal/store/sqlite"
	"github.com/Rakhoo/tablegrade/server/internal/store/storetest"
)

// Origin and RP ID of the test app.
const (
	testOrigin = "https://app.example"
	testRPID   = "app.example"
)

// testEnv is a server with a temporary database and a manual clock.
type testEnv struct {
	t       *testing.T
	handler http.Handler
	clock   *storetest.Clock
	store   *sqlite.DB
	dataDir string
}

// cfg is the configuration of every test server.
func (e *testEnv) cfg() config.Config {
	return config.Config{AppOrigins: []string{testOrigin}, RPID: testRPID, DevAuth: true, DataDir: e.dataDir}
}

// newEnv starts a server with DEV_AUTH enabled and the given options.
func newEnv(t *testing.T, opts ...Option) *testEnv {
	t.Helper()
	clock := storetest.NewClock()
	dir := t.TempDir()
	db, err := sqlite.Open(filepath.Join(dir, "db.sqlite3"), sqlite.WithClock(clock.Now))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	e := &testEnv{t: t, clock: clock, store: db, dataDir: dir}
	srv, err := New(e.cfg(), db, append([]Option{WithClock(clock.Now)}, opts...)...)
	if err != nil {
		t.Fatal(err)
	}
	e.handler = srv.Handler()
	return e
}

// do sends a request with an optional token and JSON body and decodes the JSON answer into out.
func (e *testEnv) do(method, path, token, body string, out any) *httptest.ResponseRecorder {
	e.t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, r)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.handler.ServeHTTP(rec, req)
	if out != nil {
		if err := json.Unmarshal(rec.Body.Bytes(), out); err != nil {
			e.t.Fatalf("%s %s: %v in %q", method, path, err, rec.Body.String())
		}
	}
	return rec
}

// login creates a device via the dev login, in a new account if userID is empty.
func (e *testEnv) login(userID, name string) signIn {
	e.t.Helper()
	body, _ := json.Marshal(map[string]string{"userId": userID, "deviceName": name})
	var res signIn
	if rec := e.do(http.MethodPost, "/api/v1/auth/dev/login", "", string(body), &res); rec.Code != http.StatusOK {
		e.t.Fatalf("dev login: %d %s", rec.Code, rec.Body.String())
	}
	return res
}

// wantError checks status and error code of a response.
func wantError(t *testing.T, rec *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	var body apiError
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != status || body.Code != code || body.Message == "" {
		t.Errorf("got %d %q, want %d %q", rec.Code, rec.Body.String(), status, code)
	}
}

func TestHealth(t *testing.T) {
	rec := newEnv(t).do(http.MethodGet, "/api/v1/health", "", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("X-Protocol-Version"); got != "1" {
		t.Errorf("X-Protocol-Version = %q", got)
	}
}

func TestNewerProtocolRejected(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	req.Header.Set("X-Protocol-Version", "2")
	rec := httptest.NewRecorder()
	newEnv(t).handler.ServeHTTP(rec, req)
	wantError(t, rec, http.StatusUpgradeRequired, "upgrade_required")
}

func TestCORS(t *testing.T) {
	env := newEnv(t)
	for origin, allowed := range map[string]bool{"https://app.example": true, "https://evil.example": false} {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/health", nil)
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
		got := rec.Header().Get("Access-Control-Allow-Origin") == origin
		if got != allowed {
			t.Errorf("origin %s: allowed = %v, want %v", origin, got, allowed)
		}
	}
}

func TestUnknownRouteIsJSON(t *testing.T) {
	wantError(t, newEnv(t).do(http.MethodGet, "/api/v1/nothing", "", "", nil), http.StatusNotFound, "not_found")
}

func TestDevLoginDisabledByDefault(t *testing.T) {
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "db.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	srv, err := New(config.Config{AppOrigins: []string{testOrigin}, RPID: testRPID}, db)
	if err != nil {
		t.Fatal(err)
	}
	h := srv.Handler()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/auth/dev/login", strings.NewReader(`{"deviceName":"x"}`)))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestSessionLifecycle(t *testing.T) {
	env := newEnv(t)
	first := env.login("", "iPad")
	if !first.IsNewUser || len(first.SessionToken) != 43 {
		t.Fatalf("login = %+v", first)
	}
	second := env.login(first.UserID, "PC")
	if second.IsNewUser || second.UserID != first.UserID || second.DeviceID == first.DeviceID {
		t.Fatalf("second login = %+v", second)
	}

	var sess struct {
		UserID   string       `json:"userId"`
		DeviceID string       `json:"deviceId"`
		Devices  []deviceJSON `json:"devices"`
	}
	env.do(http.MethodGet, "/api/v1/auth/session", first.SessionToken, "", &sess)
	if sess.UserID != first.UserID || sess.DeviceID != first.DeviceID || len(sess.Devices) != 2 || !sess.Devices[0].Current {
		t.Errorf("session = %+v", sess)
	}

	wantError(t, env.do(http.MethodGet, "/api/v1/auth/session", "", "", nil), http.StatusUnauthorized, "unauthorized")
	wantError(t, env.do(http.MethodGet, "/api/v1/auth/session", "bad", "", nil), http.StatusUnauthorized, "unauthorized")

	if rec := env.do(http.MethodPost, "/api/v1/auth/logout", second.SessionToken, "", nil); rec.Code != http.StatusNoContent {
		t.Fatalf("logout = %d", rec.Code)
	}
	wantError(t, env.do(http.MethodGet, "/api/v1/auth/session", second.SessionToken, "", nil), http.StatusUnauthorized, "unauthorized")
}

func TestSessionExpiryAndExtension(t *testing.T) {
	env := newEnv(t)
	login := env.login("", "iPad")
	// Each use extends the session by the full lifetime.
	for range 3 {
		env.clock.Advance(auth.SessionLifetime - time.Hour)
		if rec := env.do(http.MethodGet, "/api/v1/devices", login.SessionToken, "", nil); rec.Code != http.StatusOK {
			t.Fatalf("status after %v = %d", env.clock.Now(), rec.Code)
		}
	}
	env.clock.Advance(auth.SessionLifetime + time.Hour)
	wantError(t, env.do(http.MethodGet, "/api/v1/devices", login.SessionToken, "", nil), http.StatusUnauthorized, "unauthorized")
}

func TestDevices(t *testing.T) {
	env := newEnv(t)
	a := env.login("", "iPad")
	b := env.login(a.UserID, "PC")
	other := env.login("", "Fremd")

	if rec := env.do(http.MethodPatch, "/api/v1/devices/"+b.DeviceID, a.SessionToken, `{"name":" Laptop "}`, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("rename = %d", rec.Code)
	}
	wantError(t, env.do(http.MethodPatch, "/api/v1/devices/"+b.DeviceID, a.SessionToken, `{"name":""}`, nil),
		http.StatusBadRequest, "bad_request")
	wantError(t, env.do(http.MethodPatch, "/api/v1/devices/"+b.DeviceID, other.SessionToken, `{"name":"x"}`, nil),
		http.StatusNotFound, "not_found")
	wantError(t, env.do(http.MethodPost, "/api/v1/devices/"+a.DeviceID+"/revoke", a.SessionToken, "", nil),
		http.StatusConflict, "conflict")
	wantError(t, env.do(http.MethodPost, "/api/v1/devices/"+b.DeviceID+"/revoke", other.SessionToken, "", nil),
		http.StatusNotFound, "not_found")

	if rec := env.do(http.MethodPost, "/api/v1/devices/"+b.DeviceID+"/revoke", a.SessionToken, "", nil); rec.Code != http.StatusNoContent {
		t.Fatalf("revoke = %d", rec.Code)
	}
	wantError(t, env.do(http.MethodGet, "/api/v1/devices", b.SessionToken, "", nil), http.StatusUnauthorized, "session_revoked")

	var list struct {
		Devices []deviceJSON `json:"devices"`
	}
	env.do(http.MethodGet, "/api/v1/devices", a.SessionToken, "", &list)
	if len(list.Devices) != 2 || list.Devices[1].Name != "Laptop" || list.Devices[1].RevokedAt == nil || list.Devices[0].RevokedAt != nil {
		t.Errorf("devices = %+v", list.Devices)
	}
}

func TestDeviceLimit(t *testing.T) {
	env := newEnv(t)
	first := env.login("", "1")
	for range maxDevices - 1 {
		env.clock.Advance(10 * time.Second) // stay below the auth rate limit
		env.login(first.UserID, "n")
	}
	env.clock.Advance(10 * time.Second)
	rec := env.do(http.MethodPost, "/api/v1/auth/dev/login", "", `{"userId":"`+first.UserID+`","deviceName":"x"}`, nil)
	wantError(t, rec, http.StatusConflict, "conflict")
}

func TestAuthRateLimit(t *testing.T) {
	env := newEnv(t)
	for range authPerMinute {
		env.login("", "x")
	}
	rec := env.do(http.MethodPost, "/api/v1/auth/dev/login", "", `{"deviceName":"x"}`, nil)
	wantError(t, rec, http.StatusTooManyRequests, "rate_limited")
	if rec.Header().Get("Retry-After") == "" {
		t.Error("Retry-After missing")
	}
}

func TestBodyLimit(t *testing.T) {
	env := newEnv(t)
	body := `{"deviceName":"` + strings.Repeat("x", maxJSONBody) + `"}`
	wantError(t, env.do(http.MethodPost, "/api/v1/auth/dev/login", "", body, nil), http.StatusRequestEntityTooLarge, "too_large")
	wantError(t, env.do(http.MethodPost, "/api/v1/auth/dev/login", "", "{", nil), http.StatusBadRequest, "bad_request")
}
