import { useState, useEffect } from 'react'
import { Trophy, Plus, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getTournamentData } from '@/lib/api'
import type { TeamStanding, Match, Participant, TournamentResponse } from '@/lib/api'
import { useDraft } from '@/context/DraftContext'
import RecordMatchModal from './RecordMatchModal'
import TeamDetailModal from './TeamDetailModal'

interface TournamentViewProps {
  draftCode: string
  participantName: string
  isAdmin: boolean
}

export default function TournamentView({ draftCode, participantName, isAdmin }: TournamentViewProps) {
  const { state } = useDraft()
  const [standings, setStandings] = useState<TeamStanding[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRecordMatchModalOpen, setIsRecordMatchModalOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [isTeamDetailModalOpen, setIsTeamDetailModalOpen] = useState(false)

  const fetchTournamentData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data: TournamentResponse = await getTournamentData(draftCode)
      setStandings(data.standings || [])
      setMatches(data.matches || [])
      setParticipants(data.participants || [])
    } catch (err) {
      console.error('Failed to fetch tournament data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tournament data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTournamentData()
  }, [draftCode])

  // Listen for tournament WebSocket updates
  useEffect(() => {
    if (state.tournamentData && state.draft?.status === 'tournament') {
      // Update local state with tournament data from WebSocket
      setStandings(state.tournamentData.standings || [])
      setMatches(state.tournamentData.matches || [])
      setParticipants(state.tournamentData.participants || [])
      setLoading(false)
    }
  }, [state.tournamentData, state.draft?.status])

  const handleMatchRecorded = () => {
    // Refresh tournament data after a match is recorded
    fetchTournamentData()
  }

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName)
    setIsTeamDetailModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600">Loading tournament data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
        <p className="font-medium">Error loading tournament data</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-6 h-[calc(100vh-320px)]">
      {/* Standings - Left Side */}
      <Card className="flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-600" />
              Standings
            </CardTitle>
            {isAdmin && (
              <Button 
                onClick={() => setIsRecordMatchModalOpen(true)}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-2" />
                Record Match
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto scrollbar-minimal min-h-0 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-center w-12">GP</TableHead>
                <TableHead className="text-center w-12">W</TableHead>
                <TableHead className="text-center w-12">D</TableHead>
                <TableHead className="text-center w-12">L</TableHead>
                <TableHead className="text-center w-16">GF</TableHead>
                <TableHead className="text-center w-16">GA</TableHead>
                <TableHead className="text-center w-16">GD</TableHead>
                <TableHead className="text-center w-12 font-bold">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((team, index) => (
                <TableRow 
                  key={team.teamName}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleTeamClick(team.teamName)}
                >
                  <TableCell>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-amber-600' : 'bg-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{team.teamName}</TableCell>
                  <TableCell className="text-center">{team.gamesPlayed}</TableCell>
                  <TableCell className="text-center text-green-600 font-medium">{team.wins}</TableCell>
                  <TableCell className="text-center text-yellow-600 font-medium">{team.draws}</TableCell>
                  <TableCell className="text-center text-red-600 font-medium">{team.losses}</TableCell>
                  <TableCell className="text-center">{team.goalsFor}</TableCell>
                  <TableCell className="text-center">{team.goalsAgainst}</TableCell>
                  <TableCell className={`text-center font-medium ${
                    team.goalDifference > 0 ? 'text-green-600' : 
                    team.goalDifference < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                  </TableCell>
                  <TableCell className="text-center font-bold text-lg">{team.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Matches - Right Side */}
      <Card className="flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Match Results
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto scrollbar-minimal min-h-0">
          {matches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No matches played yet</p>
              {isAdmin && (
                <p className="text-sm mt-2">Use "Record Match" to add the first match</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => (
                <div key={match.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-5 items-center gap-4">
                    {/* Home Team */}
                    <div className="col-span-2 text-right">
                      <div className="font-semibold text-gray-900 text-lg">{match.homeTeamName}</div>
                    </div>
                    
                    {/* Score Section */}
                    <div className="col-span-1 flex items-center justify-center">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-blue-600 w-8 text-center">{match.homeScore}</div>
                        <div className="text-gray-400 font-medium text-lg">-</div>
                        <div className="text-2xl font-bold text-blue-600 w-8 text-center">{match.awayScore}</div>
                      </div>
                    </div>
                    
                    {/* Away Team */}
                    <div className="col-span-2 text-left">
                      <div className="font-semibold text-gray-900 text-lg">{match.awayTeamName}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Match Modal */}
      <RecordMatchModal
        isOpen={isRecordMatchModalOpen}
        onClose={() => setIsRecordMatchModalOpen(false)}
        participants={participants}
        draftCode={draftCode}
        recordedBy={participantName}
        onMatchRecorded={handleMatchRecorded}
      />

      {/* Team Detail Modal */}
      {selectedTeam && (
        <TeamDetailModal
          isOpen={isTeamDetailModalOpen}
          onClose={() => {
            setIsTeamDetailModalOpen(false)
            setSelectedTeam(null)
          }}
          teamName={selectedTeam}
          draftCode={draftCode}
          matches={matches.filter(match => 
            match.homeTeamName === selectedTeam || match.awayTeamName === selectedTeam
          )}
        />
      )}
    </div>
  )
} 