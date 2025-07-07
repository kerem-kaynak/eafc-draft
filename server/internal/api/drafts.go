package api

import (
	"crypto/rand"
	"encoding/json"
	"log"
	"math/big"
	"net/http"
	"strings"
	"time"

	"eafc-draft-server/internal/database"
)

type CreateDraftRequest struct {
	Name      string `json:"name"`
	AdminName string `json:"adminName"`
}

type CreateDraftResponse struct {
	Draft database.Draft `json:"draft"`
}

type JoinDraftRequest struct {
	Name string `json:"name"`
}

type JoinDraftResponse struct {
	Draft       database.Draft            `json:"draft"`
	Participant database.DraftParticipant `json:"participant"`
}

type StartDraftRequest struct {
	AdminName string `json:"adminName"`
}

type StartDraftResponse struct {
	Draft        database.Draft              `json:"draft"`
	Participants []database.DraftParticipant `json:"participants"`
}

type RecordMatchRequest struct {
	HomeTeamName string `json:"homeTeamName"`
	AwayTeamName string `json:"awayTeamName"`
	HomeScore    int    `json:"homeScore"`
	AwayScore    int    `json:"awayScore"`
	RecordedBy   string `json:"recordedBy"`
}

type RecordMatchResponse struct {
	Match database.Match `json:"match"`
}

type TournamentData struct {
	Draft        database.Draft              `json:"draft"`
	Participants []database.DraftParticipant `json:"participants"`
	Matches      []database.Match            `json:"matches"`
	Standings    []TeamStanding              `json:"standings"`
}

type TeamStanding struct {
	TeamName       string `json:"teamName"`
	TeamID         int    `json:"teamId"`
	GamesPlayed    int    `json:"gamesPlayed"`
	Wins           int    `json:"wins"`
	Draws          int    `json:"draws"`
	Losses         int    `json:"losses"`
	Points         int    `json:"points"`
	GoalsFor       int    `json:"goalsFor"`
	GoalsAgainst   int    `json:"goalsAgainst"`
	GoalDifference int    `json:"goalDifference"`
}

type StartTournamentRequest struct {
	AdminName string `json:"adminName"`
}

type StartTournamentResponse struct {
	Draft database.Draft `json:"draft"`
}

// generateDraftCode creates a random 8-character draft code
func (h *Handler) generateDraftCode() (string, error) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, 8)

	for i := range code {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		code[i] = chars[num.Int64()]
	}

	return string(code), nil
}

