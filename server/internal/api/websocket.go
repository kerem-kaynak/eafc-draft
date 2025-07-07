package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	"eafc-draft-server/internal/database"

	"github.com/gorilla/websocket"
	"github.com/jmoiron/sqlx"
)

func createUpgrader(allowedOrigin string) websocket.Upgrader {
	return websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			// Allow configured origin, local files, and development
			return origin == allowedOrigin || origin == "null" || origin == ""
		},
	}
}

// DraftRoom manages all connections for a specific draft
type DraftRoom struct {
	DraftCode  string
	Clients    map[*websocket.Conn]*DraftClient
	Broadcast  chan []byte
	Register   chan *DraftClient
	Unregister chan *DraftClient
	mutex      sync.RWMutex
}

// DraftClient represents a connected client
type DraftClient struct {
	Conn            *websocket.Conn
	Room            *DraftRoom
	ParticipantName string
	Send            chan []byte
}

// WebSocket message types
type WSMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type JoinRoomMessage struct {
	ParticipantName string `json:"participantName"`
}

type MakePickMessage struct {
	ParticipantName string `json:"participantName"`
	PlayerID        int    `json:"playerId"`
}

// Global room manager
var roomManager = &RoomManager{
	rooms: make(map[string]*DraftRoom),
}

type RoomManager struct {
	rooms map[string]*DraftRoom
	mutex sync.RWMutex
}

func (rm *RoomManager) getRoom(draftCode string) *DraftRoom {
	rm.mutex.Lock()
	defer rm.mutex.Unlock()

	room, exists := rm.rooms[draftCode]
	if !exists {
		room = &DraftRoom{
			DraftCode:  draftCode,
			Clients:    make(map[*websocket.Conn]*DraftClient),
			Broadcast:  make(chan []byte),
			Register:   make(chan *DraftClient),
			Unregister: make(chan *DraftClient),
		}
		rm.rooms[draftCode] = room
		go room.run()
	}

	return room
}

// BroadcastToRoom sends a message to all clients in a specific room
func (rm *RoomManager) BroadcastToRoom(draftCode string, message []byte) {
	rm.mutex.RLock()
	room, exists := rm.rooms[draftCode]
	rm.mutex.RUnlock()

	if exists {
		select {
		case room.Broadcast <- message:
		default:
			log.Printf("Failed to broadcast to room %s", draftCode)
		}
	}
}

func (room *DraftRoom) run() {
	for {
		select {
		case client := <-room.Register:
			room.mutex.Lock()
			room.Clients[client.Conn] = client
			room.mutex.Unlock()
			log.Printf("Client %s joined draft room %s", client.ParticipantName, room.DraftCode)

			// Send join confirmation
			joinMsg := WSMessage{
				Type: "joined",
				Data: map[string]string{"participantName": client.ParticipantName},
			}
			if data, err := json.Marshal(joinMsg); err == nil {
				select {
				case client.Send <- data:
				default:
					close(client.Send)
				}
			}

		case client := <-room.Unregister:
			room.mutex.Lock()
			if _, ok := room.Clients[client.Conn]; ok {
				delete(room.Clients, client.Conn)
				close(client.Send)
				log.Printf("Client %s left draft room %s", client.ParticipantName, room.DraftCode)
			}
			room.mutex.Unlock()

		case message := <-room.Broadcast:
			room.mutex.RLock()
			for conn, client := range room.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(room.Clients, conn)
				}
			}
			room.mutex.RUnlock()
		}
	}
}

func (h *Handler) handleDraftWebSocket(w http.ResponseWriter, r *http.Request) {
	// Extract draft code from URL path
	path := r.URL.Path
	draftCode := strings.TrimPrefix(path, "/ws/drafts/")

	if draftCode == "" {
		log.Printf("WebSocket request missing draft code")
		http.Error(w, "Draft code required", http.StatusBadRequest)
		return
	}

	log.Printf("WebSocket connection request for draft %s from %s", draftCode, r.RemoteAddr)

	// Create upgrader with configured allowed origin
	upgrader := createUpgrader(h.config.AllowedOrigin)

	// Upgrade connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	log.Printf("WebSocket upgraded successfully for draft %s", draftCode)

	// Get or create room for this draft
	room := roomManager.getRoom(draftCode)

	// Create client
	client := &DraftClient{
		Conn: conn,
		Room: room,
		Send: make(chan []byte, 256),
	}

	// Start client goroutines
	go client.writePump()
	go client.readPump(h)

	// Register client with room
	room.Register <- client
}

