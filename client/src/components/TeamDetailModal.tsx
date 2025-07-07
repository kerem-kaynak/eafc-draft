import { useState, useEffect } from 'react'
import { Users, Trophy, Target } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getOptimalTransferData } from '@/lib/api'
import type { Match, Pick, OptimalTransferResponse, Player } from '@/lib/api'

interface TeamDetailModalProps {
  isOpen: boolean
  onClose: () => void
  teamName: string
  draftCode: string
  matches: Match[]
}

export default function TeamDetailModal({ isOpen, onClose, teamName, draftCode, matches }: TeamDetailModalProps) {
  const [players, setPlayers] = useState<Pick[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && teamName && draftCode) {
      fetchTeamPlayers()
    }
  }, [isOpen, teamName, draftCode])

  const fetchTeamPlayers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data: OptimalTransferResponse = await getOptimalTransferData(draftCode)
      const teamPicks = data.picks?.filter((pick: Pick) => pick.participantName === teamName) || []
      setPlayers(teamPicks)
    } catch (err) {
      console.error('Failed to fetch team players:', err)
      setError(err instanceof Error ? err.message : 'Failed to load team players')
    } finally {
      setLoading(false)
    }
  }

  const getPlayerDisplayName = (player: Player) => {
    return player?.commonName || `${player?.firstName || ''} ${player?.lastName || ''}`.trim()
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 75) return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
    if (rating >= 65) return 'bg-gradient-to-r from-gray-300 to-gray-500'
    return 'bg-gradient-to-r from-amber-800 to-amber-950'
  }

  const getMatchResult = (match: Match) => {
    const isHome = match.homeTeamName === teamName
    const teamScore = isHome ? match.homeScore : match.awayScore
    const opponentScore = isHome ? match.awayScore : match.homeScore
    const opponent = isHome ? match.awayTeamName : match.homeTeamName

    let result: 'W' | 'D' | 'L'
    let resultColor: string
    
    if (teamScore > opponentScore) {
      result = 'W'
      resultColor = 'bg-green-500'
    } else if (teamScore < opponentScore) {
      result = 'L'
      resultColor = 'bg-red-500'
    } else {
      result = 'D'
      resultColor = 'bg-yellow-500'
    }

    return { result, resultColor, teamScore, opponentScore, opponent, isHome }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-h-[90vh] overflow-hidden flex flex-col"
        style={{ width: '90vw', maxWidth: '1000px' }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            {teamName} - Team Details
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Match History - Left Side */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5 text-blue-600" />
                Match History
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-minimal min-h-0 p-4">
              {matches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No matches played yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => {
                    const { result, resultColor, teamScore, opponentScore, opponent, isHome } = getMatchResult(match)
                    
                    return (
                      <div key={match.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${resultColor} text-white flex items-center justify-center font-bold text-sm`}>
                              {result}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                vs {opponent}
                              </div>
                              <div className="text-sm text-gray-600">
                                {isHome ? 'Home' : 'Away'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg text-gray-900">
                              {teamScore} - {opponentScore}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Players - Right Side */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="w-5 h-5 text-yellow-600" />
                Squad ({players.length} players)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-minimal min-h-0 p-4">
              {loading && (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="ml-3 text-gray-600">Loading players...</span>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {!loading && !error && (
                <div className="space-y-3">
                  {players
                    .sort((a, b) => a.overallPickNumber - b.overallPickNumber)
                    .map((pick) => (
                    <Card key={pick.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="relative flex items-center gap-2">
                            <div className={`w-14 h-14 rounded-full ${getRatingColor(pick.player?.overallRating || 0)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                              {pick.player?.overallRating || '?'}
                            </div>
                            {pick.player?.avatarUrl && (
                              <img
                                src={pick.player.avatarUrl}
                                alt={getPlayerDisplayName(pick.player)}
                                className="absolute left-0 w-14 h-14 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                            {/* Rating Badge */}
                            <div className={`${getRatingColor(pick.player?.overallRating || 0)} text-white text-xs font-bold px-2 py-1 rounded shadow-lg`}>
                              {pick.player?.overallRating || '?'}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                Round {pick.roundNumber}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                Pick #{pick.overallPickNumber}
                              </Badge>
                            </div>
                            
                            <h4 className="font-semibold text-lg truncate">
                              {getPlayerDisplayName(pick.player)}
                            </h4>
                            
                            <div className="flex items-center gap-3 mt-1">
                              <Badge variant="secondary" className="font-medium text-xs">
                                {pick.player?.positionShortLabel}
                              </Badge>
                              
                              {/* Team with logo */}
                              <div className="flex items-center gap-1">
                                {pick.player?.teamImageUrl && (
                                  <img 
                                    src={pick.player.teamImageUrl} 
                                    alt={pick.player.teamLabel || ''}
                                    className="w-4 h-4 object-contain"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                )}
                                <span className="text-sm text-gray-600 truncate">
                                  {pick.player.teamLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
} 