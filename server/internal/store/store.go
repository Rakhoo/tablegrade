// Package store persists users, identities, devices, sessions, key wraps and encrypted records
// (docs/protocol.md 2–6). Handlers use only the Store interface, so the SQLite implementation
// (package sqlite) can later be joined by a Postgres one. All times are Unix milliseconds.
package store

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
)

// Errors returned by every Store implementation.
var (
	// ErrNotFound means the requested entry does not exist for this user.
	ErrNotFound = errors.New("store: not found")
	// ErrConflict means a unique value (identity, credential, id of another user) is taken.
	ErrConflict = errors.New("store: conflict")
	// ErrLastRecovery means the only recovery wrap of an account must not be deleted.
	ErrLastRecovery = errors.New("store: last recovery wrap")
)

// Identity providers (docs/protocol.md 2).
const (
	ProviderPasskey   = "passkey"
	ProviderMicrosoft = "microsoft"
	ProviderGoogle    = "google"
)

// Key wrap kinds (docs/protocol.md 3).
const (
	WrapPasskey  = "passkey"
	WrapRecovery = "recovery"
	WrapOrg      = "org"
)

// User is an account.
type User struct {
	ID        string
	CreatedAt int64
	// ApprovedAt is 0 until the operator approves the account; until then it cannot sync.
	ApprovedAt int64
	// ContactEmail is the address the user gave for approval, maintenance and billing mails;
	// empty if none.
	ContactEmail string
	// AccessNote is the free text of the access request, e.g. who recommended the app.
	AccessNote string
}

// Identity is a way to sign in to an account.
type Identity struct {
	UserID   string
	Provider string
	// Subject is the OIDC "sub" claim or the passkey credential id (base64url).
	Subject   string
	CreatedAt int64
}

// Passkey is a WebAuthn credential of an account.
type Passkey struct {
	UserID       string
	CredentialID []byte
	PublicKey    []byte
	SignCount    uint32
	Transports   []string
	PRFCapable   bool
	Name         string
	// Data holds the serialized library credential (flags, AAGUID, attestation) the WebAuthn
	// library needs on login. The store treats it as opaque.
	Data      []byte
	CreatedAt int64
}

// Device is one installation of the app. RevokedAt is 0 while the device is active.
type Device struct {
	ID         string
	UserID     string
	Name       string
	CreatedAt  int64
	LastSeenAt int64
	RevokedAt  int64
}

// Session is a sign-in of one device. Only the SHA-256 of the token is stored.
type Session struct {
	TokenHash  []byte
	UserID     string
	DeviceID   string
	CreatedAt  int64
	LastUsedAt int64
	ExpiresAt  int64
}

// KeyWrap is the data key encrypted with one key encryption key.
type KeyWrap struct {
	ID     string
	UserID string
	Kind   string
	// CredentialID is set for kind "passkey" (base64url of the credential id).
	CredentialID string
	Alg          string
	Wrapped      []byte
	CreatedAt    int64
}

// PushRecord is one record sent by a device.
type PushRecord struct {
	ID         string
	Deleted    bool
	Schema     int
	Ciphertext []byte
	// Blobs are the ids of the photos the record refers to.
	Blobs []string
}

// PushResult is the server-assigned order of one pushed record.
type PushResult struct {
	ID        string
	Seq       int64
	UpdatedAt int64
}

// Record is a stored record as returned by a pull.
type Record struct {
	ID         string
	Seq        int64
	UpdatedAt  int64
	Deleted    bool
	Schema     int
	Ciphertext []byte
	DeviceID   string
}

// Pull is one page of records after a given seq.
type Pull struct {
	Records []Record
	// More is true when further records follow after the last one.
	More bool
	// LatestSeq is the highest seq of the account.
	LatestSeq int64
}

// BlobRef names one stored photo.
type BlobRef struct {
	UserID string
	ID     string
}

// Link is a pending or finished device link (docs/protocol.md 6).
type Link struct {
	ID     string
	UserID string
	Code   string
	// PublicKey is the ECDH key of the new device, OtherPublicKey that of the old one.
	PublicKey      []byte
	OtherPublicKey []byte
	Wrapped        []byte
	CreatedAt      int64
	ExpiresAt      int64
}

// Done reports whether the old device has completed the link.
func (l Link) Done() bool { return l.Wrapped != nil }

