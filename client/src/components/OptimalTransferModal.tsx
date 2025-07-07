import { useState, useEffect } from 'react'
import { Trophy, Download, Play, ArrowRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getOptimalTransferData } from '@/lib/api'
import type { Pick, OptimalTransferResponse } from '@/lib/api'

interface OptimalTransferModalProps {
  isOpen: boolean
  onClose: () => void
  draftCode: string
  onProceedToPlay: () => void
}

export default function OptimalTransferModal({ isOpen, onClose, draftCode, onProceedToPlay }: OptimalTransferModalProps) {
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch optimal transfer data when modal opens
  useEffect(() => {
    if (isOpen && draftCode) {
      setLoading(true)
      setError(null)
      
      getOptimalTransferData(draftCode)
        .then((response: OptimalTransferResponse) => {
          setPicks(response.picks || [])
        })
        .catch((err) => {
          console.error('Failed to fetch optimal transfer data:', err)
          setError(err.message || 'Failed to load optimal transfer data')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isOpen, draftCode])

  const getPlayerDisplayName = (player: Pick['player']) => {
    return player?.commonName || `${player?.firstName || ''} ${player?.lastName || ''}`.trim()
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 75) return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
    if (rating >= 65) return 'bg-gradient-to-r from-gray-300 to-gray-500'
    return 'bg-gradient-to-r from-amber-800 to-amber-950'
  }

  // Sort picks for optimal transfer path - League → Club → Rating
  const sortedPicks = [...picks].sort((a, b) => {
    const leagueA = a.player.leagueName || 'Unknown'
    const leagueB = b.player.leagueName || 'Unknown'
    
    // 1. Sort by league name alphabetically
    if (leagueA !== leagueB) {
      return leagueA.localeCompare(leagueB)
    }
    
    // 2. Sort by club name alphabetically within same league
    const teamA = a.player.teamLabel || ''
    const teamB = b.player.teamLabel || ''
    if (teamA !== teamB) {
      return teamA.localeCompare(teamB)
    }
    
    // 3. Sort by overall rating (highest first) within same club
    return (b.player.overallRating || 0) - (a.player.overallRating || 0)
  })

  const handleProceedToPlay = () => {
    onProceedToPlay()
    onClose()
  }

  const handleExportList = () => {
    // Create a simple text export of the transfer path
    const exportText = sortedPicks.map((pick, index) => 
      `${index + 1}. ${getPlayerDisplayName(pick.player)} (${pick.player.overallRating} OVR) - ${pick.player.teamLabel} (${pick.player.leagueName || 'Unknown League'}) - Picked by ${pick.participantName}`
    ).join('\n')
    
    const blob = new Blob([exportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'optimal-transfer-path.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-h-[90vh] overflow-hidden flex flex-col"
        style={{ width: '90vw', maxWidth: '1200px' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-600" />
            Optimal Transfer Path
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Players sorted to minimize clicks when transferring in-game. Order: League → Club → Rating
          </p>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="ml-3 text-gray-600">Loading optimal transfer data...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
            <p className="font-medium">Error loading transfer data</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Action Buttons */}
            <div className="flex gap-3 mb-4">
              <Button 
                onClick={handleProceedToPlay}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white cursor-pointer"
              >
                <Play className="w-4 h-4 mr-2" />
                Proceed to Play
              </Button>
              <Button 
                onClick={handleExportList}
                variant="outline"
                className="cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Export List
              </Button>
            </div>

            {/* Transfer Path List */}
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-minimal">
              <div className="space-y-3">
                {sortedPicks.map((pick, index) => (
                  <Card key={pick.id} className="hover:shadow-sm transition-shadow mx-1">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Transfer Order Number */}
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                        </div>

                        {/* Player Info */}
                        <div className="relative flex items-center gap-3">
                          <div className={`w-16 h-16 rounded-full ${getRatingColor(pick.player?.overallRating || 0)} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                            {pick.player?.overallRating || '?'}
                          </div>
                          {pick.player?.avatarUrl && (
                            <img
                              src={pick.player.avatarUrl}
                              alt={getPlayerDisplayName(pick.player)}
                              className="absolute left-0 w-16 h-16 rounded-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}
                          {/* Overall Rating Badge with same color as background */}
                          <div className={`${getRatingColor(pick.player?.overallRating || 0)} text-white text-sm font-bold px-2 py-1 rounded shadow-lg`}>
                            {pick.player?.overallRating || '?'}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-lg truncate">
                            {getPlayerDisplayName(pick.player)}
                          </h4>
                          
                          <div className="flex items-center gap-4 mt-2">
                            <Badge variant="secondary" className="font-medium text-sm">
                              {pick.player?.positionShortLabel}
                            </Badge>
                            
                            {/* Team with logo - Much larger */}
                            <div className="flex items-center gap-2">
                              {pick.player?.teamImageUrl && (
                                <img 
                                  src={pick.player.teamImageUrl} 
                                  alt={pick.player.teamLabel || ''}
                                  className="w-8 h-8 object-contain"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              )}
                              <span className="text-base font-semibold text-gray-800 truncate">
                                {pick.player.teamLabel}
                              </span>
                            </div>
                            
                            {/* League - Much larger and more prominent */}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-base font-semibold px-3 py-1 bg-blue-50 text-blue-800 border-blue-200">
                                {pick.player.leagueName || 'Unknown League'}
                              </Badge>
                            </div>
                          </div>

                        </div>

                        {/* Picked by */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-medium text-gray-900">
                            {pick.participantName}
                          </div>
                          <div className="text-xs text-gray-500">
                            picked this
                          </div>
                        </div>

                        {/* Arrow for visual flow */}
                        {index < sortedPicks.length - 1 && (
                          <div className="flex-shrink-0">
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">{sortedPicks.length}</span> players to transfer
                </div>
                <div className="text-sm text-gray-600">
                  Organized by: <span className="font-semibold">League → Club → Rating</span>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
} 