package database

import (
	"reflect"
)

// Player represents a player from the database
type Player struct {
	ID                    int     `db:"id" json:"id"`
	OverallRating         *int    `db:"overall_rating" json:"overallRating"`
	FirstName             *string `db:"first_name" json:"firstName"`
	LastName              *string `db:"last_name" json:"lastName"`
	CommonName            *string `db:"common_name" json:"commonName"`
	SkillMoves            *int    `db:"skill_moves" json:"skillMoves"`
	WeakFoot              *int    `db:"weak_foot" json:"weakFoot"`
	PreferredFoot         *int    `db:"preferred_foot" json:"preferredFoot"`
	LeagueName            *string `db:"league_name" json:"leagueName"`
	AvatarURL             *string `db:"avatar_url" json:"avatarUrl"`
	ShieldURL             *string `db:"shield_url" json:"shieldUrl"`
	AlternatePositions    *string `db:"alternate_positions" json:"alternatePositions"`
	PlayerAbilitiesLabels *string `db:"player_abilities_labels" json:"playerAbilitiesLabels"`
	PlayerAbilitiesImages *string `db:"player_abilities_images" json:"playerAbilitiesImages"`
	NationalityLabel      *string `db:"nationality_label" json:"nationalityLabel"`
	NationalityImageURL   *string `db:"nationality_image_url" json:"nationalityImageUrl"`
	TeamLabel             *string `db:"team_label" json:"teamLabel"`
	TeamImageURL          *string `db:"team_image_url" json:"teamImageUrl"`
	PositionShortLabel    *string `db:"position_short_label" json:"positionShortLabel"`

	// Stats
	StatAcceleration       *int `db:"stat_acceleration" json:"statAcceleration"`
	StatAgility            *int `db:"stat_agility" json:"statAgility"`
	StatJumping            *int `db:"stat_jumping" json:"statJumping"`
	StatStamina            *int `db:"stat_stamina" json:"statStamina"`
	StatStrength           *int `db:"stat_strength" json:"statStrength"`
	StatAggression         *int `db:"stat_aggression" json:"statAggression"`
	StatBalance            *int `db:"stat_balance" json:"statBalance"`
	StatBallControl        *int `db:"stat_ball_control" json:"statBallControl"`
	StatComposure          *int `db:"stat_composure" json:"statComposure"`
	StatCrossing           *int `db:"stat_crossing" json:"statCrossing"`
	StatCurve              *int `db:"stat_curve" json:"statCurve"`
	StatDef                *int `db:"stat_def" json:"statDef"`
	StatDefensiveAwareness *int `db:"stat_defensive_awareness" json:"statDefensiveAwareness"`
	StatDri                *int `db:"stat_dri" json:"statDri"`
	StatDribbling          *int `db:"stat_dribbling" json:"statDribbling"`
	StatFinishing          *int `db:"stat_finishing" json:"statFinishing"`
	StatFreeKickAccuracy   *int `db:"stat_free_kick_accuracy" json:"statFreeKickAccuracy"`
	StatGkDiving           *int `db:"stat_gk_diving" json:"statGkDiving"`
	StatGkHandling         *int `db:"stat_gk_handling" json:"statGkHandling"`
	StatGkKicking          *int `db:"stat_gk_kicking" json:"statGkKicking"`
	StatGkPositioning      *int `db:"stat_gk_positioning" json:"statGkPositioning"`
	StatGkReflexes         *int `db:"stat_gk_reflexes" json:"statGkReflexes"`
	StatHeadingAccuracy    *int `db:"stat_heading_accuracy" json:"statHeadingAccuracy"`
	StatInterceptions      *int `db:"stat_interceptions" json:"statInterceptions"`
	StatLongPassing        *int `db:"stat_long_passing" json:"statLongPassing"`
	StatLongShots          *int `db:"stat_long_shots" json:"statLongShots"`
	StatPac                *int `db:"stat_pac" json:"statPac"`
	StatPas                *int `db:"stat_pas" json:"statPas"`
	StatPenalties          *int `db:"stat_penalties" json:"statPenalties"`
	StatPhy                *int `db:"stat_phy" json:"statPhy"`
	StatPositioning        *int `db:"stat_positioning" json:"statPositioning"`
	StatReactions          *int `db:"stat_reactions" json:"statReactions"`
	StatSho                *int `db:"stat_sho" json:"statSho"`
	StatShortPassing       *int `db:"stat_short_passing" json:"statShortPassing"`
	StatShotPower          *int `db:"stat_shot_power" json:"statShotPower"`
	StatSlidingTackle      *int `db:"stat_sliding_tackle" json:"statSlidingTackle"`
	StatSprintSpeed        *int `db:"stat_sprint_speed" json:"statSprintSpeed"`
	StatStandingTackle     *int `db:"stat_standing_tackle" json:"statStandingTackle"`
	StatVision             *int `db:"stat_vision" json:"statVision"`
	StatVolleys            *int `db:"stat_volleys" json:"statVolleys"`

	// Search vector for full-text search
	SearchVector *string  `db:"search_vector" json:"-"`
	Rank         *float64 `db:"rank" json:"-"`
}

// GetNumberColumns returns a map of column names that are integer types
func GetNumberColumns() map[string]bool {
	numberColumns := make(map[string]bool)

	t := reflect.TypeOf(Player{})
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		dbTag := field.Tag.Get("db")

		if dbTag != "" {
			// Check if field type is int or *int
			fieldType := field.Type
			if fieldType == reflect.TypeOf(int(0)) || fieldType == reflect.TypeOf((*int)(nil)) {
				numberColumns[dbTag] = true
			}
		}
	}

	return numberColumns
}
