// Package ratelimit limits requests per key (IP or account) with an in-memory token bucket
// (protocol.md 8). State is lost on restart, which is fine for abuse protection.
package ratelimit

import (
	"math"
	"sync"
	"time"
)

// maxKeys bounds memory; when reached, buckets that are full again are dropped.
const maxKeys = 10_000

// Limiter allows n requests per period per key, at once or spread out.
type Limiter struct {
	burst float64
	rate  float64 // tokens per second
	now   func() time.Time

	mu      sync.Mutex
	buckets map[string]*bucket
}

// bucket is the state of one key.
type bucket struct {
	tokens float64
	last   time.Time
}

// New returns a limiter for n requests per period. now may be nil (time.Now).
func New(n int, per time.Duration, now func() time.Time) *Limiter {
	if now == nil {
		now = time.Now
	}
	return &Limiter{
		burst:   float64(n),
		rate:    float64(n) / per.Seconds(),
		now:     now,
		buckets: map[string]*bucket{},
	}
}

// Allow takes one token for key. If none is left it returns false and the wait in seconds.
func (l *Limiter) Allow(key string) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	b, ok := l.buckets[key]
	if !ok {
		if len(l.buckets) >= maxKeys {
			l.prune(now)
		}
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}
	b.tokens = math.Min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.rate)
	b.last = now
	if b.tokens < 1 {
		return false, int(math.Ceil((1 - b.tokens) / l.rate))
	}
	b.tokens--
	return true, 0
}

// prune drops buckets that have refilled completely; they behave like new ones.
func (l *Limiter) prune(now time.Time) {
	for key, b := range l.buckets {
		if b.tokens+now.Sub(b.last).Seconds()*l.rate >= l.burst {
			delete(l.buckets, key)
		}
	}
}
