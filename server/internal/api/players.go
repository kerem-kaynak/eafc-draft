package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"eafc-draft-server/internal/database"
)

type GetPlayersResponse struct {
	Players    []database.Player `json:"players"`
	Pagination *Pagination       `json:"pagination"`
}

type Pagination struct {
	Page        int  `json:"page"`
	Limit       int  `json:"limit"`
	TotalItems  int  `json:"totalItems"`
	TotalPages  int  `json:"totalPages"`
	HasNext     bool `json:"hasNext"`
	HasPrevious bool `json:"hasPrevious"`
}

type RangeParam struct {
	Min *int
	Max *int
}

// GetPlayerEnumsResponse represents the response for player enum values
type GetPlayerEnumsResponse struct {
	Nationalities        []string              `json:"nationalities"`
	Leagues              []string              `json:"leagues"`
	Clubs                []string              `json:"clubs"`
	Positions            []string              `json:"positions"`
	PlayerAbilities      []string              `json:"playerAbilities"`
	PreferredFootOptions []PreferredFootOption `json:"preferredFootOptions"`
}

type PreferredFootOption struct {
	Value int    `json:"value"`
	Label string `json:"label"`
}

func (h *Handler) parseRangeParam(value string) RangeParam {
	var result RangeParam

	parts := strings.Split(value, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)

		if strings.HasPrefix(part, "gte:") {
			if val, err := strconv.Atoi(strings.TrimPrefix(part, "gte:")); err == nil {
				result.Min = &val
			}
		} else if strings.HasPrefix(part, "lte:") {
			if val, err := strconv.Atoi(strings.TrimPrefix(part, "lte:")); err == nil {
				result.Max = &val
			}
		} else if strings.HasPrefix(part, "gt:") {
			if val, err := strconv.Atoi(strings.TrimPrefix(part, "gt:")); err == nil {
				gtVal := val + 1
				result.Min = &gtVal
			}
		} else if strings.HasPrefix(part, "lt:") {
			if val, err := strconv.Atoi(strings.TrimPrefix(part, "lt:")); err == nil {
				ltVal := val - 1
				result.Max = &ltVal
			}
		} else {
			// Exact match
			if val, err := strconv.Atoi(part); err == nil {
				result.Min = &val
				result.Max = &val
			}
		}
	}

	return result
}

