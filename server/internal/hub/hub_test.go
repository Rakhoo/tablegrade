package hub

import "testing"

func TestPublish(t *testing.T) {
	m := NewMemory()
	ipad := m.Subscribe("u1", "ipad")
	pc := m.Subscribe("u1", "pc")
	other := m.Subscribe("u2", "x")
	defer ipad.Close()
	defer pc.Close()
	defer other.Close()

	m.Publish("u1", "", Changed(3, "ipad"))
	m.Publish("u1", "pc", Revoked())
	if msg := <-ipad.C; msg["type"] != TypeChanged || msg["latestSeq"] != int64(3) {
		t.Errorf("ipad: %v", msg)
	}
	if msg := <-pc.C; msg["type"] != TypeChanged {
		t.Errorf("pc first: %v", msg)
	}
	if msg := <-pc.C; msg["type"] != TypeRevoked {
		t.Errorf("pc second: %v", msg)
	}
	select {
	case msg := <-ipad.C:
		t.Errorf("ipad got device message %v", msg)
	case msg := <-other.C:
		t.Errorf("other account got %v", msg)
	default:
	}
}

func TestSlowSubscriptionIsClosed(t *testing.T) {
	m := NewMemory()
	s := m.Subscribe("u1", "ipad")
	for i := range bufferSize + 1 {
		m.Publish("u1", "", Changed(int64(i), "pc"))
	}
	n := 0
	for range s.C {
		n++
	}
	if n != bufferSize || m.Count("u1") != 0 {
		t.Errorf("got %d messages, %d subscriptions", n, m.Count("u1"))
	}
	s.Close() // closing twice is safe
}
