// Package storetest is a conformance test suite for store.Store. Every implementation (SQLite
// now, Postgres later) runs it from its own tests.
package storetest

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/store"
)

// Clock is a manual clock for tests.
type Clock struct{ ms atomic.Int64 }

// NewClock returns a clock at 2026-01-01 00:00 UTC.
func NewClock() *Clock {
	c := &Clock{}
	c.ms.Store(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli())
	return c
}

// Now returns the current test time.
func (c *Clock) Now() time.Time { return time.UnixMilli(c.ms.Load()) }

// Advance moves the clock forward.
func (c *Clock) Advance(d time.Duration) { c.ms.Add(d.Milliseconds()) }

// OpenFunc opens an empty store that reads the time from clock.
type OpenFunc func(t *testing.T, clock *Clock) store.Store

// Run runs all conformance tests against stores created by open.
func Run(t *testing.T, open OpenFunc) {
	tests := map[string]func(*testing.T, store.Store, *Clock){
		"Users":             testUsers,
		"Identities":        testIdentities,
		"Passkeys":          testPasskeys,
		"DevicesSessions":   testDevicesSessions,
		"KeyWraps":          testKeyWraps,
		"PushPull":          testPushPull,
		"ParallelPushSeq":   testParallelPushSeq,
		"Tombstones":        testTombstones,
		"Blobs":             testBlobs,
		"Links":             testLinks,
		"DeleteUserCascade": testDeleteUserCascade,
	}
	for name, fn := range tests {
		t.Run(name, func(t *testing.T) {
			clock := NewClock()
			s := open(t, clock)
			t.Cleanup(func() { _ = s.Close() })
			fn(t, s, clock)
		})
	}
}

var ctx = context.Background()

// must returns v and panics on err, which fails the running test with a stack trace. A
// function call with two results can only be passed whole, so there is no *testing.T here.
func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

