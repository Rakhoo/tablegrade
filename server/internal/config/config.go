// Package config reads the server configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strings"
)

// OIDCProvider holds the OAuth client of one identity provider. An empty ClientID disables it.
type OIDCProvider struct {
	ClientID     string
	ClientSecret string
}

// Config is the complete server configuration.
type Config struct {
	// ListenAddr is the TCP address of the HTTP server, e.g. ":8080".
	ListenAddr string
	// DataDir holds the SQLite file and the blob folder.
	DataDir string
	// AppOrigins are the origins allowed by CORS and WebAuthn.
	AppOrigins []string
	// RPID is the WebAuthn relying party id.
	RPID      string
	Microsoft OIDCProvider
	Google    OIDCProvider
}

// Defaults for local development and the production setup.
const (
	defaultListenAddr = ":8080"
	defaultDataDir    = "./data"
	defaultOrigins    = "https://tablegrade.pages.dev,https://dev.tablegrade.pages.dev"
	defaultRPID       = "tablegrade.pages.dev"
)

// Load reads the configuration via getenv (os.Getenv in production, a map in tests).
func Load(getenv func(string) string) (Config, error) {
	get := func(key, fallback string) string {
		if v := strings.TrimSpace(getenv(key)); v != "" {
			return v
		}
		return fallback
	}
	cfg := Config{
		ListenAddr: get("LISTEN_ADDR", defaultListenAddr),
		DataDir:    get("DATA_DIR", defaultDataDir),
		RPID:       get("RP_ID", defaultRPID),
		Microsoft: OIDCProvider{
			ClientID:     get("OIDC_MICROSOFT_CLIENT_ID", ""),
			ClientSecret: get("OIDC_MICROSOFT_CLIENT_SECRET", ""),
		},
		Google: OIDCProvider{
			ClientID:     get("OIDC_GOOGLE_CLIENT_ID", ""),
			ClientSecret: get("OIDC_GOOGLE_CLIENT_SECRET", ""),
		},
	}
	for _, origin := range strings.Split(get("APP_ORIGINS", defaultOrigins), ",") {
		origin = strings.TrimRight(strings.TrimSpace(origin), "/")
		if origin == "" {
			continue
		}
		if !strings.HasPrefix(origin, "https://") && !strings.HasPrefix(origin, "http://localhost") {
			return Config{}, fmt.Errorf("APP_ORIGINS: %q must use https (or be http://localhost)", origin)
		}
		cfg.AppOrigins = append(cfg.AppOrigins, origin)
	}
	if len(cfg.AppOrigins) == 0 {
		return Config{}, fmt.Errorf("APP_ORIGINS: no origin given")
	}
	if cfg.Google.ClientID != "" && cfg.Google.ClientSecret == "" {
		return Config{}, fmt.Errorf("OIDC_GOOGLE_CLIENT_SECRET is required with OIDC_GOOGLE_CLIENT_ID")
	}
	return cfg, nil
}

// FromEnv loads the configuration from the process environment.
func FromEnv() (Config, error) {
	return Load(os.Getenv)
}
