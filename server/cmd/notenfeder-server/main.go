// Command notenfeder-server is the sync server of Notenfeder. It stores only encrypted data
// (docs/sync-plan/protocol.md) and is configured via environment variables (see README.md).
package main

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/api"
	"github.com/Rakhoo/tablegrade/server/internal/config"
	"github.com/Rakhoo/tablegrade/server/internal/store/sqlite"
)

// dbFile is the name of the SQLite file in DATA_DIR.
const dbFile = "notenfeder.sqlite3"

// shutdownTimeout bounds how long running requests may take after a stop signal.
const shutdownTimeout = 10 * time.Second

func main() {
	// The runtime image has no shell or curl, so the container health check calls the binary.
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := healthcheck(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "admin" {
		runAdmin(os.Args[2:])
		return
	}
	if err := run(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	// JSON lines are easy to filter in `docker compose logs`.
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))
	cfg, err := config.FromEnv()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(cfg.DataDir, 0o700); err != nil {
		return err
	}
	db, err := sqlite.Open(filepath.Join(cfg.DataDir, dbFile))
	if err != nil {
		return err
	}
	defer db.Close()
	server, err := api.New(cfg, db)
	if err != nil {
		return err
	}
	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ErrorLog:          slog.NewLogLogger(slog.Default().Handler(), slog.LevelWarn),
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go server.RunMaintenance(ctx)

	errs := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", cfg.ListenAddr)
		errs <- srv.ListenAndServe()
	}()
	select {
	case err := <-errs:
		return err
	case <-ctx.Done():
	}
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-errs; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// healthcheck asks the local server for GET /api/v1/health.
func healthcheck() error {
	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" || strings.HasPrefix(addr, ":") {
		addr = "127.0.0.1" + cmp.Or(addr, ":8080")
	}
	client := &http.Client{Timeout: 3 * time.Second}
	res, err := client.Get("http://" + addr + "/api/v1/health")
	if err != nil {
		return err
	}
	_ = res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("health: status %d", res.StatusCode)
	}
	return nil
}
