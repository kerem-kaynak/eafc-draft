import { useState, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { searchPlayers, type Player } from '@/lib/api'
import { toast } from 'sonner'

interface PlayerSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectPlayer: (playerId: number) => Promise<void>
  isMyTurn: boolean
}

export default function PlayerSearchModal({ isOpen, onClose, onSelectPlayer, isMyTurn }: PlayerSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [picking, setPicking] = useState(false)

  // Reset picking state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPicking(false)
    }
  }, [isOpen])

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setPlayers([])
      setSearching(false)
      return
    }

    setLoading(true)
    setSearching(false)
    try {
      const data = await searchPlayers(query)
      // API should return max 10, but ensure we don't show more than 10
      const playersArray = Array.isArray(data) ? data : []
      setPlayers(playersArray.slice(0, 10))
    } catch (error) {
      console.error('Search failed:', error)
      setPlayers([])
      toast.error('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (searchQuery.trim()) {
      setSearching(true)
      setPlayers([]) // Clear previous results when starting a new search
    } else {
      setSearching(false)
      setPlayers([]) // Clear results when search is empty
    }
    
    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleConfirmPick = async () => {
    if (selectedPlayer && !picking) {
      setPicking(true)
      const playerName = getPlayerDisplayName(selectedPlayer)
      
      // Close modal immediately to prevent it from staying on top of walkout animation
      onClose()
      setSelectedPlayer(null)
      setSearchQuery('')
      setPlayers([])
      
      try {
        await onSelectPlayer(selectedPlayer.id)
        // Don't show success toast as the walkout animation will show the pick
      } catch (error) {
        console.error('Pick failed:', error)
        let errorMessage = 'Failed to pick player'
        if (error instanceof Error) {
          if (error.message.includes('already picked')) {
            errorMessage = `${playerName} has already been picked by another player`
          } else if (error.message.includes('not your turn')) {
            errorMessage = 'It\'s not your turn to pick'
          } else if (error.message.includes('Connection lost')) {
            errorMessage = 'Connection lost. Please check your internet connection and try again'
          } else if (error.message.includes('timed out')) {
            errorMessage = 'Pick request timed out. Please try again'
          } else {
            errorMessage = error.message
          }
        }
        toast.error(errorMessage, {
          description: 'You can try picking another player or try again'
        })
      } finally {
        setPicking(false)
      }
    }
  }

  const getPlayerDisplayName = (player: Player) => {
    return player.commonName || `${player.firstName || ''} ${player.lastName || ''}`.trim()
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 75) return 'bg-gradient-to-r from-yellow-400 to-yellow-600'     // More golden for 75+
    if (rating >= 65) return 'bg-gradient-to-r from-gray-300 to-gray-500'       // Silver for 65-74
    return 'bg-gradient-to-r from-amber-800 to-amber-950'                       // Bronze for <65
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Players
          </DialogTitle>
        </DialogHeader>

        {!isMyTurn && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-yellow-800 text-sm font-medium">
              It's not your turn to pick. You can search but cannot make a selection.
            </p>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by player name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto max-h-[50vh] scrollbar-minimal py-2">
          {(loading || searching) && searchQuery && (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin opacity-50" />
              <p>Searching for players...</p>
            </div>
          )}

          {players.length === 0 && searchQuery && !loading && !searching && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No players found for "{searchQuery}"</p>
            </div>
          )}

          {players.length === 0 && !searchQuery && !loading && !searching && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Start typing to search for players</p>
            </div>
          )}

          <div className="space-y-3 px-2">
            {players.map((player) => (
              <Card
                key={player.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedPlayer?.id === player.id
                    ? 'ring-2 ring-primary shadow-md'
                    : 'hover:shadow-sm'
                } ${!isMyTurn ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={() => isMyTurn && setSelectedPlayer(player)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center gap-3">
                      <div className={`w-16 h-16 rounded-full ${getRatingColor(player.overallRating || 0)} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                        {player.overallRating || '?'}
                      </div>
                      {player.avatarUrl && (
                        <img
                          src={player.avatarUrl}
                          alt={getPlayerDisplayName(player)}
                          className="absolute left-0 w-16 h-16 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      {/* Overall Rating Badge with same color as background */}
                      <div className={`${getRatingColor(player.overallRating || 0)} text-white text-sm font-bold px-2 py-1 rounded shadow-lg`}>
                        {player.overallRating || '?'}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {getPlayerDisplayName(player)}
                      </h3>
                      
                      <div className="flex items-center gap-3 mt-2">
                        {/* Position */}
                        <Badge variant="secondary" className="font-medium">
                          {player.positionShortLabel}
                        </Badge>
                        
                        {/* Team with logo */}
                        <div className="flex items-center gap-1">
                          {player.teamImageUrl && (
                            <img 
                              src={player.teamImageUrl} 
                              alt={player.teamLabel || ''}
                              className="w-4 h-4 object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}
                          <span className="text-sm text-muted-foreground truncate">
                            {player.teamLabel}
                          </span>
                        </div>
                        
                        {/* Nationality with flag */}
                        <div className="flex items-center gap-1">
                          {player.nationalityImageUrl && (
                            <img 
                              src={player.nationalityImageUrl} 
                              alt={player.nationalityLabel || ''}
                              className="w-4 h-3 object-cover rounded-sm"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {player.nationalityLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedPlayer?.id === player.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {selectedPlayer && isMyTurn && (
          <div className="pt-4 border-t bg-muted/20 -mx-6 px-6 -mb-6 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Selected: {getPlayerDisplayName(selectedPlayer)}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPlayer.overallRating} OVR • {selectedPlayer.positionShortLabel} • {selectedPlayer.teamLabel}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedPlayer(null)} disabled={picking} className="cursor-pointer">
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmPick} 
                  disabled={picking}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 cursor-pointer"
                >
                  {picking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Picking...
                    </>
                  ) : (
                    'Confirm Pick'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}