import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Player } from '@/lib/api'

interface PlayerDetailModalProps {
  isOpen: boolean
  onClose: () => void
  player: Player | null
}

const SHORTLIST_STORAGE_KEY = 'eafc-draft-shortlist'

export default function PlayerDetailModal({ isOpen, onClose, player }: PlayerDetailModalProps) {
  const [isShortlisted, setIsShortlisted] = useState(false)

  // Check if player is already shortlisted
  useEffect(() => {
    if (player?.id) {
      const shortlist = getShortlist()
      setIsShortlisted(shortlist.some(item => item.id === player.id))
    }
  }, [player?.id])

  const getShortlist = (): Array<{id: number, shieldUrl: string, position?: string}> => {
    try {
      const stored = localStorage.getItem(SHORTLIST_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  const toggleShortlist = () => {
    if (!player?.id || !player?.shieldUrl) return

    const shortlist = getShortlist()
    let newShortlist: Array<{id: number, shieldUrl: string, position?: string}>

    if (isShortlisted) {
      newShortlist = shortlist.filter(item => item.id !== player.id)
    } else {
      newShortlist = [...shortlist, { 
        id: player.id, 
        shieldUrl: player.shieldUrl,
        position: player.positionShortLabel || ''
      }]
    }

    localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(newShortlist))
    setIsShortlisted(!isShortlisted)
  }

  const getPlayerDisplayName = (player: Player) => {
    return player?.commonName || `${player?.firstName || ''} ${player?.lastName || ''}`.trim()
  }

  const getStatColor = (value: number): string => {
    if (value >= 90) return 'text-green-900 bg-green-800 text-white'
    if (value >= 80) return 'text-green-800 bg-green-100'
    if (value >= 70) return 'text-yellow-800 bg-yellow-200'
    if (value >= 60) return 'text-orange-800 bg-orange-300'
    return 'text-red-900 bg-red-400 text-white'
  }


  // Detailed stats grouped by category (matching the filter structure)
  const statCategories = [
    {
      name: 'Pace',
      stats: [
        { label: 'Acceleration', value: player?.statAcceleration },
        { label: 'Sprint Speed', value: player?.statSprintSpeed },
      ]
    },
    {
      name: 'Shooting',
      stats: [
        { label: 'Finishing', value: player?.statFinishing },
        { label: 'Shot Power', value: player?.statShotPower },
        { label: 'Long Shots', value: player?.statLongShots },
        { label: 'Volleys', value: player?.statVolleys },
        { label: 'Penalties', value: player?.statPenalties },
      ]
    },
    {
      name: 'Passing',
      stats: [
        { label: 'Crossing', value: player?.statCrossing },
        { label: 'Curve', value: player?.statCurve },
        { label: 'FK Accuracy', value: player?.statFreeKickAccuracy },
        { label: 'Short Passing', value: player?.statShortPassing },
        { label: 'Long Passing', value: player?.statLongPassing },
        { label: 'Vision', value: player?.statVision },
      ]
    },
    {
      name: 'Dribbling',
      stats: [
        { label: 'Ball Control', value: player?.statBallControl },
        { label: 'Dribbling', value: player?.statDribbling },
        { label: 'Composure', value: player?.statComposure },
        { label: 'Agility', value: player?.statAgility },
        { label: 'Balance', value: player?.statBalance },
        { label: 'Reactions', value: player?.statReactions },
      ]
    },
    {
      name: 'Defending',
      stats: [
        { label: 'Defensive Awareness', value: player?.statDefensiveAwareness },
        { label: 'Standing Tackle', value: player?.statStandingTackle },
        { label: 'Sliding Tackle', value: player?.statSlidingTackle },
        { label: 'Interceptions', value: player?.statInterceptions },
        { label: 'Heading Accuracy', value: player?.statHeadingAccuracy },
      ]
    },
    {
      name: 'Physical',
      stats: [
        { label: 'Jumping', value: player?.statJumping },
        { label: 'Stamina', value: player?.statStamina },
        { label: 'Strength', value: player?.statStrength },
        { label: 'Aggression', value: player?.statAggression },
      ]
    },
    {
      name: 'Goalkeeping',
      stats: [
        { label: 'GK Diving', value: player?.statGkDiving },
        { label: 'GK Handling', value: player?.statGkHandling },
        { label: 'GK Kicking', value: player?.statGkKicking },
        { label: 'GK Positioning', value: player?.statGkPositioning },
        { label: 'GK Reflexes', value: player?.statGkReflexes },
      ]
    }
  ]

  // Get player abilities with images
  const getPlayerAbilities = () => {
    if (!player?.playerAbilitiesLabels || !player?.playerAbilitiesImages) return []
    
    const labels = player.playerAbilitiesLabels.split('|')
    const images = player.playerAbilitiesImages.split('|')
    
    return labels.map((label, index) => ({
      label: label.trim(),
      image: images[index]?.trim()
    })).filter(ability => ability.label && ability.image)
  }

  if (!player) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-h-[95vh] overflow-hidden flex flex-col"
        style={{ width: '95vw', maxWidth: '1400px' }}
      >
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold">
            {getPlayerDisplayName(player)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-6">
          {/* Left Side - Shield (Sticky) */}
          <div className="w-80 flex-shrink-0 flex flex-col items-center space-y-4 p-4">
            {/* Add to Shortlist Button */}
            <Button
              onClick={toggleShortlist}
              className={`w-full cursor-pointer ${isShortlisted 
                ? "bg-red-500 hover:bg-red-600 text-white" 
                : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
              }`}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
            </Button>

            {/* Shield Image */}
            {player.shieldUrl && (
              <div className="flex justify-center">
                <img
                  src={player.shieldUrl}
                  alt={`${getPlayerDisplayName(player)} Shield`}
                  className="w-64 h-80 object-contain"
                  onError={(e) => {
                    console.log('Shield image failed to load:', player.shieldUrl)
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>

          {/* Right Side - All Info (Scrollable) */}
          <div className="flex-1 overflow-y-auto scrollbar-minimal">
            <div className="space-y-6">
              {/* Player Info */}
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {/* Basic Info Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Skill Moves</div>
                        <div className="font-semibold">{player.skillMoves}★</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Weak Foot</div>
                        <div className="font-semibold">{player.weakFoot}★</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-gray-600">Preferred Foot</div>
                        <div className="font-semibold">
                          {player.preferredFoot === 1 ? 'Right' : player.preferredFoot === 2 ? 'Left' : 'Unknown'}
                        </div>
                      </div>
                    </div>

                    {/* Alternate Positions */}
                    {player.alternatePositions && (
                      <div>
                        <div className="text-gray-600 text-sm mb-2">Alternate Positions</div>
                        <div className="flex flex-wrap gap-1">
                          {player.alternatePositions.split('|').map((pos, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {pos.trim()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Player Abilities */}
                    {getPlayerAbilities().length > 0 && (
                      <div>
                        <div className="text-gray-600 text-sm mb-3">Player Abilities</div>
                        <TooltipProvider>
                          <div className="flex flex-wrap gap-3">
                            {getPlayerAbilities().map((ability, index) => (
                              <Tooltip key={index}>
                                <TooltipTrigger asChild>
                                  <div className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-help transition-colors">
                                    <img
                                      src={ability.image}
                                      alt={ability.label}
                                      className="w-12 h-12 object-contain"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{ability.label}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>


              {/* Detailed Stats */}
              <div className="grid grid-cols-2 gap-6">
                {statCategories.map((category) => (
                  <Card key={category.name}>
                    <CardHeader>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {category.stats.map((stat) => (
                          <div key={stat.label} className="flex justify-between items-center">
                            <span className="text-sm">{stat.label}</span>
                            <span className={`px-2 py-1 rounded text-sm font-medium ${getStatColor(stat.value || 0)}`}>
                              {stat.value || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>


            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 