// check fails the test on err.
func check(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

// wantErr fails the test unless err is target.
func wantErr(t *testing.T, err, target error) {
	t.Helper()
	if !errors.Is(err, target) {
		t.Fatalf("err = %v, want %v", err, target)
	}
}

// newUser creates an account with one device.
func newUser(t *testing.T, s store.Store) (store.User, store.Device) {
	t.Helper()
	u := must(s.CreateUser(ctx))
	return u, must(s.CreateDevice(ctx, u.ID, "iPad"))
}

func testUsers(t *testing.T, s store.Store, clock *Clock) {
	u := must(s.CreateUser(ctx))
	got := must(s.GetUser(ctx, u.ID))
	if got != u || u.CreatedAt != clock.Now().UnixMilli() || len(u.ID) != 36 {
		t.Errorf("GetUser = %+v, created %+v", got, u)
	}
	_, err := s.GetUser(ctx, "missing")
	wantErr(t, err, store.ErrNotFound)
	wantErr(t, s.DeleteUser(ctx, "missing"), store.ErrNotFound)
	id := store.NewID()
	if got := must(s.CreateUserWithID(ctx, id)); got.ID != id {
		t.Errorf("CreateUserWithID id = %s", got.ID)
	}
	_, err = s.CreateUserWithID(ctx, id)
	wantErr(t, err, store.ErrConflict)
}

func testIdentities(t *testing.T, s store.Store, _ *Clock) {
	u, _ := newUser(t, s)
	other, _ := newUser(t, s)
	id := store.Identity{UserID: u.ID, Provider: store.ProviderGoogle, Subject: "sub-1"}
	check(t, s.AddIdentity(ctx, id))
	wantErr(t, s.AddIdentity(ctx, store.Identity{UserID: other.ID, Provider: id.Provider, Subject: id.Subject}),
		store.ErrConflict)
	check(t, s.AddIdentity(ctx, store.Identity{UserID: u.ID, Provider: store.ProviderMicrosoft, Subject: "sub-1"}))
	found := must(s.FindIdentity(ctx, store.ProviderGoogle, "sub-1"))
	if found.UserID != u.ID {
		t.Errorf("FindIdentity user = %s", found.UserID)
	}
	_, err := s.FindIdentity(ctx, store.ProviderGoogle, "sub-2")
	wantErr(t, err, store.ErrNotFound)
	if list := must(s.ListIdentities(ctx, u.ID)); len(list) != 2 || list[0].Provider != store.ProviderGoogle {
		t.Errorf("ListIdentities = %+v", list)
	}
}

func testPasskeys(t *testing.T, s store.Store, _ *Clock) {
	u, _ := newUser(t, s)
	p := store.Passkey{UserID: u.ID, CredentialID: []byte{1, 2, 3}, PublicKey: []byte{9}, SignCount: 1,
		Transports: []string{"internal", "hybrid"}, PRFCapable: true, Name: "iPad", Data: []byte("{}")}
	check(t, s.AddPasskey(ctx, p))
	wantErr(t, s.AddPasskey(ctx, p), store.ErrConflict)
	got := must(s.GetPasskey(ctx, p.CredentialID))
	if got.UserID != u.ID || !got.PRFCapable || len(got.Transports) != 2 || got.Name != "iPad" {
		t.Errorf("GetPasskey = %+v", got)
	}
	// The passkey is also an identity for login.
	if id := must(s.FindIdentity(ctx, store.ProviderPasskey, store.EncodeID(p.CredentialID))); id.UserID != u.ID {
		t.Errorf("passkey identity user = %s", id.UserID)
	}
	check(t, s.UpdatePasskey(ctx, p.CredentialID, 7, []byte(`{"x":1}`)))
	if got := must(s.GetPasskey(ctx, p.CredentialID)); got.SignCount != 7 || string(got.Data) != `{"x":1}` {
		t.Errorf("after update = %+v", got)
	}
	if list := must(s.ListPasskeys(ctx, u.ID)); len(list) != 1 {
		t.Errorf("ListPasskeys = %d", len(list))
	}
	wantErr(t, s.UpdatePasskey(ctx, []byte{0}, 1, nil), store.ErrNotFound)
}

func testDevicesSessions(t *testing.T, s store.Store, clock *Clock) {
	u, d := newUser(t, s)
	other, _ := newUser(t, s)
	hash := []byte("hash-1")
	now := clock.Now().UnixMilli()
	check(t, s.CreateSession(ctx, store.Session{TokenHash: hash, UserID: u.ID, DeviceID: d.ID,
		CreatedAt: now, LastUsedAt: now, ExpiresAt: now + 1000}))
	sess, dev := must2(s.GetSession(ctx, hash))
	if sess.UserID != u.ID || dev.ID != d.ID || dev.Name != "iPad" || dev.RevokedAt != 0 {
		t.Errorf("GetSession = %+v %+v", sess, dev)
	}

	clock.Advance(time.Minute)
	check(t, s.TouchSession(ctx, hash, now+5000))
	sess, dev = must2(s.GetSession(ctx, hash))
	if sess.ExpiresAt != now+5000 || sess.LastUsedAt != clock.Now().UnixMilli() || dev.LastSeenAt != sess.LastUsedAt {
		t.Errorf("after touch = %+v %+v", sess, dev)
	}

	check(t, s.RenameDevice(ctx, u.ID, d.ID, "PC"))
	wantErr(t, s.RenameDevice(ctx, other.ID, d.ID, "x"), store.ErrNotFound)
	check(t, s.RevokeDevice(ctx, u.ID, d.ID))
	_, dev = must2(s.GetSession(ctx, hash))
	if dev.RevokedAt == 0 || dev.Name != "PC" {
		t.Errorf("after revoke = %+v", dev)
	}
	_, err := s.GetDevice(ctx, other.ID, d.ID)
	wantErr(t, err, store.ErrNotFound)
	if list := must(s.ListDevices(ctx, u.ID)); len(list) != 1 {
		t.Errorf("ListDevices = %d", len(list))
	}

	clock.Advance(time.Hour)
	if n := must(s.DeleteExpiredSessions(ctx)); n != 1 {
		t.Errorf("DeleteExpiredSessions = %d", n)
	}
	_, _, err = s.GetSession(ctx, hash)
	wantErr(t, err, store.ErrNotFound)
	wantErr(t, s.DeleteSession(ctx, hash), store.ErrNotFound)
}

// must2 is must for functions with two results.
func must2[A, B any](a A, b B, err error) (A, B) {
	if err != nil {
		panic(err)
	}
	return a, b
}

func testKeyWraps(t *testing.T, s store.Store, _ *Clock) {
	u, _ := newUser(t, s)
	other, _ := newUser(t, s)
	rec1 := store.KeyWrap{ID: "w1", UserID: u.ID, Kind: store.WrapRecovery, Alg: "A256GCM", Wrapped: []byte{1}}
	pk := store.KeyWrap{ID: "w2", UserID: u.ID, Kind: store.WrapPasskey, CredentialID: "cred", Alg: "A256GCM", Wrapped: []byte{2}}
	check(t, s.PutKeyWrap(ctx, rec1))
	check(t, s.PutKeyWrap(ctx, pk))
	wantErr(t, s.PutKeyWrap(ctx, store.KeyWrap{ID: "w1", UserID: other.ID, Kind: store.WrapRecovery,
		Alg: "A256GCM", Wrapped: []byte{3}}), store.ErrConflict)

	pk.Wrapped = []byte{4}
	check(t, s.PutKeyWrap(ctx, pk))
	list := must(s.ListKeyWraps(ctx, u.ID))
	if len(list) != 2 || list[1].CredentialID != "cred" || !bytes.Equal(list[1].Wrapped, []byte{4}) || list[0].CredentialID != "" {
		t.Fatalf("ListKeyWraps = %+v", list)
	}

	wantErr(t, s.DeleteKeyWrap(ctx, u.ID, "w1"), store.ErrLastRecovery)
	check(t, s.PutKeyWrap(ctx, store.KeyWrap{ID: "w3", UserID: u.ID, Kind: store.WrapRecovery, Alg: "A256GCM", Wrapped: []byte{5}}))
	check(t, s.DeleteKeyWrap(ctx, u.ID, "w1"))
	wantErr(t, s.DeleteKeyWrap(ctx, u.ID, "w3"), store.ErrLastRecovery)
	check(t, s.DeleteKeyWrap(ctx, u.ID, "w2"))
	wantErr(t, s.DeleteKeyWrap(ctx, other.ID, "w3"), store.ErrNotFound)
}

func testPushPull(t *testing.T, s store.Store, clock *Clock) {
	u, d := newUser(t, s)
	other, od := newUser(t, s)
	res := must(s.PushRecords(ctx, u.ID, d.ID, []store.PushRecord{
		{ID: "a", Schema: 23, Ciphertext: []byte{1}},
		{ID: "b", Schema: 23, Ciphertext: []byte{2}},
		{ID: "a", Schema: 23, Ciphertext: []byte{3}},
	}))
	if len(res) != 3 || res[0].Seq != 1 || res[1].Seq != 2 || res[2].Seq != 3 || res[0].UpdatedAt != clock.Now().UnixMilli() {
		t.Fatalf("PushRecords = %+v", res)
	}
	must(s.PushRecords(ctx, other.ID, od.ID, []store.PushRecord{{ID: "a", Ciphertext: []byte{9}}}))

	clock.Advance(time.Second)
	must(s.PushRecords(ctx, u.ID, d.ID, []store.PushRecord{{ID: "b", Deleted: true, Schema: 24, Ciphertext: []byte{4}}}))

	p := must(s.PullRecords(ctx, u.ID, 0, 500))
	if p.LatestSeq != 4 || p.More || len(p.Records) != 2 {
		t.Fatalf("PullRecords = %+v", p)
	}
	// Last write wins: "a" holds the third entry, "b" the deletion.
	a, b := p.Records[0], p.Records[1]
	if a.ID != "a" || a.Seq != 3 || !bytes.Equal(a.Ciphertext, []byte{3}) || a.DeviceID != d.ID {
		t.Errorf("record a = %+v", a)
	}
	if b.ID != "b" || b.Seq != 4 || !b.Deleted || b.Schema != 24 {
		t.Errorf("record b = %+v", b)
	}

	p = must(s.PullRecords(ctx, u.ID, 0, 1))
	if !p.More || len(p.Records) != 1 || p.Records[0].Seq != 3 {
		t.Errorf("limited pull = %+v", p)
	}
	p = must(s.PullRecords(ctx, u.ID, 3, 10))
	if p.More || len(p.Records) != 1 || p.Records[0].Seq != 4 {
		t.Errorf("pull after 3 = %+v", p)
	}
	if p := must(s.PullRecords(ctx, other.ID, 0, 10)); p.LatestSeq != 1 || len(p.Records) != 1 {
		t.Errorf("other user pull = %+v", p)
	}
	_, err := s.PushRecords(ctx, "missing", d.ID, []store.PushRecord{{ID: "x", Ciphertext: []byte{1}}})
	wantErr(t, err, store.ErrNotFound)
}

func testParallelPushSeq(t *testing.T, s store.Store, _ *Clock) {
	u, d := newUser(t, s)
	const workers, pushes, perPush = 8, 10, 5
	var wg sync.WaitGroup
	seqs := make(chan int64, workers*pushes*perPush)
	errs := make(chan error, workers*pushes)
	for w := range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for p := range pushes {
				recs := make([]store.PushRecord, perPush)
				for i := range recs {
					recs[i] = store.PushRecord{ID: fmt.Sprintf("%d-%d-%d", w, p, i), Ciphertext: []byte{1}}
				}
				res, err := s.PushRecords(ctx, u.ID, d.ID, recs)
				if err != nil {
					errs <- err
					return
				}
				// Within one push seq rises by exactly one per record.
				for i, r := range res {
					if i > 0 && r.Seq != res[i-1].Seq+1 {
						errs <- errors.New("seq not contiguous within a push")
					}
					seqs <- r.Seq
				}
			}
		}()
	}
	wg.Wait()
	close(seqs)
	close(errs)
	for err := range errs {
		t.Fatal(err)
	}
	seen := map[int64]bool{}
	for seq := range seqs {
		if seen[seq] {
			t.Fatalf("seq %d assigned twice", seq)
		}
		seen[seq] = true
	}
	total := int64(workers * pushes * perPush)
	for i := int64(1); i <= total; i++ {
		if !seen[i] {
			t.Fatalf("seq %d missing", i)
		}
	}
	if p := must(s.PullRecords(ctx, u.ID, 0, 1000)); p.LatestSeq != total || len(p.Records) != int(total) {
		t.Errorf("after parallel pushes: latest %d, %d records", p.LatestSeq, len(p.Records))
	}
}

