package ratelimit

import (
	"testing"
	"time"
)

func TestAllow(t *testing.T) {
	now := time.Unix(0, 0)
	l := New(10, time.Minute, func() time.Time { return now })
	for i := range 10 {
		if ok, _ := l.Allow("ip"); !ok {
			t.Fatalf("request %d blocked", i)
		}
	}
	ok, wait := l.Allow("ip")
	if ok || wait != 6 {
		t.Errorf("11th request: ok = %v, wait = %d, want blocked for 6 s", ok, wait)
	}
	if ok, _ := l.Allow("other"); !ok {
		t.Error("other key blocked")
	}
	now = now.Add(6 * time.Second)
	if ok, _ := l.Allow("ip"); !ok {
		t.Error("blocked after refill")
	}
}
