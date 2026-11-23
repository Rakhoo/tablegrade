package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"
)

// recID returns a valid record id derived from n.
func recID(n int) string {
	id := make([]byte, 16)
	id[0], id[1] = byte(n>>8), byte(n)
	return b64(id)
}

// pushRec is one record of a push body with a fake ciphertext.
func pushRec(id string, deleted bool, fill byte, blobs ...string) map[string]any {
	ct := make([]byte, 40)
	ct[0] = fill
	if blobs == nil {
		blobs = []string{}
	}
	return map[string]any{"id": id, "deleted": deleted, "schema": 23, "ciphertext": b64(ct), "blobs": blobs}
}

// pushResponse is the answer of a push.
type pushResponse struct {
	Results []pushResultJSON `json:"results"`
}

// pullResponse is the answer of a pull.
type pullResponse struct {
	Records   []recordJSON `json:"records"`
	More      bool         `json:"more"`
	LatestSeq int64        `json:"latestSeq"`
}

// push sends records and returns the status code.
func (e *testEnv) push(token string, out any, recs ...map[string]any) int {
	e.t.Helper()
	body, _ := json.Marshal(map[string]any{"records": recs})
	return e.do(http.MethodPost, "/api/v1/records/push", token, string(body), out).Code
}

// pull fetches records after a seq.
func (e *testEnv) pull(token, query string) (pullResponse, int) {
	e.t.Helper()
	var res pullResponse
	rec := e.do(http.MethodGet, "/api/v1/records/pull"+query, token, "", nil)
	if rec.Code == http.StatusOK {
		_ = json.Unmarshal(rec.Body.Bytes(), &res)
	}
	return res, rec.Code
}

func TestPushAndPull(t *testing.T) {
	e := newEnv(t)
	ipad := e.login("", "iPad")
	pc := e.login(ipad.UserID, "PC")

	var res pushResponse
	if code := e.push(ipad.SessionToken, &res, pushRec(recID(1), false, 1), pushRec(recID(2), false, 2),
		pushRec(recID(1), false, 3)); code != http.StatusOK {
		t.Fatalf("push: %d", code)
	}
	if len(res.Results) != 3 || res.Results[0].Seq != 1 || res.Results[2].Seq != 3 || res.Results[2].UpdatedAt == 0 {
		t.Fatalf("results: %+v", res.Results)
	}

	// The second push of id 1 in the same batch wins.
	got, code := e.pull(pc.SessionToken, "")
	if code != http.StatusOK || len(got.Records) != 2 || got.LatestSeq != 3 || got.More {
		t.Fatalf("pull: %d %+v", code, got)
	}
	last := got.Records[1]
	if last.ID != recID(1) || last.Seq != 3 || last.DeviceID != ipad.DeviceID || last.Schema != 23 ||
		last.Ciphertext != pushRec("", false, 3)["ciphertext"] {
		t.Errorf("record: %+v", last)
	}

	// Last Write Wins across devices, deletions included.
	e.push(pc.SessionToken, nil, pushRec(recID(2), true, 4))
	got, _ = e.pull(ipad.SessionToken, "?after=3")
	if len(got.Records) != 1 || !got.Records[0].Deleted || got.Records[0].DeviceID != pc.DeviceID {
		t.Errorf("after 3: %+v", got)
	}

	// Paging.
	got, _ = e.pull(ipad.SessionToken, "?after=0&limit=1")
	if len(got.Records) != 1 || !got.More || got.LatestSeq != 4 {
		t.Errorf("page: %+v", got)
	}

	// Other accounts see nothing.
	other := e.login("", "Fremd")
	if got, _ := e.pull(other.SessionToken, ""); len(got.Records) != 0 || got.LatestSeq != 0 {
		t.Errorf("other account: %+v", got)
	}
}

