// Package vectors loads the shared protocol test vectors from server/testdata/vectors.json, so
// server tests check the same values as the client tests.
package vectors

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
)

// Keys holds the fixed key material all other vectors derive from.
type Keys struct {
	DEKHex        string `json:"dekHex"`
	IDKInfo       string `json:"idkInfo"`
	IDKHex        string `json:"idkHex"`
	PRFSaltHex    string `json:"prfSaltHex"`
	PRFOutputHex  string `json:"prfOutputHex"`
	PasskeyKEKHex string `json:"passkeyKekHex"`
}

// RecoveryCase maps recovery key bytes to their text and KEK.
type RecoveryCase struct {
	BytesHex string `json:"bytesHex"`
	Text     string `json:"text"`
	KEKHex   string `json:"kekHex"`
}

// Normalization maps user input to the normalized recovery key text.
type Normalization struct {
	Input      string `json:"input"`
	Normalized string `json:"normalized"`
}

// Invalid is user input that must be rejected, with the reason.
type Invalid struct {
	Input  string `json:"input"`
	Reason string `json:"reason"`
}

// RecoveryKey groups all recovery key vectors.
type RecoveryKey struct {
	Cases         []RecoveryCase  `json:"cases"`
	Normalization []Normalization `json:"normalization"`
	Invalid       []Invalid       `json:"invalid"`
}

// Wrap is a DEK wrapped with a KEK and a fixed nonce.
type Wrap struct {
	Kind     string `json:"kind"`
	UserID   string `json:"userId"`
	KEKHex   string `json:"kekHex"`
	DEKHex   string `json:"dekHex"`
	NonceHex string `json:"nonceHex"`
	AAD      string `json:"aad"`
	Wrapped  string `json:"wrapped"`
}

// RecordID is the HMAC id of a table row.
type RecordID struct {
	Table string `json:"table"`
	Key   []any  `json:"key"`
	Input string `json:"input"`
	ID    string `json:"id"`
}

// Record is an encrypted record with a fixed nonce.
type Record struct {
	UserID     string `json:"userId"`
	ID         string `json:"id"`
	NonceHex   string `json:"nonceHex"`
	AAD        string `json:"aad"`
	Plaintext  string `json:"plaintext"`
	Deleted    bool   `json:"deleted"`
	Ciphertext string `json:"ciphertext"`
}

// Blob is an encrypted photo with its id.
type Blob struct {
	UserID     string `json:"userId"`
	DataURL    string `json:"dataUrl"`
	SHA256Hex  string `json:"sha256Hex"`
	BlobID     string `json:"blobId"`
	NonceHex   string `json:"nonceHex"`
	AAD        string `json:"aad"`
	Ciphertext string `json:"ciphertext"`
}

// Link holds the device link values: ECDH keys, the wrapped DEK, check code and link code.
type Link struct {
	UserID           string `json:"userId"`
	NewPrivateHex    string `json:"newPrivateHex"`
	NewPublic        string `json:"newPublic"`
	OldPrivateHex    string `json:"oldPrivateHex"`
	OldPublic        string `json:"oldPublic"`
	SharedSecretHex  string `json:"sharedSecretHex"`
	KEKHex           string `json:"kekHex"`
	DEKHex           string `json:"dekHex"`
	NonceHex         string `json:"nonceHex"`
	AAD              string `json:"aad"`
	Wrapped          string `json:"wrapped"`
	CheckCode        string `json:"checkCode"`
	LinkCodeBytesHex string `json:"linkCodeBytesHex"`
	LinkCode         string `json:"linkCode"`
}

// Vectors is the content of vectors.json.
type Vectors struct {
	Version     int         `json:"version"`
	Format      string      `json:"_format"`
	Keys        Keys        `json:"keys"`
	RecoveryKey RecoveryKey `json:"recoveryKey"`
	Wraps       []Wrap      `json:"wraps"`
	RecordIDs   []RecordID  `json:"recordIds"`
	Records     []Record    `json:"records"`
	Blob        Blob        `json:"blob"`
	Link        Link        `json:"link"`
}

// Path returns the absolute path of vectors.json, independent of the working directory.
func Path() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..", "testdata", "vectors.json")
}

// Load reads and decodes vectors.json. Unknown fields are an error, so the Go types stay in
// sync with the generator.
func Load() (Vectors, error) {
	var v Vectors
	f, err := os.Open(Path())
	if err != nil {
		return v, err
	}
	defer f.Close()
	dec := json.NewDecoder(f)
	dec.DisallowUnknownFields()
	err = dec.Decode(&v)
	return v, err
}
