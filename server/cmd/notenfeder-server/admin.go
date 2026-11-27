package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/Rakhoo/tablegrade/server/internal/blob"
	"github.com/Rakhoo/tablegrade/server/internal/config"
	"github.com/Rakhoo/tablegrade/server/internal/store"
	"github.com/Rakhoo/tablegrade/server/internal/store/sqlite"
)

// adminUsage lists the operator commands; they run next to the server via docker compose exec.
const adminUsage = `Befehle:
  admin list              alle Konten (Status, E-Mail, Begründung)
  admin pending           nur Konten, die auf Freischaltung warten
  admin approve <id|mail> Konto freischalten
  admin revoke <id|mail>  Freischaltung zurücknehmen
  admin emails            Kontakt-Adressen freigeschalteter Konten, für Rundmails (BCC)
  admin delete <id|mail> --ja
                          Konto mit allen Daten und Fotos löschen (ohne --ja nur Vorschau)`

// admin runs one operator command on the database of DATA_DIR.
func admin(args []string, out io.Writer) error {
	if len(args) == 0 {
		return errors.New(adminUsage)
	}
	cfg, err := config.FromEnv()
	if err != nil {
		return err
	}
	db, err := sqlite.Open(filepath.Join(cfg.DataDir, dbFile))
	if err != nil {
		return err
	}
	defer db.Close()
	ctx := context.Background()
	users, err := db.ListUsers(ctx)
	if err != nil {
		return err
	}
	switch {
	case args[0] == "list" && len(args) == 1:
		printUsers(out, users)
	case args[0] == "pending" && len(args) == 1:
		printUsers(out, filterUsers(users, func(u store.User) bool { return u.ApprovedAt == 0 }))
	case args[0] == "emails" && len(args) == 1:
		var emails []string
		for _, u := range users {
			if u.ApprovedAt != 0 && u.ContactEmail != "" {
				emails = append(emails, u.ContactEmail)
			}
		}
		fmt.Fprintln(out, strings.Join(emails, ", "))
	case (args[0] == "approve" || args[0] == "revoke") && len(args) == 2:
		u, err := findUser(users, args[1])
		if err != nil {
			return err
		}
		if args[0] == "revoke" {
			return db.SetApproved(ctx, u.ID, 0)
		}
		if err := db.SetApproved(ctx, u.ID, time.Now().UnixMilli()); err != nil {
			return err
		}
		// Mails are sent by hand, so the command reminds of it.
		fmt.Fprintf(out, "Freigeschaltet. Benachrichtigung an: %s\n", orDash(u.ContactEmail))
	case args[0] == "delete" && (len(args) == 2 || len(args) == 3):
		u, err := findUser(users, args[1])
		if err != nil {
			return err
		}
		// A typo in the id must not delete an account, so the command first only names it
		if len(args) == 2 || args[2] != "--ja" {
			fmt.Fprintf(out, "Löscht Konto %s (%s) mit allen Daten und Fotos. Zum Ausführen: admin delete %s --ja\n",
				orDash(u.ContactEmail), u.ID, u.ID)
			return nil
		}
		return deleteUser(ctx, db, cfg.DataDir, u, out)
	default:
		return errors.New(adminUsage)
	}
	return nil
}

// deleteUser removes an account like DELETE /account: database rows first, then the photos.
func deleteUser(ctx context.Context, db *sqlite.DB, dataDir string, u store.User, out io.Writer) error {
	if err := db.DeleteUser(ctx, u.ID); err != nil {
		return err
	}
	if err := blob.NewFS(filepath.Join(dataDir, blob.DirName)).DeleteUser(ctx, u.ID); err != nil {
		return fmt.Errorf("konto gelöscht, Fotos nicht: %w", err)
	}
	fmt.Fprintf(out, "Gelöscht: %s (%s). In den Sicherungen bleibt es höchstens 7 Tage, im Papierkorb des Cloud-Speichers bis zu 30 weitere.\n",
		orDash(u.ContactEmail), u.ID)
	return nil
}

// findUser picks an account by id or contact address (case-insensitive).
func findUser(users []store.User, key string) (store.User, error) {
	found := filterUsers(users, func(u store.User) bool {
		return u.ID == key || (u.ContactEmail != "" && strings.EqualFold(u.ContactEmail, key))
	})
	switch len(found) {
	case 0:
		return store.User{}, fmt.Errorf("kein Konto für %q", key)
	case 1:
		return found[0], nil
	default:
		return store.User{}, fmt.Errorf("%q passt zu %d Konten, bitte die id nehmen", key, len(found))
	}
}

// filterUsers returns the accounts for which keep is true.
func filterUsers(users []store.User, keep func(store.User) bool) []store.User {
	var out []store.User
	for _, u := range users {
		if keep(u) {
			out = append(out, u)
		}
	}
	return out
}

// printUsers writes one line per account, aligned in columns.
func printUsers(out io.Writer, users []store.User) {
	w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "STATUS\tANGELEGT\tE-MAIL\tBEGRÜNDUNG\tID")
	for _, u := range users {
		status := "frei"
		if u.ApprovedAt == 0 {
			status = "wartet"
		}
		created := time.UnixMilli(u.CreatedAt).Format("2006-01-02")
		// Tabs and line breaks in the note would break the columns.
		note := strings.Join(strings.Fields(u.AccessNote), " ")
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", status, created, orDash(u.ContactEmail), orDash(note), u.ID)
	}
	_ = w.Flush()
}

// orDash shows "-" for an empty value.
func orDash(v string) string {
	if v == "" {
		return "-"
	}
	return v
}

// runAdmin is the entry point of "notenfeder-server admin …".
func runAdmin(args []string) {
	if err := admin(args, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