func (client *DraftClient) readPump(h *Handler) {
	defer func() {
		log.Printf("Closing readPump for client %s", client.ParticipantName)
		client.Room.Unregister <- client
		client.Conn.Close()
	}()

	for {
		var message WSMessage
		err := client.Conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		log.Printf("Received message type: %s from %s", message.Type, client.ParticipantName)

		switch message.Type {
		case "join":
			h.handleJoinRoom(client, message.Data)
		case "makePick":
			h.handleMakePick(client, message.Data, h)
		default:
			log.Printf("Unknown message type: %s", message.Type)
		}
	}
}

func (client *DraftClient) writePump() {
	defer func() {
		log.Printf("Closing writePump for client %s", client.ParticipantName)
		client.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.Send:
			if !ok {
				client.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := client.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Write message error: %v", err)
				return
			}
		}
	}
}

func (h *Handler) handleJoinRoom(client *DraftClient, data interface{}) {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		log.Printf("Join room marshal error: %v", err)
		return
	}

	var joinMsg JoinRoomMessage
	if err := json.Unmarshal(dataBytes, &joinMsg); err != nil {
		log.Printf("Join room unmarshal error: %v", err)
		return
	}

	client.ParticipantName = joinMsg.ParticipantName
	log.Printf("Client identified as %s in draft %s", client.ParticipantName, client.Room.DraftCode)

	// Send current draft state to the newly joined client
	h.sendDraftState(client)
}

func (h *Handler) handleMakePick(client *DraftClient, data interface{}, handler *Handler) {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		log.Printf("Make pick marshal error: %v", err)
		return
	}

	var pickMsg MakePickMessage
	if err := json.Unmarshal(dataBytes, &pickMsg); err != nil {
		log.Printf("Make pick unmarshal error: %v", err)
		return
	}

	log.Printf("Pick attempt: %s wants to pick player %d in draft %s",
		pickMsg.ParticipantName, pickMsg.PlayerID, client.Room.DraftCode)

	// Process the pick
	err = h.processPick(client.Room.DraftCode, pickMsg.ParticipantName, pickMsg.PlayerID)
	if err != nil {
		// Send error to the specific client
		errorMsg := WSMessage{
			Type: "pickError",
			Data: map[string]string{"error": err.Error()},
		}
		if errorData, marshalErr := json.Marshal(errorMsg); marshalErr == nil {
			select {
			case client.Send <- errorData:
			default:
				log.Printf("Failed to send error to client")
			}
		}
		return
	}

	// If pick successful, broadcast updated draft state to all clients
	BroadcastDraftStateToRoom(h.db, client.Room.DraftCode)
}

