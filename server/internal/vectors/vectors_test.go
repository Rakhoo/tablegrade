package vectors

import (
	"encoding/base64"
	"encoding/hex"
	"regexp"
	"testing"
)

var recoveryText = regexp.MustCompile(`^([0-9A-HJKMNP-TV-Z]{4}-){8}[0-9A-HJKMNP-TV-Z]{4}$`)

// checkHex fails when s is not hex of n bytes.
func checkHex(t *testing.T, name, s string, n int) {
	t.Helper()
	b, err := hex.DecodeString(s)
	if err != nil || len(b) != n {
		t.Errorf("%s: want %d bytes hex, got %q", name, n, s)
	}
}

// checkB64 fails when s is not base64url without padding of at least min bytes.
func checkB64(t *testing.T, name, s string, minLen int) []byte {
	t.Helper()
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil || len(b) < minLen {
		t.Errorf("%s: want base64url of >= %d bytes, got %q", name, minLen, s)
	}
	return b
}

func TestLoad(t *testing.T) {
	v, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if v.Version != 1 {
		t.Fatalf("version = %d", v.Version)
	}
	checkHex(t, "dek", v.Keys.DEKHex, 32)
	checkHex(t, "idk", v.Keys.IDKHex, 32)
	checkHex(t, "prfSalt", v.Keys.PRFSaltHex, 32)

	if len(v.RecoveryKey.Cases) == 0 || len(v.RecoveryKey.Normalization) == 0 || len(v.RecoveryKey.Invalid) == 0 {
		t.Error("recovery key vectors missing")
	}
	for _, c := range v.RecoveryKey.Cases {
		checkHex(t, "recovery bytes", c.BytesHex, 20)
		checkHex(t, "recovery kek", c.KEKHex, 32)
		if !recoveryText.MatchString(c.Text) {
			t.Errorf("recovery text %q has a wrong format", c.Text)
		}
	}
	for _, w := range v.Wraps {
		checkB64(t, "wrap "+w.Kind, w.Wrapped, 12+32+16)
	}
	for _, r := range v.RecordIDs {
		if b := checkB64(t, "record id", r.ID, 16); len(b) != 16 {
			t.Errorf("record id %s: %d bytes", r.ID, len(b))
		}
	}
	for _, r := range v.Records {
		checkB64(t, "record ciphertext", r.Ciphertext, 12+16)
	}
	checkB64(t, "blob id", v.Blob.BlobID, 16)
	checkB64(t, "blob ciphertext", v.Blob.Ciphertext, 12+16)
	if b := checkB64(t, "link public key", v.Link.NewPublic, 65); len(b) != 65 || b[0] != 4 {
		t.Error("link public key must be an uncompressed P-256 point")
	}
	if len(v.Link.CheckCode) != 6 || len(v.Link.LinkCode) != 8 {
		t.Errorf("check code %q or link code %q has a wrong length", v.Link.CheckCode, v.Link.LinkCode)
	}
}
