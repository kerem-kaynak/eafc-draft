package config

import (
	"os"
)

type Config struct {
	DatabaseURL   string
	ServerAddress string
	AllowedOrigin string
}

func Load() *Config {
	return &Config{
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://eafc_user:eafc_dev_password_123@localhost:5432/eafc_draft?sslmode=disable"),
		ServerAddress: getEnv("SERVER_ADDRESS", ":8080"),
		AllowedOrigin: getEnv("ALLOWED_ORIGIN", "http://localhost:5173"), // Default Vite dev server
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
