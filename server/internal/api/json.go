package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// maxJSONBody is the size limit of request bodies without a larger limit of their own.
const maxJSONBody = 64 << 10

// apiError is an error response with a code from docs/protocol.md 1 and a German message.
type apiError struct {
	Status  int    `json:"-"`
	Code    string `json:"error"`
	Message string `json:"message"`
	// RetryAfter is sent as header with rate_limited, in seconds.
	RetryAfter int `json:"-"`
}

func (e *apiError) Error() string { return e.Code + ": " + e.Message }

// newError builds an apiError.
func newError(status int, code, message string) *apiError {
	return &apiError{Status: status, Code: code, Message: message}
}

// Errors used by several handlers.
var (
	errBadRequest      = newError(http.StatusBadRequest, "bad_request", "Die Anfrage ist ungültig.")
	errUnauthorized    = newError(http.StatusUnauthorized, "unauthorized", "Bitte erneut anmelden.")
	errSessionRevoked  = newError(http.StatusUnauthorized, "session_revoked", "Dieses Gerät wurde gesperrt. Bitte erneut anmelden.")
	errNotFound        = newError(http.StatusNotFound, "not_found", "Nicht gefunden.")
	errConflict        = newError(http.StatusConflict, "conflict", "Die Änderung passt nicht zum aktuellen Stand.")
	errTooLarge        = newError(http.StatusRequestEntityTooLarge, "too_large", "Die Daten sind zu groß.")
	errNotApproved     = newError(http.StatusForbidden, "not_approved", "Das Konto ist noch nicht freigeschaltet.")
	errUpgradeRequired = newError(http.StatusUpgradeRequired, "upgrade_required", "Der Server ist älter als die App. Bitte später erneut versuchen.")
	errInternal        = newError(http.StatusInternalServerError, "internal", "Serverfehler. Bitte später erneut versuchen.")
)

// rateLimited returns the rate_limited error with its wait time.
func rateLimited(seconds int) *apiError {
	e := newError(http.StatusTooManyRequests, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.")
	e.RetryAfter = seconds
	return e
}

// writeJSON writes v as JSON with the given status.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes err as error response. Store errors map to their codes; anything else is
// logged and answered with a generic 500.
func writeError(w http.ResponseWriter, err error) {
	var e *apiError
	switch {
	case errors.As(err, &e):
	case errors.Is(err, store.ErrNotFound):
		e = errNotFound
	case errors.Is(err, store.ErrConflict):
		e = errConflict
	default:
		slog.Error("request failed", "err", err)
		e = errInternal
	}
	if e.RetryAfter > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(e.RetryAfter))
	}
	writeJSON(w, e.Status, e)
}

// readJSON decodes the request body into v, limited to maxBytes.
func readJSON(w http.ResponseWriter, r *http.Request, maxBytes int64, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(v); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return errTooLarge
		}
		return errBadRequest
	}
	return nil
}
