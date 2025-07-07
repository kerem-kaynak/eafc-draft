package database

import (
	"time"
)

// Draft represents a draft from the database
type Draft struct {
	ID                 int        `db:"id" json:"id"`
	Code               string     `db:"code" json:"code"`
	Name               string     `db:"name" json:"name"`
	AdminName          string     `db:"admin_name" json:"adminName"`
	Status             string     `db:"status" json:"status"`
	CurrentRound       int        `db:"current_round" json:"currentRound"`
	CurrentPickInRound int        `db:"current_pick_in_round" json:"currentPickInRound"`
	TotalRounds        int        `db:"total_rounds" json:"totalRounds"`
	ParticipantCount   int        `db:"participant_count" json:"participantCount"`
	CreatedAt          *time.Time `db:"created_at" json:"createdAt"`
	StartedAt          *time.Time `db:"started_at" json:"startedAt"`
	CompletedAt        *time.Time `db:"completed_at" json:"completedAt"`
}

// DraftParticipant represents a participant in a draft
type DraftParticipant struct {
	ID          int        `db:"id" json:"id"`
	DraftID     int        `db:"draft_id" json:"draftId"`
	Name        string     `db:"name" json:"name"`
	DraftOrder  int        `db:"draft_order" json:"draftOrder"`
	IsAdmin     bool       `db:"is_admin" json:"isAdmin"`
	JoinedAt    *time.Time `db:"joined_at" json:"joinedAt"`
	Picks8589   int        `db:"picks_85_89" json:"picks8589"`
	Picks8084   int        `db:"picks_80_84" json:"picks8084"`
	Picks7579   int        `db:"picks_75_79" json:"picks7579"`
	PicksUpTo74 int        `db:"picks_up_to_74" json:"picksUpTo74"`
}

// DraftPick represents a pick made in a draft
type DraftPick struct {
	ID                int        `db:"id" json:"id"`
	DraftID           int        `db:"draft_id" json:"draftId"`
	ParticipantID     int        `db:"participant_id" json:"participantId"`
	PlayerID          int        `db:"player_id" json:"playerId"`
	RoundNumber       int        `db:"round_number" json:"roundNumber"`
	PickInRound       int        `db:"pick_in_round" json:"pickInRound"`
	OverallPickNumber int        `db:"overall_pick_number" json:"overallPickNumber"`
	PlayerRatingTier  string     `db:"player_rating_tier" json:"playerRatingTier"`
	PickedAt          *time.Time `db:"picked_at" json:"pickedAt"`
}

// Match represents a match played in the tournament phase
type Match struct {
	ID           int        `db:"id" json:"id"`
	DraftID      int        `db:"draft_id" json:"draftId"`
	HomeTeamID   int        `db:"home_team_id" json:"homeTeamId"`
	AwayTeamID   int        `db:"away_team_id" json:"awayTeamId"`
	HomeTeamName string     `db:"home_team_name" json:"homeTeamName"`
	AwayTeamName string     `db:"away_team_name" json:"awayTeamName"`
	HomeScore    int        `db:"home_score" json:"homeScore"`
	AwayScore    int        `db:"away_score" json:"awayScore"`
	PlayedAt     *time.Time `db:"played_at" json:"playedAt"`
	RecordedBy   string     `db:"recorded_by" json:"recordedBy"`
}
