import { useState } from 'react'
import { Users, Target, Crown } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ParticipantPicksModal from './ParticipantPicksModal'
import type { Participant, Pick } from '@/lib/api'

interface ParticipantsListProps {
  participants: Participant[]
  participantName: string
  currentPicker: number | null
  picks: Pick[]
}

function QuotaBadge({ label, current, max }: { label: string, current: number, max: number }) {
  const isComplete = current >= max
  const isPartial = current > 0 && current < max
  
  return (
    <div className={`text-xs px-2 py-1 rounded-full border font-semibold ${
      isComplete 
        ? 'bg-gray-50 border-gray-200 text-gray-400 opacity-60' 
        : isPartial 
          ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
          : 'bg-green-100 border-green-300 text-green-800'
    }`}>
      {label}: {current}/{max}
    </div>
  )
}

export default function ParticipantsList({ participants, participantName, currentPicker, picks }: ParticipantsListProps) {
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleParticipantClick = (participant: Participant) => {
    setSelectedParticipant(participant)
    setIsModalOpen(true)
  }
  return (
    <Card className="h-full overflow-hidden py-0 gap-0">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-6 h-6" />
          Participants
        </CardTitle>
      </div>
      <CardContent className="p-0 flex-1">
        <div className="divide-y">
          {participants
            .sort((a, b) => a.draftOrder - b.draftOrder)
            .map((participant) => {
              const isCurrentUser = participant.name === participantName
              const isCurrentTurn = participant.draftOrder === currentPicker
              
              return (
                <div
                  key={participant.id}
                  onClick={() => handleParticipantClick(participant)}
                  className={`p-4 transition-all duration-200 cursor-pointer ${
                    isCurrentTurn 
                      ? 'bg-green-50 border-l-4 border-green-500 hover:bg-green-100' 
                      : isCurrentUser 
                        ? 'bg-blue-50 border-l-4 border-blue-500 hover:bg-blue-100' 
                        : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isCurrentTurn 
                          ? 'bg-green-600 text-white' 
                          : isCurrentUser 
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                      }`}>
                        {participant.draftOrder}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`font-semibold ${isCurrentUser ? 'text-blue-700' : ''}`}>
                            {participant.name}
                          </span>
                          {participant.isAdmin && (
                            <Crown className="w-4 h-4 text-yellow-600" />
                          )}
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs px-2 py-0.5">You</Badge>
                          )}
                        </div>
                        
                        <div className="flex gap-1 flex-wrap">
                          <QuotaBadge label="85-89" current={participant.picks8589 || 0} max={1} />
                          <QuotaBadge label="80-84" current={participant.picks8084 || 0} max={4} />
                          <QuotaBadge label="≤79" current={(participant.picks7579 || 0) + (participant.picksUpTo74 || 0)} max={6} />
                        </div>
                      </div>
                    </div>

                    {isCurrentTurn && (
                      <div className="flex items-center gap-1 text-green-600">
                        <Target className="w-4 h-4" />
                        <span className="text-sm font-medium">Turn</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </CardContent>
      
      <ParticipantPicksModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        participant={selectedParticipant}
        picks={picks}
      />
    </Card>
  )
}