func (h *Handler) getPlayers(w http.ResponseWriter, r *http.Request) {
	log.Printf("GET /api/players - Query params: %v", r.URL.Query())

	if r.Method != http.MethodGet {
		log.Printf("Method not allowed: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse pagination parameters
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20 // Default limit
	}

	offset := (page - 1) * limit

	// Parse sorting parameters
	sortBy := r.URL.Query().Get("sort_by")
	sortDirection := r.URL.Query().Get("sort_direction")

	// Validate sortBy column (whitelist to prevent SQL injection)
	validColumns := map[string]bool{
		"id": true, "overall_rating": true, "first_name": true, "last_name": true, "common_name": true,
		"skill_moves": true, "weak_foot": true, "preferred_foot": true, "league_name": true,
		"nationality_label": true, "team_label": true, "position_short_label": true,
		"stat_acceleration": true, "stat_agility": true, "stat_jumping": true, "stat_stamina": true,
		"stat_strength": true, "stat_aggression": true, "stat_balance": true, "stat_ball_control": true,
		"stat_composure": true, "stat_crossing": true, "stat_curve": true, "stat_def": true,
		"stat_defensive_awareness": true, "stat_dri": true, "stat_dribbling": true, "stat_finishing": true,
		"stat_free_kick_accuracy": true, "stat_gk_diving": true, "stat_gk_handling": true, "stat_gk_kicking": true,
		"stat_gk_positioning": true, "stat_gk_reflexes": true, "stat_heading_accuracy": true,
		"stat_interceptions": true, "stat_long_passing": true, "stat_long_shots": true, "stat_pac": true,
		"stat_pas": true, "stat_penalties": true, "stat_phy": true, "stat_positioning": true,
		"stat_reactions": true, "stat_sho": true, "stat_short_passing": true, "stat_shot_power": true,
		"stat_sliding_tackle": true, "stat_sprint_speed": true, "stat_standing_tackle": true,
		"stat_vision": true, "stat_volleys": true,
	}

	// Default sorting
	if sortBy == "" || !validColumns[sortBy] {
		sortBy = "overall_rating"
	}
	if sortDirection == "" {
		sortDirection = "desc"
	}

	// Validate sort direction
	if sortDirection != "asc" && sortDirection != "desc" {
		sortDirection = "desc"
	}

	// Build ORDER BY clause with consistent secondary sort
	orderClause := fmt.Sprintf("ORDER BY %s %s, id ASC", sortBy, strings.ToUpper(sortDirection))

	// Get number columns from the model
	numberColumns := database.GetNumberColumns()

	var conditions []string
	var args []interface{}
	argIndex := 1

	// Define array parameters that should use OR conditions with exact matches
	arrayParams := map[string]bool{
		"position_short_label":    true,
		"team_label":              true,
		"league_name":             true,
		"nationality_label":       true,
		"player_abilities_labels": true,
	}

	for key, values := range r.URL.Query() {
		if len(values) > 0 && values[0] != "" && key != "page" && key != "limit" && key != "exclude_gk" && key != "sort_by" && key != "sort_direction" {
			value := values[0]

			if key == "name" {
				// Special name search with accent-insensitive matching
				// Check individual fields AND concatenated full name
				conditions = append(conditions, fmt.Sprintf(`(
					unaccent(COALESCE(first_name, '')) ILIKE unaccent($%d) OR 
					unaccent(COALESCE(last_name, '')) ILIKE unaccent($%d) OR 
					unaccent(COALESCE(common_name, '')) ILIKE unaccent($%d) OR
					unaccent(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) ILIKE unaccent($%d) OR
					unaccent(COALESCE(common_name, '') || ' ' || COALESCE(last_name, '')) ILIKE unaccent($%d)
				)`, argIndex, argIndex, argIndex, argIndex, argIndex))
				args = append(args, "%"+value+"%")
				argIndex++

			} else if numberColumns[key] {
				// Handle special case for ID with 'in:' syntax
				if key == "id" && strings.HasPrefix(value, "in:") {
					// Extract IDs from "in:1,2,3" format
					idsString := strings.TrimPrefix(value, "in:")
					idStrings := strings.Split(idsString, ",")
					var ids []int

					for _, idStr := range idStrings {
						idStr = strings.TrimSpace(idStr)
						if id, err := strconv.Atoi(idStr); err == nil {
							ids = append(ids, id)
						}
					}

					if len(ids) > 0 {
						// Create IN clause with proper parameterization
						placeholders := make([]string, len(ids))
						for i, id := range ids {
							placeholders[i] = "$" + strconv.Itoa(argIndex)
							args = append(args, id)
							argIndex++
						}
						conditions = append(conditions, fmt.Sprintf("id IN (%s)", strings.Join(placeholders, ",")))
					}
				} else {
					// Handle range filtering for numbers
					rangeParam := h.parseRangeParam(value)

					if rangeParam.Min != nil && rangeParam.Max != nil && *rangeParam.Min == *rangeParam.Max {
						// Exact match
						conditions = append(conditions, fmt.Sprintf("%s = $%d", key, argIndex))
						args = append(args, *rangeParam.Min)
						argIndex++
					} else {
						// Range filtering
						if rangeParam.Min != nil {
							conditions = append(conditions, fmt.Sprintf("%s >= $%d", key, argIndex))
							args = append(args, *rangeParam.Min)
							argIndex++
						}
						if rangeParam.Max != nil {
							conditions = append(conditions, fmt.Sprintf("%s <= $%d", key, argIndex))
							args = append(args, *rangeParam.Max)
							argIndex++
						}
					}
				}
			} else if arrayParams[key] {
				// Handle array parameters with OR conditions
				arrayValues := strings.Split(value, ",")
				if len(arrayValues) > 0 {
					var orConditions []string

					for _, arrayValue := range arrayValues {
						arrayValue = strings.TrimSpace(arrayValue)
						if arrayValue != "" {
							if key == "position_short_label" {
								// For positions, check both main position and alternate positions
								orConditions = append(orConditions, fmt.Sprintf("(position_short_label = $%d OR alternate_positions LIKE $%d)", argIndex, argIndex+1))
								args = append(args, arrayValue, "%"+arrayValue+"%")
								argIndex += 2
							} else if key == "player_abilities_labels" {
								// For player abilities, check if the ability exists in the pipe-separated list
								orConditions = append(orConditions, fmt.Sprintf("player_abilities_labels LIKE $%d", argIndex))
								args = append(args, "%"+arrayValue+"%")
								argIndex++
							} else {
								// For other array params, exact match
								orConditions = append(orConditions, fmt.Sprintf("%s = $%d", key, argIndex))
								args = append(args, arrayValue)
								argIndex++
							}
						}
					}

					if len(orConditions) > 0 {
						conditions = append(conditions, "("+strings.Join(orConditions, " OR ")+")")
					}
				}
			} else {
				// Fuzzy matching for text columns with accent handling
				conditions = append(conditions, fmt.Sprintf("unaccent(%s) ILIKE unaccent($%d)", key, argIndex))
				args = append(args, "%"+value+"%")
				argIndex++
			}
		}
	}

	baseQuery := "FROM players"
	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// Get total count
	countQuery := "SELECT COUNT(*) " + baseQuery + whereClause
	log.Printf("Count query: %s, args: %v", countQuery, args)
	var totalCount int
	err := h.db.Get(&totalCount, countQuery, args...)
	if err != nil {
		log.Printf("Count query error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	log.Printf("Total count: %d", totalCount)

	// Get paginated results
	query := "SELECT * " + baseQuery + whereClause + " " + orderClause + " LIMIT $" + strconv.Itoa(argIndex) + " OFFSET $" + strconv.Itoa(argIndex+1)
	args = append(args, limit, offset)
	log.Printf("Main query: %s, args: %v", query, args)

	var players []database.Player
	err = h.db.Select(&players, query, args...)
	if err != nil {
		log.Printf("Main query error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	log.Printf("Found %d players", len(players))

	// Calculate pagination info
	totalPages := (totalCount + limit - 1) / limit
	hasNext := page < totalPages
	hasPrevious := page > 1

	response := GetPlayersResponse{
		Players: players,
		Pagination: &Pagination{
			Page:        page,
			Limit:       limit,
			TotalItems:  totalCount,
			TotalPages:  totalPages,
			HasNext:     hasNext,
			HasPrevious: hasPrevious,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) searchPlayers(w http.ResponseWriter, r *http.Request) {
	log.Printf("GET /api/players/search - Query params: %v", r.URL.Query())

	if r.Method != http.MethodGet {
		log.Printf("Method not allowed: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		log.Printf("Missing search query parameter")
		http.Error(w, "Missing search query parameter 'q'", http.StatusBadRequest)
		return
	}
	log.Printf("Search query: %s", query)

	// Parse pagination
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit

	// Use ILIKE-based search for better partial matching
	// This handles partial names much better than full-text search
	searchPattern := "%" + query + "%"

	searchQuery := `
		SELECT *
		FROM players 
		WHERE (
			unaccent(COALESCE(common_name, '')) ILIKE unaccent($1) OR
			unaccent(COALESCE(first_name, '')) ILIKE unaccent($1) OR  
			unaccent(COALESCE(last_name, '')) ILIKE unaccent($1) OR
			unaccent(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) ILIKE unaccent($1)
		)
		ORDER BY overall_rating DESC, id ASC
		LIMIT $2 OFFSET $3
	`

	countQuery := `
		SELECT COUNT(*) 
		FROM players 
		WHERE (
			unaccent(COALESCE(common_name, '')) ILIKE unaccent($1) OR
			unaccent(COALESCE(first_name, '')) ILIKE unaccent($1) OR  
			unaccent(COALESCE(last_name, '')) ILIKE unaccent($1) OR
			unaccent(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) ILIKE unaccent($1)
		)
	`

	// Get total count
	log.Printf("Count query: %s, args: [%s]", countQuery, searchPattern)
	var totalCount int
	err := h.db.Get(&totalCount, countQuery, searchPattern)
	if err != nil {
		log.Printf("Count query error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	log.Printf("Search total count: %d", totalCount)

	// Get search results
	log.Printf("Search query: %s, args: [%s, %d, %d]", searchQuery, searchPattern, limit, offset)
	var players []database.Player
	err = h.db.Select(&players, searchQuery, searchPattern, limit, offset)
	if err != nil {
		log.Printf("Search query error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	log.Printf("Found %d search results", len(players))

	// Calculate pagination
	totalPages := (totalCount + limit - 1) / limit
	hasNext := page < totalPages
	hasPrevious := page > 1

	response := GetPlayersResponse{
		Players: players,
		Pagination: &Pagination{
			Page:        page,
			Limit:       limit,
			TotalItems:  totalCount,
			TotalPages:  totalPages,
			HasNext:     hasNext,
			HasPrevious: hasPrevious,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) getPlayerEnums(w http.ResponseWriter, r *http.Request) {
	log.Printf("GET /api/players/enums")

	if r.Method != http.MethodGet {
		log.Printf("Method not allowed: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get distinct nationalities
	var nationalities []string
	err := h.db.Select(&nationalities, "SELECT DISTINCT nationality_label FROM players WHERE nationality_label IS NOT NULL ORDER BY nationality_label")
	if err != nil {
		log.Printf("Error fetching nationalities: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Get distinct leagues
	var leagues []string
	err = h.db.Select(&leagues, "SELECT DISTINCT league_name FROM players WHERE league_name IS NOT NULL ORDER BY league_name")
	if err != nil {
		log.Printf("Error fetching leagues: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Get distinct clubs
	var clubs []string
	err = h.db.Select(&clubs, "SELECT DISTINCT team_label FROM players WHERE team_label IS NOT NULL ORDER BY team_label")
	if err != nil {
		log.Printf("Error fetching clubs: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Get distinct positions (both main and alternate)
	var mainPositions []string
	err = h.db.Select(&mainPositions, "SELECT DISTINCT position_short_label FROM players WHERE position_short_label IS NOT NULL ORDER BY position_short_label")
	if err != nil {
		log.Printf("Error fetching main positions: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	var alternatePositionsData []string
	err = h.db.Select(&alternatePositionsData, "SELECT DISTINCT alternate_positions FROM players WHERE alternate_positions IS NOT NULL AND alternate_positions != ''")
	if err != nil {
		log.Printf("Error fetching alternate positions: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Parse pipe-separated alternate positions
	positionsSet := make(map[string]bool)
	for _, pos := range mainPositions {
		positionsSet[pos] = true
	}
	for _, altPos := range alternatePositionsData {
		positions := strings.Split(altPos, "|")
		for _, pos := range positions {
			pos = strings.TrimSpace(pos)
			if pos != "" {
				positionsSet[pos] = true
			}
		}
	}

	var allPositions []string
	for pos := range positionsSet {
		allPositions = append(allPositions, pos)
	}
	sort.Strings(allPositions)

	// Get distinct player abilities
	var playerAbilitiesData []string
	err = h.db.Select(&playerAbilitiesData, "SELECT DISTINCT player_abilities_labels FROM players WHERE player_abilities_labels IS NOT NULL AND player_abilities_labels != ''")
	if err != nil {
		log.Printf("Error fetching player abilities: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Parse pipe-separated player abilities
	abilitiesSet := make(map[string]bool)
	for _, abilities := range playerAbilitiesData {
		abilityList := strings.Split(abilities, "|")
		for _, ability := range abilityList {
			ability = strings.TrimSpace(ability)
			if ability != "" {
				abilitiesSet[ability] = true
			}
		}
	}

	var allAbilities []string
	for ability := range abilitiesSet {
		allAbilities = append(allAbilities, ability)
	}
	sort.Strings(allAbilities)

	// Preferred foot options
	preferredFootOptions := []PreferredFootOption{
		{Value: 1, Label: "Right"},
		{Value: 2, Label: "Left"},
	}

	response := GetPlayerEnumsResponse{
		Nationalities:        nationalities,
		Leagues:              leagues,
		Clubs:                clubs,
		Positions:            allPositions,
		PlayerAbilities:      allAbilities,
		PreferredFootOptions: preferredFootOptions,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
