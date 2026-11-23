package sqlite

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/Rakhoo/tablegrade/server/internal/store"
	"github.com/Rakhoo/tablegrade/server/internal/store/storetest"
)

func TestConformance(t *testing.T) {
	storetest.Run(t, func(t *testing.T, clock *storetest.Clock) store.Store {
		db, err := Open(filepath.Join(t.TempDir(), "test.sqlite3"), WithClock(clock.Now))
		if err != nil {
			t.Fatal(err)
		}
		return db
	})
}

func TestReopenAndBackup(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "db.sqlite3")
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	u, err := db.CreateUser(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	backup := filepath.Join(dir, "backup.sqlite3")
	if err := db.Backup(context.Background(), backup); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	// Opening again applies no migration twice; the backup is a complete database.
	for _, p := range []string{path, backup} {
		db, err := Open(p)
		if err != nil {
			t.Fatalf("open %s: %v", p, err)
		}
		if _, err := db.GetUser(context.Background(), u.ID); err != nil {
			t.Errorf("%s: %v", p, err)
		}
		_ = db.Close()
	}
}
