import { User, Trophy, Crown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Pick, Participant } from '@/lib/api'

interface ParticipantPicksModalProps {
  isOpen: boolean
  onClose: () => void
  participant: Participant | null
  picks: Pick[]
}

export default function ParticipantPicksModal({ isOpen, onClose, participant, picks }: ParticipantPicksModalProps) {
  if (!participant) return null

  // Filter picks for this participant with more robust matching
  const participantPicks = picks.filter(pick => {
    // Try exact match first
    if (pick.participantName === participant.name) return true
    // Try case-insensitive match as fallback
    if (pick.participantName?.toLowerCase() === participant.name?.toLowerCase()) return true
    return false
  })
  

  
  const getPlayerDisplayName = (player: Pick['player']) => {
    return player?.commonName || `${player?.firstName || ''} ${player?.lastName || ''}`.trim()
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 75) return 'bg-gradient-to-r from-yellow-400 to-yellow-600'     // More golden for 75+
    if (rating >= 65) return 'bg-gradient-to-r from-gray-300 to-gray-500'       // Silver for 65-74
    return 'bg-gradient-to-r from-amber-800 to-amber-950'                       // Bronze for <65
  }

  const getTotalPicks = () => {
    return (participant.picks8589 || 0) + (participant.picks8084 || 0) + (participant.picks7579 || 0) + (participant.picksUpTo74 || 0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {participant.name}'s Picks
            {participant.isAdmin && <Crown className="w-4 h-4 text-yellow-600" />}
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                {participant.draftOrder}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{participant.name}</h3>
                <p className="text-sm text-gray-600">Draft Position #{participant.draftOrder}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4 text-gray-600" />
                <span className="font-semibold">{getTotalPicks()} picks</span>
              </div>
            </div>
          </div>
          
          {/* Quota Badges */}
          <div className="flex gap-2 flex-wrap">
            <Badge 
              className={`text-xs font-semibold ${
                (participant.picks8589 || 0) >= 1 
                  ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-60' 
                  : 'bg-green-100 text-green-800 border-green-300'
              }`}
            >
              85-89: {participant.picks8589 || 0}/1
            </Badge>
            <Badge 
              className={`text-xs font-semibold ${
                (participant.picks8084 || 0) >= 4 
                  ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-60' 
                  : (participant.picks8084 || 0) > 0
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                    : 'bg-green-100 text-green-800 border-green-300'
              }`}
            >
              80-84: {participant.picks8084 || 0}/4
            </Badge>
            <Badge 
              className={`text-xs font-semibold ${
                ((participant.picks7579 || 0) + (participant.picksUpTo74 || 0)) >= 6 
                  ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-60' 
                  : ((participant.picks7579 || 0) + (participant.picksUpTo74 || 0)) > 0
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                    : 'bg-green-100 text-green-800 border-green-300'
              }`}
            >
              ≤79: {(participant.picks7579 || 0) + (participant.picksUpTo74 || 0)}/6
            </Badge>
          </div>
        </div>

        {/* Picks List */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-minimal">
          {participantPicks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No picks yet</p>
              <p className="text-sm">This participant hasn't made any picks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {participantPicks
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
                          <span className="text-sm text-gray-600 truncate">
                            {pick.player?.teamLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 