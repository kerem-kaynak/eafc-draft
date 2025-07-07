package main

import (
	"log"
	"net/http"

	"eafc-draft-server/internal/api"
	"eafc-draft-server/internal/config"
	"eafc-draft-server/internal/database"

	"github.com/jmoiron/sqlx"
)

// broadcastDraftState is the actual broadcast function
func broadcastDraftState(db *sqlx.DB, draftCode string) {
	// Call the websocket broadcast function
	// We'll import this function here to avoid circular imports
	api.BroadcastDraftStateToRoom(db, draftCode)
}

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	handler := api.NewHandler(db, cfg)

	// Set the broadcast function to avoid circular imports
	handler.SetBroadcastFunc(broadcastDraftState)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	log.Printf("Server starting on %s", cfg.ServerAddress)
	log.Fatal(http.ListenAndServe(cfg.ServerAddress, mux))
}
