package api

import (
	"context"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// Database snapshots in DATA_DIR/backup. Blobs are files already and are copied by
// the backup container directly.
const (
	backupDir    = "backup"
	backupPrefix = "notenfeder-"
	backupSuffix = ".sqlite3"
	keepBackups  = 7
)

// backupDatabase writes today's snapshot unless it exists and keeps the newest keepBackups.
func (s *Server) backupDatabase(ctx context.Context) error {
	dir := filepath.Join(s.cfg.DataDir, backupDir)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	path := filepath.Join(dir, backupPrefix+s.now().UTC().Format("2006-01-02")+backupSuffix)
	_, err := os.Stat(path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		if err := s.store.Backup(ctx, path); err != nil {
			return err
		}
		slog.Info("database backup written", "file", filepath.Base(path))
	case err != nil:
		return err
	}
	return pruneBackups(dir)
}

// pruneBackups deletes all but the newest snapshots. Names sort by date.
func pruneBackups(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	var names []string
	for _, e := range entries {
		if n := e.Name(); strings.HasPrefix(n, backupPrefix) && strings.HasSuffix(n, backupSuffix) {
			names = append(names, n)
		}
	}
	slices.Sort(names)
	for _, n := range names[:max(0, len(names)-keepBackups)] {
		if err := os.Remove(filepath.Join(dir, n)); err != nil {
			return err
		}
	}
	return nil
}
