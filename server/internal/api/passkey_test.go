package api

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

// b64 encodes like the browser's toJSON().
var b64 = base64.RawURLEncoding.EncodeToString

// authenticator is a minimal software passkey: ES256, "none" attestation, resident key.
type authenticator struct {
	t      *testing.T
	key    *ecdsa.PrivateKey
	credID []byte
	// userHandle is stored at registration, as a real passkey does.
	userHandle []byte
	signCount  uint32
	prf        bool
}

// newAuthenticator creates a passkey with a fresh key pair.
func newAuthenticator(t *testing.T, prf bool) *authenticator {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	id := make([]byte, 16)
	_, _ = rand.Read(id)
	return &authenticator{t: t, key: key, credID: id, prf: prf}
}

// beginOptions is the part of the begin response the authenticator reads.
type beginOptions struct {
	ChallengeID string `json:"challengeId"`
	Options     struct {
		Challenge string `json:"challenge"`
		RPID      string `json:"rpId"`
		RP        struct {
			ID string `json:"id"`
		} `json:"rp"`
		User struct {
			ID string `json:"id"`
		} `json:"user"`
		Extensions map[string]any `json:"extensions"`
	} `json:"options"`
}

// clientData builds clientDataJSON for a ceremony.
func clientData(typ, challenge string) []byte {
	b, _ := json.Marshal(map[string]any{"type": typ, "challenge": challenge, "origin": testOrigin, "crossOrigin": false})
	return b
}

// authData builds authenticator data; with attested credential data on registration.
func (a *authenticator) authData(register bool) []byte {
	rpHash := sha256.Sum256([]byte(testRPID))
	flags := byte(0x01 | 0x04) // user present, user verified
	if register {
		flags |= 0x40 // attested credential data included
	}
	a.signCount++
	out := append(rpHash[:], flags)
	out = binary.BigEndian.AppendUint32(out, a.signCount)
	if !register {
		return out
	}
	cose, err := webauthncbor.Marshal(webauthncose.EC2PublicKeyData{
		PublicKeyData: webauthncose.PublicKeyData{KeyType: int64(webauthncose.EllipticKey), Algorithm: int64(webauthncose.AlgES256)},
		Curve:         1,
		XCoord:        a.key.X.FillBytes(make([]byte, 32)),
		YCoord:        a.key.Y.FillBytes(make([]byte, 32)),
	})
	if err != nil {
		a.t.Fatal(err)
	}
	out = append(out, make([]byte, 16)...) // AAGUID
	out = binary.BigEndian.AppendUint16(out, uint16(len(a.credID)))
	out = append(out, a.credID...)
	return append(out, cose...)
}

// create answers registration options like navigator.credentials.create().toJSON().
func (a *authenticator) create(opts beginOptions) json.RawMessage {
	a.userHandle, _ = base64.RawURLEncoding.DecodeString(opts.Options.User.ID)
	att, err := webauthncbor.Marshal(map[string]any{"fmt": "none", "attStmt": map[string]any{}, "authData": a.authData(true)})
	if err != nil {
		a.t.Fatal(err)
	}
	ext := map[string]any{}
	if a.prf {
		ext["prf"] = map[string]any{"enabled": true}
	}
	return mustJSON(a.t, map[string]any{
		"id": b64(a.credID), "rawId": b64(a.credID), "type": "public-key",
		"authenticatorAttachment": "platform",
		"response": map[string]any{
			"clientDataJSON":    b64(clientData("webauthn.create", opts.Options.Challenge)),
			"attestationObject": b64(att),
			"transports":        []string{"internal", "hybrid"},
		},
		"clientExtensionResults": ext,
	})
}

// get answers login options like navigator.credentials.get().toJSON().
func (a *authenticator) get(opts beginOptions) json.RawMessage {
	auth := a.authData(false)
	cdj := clientData("webauthn.get", opts.Options.Challenge)
	hash := sha256.Sum256(cdj)
	digest := sha256.Sum256(append(append([]byte{}, auth...), hash[:]...))
	sig, err := ecdsa.SignASN1(rand.Reader, a.key, digest[:])
	if err != nil {
		a.t.Fatal(err)
	}
	return mustJSON(a.t, map[string]any{
		"id": b64(a.credID), "rawId": b64(a.credID), "type": "public-key",
		"authenticatorAttachment": "platform",
		"response": map[string]any{
			"clientDataJSON":    b64(cdj),
			"authenticatorData": b64(auth),
			"signature":         b64(sig),
			"userHandle":        b64(a.userHandle),
		},
		"clientExtensionResults": map[string]any{},
	})
}

