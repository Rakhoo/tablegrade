package api

import (
	"context"
	"log/slog"
	"time"
)

// tombstoneLifetime is how long deletions stay available to offline devices (protocol.md 4).
const tombstoneLifetime = 180 * 24 * time.Hour

// maintenanceInterval is the pause between two cleanup runs.
const maintenanceInterval = 24 * time.Hour

// RunMaintenance cleans up once at start and then daily until ctx ends.
func (s *Server) RunMaintenance(ctx context.Context) {
	ticker := time.NewTicker(maintenanceInterval)
	defer ticker.Stop()
	for {
		s.Maintain(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// Maintain runs every cleanup step once. Failures are logged; the next run tries again.
func (s *Server) Maintain(ctx context.Context) {
	if err := s.purgeTombstones(ctx); err != nil {
		slog.Error("purging tombstones failed", "err", err)
	}
	if err := s.purgeOrphanedBlobs(ctx); err != nil {
		slog.Error("deleting orphaned blobs failed", "err", err)
	}
	if _, err := s.store.DeleteExpiredLinks(ctx); err != nil {
		slog.Error("deleting expired links failed", "err", err)
	}
}

// purgeTombstones removes deletions older than the tombstone lifetime.
func (s *Server) purgeTombstones(ctx context.Context) error {
	n, err := s.store.PurgeTombstones(ctx, s.now().Add(-tombstoneLifetime).UnixMilli())
	if n > 0 {
		slog.Info("purged tombstones", "count", n)
	}
	return err
}