func (h *Handler) processPick(draftCode, participantName string, playerID int) error {
	// Start transaction
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("Begin pick transaction error: %v", err)
		return fmt.Errorf("database error")
	}
	defer tx.Rollback()

	// Get draft with lock
	var draft database.Draft
	err = tx.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1 FOR UPDATE
	`, draftCode)
	if err != nil {
		log.Printf("Get draft for pick error: %v", err)
		return fmt.Errorf("draft not found")
	}

	if draft.Status != "active" {
		return fmt.Errorf("draft is not active")
	}

	// Get participant making the pick
	var participant database.DraftParticipant
	err = tx.Get(&participant, `
		SELECT id, draft_id, name, draft_order, is_admin, joined_at, 
		       picks_85_89, picks_80_84, picks_75_79, picks_up_to_74
		FROM draft_participants WHERE draft_id = $1 AND name = $2
	`, draft.ID, participantName)
	if err != nil {
		return fmt.Errorf("participant not found")
	}

	// Calculate whose turn it is
	currentPicker := h.calculateCurrentPicker(draft.CurrentRound, draft.CurrentPickInRound, draft.ParticipantCount)
	if participant.DraftOrder != currentPicker {
		return fmt.Errorf("not your turn (it's player %d's turn)", currentPicker)
	}

	// Get player details
	var player database.Player
	err = tx.Get(&player, "SELECT id, overall_rating FROM players WHERE id = $1", playerID)
	if err != nil {
		return fmt.Errorf("player not found")
	}

	if player.OverallRating == nil {
		return fmt.Errorf("player has no rating")
	}

	// Check if player already picked in this draft
	var alreadyPicked bool
	err = tx.Get(&alreadyPicked, "SELECT EXISTS(SELECT 1 FROM draft_picks WHERE draft_id = $1 AND player_id = $2)", draft.ID, playerID)
	if err != nil {
		return fmt.Errorf("database error checking duplicates")
	}
	if alreadyPicked {
		return fmt.Errorf("player already picked in this draft")
	}

	// Determine rating tier and validate quota
	ratingTier := h.getRatingTier(*player.OverallRating)
	if ratingTier == "invalid" {
		return fmt.Errorf("cannot pick players rated 90+")
	}

	if !h.canPickFromTier(participant, ratingTier) {
		return h.formatQuotaError(participant, ratingTier)
	}

	// Calculate pick numbers
	overallPickNumber := (draft.CurrentRound-1)*draft.ParticipantCount + draft.CurrentPickInRound

	// Insert pick
	_, err = tx.Exec(`
		INSERT INTO draft_picks (draft_id, participant_id, player_id, round_number, pick_in_round, 
		                        overall_pick_number, player_rating_tier) 
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, draft.ID, participant.ID, playerID, draft.CurrentRound, draft.CurrentPickInRound,
		overallPickNumber, ratingTier)
	if err != nil {
		log.Printf("Insert pick error: %v", err)
		return fmt.Errorf("failed to save pick")
	}

	// Update participant quota
	err = h.updateParticipantQuota(tx, participant.ID, ratingTier)
	if err != nil {
		return fmt.Errorf("failed to update quota")
	}

	// Calculate next turn
	nextRound, nextPickInRound := h.calculateNextTurn(draft.CurrentRound, draft.CurrentPickInRound,
		draft.ParticipantCount, draft.TotalRounds)

	// Update draft state
	var status string
	var completedAt interface{}
	if nextRound > draft.TotalRounds {
		status = "completed"
		completedAt = "NOW()"
	} else {
		status = "active"
		completedAt = nil
	}

	if completedAt != nil {
		_, err = tx.Exec(`
			UPDATE drafts 
			SET current_round = $1, current_pick_in_round = $2, status = $3, completed_at = NOW()
			WHERE id = $4
		`, nextRound, nextPickInRound, status, draft.ID)
	} else {
		_, err = tx.Exec(`
			UPDATE drafts 
			SET current_round = $1, current_pick_in_round = $2, status = $3
			WHERE id = $4
		`, nextRound, nextPickInRound, status, draft.ID)
	}
	if err != nil {
		log.Printf("Update draft state error: %v", err)
		return fmt.Errorf("failed to update draft state")
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Commit pick transaction error: %v", err)
		return fmt.Errorf("failed to complete pick")
	}

	log.Printf("Pick successful: %s picked player %d (round %d, pick %d)",
		participantName, playerID, draft.CurrentRound, draft.CurrentPickInRound)

	return nil
}

// calculateCurrentPicker determines whose turn it is based on round and pick
func (h *Handler) calculateCurrentPicker(round, pickInRound, participantCount int) int {
	startingPlayer := ((round - 1) % participantCount) + 1
	return ((startingPlayer + pickInRound - 2) % participantCount) + 1
}

// calculateNextTurn determines the next round and pick
func (h *Handler) calculateNextTurn(currentRound, currentPickInRound, participantCount, totalRounds int) (int, int) {
	if currentPickInRound < participantCount {
		return currentRound, currentPickInRound + 1
	}
	return currentRound + 1, 1
}

