import { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Draft, Participant, Pick, WebSocketMessage, WebSocketMessageData } from '@/lib/api'

interface DraftState {
  // Connection state
  isConnected: boolean
  ws: WebSocket | null
  
  // Draft state
  draft: Draft | null
  participants: Participant[]
  picks: Pick[]
  currentPicker: number | null
  
  // Tournament state
  tournamentData: any | null // Tournament-specific data from WebSocket
  
  // User state
  participantName: string
  isAdmin: boolean
}

interface DraftAction {
  type: string
  payload?: WebSocketMessageData | boolean | WebSocket | string
}

interface PendingPick {
  playerId: number
  resolve: () => void
  reject: (error: Error) => void
}

const initialState: DraftState = {
  isConnected: false,
  ws: null,
  draft: null,
  participants: [],
  picks: [],
  currentPicker: null,
  tournamentData: null,
  participantName: '',
  isAdmin: false,
}

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'SET_WEBSOCKET':
      return { ...state, ws: action.payload as WebSocket }
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload as boolean }
    case 'SET_PARTICIPANT_NAME':
      return { ...state, participantName: action.payload as string }
    case 'UPDATE_DRAFT_STATE':
      const payload = action.payload as WebSocketMessageData
      const { draft, participants, picks, currentPicker } = payload
      return {
        ...state,
        draft: draft || state.draft,
        participants: participants || state.participants,
        picks: picks || state.picks,
        currentPicker: currentPicker !== undefined ? currentPicker : state.currentPicker,
        isAdmin: participants?.find((p: Participant) => p.name === state.participantName)?.isAdmin || false
      }
    case 'UPDATE_TOURNAMENT_STATE':
      return {
        ...state,
        tournamentData: action.payload,
      }
    default:
      return state
  }
}

const DraftContext = createContext<{
  state: DraftState
  connectWebSocket: (draftCode: string) => void
  joinDraft: (participantName: string) => void
  makePick: (playerId: number) => Promise<void>
} | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(draftReducer, initialState)
  const pendingPickRef = useRef<PendingPick | null>(null)

  const connectWebSocket = (draftCode: string) => {
    if (state.ws) {
      state.ws.close()
    }
  
    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080'
    const ws = new WebSocket(`${wsBaseUrl}/ws/drafts/${draftCode}`)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
      dispatch({ type: 'SET_CONNECTED', payload: true })
    }
    
    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data)
      console.log('WebSocket message:', message)
      
      if (message.type === 'draftState') {
        dispatch({ type: 'UPDATE_DRAFT_STATE', payload: message.data })
        
        // If we have a pending pick and the draft state updated, 
        // check if the pick was successful
        if (pendingPickRef.current) {
          const { playerId } = pendingPickRef.current
          
          // Check if the player was picked (appears in the picks)
          const picks = message.data.picks || []
          // Check if the player was picked (appears in the picks)
          const wasPickSuccessful = picks.some((pick: Pick) => {
            // The player ID is stored in the playerId field of the pick object
            return (pick as any).playerId === playerId
          })
          
          if (wasPickSuccessful) {
            // Clear the ref first, then resolve to prevent race conditions
            const currentPendingPick = pendingPickRef.current
            pendingPickRef.current = null
            currentPendingPick.resolve()
          }
        }
      } else if (message.type === 'tournamentState') {
        dispatch({ type: 'UPDATE_TOURNAMENT_STATE', payload: message.data })
      } else if (message.type === 'joined') {
        console.log('Successfully joined draft room')
      } else if (message.type === 'pickError') {
        console.error('Pick error:', message.data)
        
        // Reject the pending pick promise
        if (pendingPickRef.current) {
          const errorMessage = message.data?.error || 'Failed to pick player'
          pendingPickRef.current.reject(new Error(errorMessage))
          pendingPickRef.current = null
        }
      }
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
      dispatch({ type: 'SET_CONNECTED', payload: false })
      
      // Reject any pending pick
      if (pendingPickRef.current) {
        pendingPickRef.current.reject(new Error('Connection lost'))
        pendingPickRef.current = null
      }
    }
    
    dispatch({ type: 'SET_WEBSOCKET', payload: ws })
  }
  
  const joinDraft = (participantName: string) => {
    console.log('joinDraft called with:', participantName)
    dispatch({ type: 'SET_PARTICIPANT_NAME', payload: participantName })
    
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      console.log('Sending join message for:', participantName)
      console.log('WebSocket state:', state.ws.readyState)
      state.ws.send(JSON.stringify({
        type: 'join',
        data: { participantName }
      }))
    } else {
      console.log('WebSocket not ready:', state.ws?.readyState)
    }
  }

  const makePick = (playerId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to draft'))
        return
      }

      if (pendingPickRef.current) {
        reject(new Error('Another pick is already in progress'))
        return
      }

      // Set up timeout for the pick (1 minute - generous time for player selection)
      const timeoutId = setTimeout(() => {
        if (pendingPickRef.current && pendingPickRef.current.playerId === playerId) {
          // Check if the pick was actually successful before timing out
          const picks = state.picks || []
          const wasPickSuccessful = picks.some((pick: Pick) => (pick as any).playerId === playerId)
          
          if (wasPickSuccessful) {
            // Pick was successful, just resolve without error
            const currentPendingPick = pendingPickRef.current
            pendingPickRef.current = null
            currentPendingPick.resolve()
          } else {
            // Actually timed out
            const currentPendingPick = pendingPickRef.current
            pendingPickRef.current = null
            currentPendingPick.reject(new Error('Pick request timed out'))
          }
        }
              }, 60000)

      // Store the pending pick
      pendingPickRef.current = {
        playerId,
        resolve: () => {
          clearTimeout(timeoutId)
          resolve()
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId)
          reject(error)
        }
      }

      // Send the pick message
      state.ws.send(JSON.stringify({
        type: 'makePick',
        data: {
          participantName: state.participantName,
          playerId
        }
      }))
    })
  }

  useEffect(() => {
    return () => {
      if (state.ws) {
        state.ws.close()
      }
      // Clean up any pending pick
      if (pendingPickRef.current) {
        pendingPickRef.current.reject(new Error('Component unmounted'))
        pendingPickRef.current = null
      }
    }
  }, [state.ws])

  return (
    <DraftContext.Provider value={{ state, connectWebSocket, joinDraft, makePick }}>
      {children}
    </DraftContext.Provider>
  )
}

export function useDraft() {
  const context = useContext(DraftContext)
  if (!context) {
    throw new Error('useDraft must be used within a DraftProvider')
  }
  return context
}