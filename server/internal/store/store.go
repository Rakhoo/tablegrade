// Package store persists users, identities, devices, sessions, key wraps and encrypted records
// (protocol.md 2–4). Handlers use only the Store interface, so the SQLite implementation
// (modernc.org/sqlite) can later be replaced by Postgres.
package store