// getRatingTier returns the rating tier for a player
func (h *Handler) getRatingTier(rating int) string {
	if rating >= 90 {
		return "invalid"
	} else if rating >= 85 {
		return "85-89"
	} else if rating >= 80 {
		return "80-84"
	}
	return "75-79" // Now represents ≤79 (75-79 + up-to-74 combined)
}

// canPickFromTier checks if participant can pick from rating tier
func (h *Handler) canPickFromTier(participant database.DraftParticipant, tier string) bool {
	switch tier {
	case "85-89":
		return participant.Picks8589 < 1
	case "80-84":
		return participant.Picks8084 < 4
	case "75-79":
		// Combined quota: existing picks from both tiers should not exceed 6
		return (participant.Picks7579 + participant.PicksUpTo74) < 6
	default:
		return false
	}
}

// updateParticipantQuota increments the quota for the rating tier
func (h *Handler) updateParticipantQuota(tx *sqlx.Tx, participantID int, tier string) error {
	var column string
	switch tier {
	case "85-89":
		column = "picks_85_89"
	case "80-84":
		column = "picks_80_84"
	case "75-79":
		// For ≤79 tier, use picks_75_79 column to track new picks going forward
		column = "picks_75_79"
	default:
		return fmt.Errorf("invalid tier")
	}

	_, err := tx.Exec(fmt.Sprintf("UPDATE draft_participants SET %s = %s + 1 WHERE id = $1", column, column), participantID)
	return err
}

// formatQuotaError returns a detailed error message about quota limits
func (h *Handler) formatQuotaError(participant database.DraftParticipant, tier string) error {
	switch tier {
	case "85-89":
		return fmt.Errorf("quota exceeded: you have %d/1 picks for 85-89 rated players", participant.Picks8589)
	case "80-84":
		return fmt.Errorf("quota exceeded: you have %d/4 picks for 80-84 rated players", participant.Picks8084)
	case "75-79":
		current := participant.Picks7579 + participant.PicksUpTo74
		return fmt.Errorf("quota exceeded: you have %d/6 picks for players rated 79 or below", current)
	default:
		return fmt.Errorf("quota exceeded for rating tier %s", tier)
	}
}

