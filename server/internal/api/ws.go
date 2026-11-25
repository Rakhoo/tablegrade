package api

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/url"
	"time"

	"github.com/coder/websocket"

	"github.com/Rakhoo/tablegrade/server/internal/hub"
	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// WebSocket timings (docs/protocol.md 7).
const (
	// defaultPingTimeout closes a connection whose client sent nothing for this long.
	defaultPingTimeout = 90 * time.Second
	writeTimeout       = 10 * time.Second
	// maxClientMessage bounds client messages; they are only pings.
	maxClientMessage = 1 << 10
)

// originHosts returns the hosts of the app origins, the form coder/websocket expects.
func originHosts(origins []string) []string {
	hosts := make([]string, 0, len(origins))
	for _, o := range origins {
		if u, err := url.Parse(o); err == nil {
			hosts = append(hosts, u.Host)
		}
	}
	return hosts
}

// handleWS upgrades to a WebSocket. The token comes from the query because browsers cannot
// set headers on WebSocket requests.
func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	sess, err := s.checkToken(r, r.URL.Query().Get("token"))
	if err == nil {
		err = s.checkApproved(r, sess.UserID)
	}
	if err != nil {
		writeError(w, err)
		return
	}
	// Subscribe before reading latestSeq, so no change between both steps gets lost.
	sub := s.hub.Subscribe(sess.UserID, sess.DeviceID)
	defer sub.Close()
	// A pull after the largest seq returns no records, only latestSeq.
	pull, err := s.store.PullRecords(r.Context(), sess.UserID, math.MaxInt64, 0)
	if err != nil {
		writeError(w, err)
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: originHosts(s.cfg.AppOrigins)})
	if err != nil {
		return // Accept has answered the request.
	}
	conn.SetReadLimit(maxClientMessage)
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	go s.readPings(ctx, cancel, conn)

	if err := writeMessage(ctx, conn, hub.Hello(pull.LatestSeq)); err != nil {
		return
	}
	status, reason := s.forward(ctx, conn, sub)
	_ = conn.Close(status, reason)
}

// forward writes hub messages until the connection ends and returns the close status.
func (s *Server) forward(ctx context.Context, conn *websocket.Conn, sub *hub.Subscription) (websocket.StatusCode, string) {
	for {
		select {
		case <-ctx.Done():
			return websocket.StatusGoingAway, "closed"
		case msg, ok := <-sub.C:
			if !ok {
				return websocket.StatusTryAgainLater, "too slow"
			}
			if err := writeMessage(ctx, conn, msg); err != nil {
				return websocket.StatusInternalError, "write failed"
			}
			if msg["type"] == hub.TypeRevoked {
				return websocket.StatusPolicyViolation, "revoked"
			}
		}
	}
}

// readPings cancels ctx when the client sends nothing within the ping timeout or disconnects. Any
// message counts as ping.
func (s *Server) readPings(ctx context.Context, cancel context.CancelFunc, conn *websocket.Conn) {
	defer cancel()
	for {
		readCtx, stop := context.WithTimeout(ctx, s.pingTimeout)
		_, _, err := conn.Read(readCtx)
		stop()
		if err != nil {
			return
		}
	}
}

// writeMessage sends one message as JSON text frame.
func writeMessage(ctx context.Context, conn *websocket.Conn, msg hub.Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, writeTimeout)
	defer cancel()
	return conn.Write(ctx, websocket.MessageText, data)
}

// notifyChanged tells all devices of the account about a push.
func (s *Server) notifyChanged(sess store.Session, res []store.PushResult) {
	if len(res) == 0 {
		return
	}
	s.hub.Publish(sess.UserID, "", hub.Changed(res[len(res)-1].Seq, sess.DeviceID))
}
