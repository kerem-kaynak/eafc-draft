import { useState } from 'react'
import { Target } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// Using regular select for now - can upgrade to shadcn Select later
import { recordMatch } from '@/lib/api'
import { toast } from 'sonner'
import type { Participant } from '@/lib/api'

interface RecordMatchModalProps {
  isOpen: boolean
  onClose: () => void
  participants: Participant[]
  draftCode: string
  recordedBy: string
  onMatchRecorded: () => void
}

export default function RecordMatchModal({ 
  isOpen, 
  onClose, 
  participants, 
  draftCode, 
  recordedBy, 
  onMatchRecorded 
}: RecordMatchModalProps) {
  const [homeTeam, setHomeTeam] = useState<string>('')
  const [awayTeam, setAwayTeam] = useState<string>('')
  const [homeScore, setHomeScore] = useState<string>('')
  const [awayScore, setAwayScore] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    // Validation
    if (!homeTeam || !awayTeam) {
      toast.error('Please select both teams')
      return
    }

    if (homeTeam === awayTeam) {
      toast.error('Teams cannot be the same')
      return
    }

    const homeScoreNum = parseInt(homeScore)
    const awayScoreNum = parseInt(awayScore)

    if (isNaN(homeScoreNum) || isNaN(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
      toast.error('Please enter valid scores (0 or positive integers)')
      return
    }

    try {
      setSubmitting(true)
      await recordMatch(draftCode, {
        homeTeamName: homeTeam,
        awayTeamName: awayTeam,
        homeScore: homeScoreNum,
        awayScore: awayScoreNum,
        recordedBy: recordedBy
      })

      toast.success(`Match recorded: ${homeTeam} ${homeScoreNum} - ${awayScoreNum} ${awayTeam}`)
      
      // Reset form
      setHomeTeam('')
      setAwayTeam('')
      setHomeScore('')
      setAwayScore('')
      
      onMatchRecorded()
      onClose()
    } catch (error) {
      console.error('Failed to record match:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to record match')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setHomeTeam('')
      setAwayTeam('')
      setHomeScore('')
      setAwayScore('')
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Record Match Result
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Home Team Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Home Team
            </label>
            <select 
              value={homeTeam} 
              onChange={(e) => setHomeTeam(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select home team</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.name}>
                  {participant.name}
                </option>
              ))}
            </select>
          </div>

          {/* Away Team Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Away Team
            </label>
            <select 
              value={awayTeam} 
              onChange={(e) => setAwayTeam(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select away team</option>
              {participants.map((participant) => (
                <option 
                  key={participant.id} 
                  value={participant.name}
                  disabled={participant.name === homeTeam}
                >
                  {participant.name}
                </option>
              ))}
            </select>
          </div>

          {/* Score Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {homeTeam || 'Home'} Score
              </label>
              <Input
                type="number"
                min="0"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {awayTeam || 'Away'} Score
              </label>
              <Input
                type="number"
                min="0"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Match Preview */}
          {homeTeam && awayTeam && homeScore !== '' && awayScore !== '' && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 font-medium text-center">
                {homeTeam} {homeScore} - {awayScore} {awayTeam}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={handleClose} 
              disabled={submitting}
              className="flex-1 cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !homeTeam || !awayTeam || homeScore === '' || awayScore === ''}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 cursor-pointer"
            >
              {submitting ? 'Recording...' : 'Record Match'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 