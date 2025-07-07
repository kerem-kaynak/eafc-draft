import { useEffect, useState } from 'react'
import type { Pick } from '@/lib/api'
import confetti from 'canvas-confetti'

interface PlayerWalkoutAnimationProps {
  isVisible: boolean
  pick: Pick | null
  onComplete: () => void
}

type AnimationPhase = 'newSigning' | 'nationality' | 'position' | 'team' | 'shield' | 'complete'

export default function PlayerWalkoutAnimation({ isVisible, pick, onComplete }: PlayerWalkoutAnimationProps) {
  const [currentPhase, setCurrentPhase] = useState<AnimationPhase>('newSigning')
  const [fadeClass, setFadeClass] = useState('opacity-0')
  const [overlayFadeClass, setOverlayFadeClass] = useState('opacity-0')


  // Preload shield image function
  const preloadShieldImage = (url: string): Promise<void> => {
    return new Promise((resolve) => {
      console.log('Starting to preload shield image:', url)
      const img = new Image()
      img.onload = () => {
        console.log('Shield image loaded successfully')
        resolve()
      }
      img.onerror = () => {
        console.log('Shield image failed to load')
        resolve() // Resolve anyway to continue animation
      }
      img.src = url
    })
  }

  // Fireworks confetti effect
  const triggerFireworks = () => {
    const duration = 3000 // 3 seconds of fireworks
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      
      // since particles fall down, start a bit higher than random
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)
  }

  // Stars confetti effect for shield phase
  const triggerStars = () => {
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      shapes: ['star'],
      colors: ['FFE400', 'FFBD00', 'E89611', 'E89611', 'FFCA28'],
      zIndex: 9999
    }

    function shoot() {
      confetti({
        ...defaults,
        particleCount: 40,
        scalar: 1.2,
        shapes: ['star']
      })

      confetti({
        ...defaults,
        particleCount: 10,
        scalar: 0.75,
        shapes: ['circle']
      })
    }

    setTimeout(shoot, 0)
    setTimeout(shoot, 100)
    setTimeout(shoot, 200)
  }

  useEffect(() => {
    if (!isVisible || !pick) {
      setCurrentPhase('newSigning')
      setFadeClass('opacity-0')
      setOverlayFadeClass('opacity-0')
      return
    }

    // Start the animation sequence
    const sequence = async () => {
      // Trigger fireworks immediately when animation starts
      triggerFireworks()
      
      // Preload shield image at the start of animation
      let shieldImagePromise: Promise<void> | null = null
      if (pick.player?.shieldUrl) {
        shieldImagePromise = preloadShieldImage(pick.player.shieldUrl)
      }
      
      // Fade in overlay first (800ms)
      setOverlayFadeClass('opacity-100')
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Phase 1: New Signing text (1s fade-in + 1s display + 1s fade-out)
      setCurrentPhase('newSigning')
      await new Promise(resolve => setTimeout(resolve, 50)) // Small delay for DOM update
      setFadeClass('opacity-100')
      await new Promise(resolve => setTimeout(resolve, 2000)) // 1s fade-in + 1s display
      setFadeClass('opacity-0')
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1s fade-out

      // Phase 2: Nationality (1s fade-in + 1s display + 1s fade-out)
      setCurrentPhase('nationality')
      await new Promise(resolve => setTimeout(resolve, 50))
      setFadeClass('opacity-100')
      await new Promise(resolve => setTimeout(resolve, 2000))
      setFadeClass('opacity-0')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Phase 3: Position (1s fade-in + 1s display + 1s fade-out)
      setCurrentPhase('position')
      await new Promise(resolve => setTimeout(resolve, 50))
      setFadeClass('opacity-100')
      await new Promise(resolve => setTimeout(resolve, 2000))
      setFadeClass('opacity-0')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Phase 4: Team (1s fade-in + 1s display + 1s fade-out)
      setCurrentPhase('team')
      await new Promise(resolve => setTimeout(resolve, 50))
      setFadeClass('opacity-100')
      await new Promise(resolve => setTimeout(resolve, 2000))
      setFadeClass('opacity-0')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Phase 5: Shield (2s fade-in + 4s display + 2s fade-out)
      setCurrentPhase('shield')
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Wait for shield image to load before fading in
      if (shieldImagePromise) {
        console.log('Waiting for shield image to finish loading...')
        await shieldImagePromise
        console.log('Shield image ready, proceeding with fade-in')
      }
      
      // Trigger stars effect when shield appears
      triggerStars()
      
      setFadeClass('opacity-100')
      await new Promise(resolve => setTimeout(resolve, 6000)) // 2s fade-in + 4s display
      setFadeClass('opacity-0')
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2s fade-out

      // Fade out overlay (800ms)
      setOverlayFadeClass('opacity-0')
      await new Promise(resolve => setTimeout(resolve, 800))

      // Complete
      setCurrentPhase('complete')
      onComplete()
    }

    sequence()
  }, [isVisible, pick, onComplete])

  if (!isVisible || !pick) return null

  const getPlayerDisplayName = (player: Pick['player']) => {
    return player?.commonName || `${player?.firstName || ''} ${player?.lastName || ''}`.trim()
  }

  return (
    <div className={`fixed inset-0 z-[9999] bg-zinc-950 flex items-center justify-center transition-opacity duration-700 ${overlayFadeClass}`} style={{ backgroundColor: '#0a0a0a' }}>
      <div className="text-center">
        {/* New Signing Phase */}
        {currentPhase === 'newSigning' && (
          <div className={`transition-opacity duration-[1000ms] ${fadeClass}`}>
            <div className="mb-8">
              <h2 className="text-white text-5xl font-bold">New Signing!</h2>
            </div>
          </div>
        )}

        {/* Nationality Phase */}
        {currentPhase === 'nationality' && (
          <div className={`transition-opacity duration-[1000ms] ${fadeClass}`}>
            <div className="mb-8">
              <div className="flex flex-col items-center">
                {pick.player?.nationalityImageUrl && (
                  <img
                    src={pick.player.nationalityImageUrl}
                    alt={pick.player.nationalityLabel || 'Nation'}
                    className="w-48 h-48 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Position Phase */}
        {currentPhase === 'position' && (
          <div className={`transition-opacity duration-[1000ms] ${fadeClass}`}>
            <div className="mb-8">
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-4xl font-bold">
                    {pick.player?.positionShortLabel || 'POS'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Phase */}
        {currentPhase === 'team' && (
          <div className={`transition-opacity duration-[1000ms] ${fadeClass}`}>
            <div className="mb-8">
              <div className="flex flex-col items-center">
                {pick.player?.teamImageUrl ? (
                  <img
                    src={pick.player.teamImageUrl}
                    alt={pick.player.teamLabel || 'Team'}
                    className="w-40 h-40 object-contain"
                    onError={(e) => {
                      // Fallback to text box if image fails
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.parentElement?.querySelector('.team-fallback') as HTMLElement
                      if (fallback) fallback.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div 
                  className="w-40 h-40 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center team-fallback"
                  style={{ display: pick.player?.teamImageUrl ? 'none' : 'flex' }}
                >
                  <span className="text-white text-lg font-bold text-center px-2">
                    {pick.player?.teamLabel || 'Team'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shield Phase */}
        {currentPhase === 'shield' && (
          <div className={`transition-opacity duration-[2000ms] ${fadeClass}`}>
            <div className="mb-8">
              <div className="flex flex-col items-center">
                {pick.player?.shieldUrl && (
                  <img
                    src={pick.player.shieldUrl}
                    alt={getPlayerDisplayName(pick.player)}
                    className="w-64 h-80 object-contain mb-6"
                  />
                )}
                
                <div className="text-center text-white">
                  <p className="text-xl text-gray-300">
                    Drafted by <span className="font-semibold text-white">{pick.participantName}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 