func testTombstones(t *testing.T, s store.Store, clock *Clock) {
	u, d := newUser(t, s)
	must(s.PushRecords(ctx, u.ID, d.ID, []store.PushRecord{
		{ID: "a", Ciphertext: []byte{1}},
		{ID: "b", Deleted: true, Ciphertext: []byte{2}},
	}))
	cutoff := clock.Now().UnixMilli() + 1
	clock.Advance(time.Hour)
	must(s.PushRecords(ctx, u.ID, d.ID, []store.PushRecord{{ID: "c", Deleted: true, Ciphertext: []byte{3}}}))

	if n := must(s.PurgeTombstones(ctx, cutoff)); n != 1 {
		t.Errorf("PurgeTombstones = %d", n)
	}
	if seq := must(s.PurgedSeq(ctx, u.ID)); seq != 2 {
		t.Errorf("PurgedSeq = %d", seq)
	}
	p := must(s.PullRecords(ctx, u.ID, 0, 10))
	if len(p.Records) != 2 || p.Records[0].ID != "a" || p.Records[1].ID != "c" {
		t.Errorf("after purge = %+v", p.Records)
	}
	// A later purge without old tombstones keeps the boundary.
	must(s.PurgeTombstones(ctx, cutoff))
	if seq := must(s.PurgedSeq(ctx, u.ID)); seq != 2 {
		t.Errorf("PurgedSeq after second purge = %d", seq)
	}
}

