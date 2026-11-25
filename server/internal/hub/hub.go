// Package hub keeps the WebSocket connections per account and notifies devices about new
// records, revocations and finished device links (docs/protocol.md 7).
package hub

import "sync"

// Message is one server message: the field "type" plus its data.
type Message map[string]any

// Message types (docs/protocol.md 7).
const (
	TypeHello   = "hello"
	TypeChanged = "changed"
	TypeRevoked = "revoked"
	TypeLink    = "link"
)

// Hello is sent after connecting.
func Hello(latestSeq int64) Message { return Message{"type": TypeHello, "latestSeq": latestSeq} }

// Changed announces new records pushed by deviceID.
func Changed(latestSeq int64, deviceID string) Message {
	return Message{"type": TypeChanged, "latestSeq": latestSeq, "deviceId": deviceID}
}

// Revoked tells a device that it is blocked; the connection closes afterwards.
func Revoked() Message { return Message{"type": TypeRevoked} }

// Link tells the new device that the old one finished the device link.
func Link(linkID string) Message { return Message{"type": TypeLink, "linkId": linkID} }

// Hub delivers messages to the connected devices of an account. The in-memory version serves
// one server; a version with a shared broker can serve several instances later.
type Hub interface {
	// Subscribe registers a connection of a device. The caller must Close the subscription.
	Subscribe(userID, deviceID string) *Subscription
	// Publish sends msg to all connections of the account, or only to those of deviceID if it
	// is not empty.
	Publish(userID, deviceID string, msg Message)
}

// bufferSize is the number of messages a slow connection may lag behind.
const bufferSize = 16

// Subscription receives the messages of one connection.
type Subscription struct {
	// C delivers the messages. It is closed when the connection lags behind too far; the device
	// then reconnects and catches up via pull.
	C        <-chan Message
	c        chan Message
	userID   string
	deviceID string
	closed   bool
	memory   *Memory
}

// Close removes the subscription. It may be called more than once.
func (s *Subscription) Close() { s.memory.remove(s) }

// Memory is a Hub for a single server process.
type Memory struct {
	mu   sync.Mutex
	subs map[string]map[*Subscription]struct{}
}

// NewMemory returns an empty in-memory hub.
func NewMemory() *Memory {
	return &Memory{subs: map[string]map[*Subscription]struct{}{}}
}

// Subscribe implements Hub.
func (m *Memory) Subscribe(userID, deviceID string) *Subscription {
	c := make(chan Message, bufferSize)
	s := &Subscription{C: c, c: c, userID: userID, deviceID: deviceID, memory: m}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.subs[userID] == nil {
		m.subs[userID] = map[*Subscription]struct{}{}
	}
	m.subs[userID][s] = struct{}{}
	return s
}

// Publish implements Hub. It never blocks: a full buffer ends that subscription.
func (m *Memory) Publish(userID, deviceID string, msg Message) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for s := range m.subs[userID] {
		if deviceID != "" && s.deviceID != deviceID {
			continue
		}
		select {
		case s.c <- msg:
		default:
			m.removeLocked(s)
		}
	}
}

// remove unregisters a subscription and closes its channel.
func (m *Memory) remove(s *Subscription) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.removeLocked(s)
}

// removeLocked is remove with m.mu held.
func (m *Memory) removeLocked(s *Subscription) {
	if s.closed {
		return
	}
	s.closed = true
	close(s.c)
	delete(m.subs[s.userID], s)
	if len(m.subs[s.userID]) == 0 {
		delete(m.subs, s.userID)
	}
}

// Count returns the number of connections of an account, for tests and limits.
func (m *Memory) Count(userID string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.subs[userID])
}
