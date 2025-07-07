import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SHORTLIST_STORAGE_KEY = 'eafc-draft-shortlist'

// Position sorting utility - from goalkeeper to striker
const positionOrder = ['GK', 'CB', 'LB', 'LWB', 'RB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST']

const sortByPosition = (items: ShortlistItem[]): ShortlistItem[] => {
  return [...items].sort((a, b) => {
    const posA = a.position || ''
    const posB = b.position || ''
    
    const indexA = positionOrder.indexOf(posA)
    const indexB = positionOrder.indexOf(posB)
    
    // If position not found in order, put it at the end
    if (indexA === -1 && indexB === -1) return posA.localeCompare(posB)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    
    return indexA - indexB
  })
}

interface ShortlistItem {
  id: number
  shieldUrl: string
  position?: string
}

export default function ShortlistPage() {
  const navigate = useNavigate()
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([])

  useEffect(() => {
    loadShortlist()
  }, [])

  const loadShortlist = () => {
    try {
      const stored = localStorage.getItem(SHORTLIST_STORAGE_KEY)
      const items = stored ? JSON.parse(stored) : []
      // Sort by position when loading
      setShortlist(sortByPosition(items))
    } catch {
      setShortlist([])
    }
  }

  const removeFromShortlist = (playerId: number) => {
    const updatedShortlist = shortlist.filter(item => item.id !== playerId)
    localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(updatedShortlist))
    setShortlist(updatedShortlist)
  }

  const clearShortlist = () => {
    localStorage.removeItem(SHORTLIST_STORAGE_KEY)
    setShortlist([])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/players')}
              variant="outline"
              className="flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Players
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">My Shortlist</h1>
          </div>
          {shortlist.length > 0 && (
            <Button 
              onClick={clearShortlist}
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {shortlist.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Your shortlist is empty</h2>
            <p className="text-gray-500">Add players to your shortlist to see them here</p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">
              {shortlist.length} player{shortlist.length !== 1 ? 's' : ''} in your shortlist (sorted by position)
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {shortlist.map((item) => (
                <div key={item.id} className="relative group">
                  <img
                    src={item.shieldUrl}
                    alt={`Player ${item.id} Shield`}
                    className="w-full h-auto object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  
                  {/* Remove button - appears on hover */}
                  <button
                    onClick={() => removeFromShortlist(item.id)}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer"
                    title="Remove from shortlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
} 