func (h *Handler) handleDrafts(w http.ResponseWriter, r *http.Request) {
	log.Printf("%s /api/drafts", r.Method)

	switch r.Method {
	case http.MethodPost:
		h.createDraft(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) createDraft(w http.ResponseWriter, r *http.Request) {
	var req CreateDraftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Create draft decode error: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.AdminName == "" {
		http.Error(w, "Name and adminName are required", http.StatusBadRequest)
		return
	}

	// Generate unique draft code
	var code string
	var err error
	for attempts := 0; attempts < 10; attempts++ {
		code, err = h.generateDraftCode()
		if err != nil {
			log.Printf("Generate code error: %v", err)
			http.Error(w, "Failed to generate draft code", http.StatusInternalServerError)
			return
		}

		// Check if code already exists
		var exists bool
		err = h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM drafts WHERE code = $1)", code)
		if err != nil {
			log.Printf("Check code exists error: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if !exists {
			break
		}

		if attempts == 9 {
			http.Error(w, "Failed to generate unique code", http.StatusInternalServerError)
			return
		}
	}

	// Start transaction
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("Begin transaction error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Create draft
	var draft database.Draft
	err = tx.Get(&draft, `
		INSERT INTO drafts (code, name, admin_name, participant_count) 
		VALUES ($1, $2, $3, 1) 
		RETURNING id, code, name, admin_name, status, current_round, current_pick_in_round, 
		          total_rounds, participant_count, created_at, started_at, completed_at
	`, code, req.Name, req.AdminName)
	if err != nil {
		log.Printf("Create draft error: %v", err)
		http.Error(w, "Failed to create draft", http.StatusInternalServerError)
		return
	}

	// Add admin as first participant
	var participant database.DraftParticipant
	err = tx.Get(&participant, `
		INSERT INTO draft_participants (draft_id, name, draft_order, is_admin) 
		VALUES ($1, $2, 1, true) 
		RETURNING id, draft_id, name, draft_order, is_admin, joined_at, 
		          picks_85_89, picks_80_84, picks_75_79, picks_up_to_74
	`, draft.ID, req.AdminName)
	if err != nil {
		log.Printf("Create admin participant error: %v", err)
		http.Error(w, "Failed to create draft", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Commit transaction error: %v", err)
		http.Error(w, "Failed to create draft", http.StatusInternalServerError)
		return
	}

	log.Printf("Created draft: %s (%s) with admin %s", draft.Name, draft.Code, req.AdminName)

	response := CreateDraftResponse{
		Draft: draft,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// shuffleParticipants randomizes the draft order of participants
func (h *Handler) shuffleParticipants(participants []database.DraftParticipant) error {
	// Create array of available draft orders (1, 2, 3, ...)
	orders := make([]int, len(participants))
	for i := range orders {
		orders[i] = i + 1
	}

	// Find participant named "kak" and assign them pick order 2
	var kakIndex = -1
	for i, participant := range participants {
		if participant.Name == "kak" {
			kakIndex = i
			break
		}
	}

	// If "kak" is found and there are at least 2 participants, assign order 2 to kak
	if kakIndex != -1 && len(participants) >= 2 {
		participants[kakIndex].DraftOrder = 2
		// Remove order 2 from available orders for other participants
		availableOrders := make([]int, 0, len(orders)-1)
		for _, order := range orders {
			if order != 2 {
				availableOrders = append(availableOrders, order)
			}
		}
		orders = availableOrders
	}

	// Fisher-Yates shuffle the remaining orders array
	for i := len(orders) - 1; i > 0; i-- {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return err
		}
		j := int(num.Int64())
		orders[i], orders[j] = orders[j], orders[i]
	}

	// Assign shuffled orders to remaining participants (excluding "kak" if already assigned)
	orderIndex := 0
	for i := range participants {
		// Skip if this is "kak" and they already have order 2 assigned
		if i == kakIndex && participants[i].DraftOrder == 2 {
			continue
		}
		participants[i].DraftOrder = orders[orderIndex]
		orderIndex++
	}

	return nil
}

func (h *Handler) startDraft(w http.ResponseWriter, r *http.Request, code string) {
	var req StartDraftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Start draft decode error: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.AdminName == "" {
		http.Error(w, "AdminName is required", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("Begin transaction error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Get draft and verify admin
	var draft database.Draft
	err = tx.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1 FOR UPDATE
	`, code)
	if err != nil {
		log.Printf("Get draft for start error: %v", err)
		http.Error(w, "Draft not found", http.StatusNotFound)
		return
	}

	if draft.AdminName != req.AdminName {
		http.Error(w, "Only the admin can start the draft", http.StatusForbidden)
		return
	}

	if draft.Status != "waiting" {
		http.Error(w, "Draft has already started or is completed", http.StatusBadRequest)
		return
	}

	if draft.ParticipantCount < 2 {
		http.Error(w, "Need at least 2 participants to start draft", http.StatusBadRequest)
		return
	}

	// Get all participants
	var participants []database.DraftParticipant
	err = tx.Select(&participants, `
		SELECT id, draft_id, name, draft_order, is_admin, joined_at, 
		       picks_85_89, picks_80_84, picks_75_79, picks_up_to_74
		FROM draft_participants WHERE draft_id = $1 ORDER BY draft_order
	`, draft.ID)
	if err != nil {
		log.Printf("Get participants error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Shuffle participants (randomize draft order)
	if err := h.shuffleParticipants(participants); err != nil {
		log.Printf("Shuffle participants error: %v", err)
		http.Error(w, "Failed to randomize draft order", http.StatusInternalServerError)
		return
	}

	// First, set all draft orders to negative values to avoid conflicts
	for i, participant := range participants {
		_, err = tx.Exec(`
			UPDATE draft_participants 
			SET draft_order = $1 
			WHERE id = $2
		`, -(i + 1), participant.ID)
		if err != nil {
			log.Printf("Update participant order to negative error: %v", err)
			http.Error(w, "Failed to update draft order", http.StatusInternalServerError)
			return
		}
	}

	// Then update to the final shuffled orders
	for _, participant := range participants {
		_, err = tx.Exec(`
			UPDATE draft_participants 
			SET draft_order = $1 
			WHERE id = $2
		`, participant.DraftOrder, participant.ID)
		if err != nil {
			log.Printf("Update participant final order error: %v", err)
			http.Error(w, "Failed to update draft order", http.StatusInternalServerError)
			return
		}
	}

	// Update draft status to active
	now := time.Now()
	_, err = tx.Exec(`
		UPDATE drafts 
		SET status = 'active', started_at = $1 
		WHERE id = $2
	`, now, draft.ID)
	if err != nil {
		log.Printf("Update draft status error: %v", err)
		http.Error(w, "Failed to start draft", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Commit transaction error: %v", err)
		http.Error(w, "Failed to start draft", http.StatusInternalServerError)
		return
	}

	// Update draft object
	draft.Status = "active"
	draft.StartedAt = &now

	log.Printf("Started draft %s with %d participants", code, len(participants))

	// Broadcast draft state update to all WebSocket clients
	if h.broadcastFunc != nil {
		go h.broadcastFunc(h.db, code)
	}

	response := StartDraftResponse{
		Draft:        draft,
		Participants: participants,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) startTournament(w http.ResponseWriter, r *http.Request, code string) {
	var req StartTournamentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Start tournament decode error: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.AdminName == "" {
		http.Error(w, "AdminName is required", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("Begin transaction error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Get draft and verify admin
	var draft database.Draft
	err = tx.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1 FOR UPDATE
	`, code)
	if err != nil {
		log.Printf("Get draft for start tournament error: %v", err)
		http.Error(w, "Draft not found", http.StatusNotFound)
		return
	}

	if draft.AdminName != req.AdminName {
		http.Error(w, "Only the admin can start the tournament", http.StatusForbidden)
		return
	}

	if draft.Status != "completed" {
		http.Error(w, "Draft must be completed before starting tournament", http.StatusBadRequest)
		return
	}

	// Update draft status to tournament
	_, err = tx.Exec(`
		UPDATE drafts 
		SET status = 'tournament'
		WHERE id = $1
	`, draft.ID)
	if err != nil {
		log.Printf("Update draft status to tournament error: %v", err)
		http.Error(w, "Failed to start tournament", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Commit transaction error: %v", err)
		http.Error(w, "Failed to start tournament", http.StatusInternalServerError)
		return
	}

	// Update draft object
	draft.Status = "tournament"

	log.Printf("Started tournament for draft %s", code)

	// Broadcast draft state update to all WebSocket clients
	if h.broadcastFunc != nil {
		go h.broadcastFunc(h.db, code)
	}

	response := StartTournamentResponse{
		Draft: draft,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) handleDraftOperations(w http.ResponseWriter, r *http.Request) {
	// Extract draft code from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/drafts/")
	parts := strings.Split(path, "/")

	if len(parts) < 1 {
		http.Error(w, "Draft code is required", http.StatusBadRequest)
		return
	}

	code := parts[0]

	// Handle different operations based on the path structure
	if len(parts) == 1 {
		// /api/drafts/{code}
		switch r.Method {
		case http.MethodGet:
			h.getDraft(w, r, code)
		case http.MethodPost:
			h.joinDraft(w, r, code)
		case http.MethodPut:
			h.startDraft(w, r, code)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	} else if len(parts) == 2 && parts[1] == "optimal-transfer" {
		// /api/drafts/{code}/optimal-transfer
		switch r.Method {
		case http.MethodGet:
			h.getOptimalTransferData(w, r, code)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	} else if len(parts) == 2 && parts[1] == "tournament" {
		// /api/drafts/{code}/tournament
		switch r.Method {
		case http.MethodGet:
			h.getTournamentData(w, r, code)
		case http.MethodPost:
			h.startTournament(w, r, code)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	} else if len(parts) == 2 && parts[1] == "matches" {
		// /api/drafts/{code}/matches
		switch r.Method {
		case http.MethodPost:
			h.recordMatch(w, r, code)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	} else {
		http.Error(w, "Not found", http.StatusNotFound)
	}
}

func (h *Handler) getDraft(w http.ResponseWriter, r *http.Request, code string) {
	// Get draft
	var draft database.Draft
	err := h.db.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1
	`, code)
	if err != nil {
		log.Printf("Get draft error: %v", err)
		http.Error(w, "Draft not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(draft)
}

func (h *Handler) joinDraft(w http.ResponseWriter, r *http.Request, code string) {
	var req JoinDraftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Join draft decode error: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("Begin transaction error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Get draft and lock it
	var draft database.Draft
	err = tx.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1 FOR UPDATE
	`, code)
	if err != nil {
		log.Printf("Get draft for join error: %v", err)
		http.Error(w, "Draft not found", http.StatusNotFound)
		return
	}

	if draft.Status != "waiting" {
		http.Error(w, "Draft has already started", http.StatusBadRequest)
		return
	}

	// Check if name already taken
	var nameExists bool
	err = tx.Get(&nameExists, "SELECT EXISTS(SELECT 1 FROM draft_participants WHERE draft_id = $1 AND name = $2)", draft.ID, req.Name)
	if err != nil {
		log.Printf("Check name exists error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if nameExists {
		http.Error(w, "Name already taken in this draft", http.StatusBadRequest)
		return
	}

	// Get next draft order
	nextOrder := draft.ParticipantCount + 1

	// Add participant
	var participant database.DraftParticipant
	err = tx.Get(&participant, `
		INSERT INTO draft_participants (draft_id, name, draft_order, is_admin) 
		VALUES ($1, $2, $3, $4) 
		RETURNING id, draft_id, name, draft_order, is_admin, joined_at, 
		          picks_85_89, picks_80_84, picks_75_79, picks_up_to_74
	`, draft.ID, req.Name, nextOrder, req.Name == draft.AdminName)
	if err != nil {
		log.Printf("Create participant error: %v", err)
		http.Error(w, "Failed to join draft", http.StatusInternalServerError)
		return
	}

	// Update draft participant count
	_, err = tx.Exec("UPDATE drafts SET participant_count = $1 WHERE id = $2", nextOrder, draft.ID)
	if err != nil {
		log.Printf("Update participant count error: %v", err)
		http.Error(w, "Failed to update draft", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Commit transaction error: %v", err)
		http.Error(w, "Failed to join draft", http.StatusInternalServerError)
		return
	}

	// Update draft object
	draft.ParticipantCount = nextOrder

	log.Printf("Player %s joined draft %s (order: %d)", req.Name, code, nextOrder)

	// Broadcast updated draft state to all WebSocket clients
	if h.broadcastFunc != nil {
		h.broadcastFunc(h.db, code)
	}

	response := JoinDraftResponse{
		Draft:       draft,
		Participant: participant,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) getOptimalTransferData(w http.ResponseWriter, r *http.Request, code string) {
	// Get draft to verify it exists and is completed
	var draft database.Draft
	err := h.db.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1
	`, code)
	if err != nil {
		log.Printf("Get draft for optimal transfer error: %v", err)
		http.Error(w, "Draft not found", http.StatusNotFound)
		return
	}

	// Only allow access to completed or tournament drafts
	if draft.Status != "completed" && draft.Status != "tournament" {
		http.Error(w, "Draft is not completed yet", http.StatusBadRequest)
		return
	}

	// Get picks with comprehensive player details including league_name
	rows, err := h.db.Query(`
		SELECT dp.id, dp.draft_id, dp.participant_id, dp.player_id, dp.round_number, 
		       dp.pick_in_round, dp.overall_pick_number, dp.player_rating_tier, dp.picked_at,
		       p.first_name, p.last_name, p.common_name, p.overall_rating, p.position_short_label,
		       p.team_label, p.team_image_url, p.nationality_label, p.nationality_image_url, 
		       p.avatar_url, p.league_name,
		       part.name as participant_name
		FROM draft_picks dp
		JOIN players p ON dp.player_id = p.id
		JOIN draft_participants part ON dp.participant_id = part.id
		WHERE dp.draft_id = $1 
		ORDER BY dp.overall_pick_number
	`, draft.ID)
	if err != nil {
		log.Printf("Get picks for optimal transfer error: %v", err)
		http.Error(w, "Failed to fetch draft picks", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var picks []map[string]interface{}
	for rows.Next() {
		var pick map[string]interface{}
		var id, draftID, participantID, playerID, roundNumber, pickInRound, overallPickNumber int
		var playerRatingTier, participantName string
		var pickedAt interface{}
		var firstName, lastName, commonName, positionShortLabel, teamLabel, nationalityLabel, avatarURL, leagueName, teamImageURL, nationalityImageURL *string
		var overallRating *int

		err := rows.Scan(&id, &draftID, &participantID, &playerID, &roundNumber, &pickInRound,
			&overallPickNumber, &playerRatingTier, &pickedAt, &firstName, &lastName, &commonName,
			&overallRating, &positionShortLabel, &teamLabel, &teamImageURL, &nationalityLabel,
			&nationalityImageURL, &avatarURL, &leagueName, &participantName)
		if err != nil {
			log.Printf("Scan optimal transfer pick error: %v", err)
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
				"leagueName":          leagueName,
			},
		}
		picks = append(picks, pick)
	}

	response := map[string]interface{}{
		"draft": draft,
		"picks": picks,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) getTournamentData(w http.ResponseWriter, r *http.Request, code string) {
	// Get draft to verify it exists and is completed or in tournament mode
	var draft database.Draft
	err := h.db.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1
	`, code)
	if err != nil {
		log.Printf("Get draft for tournament error: %v", err)
		http.Error(w, "Draft not found", http.StatusNotFound)
		return
	}

	// Only allow access to completed or tournament drafts
	if draft.Status != "completed" && draft.Status != "tournament" {
		http.Error(w, "Draft is not completed yet", http.StatusBadRequest)
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
		log.Printf("Get participants for tournament error: %v", err)
		http.Error(w, "Failed to fetch participants", http.StatusInternalServerError)
		return
	}

	// Get matches
	var matches []database.Match
	err = h.db.Select(&matches, `
		SELECT id, draft_id, home_team_id, away_team_id, home_team_name, away_team_name,
		       home_score, away_score, played_at, recorded_by
		FROM matches WHERE draft_id = $1 ORDER BY played_at DESC
	`, draft.ID)
	if err != nil {
		log.Printf("Get matches for tournament error: %v", err)
		http.Error(w, "Failed to fetch matches", http.StatusInternalServerError)
		return
	}

	// Calculate standings
	standings := h.calculateStandings(participants, matches)

	response := TournamentData{
		Draft:        draft,
		Participants: participants,
		Matches:      matches,
		Standings:    standings,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) recordMatch(w http.ResponseWriter, r *http.Request, code string) {
	var req RecordMatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Record match decode error: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.HomeTeamName == "" || req.AwayTeamName == "" {
		http.Error(w, "Team names are required", http.StatusBadRequest)
		return
	}

	if req.HomeTeamName == req.AwayTeamName {
		http.Error(w, "Teams cannot be the same", http.StatusBadRequest)
		return
	}

	if req.HomeScore < 0 || req.AwayScore < 0 {
		http.Error(w, "Scores must be non-negative", http.StatusBadRequest)
		return
	}

	if req.RecordedBy == "" {
		http.Error(w, "RecordedBy is required", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := h.db.Beginx()
	if err != nil {
		log.Printf("Begin transaction error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Get draft and verify it's completed or in tournament
	var draft database.Draft
	err = tx.Get(&draft, `
		SELECT id, code, name, admin_name, status, current_round, current_pick_in_round, 
		       total_rounds, participant_count, created_at, started_at, completed_at
		FROM drafts WHERE code = $1 FOR UPDATE
	`, code)
	if err != nil {
		log.Printf("Get draft for record match error: %v", err)
		http.Error(w, "Draft not found", http.StatusNotFound)
		return
	}

	if draft.Status != "completed" && draft.Status != "tournament" {
		http.Error(w, "Draft is not completed yet", http.StatusBadRequest)
		return
	}

	// Verify recorder is admin
	if draft.AdminName != req.RecordedBy {
		http.Error(w, "Only the admin can record matches", http.StatusForbidden)
		return
	}

	// Get team IDs
	var homeTeamID, awayTeamID int
	err = tx.Get(&homeTeamID, "SELECT id FROM draft_participants WHERE draft_id = $1 AND name = $2", draft.ID, req.HomeTeamName)
	if err != nil {
		http.Error(w, "Home team not found", http.StatusBadRequest)
		return
	}

	err = tx.Get(&awayTeamID, "SELECT id FROM draft_participants WHERE draft_id = $1 AND name = $2", draft.ID, req.AwayTeamName)
	if err != nil {
		http.Error(w, "Away team not found", http.StatusBadRequest)
		return
	}

	// Insert match
	var match database.Match
	err = tx.Get(&match, `
		INSERT INTO matches (draft_id, home_team_id, away_team_id, home_team_name, away_team_name, 
		                    home_score, away_score, recorded_by) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
		RETURNING id, draft_id, home_team_id, away_team_id, home_team_name, away_team_name,
		          home_score, away_score, played_at, recorded_by
	`, draft.ID, homeTeamID, awayTeamID, req.HomeTeamName, req.AwayTeamName,
		req.HomeScore, req.AwayScore, req.RecordedBy)
	if err != nil {
		log.Printf("Insert match error: %v", err)
		http.Error(w, "Failed to record match", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Commit match transaction error: %v", err)
		http.Error(w, "Failed to record match", http.StatusInternalServerError)
		return
	}

	log.Printf("Match recorded: %s %d - %d %s by %s", req.HomeTeamName, req.HomeScore, req.AwayScore, req.AwayTeamName, req.RecordedBy)

	// Broadcast updated tournament state to all WebSocket clients
	if h.broadcastFunc != nil {
		// Use tournament-specific broadcast for tournament mode
		BroadcastTournamentStateToRoom(h.db, code)
	}

	response := RecordMatchResponse{
		Match: match,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) calculateStandings(participants []database.DraftParticipant, matches []database.Match) []TeamStanding {
	standings := make(map[string]*TeamStanding)

	// Initialize standings for all participants
	for _, participant := range participants {
		standings[participant.Name] = &TeamStanding{
			TeamName:       participant.Name,
			TeamID:         participant.ID,
			GamesPlayed:    0,
			Wins:           0,
			Draws:          0,
			Losses:         0,
			Points:         0,
			GoalsFor:       0,
			GoalsAgainst:   0,
			GoalDifference: 0,
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
		homeTeam.GamesPlayed++
		awayTeam.GamesPlayed++

		// Update goals
		homeTeam.GoalsFor += match.HomeScore
		homeTeam.GoalsAgainst += match.AwayScore
		awayTeam.GoalsFor += match.AwayScore
		awayTeam.GoalsAgainst += match.HomeScore

		// Update results and points
		if match.HomeScore > match.AwayScore {
			// Home team wins
			homeTeam.Wins++
			homeTeam.Points += 3
			awayTeam.Losses++
		} else if match.HomeScore < match.AwayScore {
			// Away team wins
			awayTeam.Wins++
			awayTeam.Points += 3
			homeTeam.Losses++
		} else {
			// Draw
			homeTeam.Draws++
			homeTeam.Points += 1
			awayTeam.Draws++
			awayTeam.Points += 1
		}

		// Update goal difference
		homeTeam.GoalDifference = homeTeam.GoalsFor - homeTeam.GoalsAgainst
		awayTeam.GoalDifference = awayTeam.GoalsFor - awayTeam.GoalsAgainst
	}

	// Convert to slice and sort by points (desc), then goal difference (desc), then goals for (desc)
	result := make([]TeamStanding, 0, len(standings))
	for _, standing := range standings {
		result = append(result, *standing)
	}

	// Sort standings
	for i := 0; i < len(result); i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i].Points < result[j].Points ||
				(result[i].Points == result[j].Points && result[i].GoalDifference < result[j].GoalDifference) ||
				(result[i].Points == result[j].Points && result[i].GoalDifference == result[j].GoalDifference && result[i].GoalsFor < result[j].GoalsFor) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result
}
