const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

// Base Types
export interface Draft {
  id: string
  code: string
  name: string
  adminName: string
  status: 'waiting' | 'active' | 'completed' | 'tournament'
  currentRound: number
  currentPickInRound: number
  participantCount: number
  totalRounds: number
}

export interface Participant {
  id: string
  name: string
  draftOrder: number
  isAdmin: boolean
  picks8589?: number
  picks8084?: number
  picks7579?: number
  picksUpTo74?: number
}

export interface Player {
  id: number
  firstName?: string
  lastName?: string
  commonName?: string
  overallRating?: number
  positionShortLabel?: string
  teamLabel?: string
  teamImageUrl?: string
  nationalityLabel?: string
  nationalityImageUrl?: string
  avatarUrl?: string
  shieldUrl?: string
  leagueName?: string
  skillMoves?: number
  weakFoot?: number
  preferredFoot?: number
  alternatePositions?: string
  playerAbilitiesLabels?: string
  playerAbilitiesImages?: string
  age?: number
  heightCm?: number
  weightKg?: number
  potential?: number
  
  // Stats
  statAcceleration?: number
  statAgility?: number
  statJumping?: number
  statStamina?: number  
  statStrength?: number
  statAggression?: number
  statBalance?: number
  statBallControl?: number
  statComposure?: number
  statCrossing?: number
  statCurve?: number
  statDef?: number
  statDefensiveAwareness?: number
  statDri?: number
  statDribbling?: number
  statFinishing?: number
  statFreeKickAccuracy?: number
  statGkDiving?: number
  statGkHandling?: number
  statGkKicking?: number
  statGkPositioning?: number
  statGkReflexes?: number
  statHeadingAccuracy?: number
  statInterceptions?: number
  statLongPassing?: number
  statLongShots?: number
  statPac?: number
  statPas?: number
  statPenalties?: number
  statPhy?: number
  statPositioning?: number
  statReactions?: number
  statSho?: number
  statShortPassing?: number
  statShotPower?: number
  statSlidingTackle?: number
  statSprintSpeed?: number
  statStandingTackle?: number
  statVision?: number
  statVolleys?: number
}

export interface Pick {
  id: string
  overallPickNumber: number
  roundNumber: number
  pickInRound: number
  participantName: string
  player: Player
}

export interface TeamStanding {
  teamName: string
  teamId: number
  gamesPlayed: number
  wins: number
  draws: number
  losses: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export interface Match {
  id: number
  homeTeamName: string
  awayTeamName: string
  homeScore: number
  awayScore: number
  playedAt: string
}

// Request Types
export interface CreateDraftRequest {
  name: string
  adminName: string
}

export interface JoinDraftRequest {
  name: string
}

export interface StartDraftRequest {
  adminName: string
}

export interface RecordMatchRequest {
  homeTeamName: string
  awayTeamName: string
  homeScore: number
  awayScore: number
  recordedBy: string
}

export interface StartTournamentRequest {
  adminName: string
}

// Response Types
export interface CreateDraftResponse {
  draft: Draft
}

export interface JoinDraftResponse {
  message: string
}

export interface StartDraftResponse {
  message: string
}

export interface GetDraftResponse {
  draft: Draft
  participants: Participant[]
  picks: Pick[] | null
}

export interface SearchPlayersResponse {
  players: Player[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

export interface GetPlayersResponse {
  players: Player[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

export interface OptimalTransferResponse {
  picks: Pick[]
}

export interface TournamentResponse {
  standings: TeamStanding[]
  matches: Match[]
  participants: Participant[]
}

export interface RecordMatchResponse {
  message: string
  match: Match
}

export interface StartTournamentResponse {
  draft: Draft
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'draftState' | 'joined' | 'pickError' | 'tournamentState'
  data: WebSocketMessageData
}

export interface WebSocketMessageData {
  draft?: Draft
  participants?: Participant[]
  picks?: Pick[]
  currentPicker?: number
  error?: string
  standings?: TeamStanding[]
  matches?: Match[]
}

// Base request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  const response = await fetch(url, { ...defaultOptions, ...options })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// Draft API functions
export async function createDraft(data: CreateDraftRequest): Promise<CreateDraftResponse> {
  return apiRequest('/drafts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function joinDraft(code: string, data: JoinDraftRequest): Promise<JoinDraftResponse> {
  return apiRequest(`/drafts/${code}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function startDraft(code: string, data: { adminName: string }) {
  return apiRequest(`/drafts/${code}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function getDraft(code: string): Promise<GetDraftResponse> {
  return apiRequest(`/drafts/${code}`)
}

// Player API functions
export async function searchPlayers(query: string): Promise<Player[]> {
  const response = await apiRequest<SearchPlayersResponse>(`/players/search?q=${encodeURIComponent(query)}&limit=10`)
  return response.players
}

export async function getPlayers(params: Record<string, string> = {}): Promise<GetPlayersResponse> {
  const searchParams = new URLSearchParams(params)
  return await apiRequest<GetPlayersResponse>(`/players?${searchParams.toString()}`)
}

export interface PlayerEnumsResponse {
  nationalities: string[]
  leagues: string[]
  clubs: string[]
  positions: string[]
  playerAbilities: string[]
  preferredFootOptions: { value: number; label: string }[]
}

export async function getPlayerEnums(): Promise<PlayerEnumsResponse> {
  return await apiRequest<PlayerEnumsResponse>('/players/enums')
}

export async function getOptimalTransferData(code: string): Promise<OptimalTransferResponse> {
  return apiRequest(`/drafts/${code}/optimal-transfer`)
}

export async function getTournamentData(code: string): Promise<TournamentResponse> {
  return apiRequest(`/drafts/${code}/tournament`)
}

export async function recordMatch(code: string, data: RecordMatchRequest): Promise<RecordMatchResponse> {
  return apiRequest(`/drafts/${code}/matches`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function startTournament(code: string, data: StartTournamentRequest): Promise<StartTournamentResponse> {
  return apiRequest(`/drafts/${code}/tournament`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}