func TestPushValidation(t *testing.T) {
	e := newEnv(t)
	s := e.login("", "iPad")
	short := pushRec(recID(1), false, 0)
	short["ciphertext"] = b64(make([]byte, 27))
	noSchema := pushRec(recID(1), false, 0)
	noSchema["schema"] = 0
	cases := map[string]map[string]any{
		"long id":      pushRec(b64(make([]byte, 32)), false, 0),
		"bad blob id":  pushRec(recID(1), false, 0, "x"),
		"short cipher": short,
		"no schema":    noSchema,
	}
	for name, rec := range cases {
		t.Run(name, func(t *testing.T) {
			if code := e.push(s.SessionToken, nil, rec); code != http.StatusBadRequest {
				t.Errorf("got %d", code)
			}
		})
	}
	if code := e.push(s.SessionToken, nil); code != http.StatusBadRequest {
		t.Errorf("empty push: %d", code)
	}
	many := make([]map[string]any, maxPushRecords+1)
	for i := range many {
		many[i] = pushRec(recID(i), false, 0)
	}
	if code := e.push(s.SessionToken, nil, many...); code != http.StatusBadRequest {
		t.Errorf("501 records: %d", code)
	}
	big := `{"records":[{"id":"` + recID(1) + `","schema":1,"ciphertext":"` + strings.Repeat("A", maxPushBody) + `"}]}`
	wantError(t, e.do(http.MethodPost, "/api/v1/records/push", s.SessionToken, big, nil), http.StatusRequestEntityTooLarge, "too_large")
	for _, q := range []string{"?after=-1", "?after=x", "?limit=0"} {
		if _, code := e.pull(s.SessionToken, q); code != http.StatusBadRequest {
			t.Errorf("pull %s: %d", q, code)
		}
	}
	if _, code := e.pull("", ""); code != http.StatusUnauthorized {
		t.Errorf("pull without session: %d", code)
	}
}

func TestPullLimitIsCapped(t *testing.T) {
	e := newEnv(t)
	s := e.login("", "iPad")
	for batch := range 3 {
		recs := make([]map[string]any, maxPushRecords)
		for i := range recs {
			recs[i] = pushRec(recID(batch*maxPushRecords+i), false, 0)
		}
		if code := e.push(s.SessionToken, nil, recs...); code != http.StatusOK {
			t.Fatalf("push %d: %d", batch, code)
		}
	}
	got, _ := e.pull(s.SessionToken, "?limit=5000")
	if len(got.Records) != maxPullLimit || !got.More {
		t.Errorf("got %d records, more=%v", len(got.Records), got.More)
	}
	if got, _ := e.pull(s.SessionToken, ""); len(got.Records) != defaultPullLimit {
		t.Errorf("default limit: %d", len(got.Records))
	}
}

func TestPushRateLimit(t *testing.T) {
	e := newEnv(t)
	s := e.login("", "iPad")
	for i := range pushPerMinute {
		if code := e.push(s.SessionToken, nil, pushRec(recID(i), false, 0)); code != http.StatusOK {
			t.Fatalf("push %d: %d", i, code)
		}
	}
	var res apiError
	if code := e.push(s.SessionToken, &res, pushRec(recID(0), false, 0)); code != http.StatusTooManyRequests {
		t.Errorf("over limit: %d", code)
	}
	// The limit is per account.
	other := e.login("", "PC")
	if code := e.push(other.SessionToken, nil, pushRec(recID(0), false, 0)); code != http.StatusOK {
		t.Errorf("other account: %d", code)
	}
}

func TestTombstonesExpire(t *testing.T) {
	e := newEnv(t)
	srv, err := New(e.cfg(), e.store, WithClock(e.clock.Now))
	if err != nil {
		t.Fatal(err)
	}
	s := e.login("", "iPad")
	e.push(s.SessionToken, nil, pushRec(recID(1), false, 0), pushRec(recID(2), true, 0))
	// Sessions expire after 90 days, so each check signs in again.
	e.clock.Advance(tombstoneLifetime - time.Hour)
	srv.Maintain(context.Background())
	s = e.login(s.UserID, "iPad")
	if got, _ := e.pull(s.SessionToken, ""); len(got.Records) != 2 {
		t.Fatalf("tombstone purged too early: %+v", got)
	}

	e.clock.Advance(2 * time.Hour)
	srv.Maintain(context.Background())
	got, _ := e.pull(s.SessionToken, "")
	if len(got.Records) != 1 || got.Records[0].ID != recID(1) {
		t.Fatalf("after purge: %+v", got)
	}
	// A device that last saw seq 1 missed the deletion at seq 2.
	if _, code := e.pull(s.SessionToken, "?after=1"); code != http.StatusGone {
		t.Errorf("after=1: %d", code)
	}
	for _, q := range []string{"?after=0", "?after=2"} {
		if _, code := e.pull(s.SessionToken, q); code != http.StatusOK {
			t.Errorf("%s: %d", q, code)
		}
	}
}
