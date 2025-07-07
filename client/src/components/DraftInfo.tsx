import { Trophy, Zap } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Draft, Participant } from '@/lib/api'

interface DraftInfoProps {
  draft: Draft
  currentPicker: number | null
  participants: Participant[]
}

export default function DraftInfo({ draft, currentPicker, participants }: DraftInfoProps) {
  // Fix progress calculation - should be 0% when no picks have been made
  const totalPicks = draft.totalRounds * draft.participantCount
  const completedPicks = Math.max(0, ((draft.currentRound - 1) * draft.participantCount + draft.currentPickInRound - 1))
  const progress = totalPicks > 0 ? (completedPicks / totalPicks) * 100 : 0

  // Cap round values when draft is completed
  const displayRound = Math.min(draft.currentRound, draft.totalRounds)
  const roundProgress = Math.min((draft.currentRound / draft.totalRounds) * 100, 100)

  // Find the current participant's name
  const currentParticipant = participants.find(p => p.draftOrder === currentPicker)
  const currentPlayerName = currentParticipant?.name || `Player ${currentPicker}`

  return (
    <Card className="h-full overflow-hidden py-0 gap-0">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="w-6 h-6" />
          Draft Progress
        </CardTitle>
      </div>
      <CardContent className="p-6 flex-1">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Status</span>
            <Badge 
              variant={draft.status === 'active' ? 'default' : draft.status === 'completed' ? 'secondary' : 'outline'}
              className={`${draft.status === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
            >
              {draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}
            </Badge>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Round Progress</span>
              <span className="text-sm font-semibold">{displayRound}/{draft.totalRounds}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${roundProgress}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Overall Progress</span>
              <span className="text-sm font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{draft.currentPickInRound}</div>
              <div className="text-xs text-gray-500">Pick in Round</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{draft.participantCount}</div>
              <div className="text-xs text-gray-500">Total Participants</div>
            </div>
          </div>

          {currentPicker && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Current Turn: {currentPlayerName}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}