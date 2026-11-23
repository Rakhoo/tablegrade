package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"

	"github.com/Rakhoo/tablegrade/server/internal/hub"
)

// wsEnv is a test env served over a real listener, as WebSockets need one.
type wsEnv struct {
	*testEnv
	url string
}

// newWSEnv starts a server with the given ping timeout.
func newWSEnv(t *testing.T, ping time.Duration) *wsEnv {
	t.Helper()
	e := newEnv(t, func(s *Server) { s.pingTimeout = ping })
	ts := httptest.NewServer(e.handler)
	t.Cleanup(ts.Close)
	return &wsEnv{testEnv: e, url: "ws" + strings.TrimPrefix(ts.URL, "http") + "/api/v1/ws"}
}

// dial connects with the app origin; it returns the HTTP status on failure.
func (e *wsEnv) dial(token, origin string) (*websocket.Conn, int) {
	e.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, res, err := websocket.Dial(ctx, e.url+"?token="+token, &websocket.DialOptions{
		HTTPHeader: http.Header{"Origin": {origin}},
	})
	if err != nil {
		if res == nil {
			e.t.Fatal(err)
		}
		return nil, res.StatusCode
	}
	e.t.Cleanup(func() { _ = conn.CloseNow() })
	return conn, http.StatusSwitchingProtocols
}

// read returns the next server message.
func read(t *testing.T, conn *websocket.Conn) hub.Message {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, data, err := conn.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var msg hub.Message
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatal(err)
	}
	return msg
}

func TestWSHelloAndChanged(t *testing.T) {
	e := newWSEnv(t, time.Minute)
	ipad := e.login("", "iPad")
	pc := e.login(ipad.UserID, "PC")
	e.push(ipad.SessionToken, nil, pushRec(recID(1), false, 0))

	conn, _ := e.dial(pc.SessionToken, testOrigin)
	if msg := read(t, conn); msg["type"] != "hello" || msg["latestSeq"] != float64(1) {
		t.Fatalf("hello: %v", msg)
	}
	e.push(ipad.SessionToken, nil, pushRec(recID(2), false, 0), pushRec(recID(3), false, 0))
	if msg := read(t, conn); msg["type"] != "changed" || msg["latestSeq"] != float64(3) || msg["deviceId"] != ipad.DeviceID {
		t.Errorf("changed: %v", msg)
	}
}

func TestWSRejects(t *testing.T) {
	e := newWSEnv(t, time.Minute)
	s := e.login("", "iPad")
	if _, code := e.dial("bad", testOrigin); code != http.StatusUnauthorized {
		t.Errorf("bad token: %d", code)
	}
	if _, code := e.dial(s.SessionToken, "https://evil.example"); code != http.StatusForbidden {
		t.Errorf("foreign origin: %d", code)
	}
}

func TestWSRevoked(t *testing.T) {
	e := newWSEnv(t, time.Minute)
	ipad := e.login("", "iPad")
	pc := e.login(ipad.UserID, "PC")
	conn, _ := e.dial(pc.SessionToken, testOrigin)
	read(t, conn) // hello
	if code := e.do(http.MethodPost, "/api/v1/devices/"+pc.DeviceID+"/revoke", ipad.SessionToken, "", nil).Code; code != http.StatusNoContent {
		t.Fatalf("revoke: %d", code)
	}
	if msg := read(t, conn); msg["type"] != "revoked" {
		t.Errorf("got %v", msg)
	}
	_, _, err := conn.Read(context.Background())
	if websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
		t.Errorf("close: %v", err)
	}
	if _, code := e.dial(pc.SessionToken, testOrigin); code != http.StatusUnauthorized {
		t.Errorf("reconnect after revoke: %d", code)
	}
}

func TestWSPingTimeout(t *testing.T) {
	e := newWSEnv(t, 200*time.Millisecond)
	s := e.login("", "iPad")
	conn, _ := e.dial(s.SessionToken, testOrigin)
	read(t, conn) // hello

	// Pings keep the connection open past the timeout.
	for range 3 {
		time.Sleep(100 * time.Millisecond)
		if err := conn.Write(context.Background(), websocket.MessageText, []byte(`{"type":"ping"}`)); err != nil {
			t.Fatal(err)
		}
	}
	// Without pings the server drops the connection after the timeout. Cancelling a read
	// closes the socket at once, so the client sees an abort instead of a close frame.
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _, err := conn.Read(ctx)
	if errors.Is(err, context.DeadlineExceeded) || time.Since(start) < 150*time.Millisecond {
		t.Errorf("silent connection: %v after %v", err, time.Since(start))
	}
}
