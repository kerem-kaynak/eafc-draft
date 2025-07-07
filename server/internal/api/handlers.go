package api

import (
	"net/http"

	"eafc-draft-server/internal/config"

	"github.com/jmoiron/sqlx"
)

type Handler struct {
	db            *sqlx.DB
	config        *config.Config
	broadcastFunc func(*sqlx.DB, string) // Function to broadcast draft state
}

func NewHandler(db *sqlx.DB, cfg *config.Config) *Handler {
	return &Handler{
		db:            db,
		config:        cfg,
		broadcastFunc: nil,
	}
}

// SetBroadcastFunc sets the function used to broadcast draft state updates
func (h *Handler) SetBroadcastFunc(fn func(*sqlx.DB, string)) {
	h.broadcastFunc = fn
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// Health check endpoint
	mux.HandleFunc("/health", h.handleHealth)

	// Player endpoints
	mux.HandleFunc("/api/players", h.corsMiddleware(h.getPlayers))
	mux.HandleFunc("/api/players/search", h.corsMiddleware(h.searchPlayers))
	mux.HandleFunc("/api/players/enums", h.corsMiddleware(h.getPlayerEnums))

	// Draft endpoints
	mux.HandleFunc("/api/drafts", h.corsMiddleware(h.handleDrafts))
	mux.HandleFunc("/api/drafts/", h.corsMiddleware(h.handleDraftOperations))

	// WebSocket endpoint
	mux.HandleFunc("/ws/drafts/", h.handleDraftWebSocket)
}

func (h *Handler) corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Set CORS headers first
		w.Header().Set("Access-Control-Allow-Origin", h.config.AllowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Only check origin for non-preflight requests
		if origin != "" && origin != h.config.AllowedOrigin {
			http.Error(w, "Forbidden - requests must come from "+h.config.AllowedOrigin, http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

func (h *Handler) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("healthy"))
}
