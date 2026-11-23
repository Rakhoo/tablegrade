package config

import (
	"slices"
	"testing"
)

func env(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load(env(nil))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddr != ":8080" || cfg.RPID != "tablegrade.pages.dev" {
		t.Errorf("unexpected defaults: %+v", cfg)
	}
	want := []string{"https://tablegrade.pages.dev", "https://dev.tablegrade.pages.dev"}
	if !slices.Equal(cfg.AppOrigins, want) {
		t.Errorf("AppOrigins = %v, want %v", cfg.AppOrigins, want)
	}
}

func TestLoadOrigins(t *testing.T) {
	cfg, err := Load(env(map[string]string{"APP_ORIGINS": " https://a.example/ , http://localhost:5173,"}))
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"https://a.example", "http://localhost:5173"}
	if !slices.Equal(cfg.AppOrigins, want) {
		t.Errorf("AppOrigins = %v, want %v", cfg.AppOrigins, want)
	}
	if _, err := Load(env(map[string]string{"APP_ORIGINS": "http://evil.example"})); err == nil {
		t.Error("expected an error for a plain http origin")
	}
}

func TestLoadGoogleNeedsSecret(t *testing.T) {
	if _, err := Load(env(map[string]string{"OIDC_GOOGLE_CLIENT_ID": "id"})); err == nil {
		t.Error("expected an error without client secret")
	}
}
