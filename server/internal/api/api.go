// Package api wires the HTTP routes under /api/v1 and applies the rules every response follows:
// CORS for the app origins, the protocol version header and the JSON error format
// (protocol.md 1).
package api

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/Rakhoo/tablegrade/server/internal/config"
)

// ProtocolVersion is the major protocol version this server speaks.
const ProtocolVersion = 1

// Error is the JSON body of every error response.
type Error struct {
	Code    string `json:"error"`
	Message string `json:"message"`
}

// NewHandler returns the root handler of the server.
func NewHandler(cfg config.Config) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", handleHealth)
	return withProtocol(withCORS(cfg.AppOrigins, mux))
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]any{"status": "ok", "protocolVersion": ProtocolVersion})
}

// WriteJSON writes v as JSON with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// WriteError writes an error response with a code from protocol.md 1 and a German message.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	WriteJSON(w, status, Error{Code: code, Message: message})
}

// withProtocol sets X-Protocol-Version and rejects clients with a newer major version.
func withProtocol(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Protocol-Version", strconv.Itoa(ProtocolVersion))
		if v := r.Header.Get("X-Protocol-Version"); v != "" {
			major, err := strconv.Atoi(strings.SplitN(v, ".", 2)[0])
			if err == nil && major > ProtocolVersion {
				WriteError(w, http.StatusUpgradeRequired, "upgrade_required",
					"Der Server ist älter als die App. Bitte später erneut versuchen.")
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