// BroadcastDraftStateToRoom broadcasts updated draft state to all clients in a room
func BroadcastTournamentStateToRoom(db *sqlx.DB, draftCode string) {
	// Get current draft state from database
	var draft database.Draft
	err := db.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1
	`, draftCode)
	if err != nil {
		log.Printf("Get draft state for tournament broadcast error: %v", err)
		return
	}

	// Only broadcast tournament data if draft is in tournament mode
	if draft.Status != "tournament" {
		// Fall back to regular draft state broadcast
		BroadcastDraftStateToRoom(db, draftCode)
		return
	}

	// Get participants
	var participants []database.DraftParticipant
	err = db.Select(&participants, `
		SELECT id, draft_id, name, draft_order, is_admin, joined_at, 
		       picks_85_89, picks_80_84, picks_75_79, picks_up_to_74
		FROM draft_participants WHERE draft_id = $1 ORDER BY draft_order
	`, draft.ID)
	if err != nil {
		log.Printf("Get participants for tournament broadcast error: %v", err)
		return
	}

	// Get matches
	var matches []database.Match
	err = db.Select(&matches, `
		SELECT id, draft_id, home_team_id, away_team_id, home_team_name, away_team_name,
		       home_score, away_score, played_at, recorded_by
		FROM matches WHERE draft_id = $1 ORDER BY played_at DESC
	`, draft.ID)
	if err != nil {
		log.Printf("Get matches for tournament broadcast error: %v", err)
		return
	}

	// Calculate standings
	standings := calculateStandingsForBroadcast(participants, matches)

	tournamentMsg := WSMessage{
		Type: "tournamentState",
		Data: map[string]interface{}{
			"draft":        draft,
			"participants": participants,
			"matches":      matches,
			"standings":    standings,
		},
	}

	if data, err := json.Marshal(tournamentMsg); err == nil {
		roomManager.BroadcastToRoom(draftCode, data)
		log.Printf("Broadcasted tournament state to room %s", draftCode)
	} else {
		log.Printf("Failed to marshal tournament state: %v", err)
	}
}

func BroadcastDraftStateToRoom(db *sqlx.DB, draftCode string) {
	// Get current draft state from database
	var draft database.Draft
	err := db.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1
	`, draftCode)
	if err != nil {
		log.Printf("Get draft state for broadcast error: %v", err)
		return
	}

	// Get participants
	var participants []database.DraftParticipant
	err = db.Select(&participants, `
		SELECT id, draft_id, name, draft_order, is_admin, joined_at, 
		       picks_85_89, picks_80_84, picks_75_79, picks_up_to_74
		FROM draft_participants WHERE draft_id = $1 ORDER BY draft_order
	`, draft.ID)
	if err != nil {
		log.Printf("Get participants for broadcast error: %v", err)
		return
	}

	// Get picks with player details
	var picks []map[string]interface{}
	rows, err := db.Query(`
		SELECT dp.id, dp.draft_id, dp.participant_id, dp.player_id, dp.round_number, 
		       dp.pick_in_round, dp.overall_pick_number, dp.player_rating_tier, dp.picked_at,
		       p.first_name, p.last_name, p.common_name, p.overall_rating, p.position_short_label,
		       p.team_label, p.team_image_url, p.nationality_label, p.nationality_image_url, 
		       p.avatar_url, p.shield_url,
		       part.name as participant_name
		FROM draft_picks dp
		JOIN players p ON dp.player_id = p.id
		JOIN draft_participants part ON dp.participant_id = part.id
		WHERE dp.draft_id = $1 
		ORDER BY dp.overall_pick_number
	`, draft.ID)
	if err != nil {
		log.Printf("Get picks for broadcast error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var pick map[string]interface{}
		var id, draftID, participantID, playerID, roundNumber, pickInRound, overallPickNumber int
		var playerRatingTier, participantName string
		var pickedAt interface{}
		var firstName, lastName, commonName, positionShortLabel, teamLabel, nationalityLabel, avatarURL, teamImageURL, nationalityImageURL, shieldURL *string
		var overallRating *int

		err := rows.Scan(&id, &draftID, &participantID, &playerID, &roundNumber, &pickInRound,
			&overallPickNumber, &playerRatingTier, &pickedAt, &firstName, &lastName, &commonName,
			&overallRating, &positionShortLabel, &teamLabel, &teamImageURL, &nationalityLabel, &nationalityImageURL, &avatarURL, &shieldURL, &participantName)
		if err != nil {
			continue
		}

		pick = map[string]interface{}{
			"id":                id,
			"draftId":           draftID,
			"participantId":     participantID,
			"playerId":          playerID,
			"roundNumber":       roundNumber,
			"pickInRound":       pickInRound,
			"overallPickNumber": overallPickNumber,
			"playerRatingTier":  playerRatingTier,
			"pickedAt":          pickedAt,
			"participantName":   participantName,
			"player": map[string]interface{}{
				"firstName":           firstName,
				"lastName":            lastName,
				"commonName":          commonName,
				"overallRating":       overallRating,
				"positionShortLabel":  positionShortLabel,
				"teamLabel":           teamLabel,
				"teamImageUrl":        teamImageURL,
				"nationalityLabel":    nationalityLabel,
				"nationalityImageUrl": nationalityImageURL,
				"avatarUrl":           avatarURL,
				"shieldUrl":           shieldURL,
			},
		}
		picks = append(picks, pick)
	}

	// Calculate whose turn it is next
	var currentPicker *int
	if draft.Status == "active" {
		picker := calculateCurrentPicker(draft.CurrentRound, draft.CurrentPickInRound, draft.ParticipantCount)
		currentPicker = &picker
	}

	stateMsg := WSMessage{
		Type: "draftState",
		Data: map[string]interface{}{
			"draft":         draft,
			"participants":  participants,
			"picks":         picks,
			"currentPicker": currentPicker,
		},
	}

	if data, err := json.Marshal(stateMsg); err == nil {
		roomManager.BroadcastToRoom(draftCode, data)
		log.Printf("Broadcasted draft state to room %s", draftCode)
	} else {
		log.Printf("Failed to marshal draft state: %v", err)
	}
}

