// Package blob stores encrypted photos as files in the data directory and removes blobs that
// no record has referenced for 30 days (protocol.md 5).
package blob

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
)

// ErrNotFound means the blob does not exist.
var ErrNotFound = errors.New("blob: not found")

// Store keeps the bytes of encrypted photos. The registration (size, references) lives in
// store.Store; this interface only moves bytes, so an S3 version can replace the file system.
type Store interface {
	// Put writes a blob completely or not at all.
	Put(ctx context.Context, userID, blobID string, data io.Reader) error
	// Open returns the blob for reading; ErrNotFound if missing.
	Open(ctx context.Context, userID, blobID string) (io.ReadCloser, error)
	// Delete removes a blob; a missing blob is not an error.
	Delete(ctx context.Context, userID, blobID string) error
	// DeleteUser removes all blobs of an account.
	DeleteUser(ctx context.Context, userID string) error
}

// safeName matches ids that are safe as file names (UUIDs and base64url).
var safeName = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// FS stores blobs as files at <dir>/<userId>/<blobId>.
type FS struct{ dir string }

// NewFS returns a file system store below dir; dir is created on first write.
func NewFS(dir string) *FS { return &FS{dir: dir} }

// path returns the file of a blob and rejects ids that could leave the directory.
func (f *FS) path(userID, blobID string) (string, error) {
	if !safeName.MatchString(userID) || !safeName.MatchString(blobID) {
		return "", fmt.Errorf("blob: invalid id %q/%q", userID, blobID)
	}
	return filepath.Join(f.dir, userID, blobID), nil
}

// Put implements Store. It writes a temporary file and renames it, so readers never see a
// partial blob.
func (f *FS) Put(_ context.Context, userID, blobID string, data io.Reader) error {
	path, err := f.path(userID, blobID)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".upload-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	if _, err := io.Copy(tmp, data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// Open implements Store.
func (f *FS) Open(_ context.Context, userID, blobID string) (io.ReadCloser, error) {
	path, err := f.path(userID, blobID)
	if err != nil {
		return nil, err
	}
	file, err := os.Open(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, ErrNotFound
	}
	return file, err
}

// Delete implements Store.
func (f *FS) Delete(_ context.Context, userID, blobID string) error {
	path, err := f.path(userID, blobID)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return nil
}

// DeleteUser implements Store.
func (f *FS) DeleteUser(_ context.Context, userID string) error {
	if !safeName.MatchString(userID) {
		return fmt.Errorf("blob: invalid user id %q", userID)
	}
	return os.RemoveAll(filepath.Join(f.dir, userID))
}