func testBlobs(t *testing.T, s store.Store, clock *Clock) {
	u, d := newUser(t, s)
	start := clock.Now().UnixMilli()
	if created := must(s.PutBlob(ctx, u.ID, "p1", 100)); !created {
		t.Error("first PutBlob not created")
	}
	if created := must(s.PutBlob(ctx, u.ID, "p1", 100)); created {
		t.Error("second PutBlob created")
	}
	if ok := must(s.HasBlob(ctx, u.ID, "p1")); !ok {
		t.Error("HasBlob = false")
	}
	// Uploaded but not referenced yet: orphaned since upload.
	if refs := must(s.OrphanedBlobs(ctx, start+1)); len(refs) != 1 {
		t.Errorf("orphans after upload = %+v", refs)
	}
	must(s.PushRecords(ctx, u.ID, d.ID, []store.PushRecord{{ID: "s1", Ciphertext: []byte{1}, Blobs: []string{"p1"}}}))
	must(s.PushRecords(ctx, u.ID, d.ID, []store.PushRecord{{ID: "s2", Ciphertext: []byte{1}, Blobs: []string{"p1", "p2"}}}))
	if refs := must(s.OrphanedBlobs(ctx, start+1)); len(refs) != 0 {
		t.Errorf("orphans while referenced = %+v", refs)
	}
	// Referenced before the upload: not orphaned.
	must(s.PutBlob(ctx, u.ID, "p2", 50))

	clock.Advance(time.Hour)
	must(s.PushRecords(ctx, u.ID, d.ID, []store.PushRecord{{ID: "s1", Ciphertext: []byte{2}}}))
	if refs := must(s.OrphanedBlobs(ctx, clock.Now().UnixMilli()+1)); len(refs) != 0 {
		t.Errorf("orphans with one reference left = %+v", refs)
	}
	must(s.PushRecords(ctx, u.ID, d.ID, []store.PushRecord{{ID: "s2", Deleted: true, Ciphertext: []byte{3}}}))
	orphanedAt := clock.Now().UnixMilli()
	if refs := must(s.OrphanedBlobs(ctx, orphanedAt)); len(refs) != 0 {
		t.Errorf("orphans before cutoff = %+v", refs)
	}
	refs := must(s.OrphanedBlobs(ctx, orphanedAt+1))
	if len(refs) != 2 || refs[0].UserID != u.ID {
		t.Fatalf("orphans = %+v", refs)
	}
	check(t, s.DeleteBlob(ctx, u.ID, "p1"))
	if ok := must(s.HasBlob(ctx, u.ID, "p1")); ok {
		t.Error("HasBlob after delete = true")
	}
}

