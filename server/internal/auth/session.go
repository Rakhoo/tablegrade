package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// Session timing (protocol.md 2).
const (
	// SessionLifetime is how long a session lasts without use.
	SessionLifetime = 90 * 24 * time.Hour
	// touchInterval limits writes: a session is extended at most once per interval.
	touchInterval = time.Minute
)

// Errors of Authenticate.
var (
	// ErrUnauthorized means the token is missing, unknown or expired.
	ErrUnauthorized = errors.New("auth: unauthorized")
	// ErrRevoked means the device of the session was revoked.
	ErrRevoked = errors.New("auth: session revoked")
)

// Sessions creates and checks session tokens. Only the SHA-256 of a token is stored.
type Sessions struct {
	Store store.Store
	Now   func() time.Time
}

// HashToken returns the stored form of a token, or nil if it is not valid base64url.
func HashToken(token string) []byte {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(raw) != 32 {
		return nil
	}
	sum := sha256.Sum256(raw)
	return sum[:]
}

// Create starts a session for a device and returns its token.
func (s Sessions) Create(ctx context.Context, userID, deviceID string) (string, error) {
	var raw [32]byte
	_, _ = rand.Read(raw[:]) // never fails (crypto/rand docs)
	token := base64.RawURLEncoding.EncodeToString(raw[:])
	now := s.Now()
	err := s.Store.CreateSession(ctx, store.Session{
		TokenHash:  HashToken(token),
		UserID:     userID,
		DeviceID:   deviceID,
		CreatedAt:  now.UnixMilli(),
		LastUsedAt: now.UnixMilli(),
		ExpiresAt:  now.Add(SessionLifetime).UnixMilli(),
	})
	return token, err
}

// Authenticate checks a token and extends its session.
func (s Sessions) Authenticate(ctx context.Context, token string) (store.Session, store.Device, error) {
	hash := HashToken(token)
	if hash == nil {
		return store.Session{}, store.Device{}, ErrUnauthorized
	}
	sess, dev, err := s.Store.GetSession(ctx, hash)
	if errors.Is(err, store.ErrNotFound) {
		return sess, dev, ErrUnauthorized
	}
	if err != nil {
		return sess, dev, err
	}
	now := s.Now()
	if now.UnixMilli() > sess.ExpiresAt {
		return sess, dev, ErrUnauthorized
	}
	if dev.RevokedAt != 0 {
		return sess, dev, ErrRevoked
	}
	if now.UnixMilli()-sess.LastUsedAt >= touchInterval.Milliseconds() {
		sess.ExpiresAt = now.Add(SessionLifetime).UnixMilli()
		if err := s.Store.TouchSession(ctx, hash, sess.ExpiresAt); err != nil {
			return sess, dev, err
		}
	}
	return sess, dev, nil
}
