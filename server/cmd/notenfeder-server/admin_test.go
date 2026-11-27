package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Rakhoo/tablegrade/server/internal/blob"
	"github.com/Rakhoo/tablegrade/server/internal/store/sqlite"
)

func TestAdmin(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("DATA_DIR", dir)
	db, err := sqlite.Open(filepath.Join(dir, dbFile))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	u, _ := db.CreateUser(ctx)
	_ = db.SetContact(ctx, u.ID, "Anna@example.org", "Empfohlen\tvon Frau M.")
	_ = db.Close()

	run := func(args ...string) string {
		t.Helper()
		var out bytes.Buffer
		if err := admin(args, &out); err != nil {
			t.Fatalf("%v: %v", args, err)
		}
		return out.String()
	}
	if got := run("pending"); !strings.Contains(got, "wartet") || !strings.Contains(got, "Empfohlen von Frau M.") {
		t.Errorf("pending:\n%s", got)
	}
	if got := run("approve", "anna@example.org"); !strings.Contains(got, "Anna@example.org") {
		t.Errorf("approve: %s", got)
	}
	if got := run("emails"); strings.TrimSpace(got) != "Anna@example.org" {
		t.Errorf("emails: %q", got)
	}
	run("revoke", u.ID)
	if got := run("pending"); !strings.Contains(got, u.ID) {
		t.Errorf("revoke did not take back the approval:\n%s", got)
	}
	if err := admin([]string{"approve", "nobody@example.org"}, &bytes.Buffer{}); err == nil {
		t.Error("unknown account accepted")
	}

	// Delete: without --ja only a preview, with it the account and its photos are gone.
	photos := filepath.Join(dir, blob.DirName, u.ID)
	if err := os.MkdirAll(photos, 0o700); err != nil {
		t.Fatal(err)
	}
	if got := run("delete", u.ID); !strings.Contains(got, "--ja") {
		t.Errorf("preview: %s", got)
	}
	if got := run("list"); !strings.Contains(got, u.ID) {
		t.Error("preview deleted the account")
	}
	run("delete", u.ID, "--ja")
	if got := run("list"); strings.Contains(got, u.ID) {
		t.Errorf("account still listed:\n%s", got)
	}
	if _, err := os.Stat(photos); !os.IsNotExist(err) {
		t.Errorf("photos still there: %v", err)
	}
}
