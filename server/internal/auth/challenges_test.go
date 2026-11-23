package auth

import (
	"testing"
	"time"
)

func TestChallenges(t *testing.T) {
	now := time.UnixMilli(0)
	c := NewChallenges[string](func() time.Time { return now })
	id, ok := c.Put("a")
	if !ok || id == "" {
		t.Fatal("Put failed")
	}
	if v, ok := c.Take(id); !ok || v != "a" {
		t.Errorf("Take = %q, %v", v, ok)
	}
	if _, ok := c.Take(id); ok {
		t.Error("challenge taken twice")
	}
	id, _ = c.Put("b")
	now = now.Add(ChallengeLifetime)
	if _, ok := c.Take(id); ok {
		t.Error("expired challenge taken")
	}
}

func TestChallengesFull(t *testing.T) {
	now := time.UnixMilli(0)
	c := NewChallenges[int](func() time.Time { return now })
	for i := range maxChallenges {
		if _, ok := c.Put(i); !ok {
			t.Fatalf("Put %d failed", i)
		}
	}
	if _, ok := c.Put(0); ok {
		t.Error("Put succeeded beyond the limit")
	}
	// Expired entries make room again.
	now = now.Add(ChallengeLifetime)
	if _, ok := c.Put(0); !ok {
		t.Error("Put failed after expiry")
	}
}
