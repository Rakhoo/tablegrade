package blob

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
)

func TestFS(t *testing.T) {
	ctx := context.Background()
	f := NewFS(t.TempDir())
	if err := f.Put(ctx, "u1", "b1", strings.NewReader("photo")); err != nil {
		t.Fatal(err)
	}
	r, err := f.Open(ctx, "u1", "b1")
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(r)
	_ = r.Close()
	if string(data) != "photo" {
		t.Errorf("read %q", data)
	}
	if _, err := f.Open(ctx, "u2", "b1"); !errors.Is(err, ErrNotFound) {
		t.Errorf("other user: %v", err)
	}
	if err := f.Delete(ctx, "u1", "b1"); err != nil {
		t.Fatal(err)
	}
	if err := f.Delete(ctx, "u1", "b1"); err != nil {
		t.Errorf("second delete: %v", err)
	}
	_ = f.Put(ctx, "u1", "b2", strings.NewReader("x"))
	if err := f.DeleteUser(ctx, "u1"); err != nil {
		t.Fatal(err)
	}
	if _, err := f.Open(ctx, "u1", "b2"); !errors.Is(err, ErrNotFound) {
		t.Errorf("after DeleteUser: %v", err)
	}
}

func TestFSRejectsPaths(t *testing.T) {
	f := NewFS(t.TempDir())
	for _, id := range []string{"../x", "a/b", "", "."} {
		if err := f.Put(context.Background(), "u1", id, strings.NewReader("x")); err == nil {
			t.Errorf("Put accepted %q", id)
		}
	}
}

// failingReader breaks off an upload.
type failingReader struct{}

func (failingReader) Read([]byte) (int, error) { return 0, errors.New("connection lost") }

func TestFSPutIsAtomic(t *testing.T) {
	ctx := context.Background()
	f := NewFS(t.TempDir())
	if err := f.Put(ctx, "u1", "b1", failingReader{}); err == nil {
		t.Fatal("expected an error")
	}
	if _, err := f.Open(ctx, "u1", "b1"); !errors.Is(err, ErrNotFound) {
		t.Errorf("partial blob visible: %v", err)
	}
}
