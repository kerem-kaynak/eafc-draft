import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { searchPlayers, type Player } from '@/lib/api'

// Import the same stat categories from PlayersPage
const statCategories = [
  {
    name: 'Main Stats',
    stats: [
      { key: 'overall_rating', label: 'Overall Rating' },
      { key: 'stat_pac', label: 'Pace' },
      { key: 'stat_sho', label: 'Shooting' },
      { key: 'stat_pas', label: 'Passing' },
      { key: 'stat_dri', label: 'Dribbling' },
      { key: 'stat_def', label: 'Defending' },
      { key: 'stat_phy', label: 'Physical' },
    ]
  },
  {
    name: 'Pace',
    stats: [
      { key: 'stat_acceleration', label: 'Acceleration' },
      { key: 'stat_sprint_speed', label: 'Sprint Speed' },
    ]
  },
  {
    name: 'Shooting',
    stats: [
      { key: 'stat_finishing', label: 'Finishing' },
      { key: 'stat_shot_power', label: 'Shot Power' },
      { key: 'stat_long_shots', label: 'Long Shots' },
      { key: 'stat_volleys', label: 'Volleys' },
      { key: 'stat_penalties', label: 'Penalties' },
    ]
  },
  {
    name: 'Passing',
    stats: [
      { key: 'stat_crossing', label: 'Crossing' },
      { key: 'stat_curve', label: 'Curve' },
      { key: 'stat_free_kick_accuracy', label: 'FK Accuracy' },
      { key: 'stat_short_passing', label: 'Short Passing' },
      { key: 'stat_long_passing', label: 'Long Passing' },
      { key: 'stat_vision', label: 'Vision' },
    ]
  },
  {
    name: 'Dribbling',
    stats: [
      { key: 'stat_ball_control', label: 'Ball Control' },
      { key: 'stat_dribbling', label: 'Dribbling' },
      { key: 'stat_composure', label: 'Composure' },
      { key: 'stat_agility', label: 'Agility' },
      { key: 'stat_balance', label: 'Balance' },
      { key: 'stat_reactions', label: 'Reactions' },
    ]
  },
  {
    name: 'Defending',
    stats: [
      { key: 'stat_defensive_awareness', label: 'Defensive Awareness' },
      { key: 'stat_standing_tackle', label: 'Standing Tackle' },
      { key: 'stat_sliding_tackle', label: 'Sliding Tackle' },
      { key: 'stat_interceptions', label: 'Interceptions' },
      { key: 'stat_heading_accuracy', label: 'Heading Accuracy' },
    ]
  },
  {
    name: 'Physical',
    stats: [
      { key: 'stat_jumping', label: 'Jumping' },
      { key: 'stat_stamina', label: 'Stamina' },
      { key: 'stat_strength', label: 'Strength' },
      { key: 'stat_aggression', label: 'Aggression' },
    ]
  },
  {
    name: 'Goalkeeping',
    stats: [
      { key: 'stat_gk_diving', label: 'GK Diving' },
      { key: 'stat_gk_handling', label: 'GK Handling' },
      { key: 'stat_gk_kicking', label: 'GK Kicking' },
      { key: 'stat_gk_positioning', label: 'GK Positioning' },
      { key: 'stat_gk_reflexes', label: 'GK Reflexes' },
    ]
  }
]

