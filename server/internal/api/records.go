package api

import (
	"encoding/base64"
	"net/http"
	"strconv"

	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// Record limits (protocol.md 4 and 8).
const (
	maxPushRecords   = 500
	maxPushBody      = 5 << 20
	defaultPullLimit = 500
	maxPullLimit     = 1000
	pushPerMinute    = 60
	// maxRecordBlobs bounds the photo references of one record; a student has one photo.
	maxRecordBlobs = 16
	// minCiphertext is nonce(12) ‖ tag(16) of an empty plaintext.
	minCiphertext = 12 + 16
)

// errGone tells a device that was offline too long to download everything again.
var errGone = newError(http.StatusGone, "gone", "Dieses Gerät war zu lange offline. Alle Daten werden neu geladen.")

// validShortID reports whether id is base64url of 16 bytes, the form of record and blob ids.
func validShortID(id string) bool {
	b, err := base64.RawURLEncoding.DecodeString(id)
	return err == nil && len(b) == 16
}

// pushRecordJSON is one record of a push body.
type pushRecordJSON struct {
	ID         string   `json:"id"`
	Deleted    bool     `json:"deleted"`
	Schema     int      `json:"schema"`
	Ciphertext string   `json:"ciphertext"`
	Blobs      []string `json:"blobs"`
}

// toPushRecord checks one pushed record and converts it for the store.
func (p pushRecordJSON) toPushRecord() (store.PushRecord, bool) {
	ct, err := base64.RawURLEncoding.DecodeString(p.Ciphertext)
	if err != nil || len(ct) < minCiphertext || !validShortID(p.ID) || p.Schema < 1 || len(p.Blobs) > maxRecordBlobs {
		return store.PushRecord{}, false
	}
	for _, b := range p.Blobs {
		if !validShortID(b) {
			return store.PushRecord{}, false
		}
	}
	return store.PushRecord{ID: p.ID, Deleted: p.Deleted, Schema: p.Schema, Ciphertext: ct, Blobs: p.Blobs}, true
}

// pushResultJSON is the server order of one pushed record.
type pushResultJSON struct {
	ID        string `json:"id"`
	Seq       int64  `json:"seq"`
	UpdatedAt int64  `json:"updatedAt"`
}

// handlePush stores records in order; a later record with the same id wins (Last Write Wins).
func (s *Server) handlePush(w http.ResponseWriter, r *http.Request, sess store.Session) {
	if ok, wait := s.pushLimit.Allow(sess.UserID); !ok {
		writeError(w, rateLimited(wait))
		return
	}
	var body struct {
		Records []pushRecordJSON `json:"records"`
	}
	if err := readJSON(w, r, maxPushBody, &body); err != nil {
		writeError(w, err)
		return
	}
	if len(body.Records) == 0 || len(body.Records) > maxPushRecords {
		writeError(w, newError(http.StatusBadRequest, "bad_request", "Ein Push braucht 1 bis 500 Einträge."))
		return
	}
	recs := make([]store.PushRecord, len(body.Records))
	for i, p := range body.Records {
		rec, ok := p.toPushRecord()
		if !ok {
			writeError(w, errBadRequest)
			return
		}
		recs[i] = rec
	}
	res, err := s.store.PushRecords(r.Context(), sess.UserID, sess.DeviceID, recs)
	if err != nil {
		writeError(w, err)
		return
	}
	results := make([]pushResultJSON, len(res))
	for i, p := range res {
		results[i] = pushResultJSON{ID: p.ID, Seq: p.Seq, UpdatedAt: p.UpdatedAt}
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

// recordJSON is one record of a pull answer.
type recordJSON struct {
	ID         string `json:"id"`
	Seq        int64  `json:"seq"`
	UpdatedAt  int64  `json:"updatedAt"`
	Deleted    bool   `json:"deleted"`
	Schema     int    `json:"schema"`
	Ciphertext string `json:"ciphertext"`
	DeviceID   string `json:"deviceId"`
}

// queryInt reads an optional non-negative integer query parameter.
func queryInt(r *http.Request, name string, fallback int64) (int64, bool) {
	v := r.URL.Query().Get(name)
	if v == "" {
		return fallback, true
	}
	n, err := strconv.ParseInt(v, 10, 64)
	return n, err == nil && n >= 0
}

// handlePull returns records after a seq. A device whose seq lies before purged tombstones
// gets gone, because it would miss deletions.
func (s *Server) handlePull(w http.ResponseWriter, r *http.Request, sess store.Session) {
	after, okAfter := queryInt(r, "after", 0)
	limit, okLimit := queryInt(r, "limit", defaultPullLimit)
	if !okAfter || !okLimit || limit < 1 {
		writeError(w, errBadRequest)
		return
	}
	limit = min(limit, maxPullLimit)
	if after > 0 {
		purged, err := s.store.PurgedSeq(r.Context(), sess.UserID)
		if err != nil {
			writeError(w, err)
			return
		}
		if after < purged {
			writeError(w, errGone)
			return
		}
	}
	pull, err := s.store.PullRecords(r.Context(), sess.UserID, after, int(limit))
	if err != nil {
		writeError(w, err)
		return
	}
	records := make([]recordJSON, len(pull.Records))
	for i, rec := range pull.Records {
		records[i] = recordJSON{ID: rec.ID, Seq: rec.Seq, UpdatedAt: rec.UpdatedAt, Deleted: rec.Deleted,
			Schema: rec.Schema, Ciphertext: base64.RawURLEncoding.EncodeToString(rec.Ciphertext), DeviceID: rec.DeviceID}
	}
	writeJSON(w, http.StatusOK, map[string]any{"records": records, "more": pull.More, "latestSeq": pull.LatestSeq})
}
