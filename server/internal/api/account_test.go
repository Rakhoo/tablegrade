package api

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestDeleteAccount(t *testing.T) {
	e := newWSEnv(t, time.Minute)
	ipad := e.login("", "iPad")
	pc := e.login(ipad.UserID, "PC")
	other := e.login("", "Fremd")
	e.putBlob(ipad.SessionToken, blobID(1), strings.Repeat("x", 100))
	e.putBlob(other.SessionToken, blobID(1), strings.Repeat("y", 100))
	e.push(ipad.SessionToken, nil, pushRec(recID(1), false, 0, blobID(1)))
	conn, _ := e.dial(pc.SessionToken, testOrigin)
	read(t, conn) // hello

	if code := e.do(http.MethodDelete, "/api/v1/account", ipad.SessionToken, "", nil).Code; code != http.StatusNoContent {
		t.Fatalf("delete: %d", code)
	}
	if msg := read(t, conn); msg["type"] != "revoked" {
		t.Errorf("ws: %v", msg)
	}
	for _, s := range []signIn{ipad, pc} {
		wantError(t, e.do(http.MethodGet, "/api/v1/auth/session", s.SessionToken, "", nil), http.StatusUnauthorized, "unauthorized")
	}
	if _, err := os.Stat(filepath.Join(e.dataDir, "blobs", ipad.UserID)); !os.IsNotExist(err) {
		t.Errorf("blob folder still there: %v", err)
	}
	// Other accounts are untouched.
	if rec := e.do(http.MethodGet, "/api/v1/blobs/"+blobID(1), other.SessionToken, "", nil); rec.Body.String() != strings.Repeat("y", 100) {
		t.Errorf("other blob: %d", rec.Code)
	}
}

func TestDailyBackup(t *testing.T) {
	e := newEnv(t)
	srv, err := New(e.cfg(), e.store, WithClock(e.clock.Now))
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(e.dataDir, backupDir)
	list := func() []string {
		entries, _ := os.ReadDir(dir)
		var names []string
		for _, en := range entries {
			names = append(names, en.Name())
		}
		return names
	}
	srv.Maintain(context.Background())
	srv.Maintain(context.Background()) // a restart on the same day writes no second file
	if got := list(); !slices.Equal(got, []string{"notenfeder-2026-01-01.sqlite3"}) {
		t.Fatalf("first day: %v", got)
	}
	for range 9 {
		e.clock.Advance(24 * time.Hour)
		srv.Maintain(context.Background())
	}
	got := list()
	if len(got) != keepBackups || got[0] != "notenfeder-2026-01-04.sqlite3" || got[6] != "notenfeder-2026-01-10.sqlite3" {
		t.Errorf("after 10 days: %v", got)
	}
}

func TestAccessLogHidesSecrets(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })

	e := newEnv(t)
	s := e.login("", "iPad")
	e.do(http.MethodGet, "/api/v1/ws?token="+s.SessionToken, "", "", nil)
	e.do(http.MethodGet, "/api/v1/blobs/"+blobID(7), s.SessionToken, "", nil)
	out := buf.String()
	if strings.Contains(out, s.SessionToken) || strings.Contains(out, blobID(7)) || strings.Contains(out, "192.0.2.1") {
		t.Errorf("secret in log: %s", out)
	}
	if !strings.Contains(out, `route="GET /api/v1/blobs/{id}" status=404`) {
		t.Errorf("missing access line: %s", out)
	}
}
