package api

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"
)

// blobID returns a valid blob id derived from n.
func blobID(n int) string { return recID(1000 + n) }

// putBlob uploads data and returns the status code.
func (e *testEnv) putBlob(token, id, data string) int {
	e.t.Helper()
	return e.do(http.MethodPut, "/api/v1/blobs/"+id, token, data, nil).Code
}

func TestBlobUploadAndDownload(t *testing.T) {
	e := newEnv(t)
	s := e.login("", "iPad")
	photo := strings.Repeat("p", 100)
	if code := e.putBlob(s.SessionToken, blobID(1), photo); code != http.StatusCreated {
		t.Fatalf("upload: %d", code)
	}
	if code := e.putBlob(s.SessionToken, blobID(1), strings.Repeat("x", 100)); code != http.StatusOK {
		t.Errorf("second upload: %d", code)
	}
	rec := e.do(http.MethodGet, "/api/v1/blobs/"+blobID(1), s.SessionToken, "", nil)
	if rec.Code != http.StatusOK || rec.Body.String() != photo ||
		rec.Header().Get("Content-Type") != "application/octet-stream" {
		t.Errorf("download: %d %q", rec.Code, rec.Body.String())
	}

	other := e.login("", "PC")
	wantError(t, e.do(http.MethodGet, "/api/v1/blobs/"+blobID(1), other.SessionToken, "", nil), http.StatusNotFound, "not_found")
	wantError(t, e.do(http.MethodGet, "/api/v1/blobs/x", s.SessionToken, "", nil), http.StatusNotFound, "not_found")
	wantError(t, e.do(http.MethodGet, "/api/v1/blobs/"+blobID(1), "", "", nil), http.StatusUnauthorized, "unauthorized")
}

func TestBlobUploadLimits(t *testing.T) {
	e := newEnv(t)
	s := e.login("", "iPad")
	wantError(t, e.do(http.MethodPut, "/api/v1/blobs/"+blobID(1), s.SessionToken, strings.Repeat("x", maxBlobSize+1), nil),
		http.StatusRequestEntityTooLarge, "too_large")
	wantError(t, e.do(http.MethodPut, "/api/v1/blobs/"+blobID(1), s.SessionToken, "short", nil), http.StatusBadRequest, "bad_request")
	wantError(t, e.do(http.MethodPut, "/api/v1/blobs/abc", s.SessionToken, strings.Repeat("x", 100), nil), http.StatusBadRequest, "bad_request")
	if code := e.putBlob(s.SessionToken, blobID(1), strings.Repeat("x", maxBlobSize)); code != http.StatusCreated {
		t.Errorf("2 MB: %d", code)
	}
}

func TestOrphanedBlobsAreDeleted(t *testing.T) {
	e := newEnv(t)
	srv, err := New(e.cfg(), e.store, WithClock(e.clock.Now))
	if err != nil {
		t.Fatal(err)
	}
	s := e.login("", "iPad")
	data := strings.Repeat("x", 100)
	e.putBlob(s.SessionToken, blobID(1), data) // referenced by a record
	e.putBlob(s.SessionToken, blobID(2), data) // never referenced
	e.putBlob(s.SessionToken, blobID(3), data) // referenced, then replaced
	e.push(s.SessionToken, nil, pushRec(recID(1), false, 0, blobID(1)), pushRec(recID(2), false, 0, blobID(3)))
	e.clock.Advance(time.Hour)
	e.push(s.SessionToken, nil, pushRec(recID(2), false, 0))

	e.clock.Advance(orphanLifetime - 30*time.Minute)
	srv.Maintain(context.Background())
	// Blob 2 has been orphaned since upload, 30 days and 30 minutes ago.
	exists := func(n int) bool {
		return e.do(http.MethodGet, "/api/v1/blobs/"+blobID(n), s.SessionToken, "", nil).Code == http.StatusOK
	}
	if !exists(1) || exists(2) || !exists(3) {
		t.Fatalf("after 30 days: %v %v %v", exists(1), exists(2), exists(3))
	}
	e.clock.Advance(time.Hour)
	srv.Maintain(context.Background())
	if !exists(1) || exists(3) {
		t.Errorf("after the reference was dropped: %v %v", exists(1), exists(3))
	}
	// The file is gone as well, so a new upload stores it again.
	if code := e.putBlob(s.SessionToken, blobID(3), data); code != http.StatusCreated {
		t.Errorf("upload after cleanup: %d", code)
	}
}
