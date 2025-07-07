import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useDraft } from '@/context/DraftContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Wifi, WifiOff, BookmarkCheck } from 'lucide-react'
import DraftInfo from '@/components/DraftInfo'
import ParticipantsList from '@/components/ParticipantsList'
import RecentPicks from '@/components/RecentPicks'
import PlayerSearchModal from '@/components/PlayerSearchModal'
import OptimalTransferModal from '@/components/OptimalTransferModal'
import TournamentView from '@/components/TournamentView'
import PlayerWalkoutAnimation from '@/components/PlayerWalkoutAnimation'
import ShortlistModal from '@/components/ShortlistModal'
import { startDraft, startTournament } from '@/lib/api'
import type { Pick } from '@/lib/api'

export default function DraftRoom() {
  const { code } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const participant = searchParams.get('participant')
  const { state, connectWebSocket, joinDraft, makePick } = useDraft()
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isOptimalTransferModalOpen, setIsOptimalTransferModalOpen] = useState(false)
  const [isShortlistModalOpen, setIsShortlistModalOpen] = useState(false)
  const [isWalkoutVisible, setIsWalkoutVisible] = useState(false)
  const [walkoutPick, setWalkoutPick] = useState<Pick | null>(null)
  const [lastPickCount, setLastPickCount] = useState(0)

  // Determine if we should show tournament view based on draft status
  const showTournamentView = state.draft?.status === 'tournament'

  // Debug logging
  console.log('DraftRoom state:', {
    code,
    participant,
    isConnected: state.isConnected,
    participantName: state.participantName,
    draft: state.draft,
    participants: state.participants,
    currentPicker: state.currentPicker,
    showTournamentView
  })

  useEffect(() => {
    if (code) {
      connectWebSocket(code)
    }
  }, [code])

  useEffect(() => {
    if (participant && state.isConnected && state.ws?.readyState === WebSocket.OPEN) {
      console.log('Ready to join draft with participant:', participant)
      joinDraft(participant)
    }
  }, [participant, state.isConnected, state.ws?.readyState])

  // Show optimal transfer modal when draft is completed and user is admin (but not in tournament mode)
  useEffect(() => {
    if (state.draft?.status === 'completed' && state.isAdmin && state.picks?.length > 0) {
      // Delay the modal opening to allow for the final walkout animation to complete
      // Walkout animation takes about 15-16 seconds
      setTimeout(() => {
        setIsOptimalTransferModalOpen(true)
      }, 22000) // 22 seconds to ensure walkout completes
    }
  }, [state.draft?.status, state.isAdmin, state.picks?.length])

  // Detect new picks and trigger walkout animation
  useEffect(() => {
    const currentPickCount = state.picks?.length || 0
    
    // Only trigger if we have picks, the count increased, and we're in active or completed draft mode
    if (currentPickCount > lastPickCount && currentPickCount > 0 && 
        (state.draft?.status === 'active' || state.draft?.status === 'completed')) {
      const latestPick = state.picks?.[currentPickCount - 1]
      if (latestPick) {
        // Close all modals before starting walkout animation to prevent z-index issues
        setIsShortlistModalOpen(false)
        setIsSearchModalOpen(false)
        setIsOptimalTransferModalOpen(false)
        setWalkoutPick(latestPick)
        setIsWalkoutVisible(true)
      }
    }
    
    setLastPickCount(currentPickCount)
  }, [state.picks?.length, lastPickCount, state.draft?.status, state.picks])

  const isMyTurn = () => {
    if (!state.currentPicker || !state.participantName) return false
    const myParticipant = state.participants.find(p => p.name === state.participantName)

    // Debug logging
    console.log('Debug turn check:', {
      currentPicker: state.currentPicker,
      participantName: state.participantName,
      myParticipant: myParticipant,
      myDraftOrder: myParticipant?.draftOrder,
      isMyTurn: myParticipant?.draftOrder === state.currentPicker
    })

    return myParticipant?.draftOrder === state.currentPicker
  }

  const handlePlayerSelect = async (playerId: number) => {
    try {
      await makePick(playerId)
    } catch (error) {
      console.error('Error making pick:', error)
      // Error handling is done in the PlayerSearchModal component
      throw error
    }
  }

  const handleStartDraft = async () => {
    if (!state.isAdmin || !state.participantName || !code) return
    
    try {
      await startDraft(code, { adminName: state.participantName })
      // The WebSocket will automatically receive the updated draft state
    } catch (error) {
      console.error('Error starting draft:', error)
      alert(`Failed to start draft: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleProceedToPlay = async () => {
    if (!state.isAdmin || !state.participantName || !code) return
    
    try {
      await startTournament(code, { adminName: state.participantName })
      // The WebSocket will automatically receive the updated draft state and show tournament view
      setIsOptimalTransferModalOpen(false)
    } catch (error) {
      console.error('Error starting tournament:', error)
      alert(`Failed to start tournament: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleWalkoutComplete = () => {
    setIsWalkoutVisible(false)
    setWalkoutPick(null)
  }

  if (!state.draft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connecting to Draft</h2>
          <p className="text-gray-600 mb-4">Joining draft room...</p>
          <Badge variant="outline" className="text-sm">
            Code: {code}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{state.draft.name}</h1>
              <div className="flex items-center gap-4 mt-1">
                <Badge variant="outline" className="text-sm">
                  Code: {state.draft.code}
                </Badge>
                <div className="flex items-center gap-1">
                  {state.isConnected ? (
                    <>
                      <Wifi className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-600 font-medium">Disconnected</span>
                    </>
                  )}
                </div>
                <Button
                  onClick={() => setIsShortlistModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="text-sm cursor-pointer"
                >
                  <BookmarkCheck className="w-4 h-4 mr-1" />
                  Shortlist
                </Button>
              </div>
            </div>

            {state.draft.status === 'active' && (
              <Button
                onClick={() => setIsSearchModalOpen(true)}
                disabled={!isMyTurn()}
                size="lg"
                className={`${
                  isMyTurn() 
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg animate-pulse cursor-pointer' 
                    : 'bg-gray-400 cursor-not-allowed'
                } text-white font-semibold px-6`}
              >
                <Search className="w-5 h-5 mr-2" />
                {isMyTurn() ? 'Draft Player' : 'Not Your Turn'}
              </Button>
            )}

            {state.draft.status === 'waiting' && state.isAdmin && (
              <Button
                onClick={handleStartDraft}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 shadow-lg cursor-pointer"
              >
                Start Draft
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {/* Status Banner */}
        {state.draft.status === 'waiting' && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-4 mb-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <div>
                <h3 className="font-semibold">Waiting for Draft to Start</h3>
                <p className="text-blue-100 text-sm">
                  The admin will start the draft once all participants are ready.
                </p>
              </div>
            </div>
          </div>
        )}

        {state.draft.status === 'tournament' && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg p-4 mb-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <div>
                <h3 className="font-semibold">Tournament Phase</h3>
                <p className="text-green-100 text-sm">
                  The draft is complete. Time to play matches and compete for the championship!
                </p>
              </div>
            </div>
          </div>
        )}

        {isMyTurn() && state.draft.status === 'active' && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg p-4 mb-6 shadow-lg animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                <div>
                  <h3 className="font-semibold">Your Turn!</h3>
                  <p className="text-green-100 text-sm">Click "Draft Player" to search for a player</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Area - Draft or Tournament */}
        {showTournamentView ? (
          <TournamentView 
            draftCode={code || ''}
            participantName={state.participantName || ''}
            isAdmin={state.isAdmin || false}
          />
        ) : (
          /* Draft Grid */
          <div className="grid grid-cols-3 gap-6 h-[calc(100vh-300px)]">
            <DraftInfo draft={state.draft} currentPicker={state.currentPicker} participants={state.participants} />
            <ParticipantsList 
              participants={state.participants} 
              participantName={state.participantName}
              currentPicker={state.currentPicker}
              picks={state.picks}
            />
            <RecentPicks picks={state.picks} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Draft ID: {state.draft.id} • Room Code: {state.draft.code}</p>
        </div>
      </div>

      {/* Player Search Modal */}
      <PlayerSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectPlayer={handlePlayerSelect}
        isMyTurn={isMyTurn()}
      />

      {/* Optimal Transfer Modal */}
      <OptimalTransferModal
        isOpen={isOptimalTransferModalOpen}
        onClose={() => setIsOptimalTransferModalOpen(false)}
        draftCode={code || ''}
        onProceedToPlay={handleProceedToPlay}
      />

      {/* Shortlist Modal */}
      <ShortlistModal
        isOpen={isShortlistModalOpen}
        onClose={() => setIsShortlistModalOpen(false)}
      />

      {/* Player Walkout Animation */}
      <PlayerWalkoutAnimation
        isVisible={isWalkoutVisible}
        pick={walkoutPick}
        onComplete={handleWalkoutComplete}
      />
    </div>
  )
}