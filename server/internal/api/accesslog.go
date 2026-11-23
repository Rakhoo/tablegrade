package api

import (
	"log/slog"
	"net/http"
	"time"
)

// statusRecorder remembers the response status for the access log.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// Unwrap lets http.ResponseController and the WebSocket upgrade reach the real writer.
func (r *statusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// withAccessLog logs one line per request. It logs the route pattern instead of the path and
// never the query, client IP or headers, so no ids, tokens or addresses end up in the logs.
func withAccessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.Info("request", "route", r.Pattern, "status", rec.status,
			"ms", time.Since(start).Milliseconds())
	})
}
