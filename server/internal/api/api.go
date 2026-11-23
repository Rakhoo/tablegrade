// Package api wires the HTTP routes under /api/v1 and applies the rules every response follows:
// CORS for the app origins, the protocol version header, size and rate limits and the JSON
// error format (protocol.md 1 and 8).
package api

import (
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/auth"
	"github.com/Rakhoo/tablegrade/server/internal/config"
	"github.com/Rakhoo/tablegrade/server/internal/ratelimit"
	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// ProtocolVersion is the major protocol version this server speaks.
const ProtocolVersion = 1

// Limits from protocol.md 8.
const (
	authPerMinute = 10
	maxDevices    = 10
)

// Server holds the dependencies of all handlers.
type Server struct {
	cfg      config.Config
	store    store.Store
	sessions auth.Sessions
	now      func() time.Time
	// authLimit counts auth requests per client IP.
	authLimit *ratelimit.Limiter
}

// Option changes the behavior of New.
type Option func(*Server)

// WithClock replaces time.Now, e.g. in tests.
func WithClock(now func() time.Time) Option {
	return func(s *Server) { s.now = now }
}

// New returns the server with all routes.
func New(cfg config.Config, st store.Store, opts ...Option) *Server {
	s := &Server{cfg: cfg, store: st, now: time.Now}
	for _, opt := range opts {
		opt(s)
	}
	s.sessions = auth.Sessions{Store: st, Now: s.now}
	s.authLimit = ratelimit.New(authPerMinute, time.Minute, s.now)
	if cfg.DevAuth {
		slog.Warn("DEV_AUTH=1: POST /api/v1/auth/dev/login creates accounts without sign-in. Never use this in production.")
	}
	return s
}

// Handler returns the root handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", handleHealth)

	mux.Handle("GET /api/v1/auth/session", s.withSession(s.handleSession))
	mux.Handle("POST /api/v1/auth/logout", s.withSession(s.handleLogout))
	if s.cfg.DevAuth {
		mux.Handle("POST /api/v1/auth/dev/login", s.withAuthLimit(s.handleDevLogin))
	}

	mux.Handle("GET /api/v1/devices", s.withSession(s.handleListDevices))
	mux.Handle("POST /api/v1/devices/{id}/revoke", s.withSession(s.handleRevokeDevice))
	mux.Handle("PATCH /api/v1/devices/{id}", s.withSession(s.handleRenameDevice))

	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, errNotFound)
	})
	return withProtocol(withCORS(s.cfg.AppOrigins, mux))
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "protocolVersion": ProtocolVersion})
}

// withProtocol sets X-Protocol-Version and rejects clients with a newer major version.
func withProtocol(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Protocol-Version", strconv.Itoa(ProtocolVersion))
		if v := r.Header.Get("X-Protocol-Version"); v != "" {
			major, err := strconv.Atoi(strings.SplitN(v, ".", 2)[0])
			if err == nil && major > ProtocolVersion {
				writeError(w, errUpgradeRequired)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// withCORS allows the configured app origins and answers preflight requests.
func withCORS(origins []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && slices.Contains(origins, origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Expose-Headers", "X-Protocol-Version, Retry-After")
			if r.Method == http.MethodOptions {
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE")
				h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Protocol-Version")
				h.Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
