package api

import (
	"net/http"

	"github.com/Rakhoo/tablegrade/server/internal/hub"
	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// deviceJSON is one device in GET /devices and GET /auth/session. RevokedAt is null while active.
type deviceJSON struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	CreatedAt  int64  `json:"createdAt"`
	LastSeenAt int64  `json:"lastSeenAt"`
	RevokedAt  *int64 `json:"revokedAt"`
	Current    bool   `json:"current"`
}

// devicesJSON lists the devices of the session's account.
func (s *Server) devicesJSON(r *http.Request, sess store.Session) ([]deviceJSON, error) {
	devices, err := s.store.ListDevices(r.Context(), sess.UserID)
	if err != nil {
		return nil, err
	}
	out := make([]deviceJSON, len(devices))
	for i, d := range devices {
		out[i] = deviceJSON{ID: d.ID, Name: d.Name, CreatedAt: d.CreatedAt, LastSeenAt: d.LastSeenAt,
			Current: d.ID == sess.DeviceID}
		if d.RevokedAt != 0 {
			out[i].RevokedAt = &d.RevokedAt
		}
	}
	return out, nil
}

// handleListDevices answers GET /devices.
func (s *Server) handleListDevices(w http.ResponseWriter, r *http.Request, sess store.Session) {
	devices, err := s.devicesJSON(r, sess)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"devices": devices})
}

// handleRevokeDevice blocks another device of the account. The own device signs out instead.
func (s *Server) handleRevokeDevice(w http.ResponseWriter, r *http.Request, sess store.Session) {
	id := r.PathValue("id")
	if id == sess.DeviceID {
		writeError(w, newError(http.StatusConflict, "conflict",
			"Das eigene Gerät lässt sich nicht sperren. Bitte abmelden."))
		return
	}
	if err := s.store.RevokeDevice(r.Context(), sess.UserID, id); err != nil {
		writeError(w, err)
		return
	}
	s.hub.Publish(sess.UserID, id, hub.Revoked())
	w.WriteHeader(http.StatusNoContent)
}

// handleRenameDevice changes the name of a device of the account.
func (s *Server) handleRenameDevice(w http.ResponseWriter, r *http.Request, sess store.Session) {
	var body struct {
		Name string `json:"name"`
	}
	if err := readJSON(w, r, maxJSONBody, &body); err != nil {
		writeError(w, err)
		return
	}
	name, err := cleanDeviceName(body.Name)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.store.RenameDevice(r.Context(), sess.UserID, r.PathValue("id"), name); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
