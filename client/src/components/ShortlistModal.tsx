import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

interface ShortlistModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ShortlistModal({ isOpen, onClose }: ShortlistModalProps) {
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([])

  useEffect(() => {
    if (isOpen) {
      loadShortlist()
    }
  }, [isOpen])

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-h-[90vh] overflow-hidden flex flex-col"
        style={{ width: '90vw', maxWidth: '1200px' }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            My Shortlist
          </DialogTitle>
          {shortlist.length > 0 && (
            <p className="text-gray-600">
              {shortlist.length} player{shortlist.length !== 1 ? 's' : ''} in your shortlist (sorted by position)
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-minimal">
          {shortlist.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Your shortlist is empty</h2>
              <p className="text-gray-500">Add players to your shortlist from the player database</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-2">
              {shortlist.map((item) => (
                <div key={item.id} className="flex justify-center">
                  <img
                    src={item.shieldUrl}
                    alt={`Player ${item.id} Shield`}
                    className="w-full h-auto object-contain max-w-[200px]"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 