func testLinks(t *testing.T, s store.Store, clock *Clock) {
	u, _ := newUser(t, s)
	other, _ := newUser(t, s)
	now := clock.Now().UnixMilli()
	l := store.Link{ID: "l1", UserID: u.ID, Code: "ABCD1234", PublicKey: []byte{4}, CreatedAt: now, ExpiresAt: now + 600_000}
	check(t, s.CreateLink(ctx, l))
	wantErr(t, s.CreateLink(ctx, store.Link{ID: "l2", UserID: u.ID, Code: l.Code, PublicKey: []byte{4},
		CreatedAt: now, ExpiresAt: now + 1}), store.ErrConflict)

	got := must(s.GetLinkByCode(ctx, u.ID, l.Code))
	if got.ID != l.ID || got.Done() {
		t.Errorf("GetLinkByCode = %+v", got)
	}
	_, err := s.GetLinkByCode(ctx, other.ID, l.Code)
	wantErr(t, err, store.ErrNotFound)
	wantErr(t, s.CompleteLink(ctx, other.ID, l.ID, []byte{5}, []byte{6}), store.ErrNotFound)

	check(t, s.CompleteLink(ctx, u.ID, l.ID, []byte{5}, []byte{6}))
	wantErr(t, s.CompleteLink(ctx, u.ID, l.ID, []byte{5}, []byte{6}), store.ErrConflict)
	got = must(s.GetLink(ctx, u.ID, l.ID))
	if !got.Done() || !bytes.Equal(got.OtherPublicKey, []byte{5}) || !bytes.Equal(got.Wrapped, []byte{6}) {
		t.Errorf("GetLink = %+v", got)
	}
	check(t, s.DeleteLink(ctx, u.ID, l.ID))

	// Five wrong codes drop the open links of the account.
	check(t, s.CreateLink(ctx, store.Link{ID: "l3", UserID: u.ID, Code: "CODE0003", PublicKey: []byte{4},
		CreatedAt: now, ExpiresAt: now + 600_000}))
	for i := 1; i <= 5; i++ {
		if n := must(s.AddLinkFailure(ctx, u.ID, 5)); n != i {
			t.Fatalf("AddLinkFailure = %d, want %d", n, i)
		}
	}
	_, err = s.GetLink(ctx, u.ID, "l3")
	wantErr(t, err, store.ErrNotFound)
	if n := must(s.AddLinkFailure(ctx, u.ID, 5)); n != 1 {
		t.Errorf("count after reset = %d", n)
	}

	check(t, s.CreateLink(ctx, store.Link{ID: "l4", UserID: u.ID, Code: "CODE0004", PublicKey: []byte{4},
		CreatedAt: now, ExpiresAt: now + 1000}))
	clock.Advance(2 * time.Second)
	_, err = s.GetLink(ctx, u.ID, "l4")
	wantErr(t, err, store.ErrNotFound)
	if n := must(s.DeleteExpiredLinks(ctx)); n != 1 {
		t.Errorf("DeleteExpiredLinks = %d", n)
	}
}

