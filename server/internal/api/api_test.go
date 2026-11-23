package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Rakhoo/tablegrade/server/internal/config"
)

func testHandler() http.Handler {
	return NewHandler(config.Config{AppOrigins: []string{"https://app.example"}})
}

func TestHealth(t *testing.T) {
	rec := httptest.NewRecorder()
	testHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/health", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("X-Protocol-Version"); got != "1" {
		t.Errorf("X-Protocol-Version = %q", got)
	}
}

func TestNewerProtocolRejected(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	req.Header.Set("X-Protocol-Version", "2")
	rec := httptest.NewRecorder()
	testHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUpgradeRequired {
		t.Errorf("status = %d, want 426", rec.Code)
	}
}

func TestCORS(t *testing.T) {
	for origin, allowed := range map[string]bool{"https://app.example": true, "https://evil.example": false} {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/health", nil)
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		testHandler().ServeHTTP(rec, req)
		got := rec.Header().Get("Access-Control-Allow-Origin") == origin
		if got != allowed {
			t.Errorf("origin %s: allowed = %v, want %v", origin, got, allowed)
		}
	}
}