// Player Search Component (similar to PlayerSearchModal but simplified)
const PlayerSearch = ({ 
  placeholder, 
  onSelectPlayer 
}: { 
  placeholder: string
  selectedPlayer: Player | null
  onSelectPlayer: (player: Player) => void
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setPlayers([])
      return
    }

    setLoading(true)
    try {
      const data = await searchPlayers(query)
      setPlayers(data.slice(0, 10))
    } catch (error) {
      console.error('Search failed:', error)
      setPlayers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const getPlayerDisplayName = (player: Player) => {
    return player.commonName || `${player.firstName || ''} ${player.lastName || ''}`.trim()
  }

  const handlePlayerSelect = (player: Player) => {
    onSelectPlayer(player)
    setSearchQuery(getPlayerDisplayName(player))
    setIsOpen(false)
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 75) return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
    if (rating >= 65) return 'bg-gradient-to-r from-gray-300 to-gray-500'
    return 'bg-gradient-to-r from-amber-800 to-amber-950'
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && searchQuery && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Results */}
          <div className="absolute top-full left-0 right-0 z-20 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <p>Searching...</p>
              </div>
            ) : players.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <p>No players found</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer rounded-md"
                    onClick={() => handlePlayerSelect(player)}
                  >
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full ${getRatingColor(player.overallRating || 0)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                        {player.overallRating || '?'}
                      </div>
                      {player.avatarUrl && (
                        <img
                          src={player.avatarUrl}
                          alt={getPlayerDisplayName(player)}
                          className="absolute inset-0 w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {getPlayerDisplayName(player)}
                      </div>
                      <div className="text-sm text-slate-600">
                        {player.positionShortLabel} • {player.teamLabel}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function PlayerComparisonPage() {
  const navigate = useNavigate()
  const [player1, setPlayer1] = useState<Player | null>(null)
  const [player2, setPlayer2] = useState<Player | null>(null)

  const getStatValue = (player: Player, statKey: string): number => {
    switch (statKey) {
      case 'overall_rating':
        return player.overallRating || 0
      default:
        // Convert snake_case to camelCase
        const camelCaseKey = statKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        return (player as any)[camelCaseKey] || 0
    }
  }

  const getStatComparison = (player1Value: number, player2Value: number) => {
    if (player1Value > player2Value) {
      return { player1Color: 'bg-green-100 text-green-800', player2Color: 'bg-slate-50 text-slate-600' }
    } else if (player2Value > player1Value) {
      return { player1Color: 'bg-slate-50 text-slate-600', player2Color: 'bg-green-100 text-green-800' }
    } else {
      return { player1Color: 'bg-yellow-100 text-yellow-800', player2Color: 'bg-yellow-100 text-yellow-800' }
    }
  }

  const bothPlayersSelected = player1 && player2

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/players')}
                variant="outline"
                className="flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Players
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Player Comparison
                </h1>
                <p className="text-slate-600 mt-1">Compare two players head-to-head</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Player Selection */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Player 1</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerSearch
                placeholder="Search for first player..."
                selectedPlayer={player1}
                onSelectPlayer={setPlayer1}
              />
                             {player1 && player1.shieldUrl && (
                 <div className="mt-4 flex justify-center p-12 bg-slate-50 rounded-lg">
                   <img
                     src={player1.shieldUrl}
                     alt={`${player1.teamLabel} shield`}
                     className="w-80 h-80 object-contain"
                     onError={(e) => {
                       e.currentTarget.style.display = 'none'
                     }}
                   />
                 </div>
               )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Player 2</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerSearch
                placeholder="Search for second player..."
                selectedPlayer={player2}
                onSelectPlayer={setPlayer2}
              />
                             {player2 && player2.shieldUrl && (
                 <div className="mt-4 flex justify-center p-12 bg-slate-50 rounded-lg">
                   <img
                     src={player2.shieldUrl}
                     alt={`${player2.teamLabel} shield`}
                     className="w-80 h-80 object-contain"
                     onError={(e) => {
                       e.currentTarget.style.display = 'none'
                     }}
                   />
                 </div>
               )}
            </CardContent>
          </Card>
        </div>

        {/* Comparison Table */}
        {bothPlayersSelected ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Stats Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {statCategories.map((category) => (
                <div key={category.name} className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">
                    {category.name}
                  </h3>
                  <div className="space-y-3">
                    {category.stats.map((stat) => {
                      const player1Value = getStatValue(player1, stat.key)
                      const player2Value = getStatValue(player2, stat.key)
                      const { player1Color, player2Color } = getStatComparison(player1Value, player2Value)

                                             return (
                         <div key={stat.key} className="grid grid-cols-3 gap-4 items-center py-3">
                           <div className={`text-center py-2 px-3 rounded-md font-medium ${player1Color}`}>
                             {player1Value}
                           </div>
                           <div className="text-center font-medium text-slate-700">
                             {stat.label}
                           </div>
                           <div className={`text-center py-2 px-3 rounded-md font-medium ${player2Color}`}>
                             {player2Value}
                           </div>
                         </div>
                       )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-center py-16">
              <Users className="w-16 h-16 mx-auto text-slate-400 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                Select Two Players to Compare
              </h3>
              <p className="text-slate-500">
                Use the search bars above to find and select two players for comparison
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 