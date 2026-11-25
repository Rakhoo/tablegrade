package auth

import (
	"sync"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// ChallengeLifetime is how long a WebAuthn challenge stays valid (docs/protocol.md 2).
const ChallengeLifetime = 5 * time.Minute

// maxChallenges bounds memory; the auth rate limit keeps the real number far below.
const maxChallenges = 10_000

// Challenges keeps pending WebAuthn ceremonies in memory. Each one can be taken once. A restart
// drops them, which only means the user starts the sign-in again.
type Challenges[T any] struct {
	now func() time.Time

	mu      sync.Mutex
	pending map[string]challenge[T]
}

// challenge is one pending ceremony.
type challenge[T any] struct {
	value   T
	expires time.Time
}

// NewChallenges returns an empty challenge store. now may be nil (time.Now).
func NewChallenges[T any](now func() time.Time) *Challenges[T] {
	if now == nil {
		now = time.Now
	}
	return &Challenges[T]{now: now, pending: map[string]challenge[T]{}}
}

// Put stores value and returns its new challenge id. ok is false when the store is full.
func (c *Challenges[T]) Put(value T) (id string, ok bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	if len(c.pending) >= maxChallenges {
		for k, ch := range c.pending {
			if !now.Before(ch.expires) {
				delete(c.pending, k)
			}
		}
		if len(c.pending) >= maxChallenges {
			return "", false
		}
	}
	id = store.NewID()
	c.pending[id] = challenge[T]{value: value, expires: now.Add(ChallengeLifetime)}
	return id, true
}

// Take removes and returns the value of an unexpired challenge.
func (c *Challenges[T]) Take(id string) (T, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	ch, found := c.pending[id]
	delete(c.pending, id)
	if !found || !c.now().Before(ch.expires) {
		var zero T
		return zero, false
	}
	return ch.value, true
}