func testDeleteUserCascade(t *testing.T, s store.Store, clock *Clock) {
	u, d := newUser(t, s)
	keep, kd := newUser(t, s)
	now := clock.Now().UnixMilli()
	for _, user := range []struct{ id, dev string }{{u.ID, d.ID}, {keep.ID, kd.ID}} {
		check(t, s.AddIdentity(ctx, store.Identity{UserID: user.id, Provider: store.ProviderGoogle, Subject: user.id}))
		check(t, s.CreateSession(ctx, store.Session{TokenHash: []byte(user.id), UserID: user.id, DeviceID: user.dev,
			CreatedAt: now, LastUsedAt: now, ExpiresAt: now + 1000}))
		check(t, s.PutKeyWrap(ctx, store.KeyWrap{ID: "w" + user.id, UserID: user.id, Kind: store.WrapRecovery,
			Alg: "A256GCM", Wrapped: []byte{1}}))
		must(s.PushRecords(ctx, user.id, user.dev, []store.PushRecord{{ID: "r", Ciphertext: []byte{1}, Blobs: []string{"b"}}}))
		must(s.PutBlob(ctx, user.id, "b", 1))
	}
	check(t, s.DeleteUser(ctx, u.ID))
	_, err := s.FindIdentity(ctx, store.ProviderGoogle, u.ID)
	wantErr(t, err, store.ErrNotFound)
	_, _, err = s.GetSession(ctx, []byte(u.ID))
	wantErr(t, err, store.ErrNotFound)
	if ok := must(s.HasBlob(ctx, u.ID, "b")); ok {
		t.Error("blob of deleted user still registered")
	}
	if w := must(s.ListKeyWraps(ctx, u.ID)); len(w) != 0 {
		t.Error("wraps of deleted user left")
	}
	if p := must(s.PullRecords(ctx, keep.ID, 0, 10)); len(p.Records) != 1 {
		t.Error("records of other user removed")
	}
}