// Helper function for calculating current picker
func calculateCurrentPicker(round, pickInRound, participantCount int) int {
	startingPlayer := ((round - 1) % participantCount) + 1
	return ((startingPlayer + pickInRound - 2) % participantCount) + 1
}

func (h *Handler) sendDraftState(client *DraftClient) {
	// Get current draft state from database
	var draft database.Draft
	err := h.db.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1
	`, client.Room.DraftCode)
	if err != nil {
		log.Printf("Get draft state error: %v", err)
		return
	}

	// Get participants
	var participants []database.DraftParticipant
	err = h.db.Select(&participants, `
		SELECT id, draft_id, name, draft_order, is_admin, joined_at, 
		       picks_85_89, picks_80_84, picks_75_79, picks_up_to_74
		FROM draft_participants WHERE draft_id = $1 ORDER BY draft_order
	`, draft.ID)
	if err != nil {
		log.Printf("Get participants state error: %v", err)
		return
	}

	// Get picks with player details
	var picks []map[string]interface{}
	rows, err := h.db.Query(`
		SELECT dp.id, dp.draft_id, dp.participant_id, dp.player_id, dp.round_number, 
		       dp.pick_in_round, dp.overall_pick_number, dp.player_rating_tier, dp.picked_at,
		       p.first_name, p.last_name, p.common_name, p.overall_rating, p.position_short_label,
		       p.team_label, p.team_image_url, p.nationality_label, p.nationality_image_url, 
		       p.avatar_url, p.shield_url,
		       part.name as participant_name
		FROM draft_picks dp
		JOIN players p ON dp.player_id = p.id
		JOIN draft_participants part ON dp.participant_id = part.id
		WHERE dp.draft_id = $1 
		ORDER BY dp.overall_pick_number
	`, draft.ID)
	if err != nil {
		log.Printf("Get picks for state error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var pick map[string]interface{}
		var id, draftID, participantID, playerID, roundNumber, pickInRound, overallPickNumber int
		var playerRatingTier, participantName string
		var pickedAt interface{}
		var firstName, lastName, commonName, positionShortLabel, teamLabel, nationalityLabel, avatarURL, teamImageURL, nationalityImageURL, shieldURL *string
		var overallRating *int

		err := rows.Scan(&id, &draftID, &participantID, &playerID, &roundNumber, &pickInRound,
			&overallPickNumber, &playerRatingTier, &pickedAt, &firstName, &lastName, &commonName,
			&overallRating, &positionShortLabel, &teamLabel, &teamImageURL, &nationalityLabel, &nationalityImageURL, &avatarURL, &shieldURL, &participantName)
		if err != nil {
			continue
		}

		pick = map[string]interface{}{
			"id":                id,
			"draftId":           draftID,
			"participantId":     participantID,
			"playerId":          playerID,
			"roundNumber":       roundNumber,
			"pickInRound":       pickInRound,
			"overallPickNumber": overallPickNumber,
			"playerRatingTier":  playerRatingTier,
			"pickedAt":          pickedAt,
			"participantName":   participantName,
			"player": map[string]interface{}{
				"firstName":           firstName,
				"lastName":            lastName,
				"commonName":          commonName,
				"overallRating":       overallRating,
				"positionShortLabel":  positionShortLabel,
				"teamLabel":           teamLabel,
				"teamImageUrl":        teamImageURL,
				"nationalityLabel":    nationalityLabel,
				"nationalityImageUrl": nationalityImageURL,
				"avatarUrl":           avatarURL,
				"shieldUrl":           shieldURL,
			},
		}
		picks = append(picks, pick)
	}

	// Calculate whose turn it is next (ADD THIS PART)
	var currentPicker *int
	if draft.Status == "active" {
		picker := calculateCurrentPicker(draft.CurrentRound, draft.CurrentPickInRound, draft.ParticipantCount)
		currentPicker = &picker
	}

	stateMsg := WSMessage{
		Type: "draftState",
		Data: map[string]interface{}{
			"draft":         draft,
			"participants":  participants,
			"picks":         picks,
			"currentPicker": currentPicker, // ADD THIS LINE
		},
	}

	if data, err := json.Marshal(stateMsg); err == nil {
		select {
		case client.Send <- data:
		default:
			log.Printf("Failed to send draft state to client")
		}
	}
}

// Helper function for calculating standings in WebSocket broadcasts
func calculateStandingsForBroadcast(participants []database.DraftParticipant, matches []database.Match) []map[string]interface{} {
	standings := make(map[string]*map[string]interface{})

	// Initialize standings for all participants
	for _, participant := range participants {
		standings[participant.Name] = &map[string]interface{}{
			"teamName":       participant.Name,
			"teamId":         participant.ID,
			"gamesPlayed":    0,
			"wins":           0,
			"draws":          0,
			"losses":         0,
			"points":         0,
			"goalsFor":       0,
			"goalsAgainst":   0,
			"goalDifference": 0,
		}
	}

	// Process matches
	for _, match := range matches {
		homeTeam := standings[match.HomeTeamName]
		awayTeam := standings[match.AwayTeamName]

		if homeTeam == nil || awayTeam == nil {
			continue // Skip if team not found
		}

		// Update games played
		(*homeTeam)["gamesPlayed"] = (*homeTeam)["gamesPlayed"].(int) + 1
		(*awayTeam)["gamesPlayed"] = (*awayTeam)["gamesPlayed"].(int) + 1

		// Update goals
		(*homeTeam)["goalsFor"] = (*homeTeam)["goalsFor"].(int) + match.HomeScore
		(*homeTeam)["goalsAgainst"] = (*homeTeam)["goalsAgainst"].(int) + match.AwayScore
		(*awayTeam)["goalsFor"] = (*awayTeam)["goalsFor"].(int) + match.AwayScore
		(*awayTeam)["goalsAgainst"] = (*awayTeam)["goalsAgainst"].(int) + match.HomeScore

		// Update results and points
		if match.HomeScore > match.AwayScore {
			// Home team wins
			(*homeTeam)["wins"] = (*homeTeam)["wins"].(int) + 1
			(*homeTeam)["points"] = (*homeTeam)["points"].(int) + 3
			(*awayTeam)["losses"] = (*awayTeam)["losses"].(int) + 1
		} else if match.HomeScore < match.AwayScore {
			// Away team wins
			(*awayTeam)["wins"] = (*awayTeam)["wins"].(int) + 1
			(*awayTeam)["points"] = (*awayTeam)["points"].(int) + 3
			(*homeTeam)["losses"] = (*homeTeam)["losses"].(int) + 1
		} else {
			// Draw
			(*homeTeam)["draws"] = (*homeTeam)["draws"].(int) + 1
			(*homeTeam)["points"] = (*homeTeam)["points"].(int) + 1
			(*awayTeam)["draws"] = (*awayTeam)["draws"].(int) + 1
			(*awayTeam)["points"] = (*awayTeam)["points"].(int) + 1
		}

		// Update goal difference
		(*homeTeam)["goalDifference"] = (*homeTeam)["goalsFor"].(int) - (*homeTeam)["goalsAgainst"].(int)
		(*awayTeam)["goalDifference"] = (*awayTeam)["goalsFor"].(int) - (*awayTeam)["goalsAgainst"].(int)
	}

	// Convert to slice and sort by points (desc), then goal difference (desc), then goals for (desc)
	result := make([]map[string]interface{}, 0, len(standings))
	for _, standing := range standings {
		result = append(result, *standing)
	}

	// Sort standings
	for i := 0; i < len(result); i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i]["points"].(int) < result[j]["points"].(int) ||
				(result[i]["points"].(int) == result[j]["points"].(int) && result[i]["goalDifference"].(int) < result[j]["goalDifference"].(int)) ||
				(result[i]["points"].(int) == result[j]["points"].(int) && result[i]["goalDifference"].(int) == result[j]["goalDifference"].(int) && result[i]["goalsFor"].(int) < result[j]["goalsFor"].(int)) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result
}