// mustJSON marshals v or fails the test.
func mustJSON(t *testing.T, v any) json.RawMessage {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// begin calls a begin endpoint and checks the answer.
func (e *testEnv) begin(path, token string) beginOptions {
	e.t.Helper()
	var opts beginOptions
	if rec := e.do(http.MethodPost, path, token, "{}", &opts); rec.Code != http.StatusOK {
		e.t.Fatalf("%s: %d %s", path, rec.Code, rec.Body.String())
	}
	return opts
}

// finishBody builds the body of a finish request.
func finishBody(t *testing.T, challengeID string, cred json.RawMessage, deviceName string) string {
	return string(mustJSON(t, map[string]any{"challengeId": challengeID, "credential": cred, "deviceName": deviceName}))
}

// registerPasskey creates a new account with a passkey.
func (e *testEnv) registerPasskey(a *authenticator, deviceName string) signIn {
	e.t.Helper()
	opts := e.begin("/api/v1/auth/passkey/register/begin", "")
	var res signIn
	rec := e.do(http.MethodPost, "/api/v1/auth/passkey/register/finish", "",
		finishBody(e.t, opts.ChallengeID, a.create(opts), deviceName), &res)
	if rec.Code != http.StatusOK {
		e.t.Fatalf("register finish: %d %s", rec.Code, rec.Body.String())
	}
	return res
}

// passkeyLogin signs in with a passkey and returns the response.
func (e *testEnv) passkeyLogin(a *authenticator, deviceName string, out any) int {
	e.t.Helper()
	opts := e.begin("/api/v1/auth/passkey/login/begin", "")
	return e.do(http.MethodPost, "/api/v1/auth/passkey/login/finish", "",
		finishBody(e.t, opts.ChallengeID, a.get(opts), deviceName), out).Code
}

// sessionInfo reads GET /auth/session.
func (e *testEnv) sessionInfo(token string) (info struct {
	UserID     string         `json:"userId"`
	Identities []identityJSON `json:"identities"`
	Devices    []struct {
		Name string `json:"name"`
	} `json:"devices"`
},
) {
	e.t.Helper()
	if rec := e.do(http.MethodGet, "/api/v1/auth/session", token, "", &info); rec.Code != http.StatusOK {
		e.t.Fatalf("session: %d %s", rec.Code, rec.Body.String())
	}
	return info
}

func TestPasskeyRegisterAndLogin(t *testing.T) {
	e := newEnv(t)
	a := newAuthenticator(t, true)
	reg := e.registerPasskey(a, "iPad")
	if !reg.IsNewUser || reg.SessionToken == "" || reg.UserID == "" {
		t.Fatalf("register = %+v", reg)
	}
	if string(a.userHandle) != reg.UserID {
		t.Errorf("user handle %q, want the account id %q", a.userHandle, reg.UserID)
	}
	info := e.sessionInfo(reg.SessionToken)
	if len(info.Identities) != 1 || info.Identities[0].Provider != "passkey" || info.Devices[0].Name != "iPad" {
		t.Errorf("session = %+v", info)
	}
	key, err := e.store.GetPasskey(t.Context(), a.credID)
	if err != nil || !key.PRFCapable || key.UserID != reg.UserID || len(key.Transports) != 2 {
		t.Errorf("stored passkey = %+v, %v", key, err)
	}

	var login signIn
	if code := e.passkeyLogin(a, "PC", &login); code != http.StatusOK {
		t.Fatalf("login: %d", code)
	}
	if login.IsNewUser || login.UserID != reg.UserID || login.DeviceID == reg.DeviceID {
		t.Errorf("login = %+v, register %+v", login, reg)
	}
	if key, _ := e.store.GetPasskey(t.Context(), a.credID); key.SignCount != 2 {
		t.Errorf("sign count = %d, want 2", key.SignCount)
	}
}

func TestPasskeyOptions(t *testing.T) {
	e := newEnv(t)
	reg := e.begin("/api/v1/auth/passkey/register/begin", "")
	if reg.Options.RP.ID != testRPID || reg.Options.Challenge == "" || reg.Options.Extensions["prf"] == nil {
		t.Errorf("register options = %+v", reg.Options)
	}
	login := e.begin("/api/v1/auth/passkey/login/begin", "")
	prf, _ := login.Options.Extensions["prf"].(map[string]any)
	eval, _ := prf["eval"].(map[string]any)
	salt := sha256.Sum256([]byte("notenfeder/prf/v1"))
	if login.Options.RPID != testRPID || eval["first"] != b64(salt[:]) {
		t.Errorf("login options = %+v", login.Options)
	}
}

func TestPasskeyWithoutPRF(t *testing.T) {
	e := newEnv(t)
	a := newAuthenticator(t, false)
	e.registerPasskey(a, "PC")
	if key, _ := e.store.GetPasskey(t.Context(), a.credID); key.PRFCapable {
		t.Error("prfCapable = true without PRF support")
	}
}

func TestPasskeyAddToAccount(t *testing.T) {
	e := newEnv(t)
	first := newAuthenticator(t, true)
	reg := e.registerPasskey(first, "iPad")

	second := newAuthenticator(t, false)
	opts := e.begin("/api/v1/auth/passkey/register/begin", reg.SessionToken)
	rec := e.do(http.MethodPost, "/api/v1/auth/passkey/register/finish", reg.SessionToken,
		finishBody(t, opts.ChallengeID, second.create(opts), ""), nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("add passkey: %d %s", rec.Code, rec.Body.String())
	}
	if string(second.userHandle) != reg.UserID {
		t.Errorf("second user handle %q, want %q", second.userHandle, reg.UserID)
	}
	var login signIn
	if code := e.passkeyLogin(second, "Handy", &login); code != http.StatusOK || login.UserID != reg.UserID {
		t.Errorf("login with second passkey: %d %+v", code, login)
	}
	if ids := e.sessionInfo(reg.SessionToken).Identities; len(ids) != 2 {
		t.Errorf("identities = %+v", ids)
	}
}

func TestPasskeyChallengeRules(t *testing.T) {
	e := newEnv(t)
	a := newAuthenticator(t, true)

	// A challenge works only once.
	opts := e.begin("/api/v1/auth/passkey/register/begin", "")
	cred := a.create(opts)
	path := "/api/v1/auth/passkey/register/finish"
	if rec := e.do(http.MethodPost, path, "", finishBody(t, opts.ChallengeID, cred, "iPad"), nil); rec.Code != http.StatusOK {
		t.Fatalf("first finish: %d", rec.Code)
	}
	wantError(t, e.do(http.MethodPost, path, "", finishBody(t, opts.ChallengeID, cred, "iPad"), nil),
		http.StatusBadRequest, "bad_request")

	// A challenge expires after 5 minutes.
	opts = e.begin("/api/v1/auth/passkey/login/begin", "")
	e.clock.Advance(5*time.Minute + time.Second)
	wantError(t, e.do(http.MethodPost, "/api/v1/auth/passkey/login/finish", "",
		finishBody(t, opts.ChallengeID, a.get(opts), "PC"), nil), http.StatusBadRequest, "bad_request")

	// A login challenge cannot finish a registration.
	opts = e.begin("/api/v1/auth/passkey/login/begin", "")
	wantError(t, e.do(http.MethodPost, path, "", finishBody(t, opts.ChallengeID, newAuthenticator(t, true).create(opts), "PC"), nil),
		http.StatusBadRequest, "bad_request")
}

func TestPasskeyRejectsBadAssertion(t *testing.T) {
	e := newEnv(t)
	a := newAuthenticator(t, true)
	e.registerPasskey(a, "iPad")

	// Signed by another key with the same credential id.
	fake := newAuthenticator(t, true)
	fake.credID, fake.userHandle = a.credID, a.userHandle
	var res apiError
	if code := e.passkeyLogin(fake, "PC", &res); code != http.StatusUnauthorized || res.Code != "unauthorized" {
		t.Errorf("forged login: %d %+v", code, res)
	}

	// Unknown credential.
	unknown := newAuthenticator(t, true)
	unknown.userHandle = a.userHandle
	if code := e.passkeyLogin(unknown, "PC", &res); code != http.StatusUnauthorized {
		t.Errorf("unknown credential: %d %+v", code, res)
	}
}

func TestPasskeyRegisterNeedsDeviceName(t *testing.T) {
	e := newEnv(t)
	a := newAuthenticator(t, true)
	opts := e.begin("/api/v1/auth/passkey/register/begin", "")
	wantError(t, e.do(http.MethodPost, "/api/v1/auth/passkey/register/finish", "",
		finishBody(t, opts.ChallengeID, a.create(opts), " "), nil), http.StatusBadRequest, "bad_request")
	if _, err := e.store.GetPasskey(t.Context(), a.credID); err == nil {
		t.Error("passkey stored without device name")
	}
}

func TestPasskeyInvalidTokenDoesNotCreateAccount(t *testing.T) {
	e := newEnv(t)
	wantError(t, e.do(http.MethodPost, "/api/v1/auth/passkey/register/begin", "bm9wZQ", "{}", nil),
		http.StatusUnauthorized, "unauthorized")
}