// Store is the persistence layer of the server. Methods that take a user id act only on the
// data of that user; entries of other users count as not found.
type Store interface {
	// CreateUser adds an account with a new random id.
	CreateUser(ctx context.Context) (User, error)
	// CreateUserWithID adds an account with a given id, e.g. the WebAuthn user handle chosen
	// before the passkey exists; ErrConflict if the id is taken.
	CreateUserWithID(ctx context.Context, userID string) (User, error)
	// GetUser returns an account.
	GetUser(ctx context.Context, userID string) (User, error)
	// DeleteUser removes an account and everything that belongs to it.
	DeleteUser(ctx context.Context, userID string) error
	// ListUsers returns all accounts, oldest first (operator commands).
	ListUsers(ctx context.Context) ([]User, error)
	// SetApproved sets the approval time; 0 withdraws the approval.
	SetApproved(ctx context.Context, userID string, approvedAt int64) error
	// SetContact stores the contact address and the note of the access request; empty
	// values remove them.
	SetContact(ctx context.Context, userID, email, note string) error

	// AddIdentity links a sign-in identity; ErrConflict if it already belongs to an account.
	AddIdentity(ctx context.Context, id Identity) error
	// FindIdentity looks up an identity by provider and subject.
	FindIdentity(ctx context.Context, provider, subject string) (Identity, error)
	// ListIdentities returns all identities of an account, oldest first.
	ListIdentities(ctx context.Context, userID string) ([]Identity, error)

	// AddPasskey stores a credential and its "passkey" identity; ErrConflict if known.
	AddPasskey(ctx context.Context, p Passkey) error
	// GetPasskey looks up a credential by id across all accounts (discoverable login).
	GetPasskey(ctx context.Context, credentialID []byte) (Passkey, error)
	// ListPasskeys returns all credentials of an account, oldest first.
	ListPasskeys(ctx context.Context, userID string) ([]Passkey, error)
	// UpdatePasskey stores the sign count and library data after a login.
	UpdatePasskey(ctx context.Context, credentialID []byte, signCount uint32, data []byte) error

	// CreateDevice adds a device with a new random id.
	CreateDevice(ctx context.Context, userID, name string) (Device, error)
	// GetDevice returns one device of an account.
	GetDevice(ctx context.Context, userID, deviceID string) (Device, error)
	// ListDevices returns all devices of an account, oldest first.
	ListDevices(ctx context.Context, userID string) ([]Device, error)
	// RenameDevice changes the name of a device.
	RenameDevice(ctx context.Context, userID, deviceID, name string) error
	// RevokeDevice marks a device as revoked; its sessions then report session_revoked.
	RevokeDevice(ctx context.Context, userID, deviceID string) error

	// CreateSession stores a session.
	CreateSession(ctx context.Context, s Session) error
	// GetSession returns a session and its device by token hash.
	GetSession(ctx context.Context, tokenHash []byte) (Session, Device, error)
	// TouchSession extends a session and updates the device's last seen time.
	TouchSession(ctx context.Context, tokenHash []byte, expiresAt int64) error
	// DeleteSession ends a session.
	DeleteSession(ctx context.Context, tokenHash []byte) error
	// DeleteExpiredSessions removes sessions that expired before now.
	DeleteExpiredSessions(ctx context.Context) (int64, error)

	// ListKeyWraps returns all wraps of an account, oldest first.
	ListKeyWraps(ctx context.Context, userID string) ([]KeyWrap, error)
	// PutKeyWrap creates or replaces a wrap; ErrConflict if the id belongs to another account.
	PutKeyWrap(ctx context.Context, w KeyWrap) error
	// DeleteKeyWrap removes a wrap; ErrLastRecovery for the only recovery wrap.
	DeleteKeyWrap(ctx context.Context, userID, wrapID string) error

	// PushRecords stores records in order. Each gets the next seq of the account, so seq rises
	// strictly even with parallel pushes. A record replaces the previous one with the same id.
	PushRecords(ctx context.Context, userID, deviceID string, recs []PushRecord) ([]PushResult, error)
	// PullRecords returns up to limit records with seq > after, ascending.
	PullRecords(ctx context.Context, userID string, after int64, limit int) (Pull, error)
	// PurgedSeq returns the highest seq removed by PurgeTombstones; a pull with a smaller
	// after must start from 0.
	PurgedSeq(ctx context.Context, userID string) (int64, error)
	// PurgeTombstones removes deleted records last changed before the given time.
	PurgeTombstones(ctx context.Context, before int64) (int64, error)

	// PutBlob registers an uploaded photo; created is false if it already existed.
	PutBlob(ctx context.Context, userID, blobID string, size int64) (created bool, err error)
	// HasBlob reports whether a photo is registered.
	HasBlob(ctx context.Context, userID, blobID string) (bool, error)
	// OrphanedBlobs returns photos without any record reference since before the given time.
	OrphanedBlobs(ctx context.Context, before int64) ([]BlobRef, error)
	// DeleteBlob removes the registration of a photo.
	DeleteBlob(ctx context.Context, userID, blobID string) error

	// CreateLink stores a new device link; ErrConflict if the code is in use.
	CreateLink(ctx context.Context, l Link) error
	// GetLink returns a link of an account by id.
	GetLink(ctx context.Context, userID, linkID string) (Link, error)
	// GetLinkByCode returns an unexpired link of an account by code.
	GetLinkByCode(ctx context.Context, userID, code string) (Link, error)
	// SetLinkKey stores the old device's public key before it sends the data key, so both
	// devices can show the check code; ErrConflict if done or another key is set.
	SetLinkKey(ctx context.Context, userID, linkID string, otherPublicKey []byte) error
	// CompleteLink stores the answer of the old device; ErrConflict if already done or if it
	// differs from the key set by SetLinkKey.
	CompleteLink(ctx context.Context, userID, linkID string, otherPublicKey, wrapped []byte) error
	// DeleteLink removes a link.
	DeleteLink(ctx context.Context, userID, linkID string) error
	// AddLinkFailure counts a wrong code for an account and returns the new count. At
	// maxFailures the open links of the account are deleted and the count is reset.
	AddLinkFailure(ctx context.Context, userID string, maxFailures int) (int, error)
	// DeleteExpiredLinks removes links that expired before now.
	DeleteExpiredLinks(ctx context.Context) (int64, error)

	// Backup writes a consistent copy of the database to path.
	Backup(ctx context.Context, path string) error
	// Close releases all resources.
	Close() error
}

// NewID returns a random UUID (version 4) in lower case.
func NewID() string {
	var b [16]byte
	_, _ = rand.Read(b[:]) // never fails (crypto/rand docs)
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// EncodeID returns binary ids (credential ids, tokens) as base64url without padding.
func EncodeID(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}
