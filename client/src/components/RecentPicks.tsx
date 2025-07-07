import { Clock, Target } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Pick } from '@/lib/api'

interface RecentPicksProps {
  picks: Pick[] | null
}

export default function RecentPicks({ picks }: RecentPicksProps) {
  const allPicks = (picks || []).slice().reverse() // Show all picks, most recent first

  const getRatingColor = (rating: number) => {
    if (rating >= 75) return 'bg-gradient-to-r from-yellow-400 to-yellow-600'     // More golden for 75+
    if (rating >= 65) return 'bg-gradient-to-r from-gray-300 to-gray-500'       // Silver for 65-74
    return 'bg-gradient-to-r from-amber-800 to-amber-950'                       // Bronze for <65
  }

  const getPlayerDisplayName = (player: Pick['player']) => {
    return player?.commonName || `${player?.firstName || ''} ${player?.lastName || ''}`.trim()
  }

  return (
    <Card className="h-full overflow-hidden py-0 gap-0">
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-4">
        <CardTitle className="flex items-center gap-2 text-lg m-0 p-0">
          <Clock className="w-5 h-5" />
          All Picks
        </CardTitle>
      </div>
             <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
         {!picks || picks.length === 0 ? (
           <div className="p-8 text-center text-gray-500 flex-1 flex items-center justify-center">
             <div>
               <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
               <p className="font-medium">No picks yet</p>
               <p className="text-sm">The draft will begin soon!</p>
             </div>
           </div>
         ) : (
           <div className="divide-y overflow-y-auto min-h-0 flex-1 scrollbar-minimal">
            {allPicks.map((pick) => (
              <div key={pick.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center gap-2">
                    <div className={`w-12 h-12 rounded-full ${getRatingColor(pick.player?.overallRating || 0)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                      {pick.player?.overallRating || '?'}
                    </div>
                    {pick.player?.avatarUrl && (
                      <img
                        src={pick.player.avatarUrl}
                        alt={getPlayerDisplayName(pick.player)}
                        className="absolute left-0 w-12 h-12 rounded-full object-cover"
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
                    </div>
                    
                    <h4 className="font-semibold truncate">
                      {getPlayerDisplayName(pick.player)}
                    </h4>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{pick.player?.positionShortLabel}</span>
                      <span>•</span>
                      <span className="truncate">{pick.player?.teamLabel}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {pick.participantName}
                    </div>
                    <div className="text-xs text-gray-500">
                      Pick {pick.pickInRound}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}