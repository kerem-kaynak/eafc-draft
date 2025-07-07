import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, LogIn, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createDraft, joinDraft } from '@/lib/api'

export default function HomePage() {
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const createDraftHandler = async () => {
    if (!draftName.trim() || !adminName.trim()) return
    setLoading(true)

    try {
      const response = await createDraft({
        name: draftName,
        adminName: adminName
      })
      navigate(`/draft/${response.draft.code}?participant=${adminName}`)
    } catch (error) {
      console.error('Error creating draft:', error)
      alert(`Failed to create draft: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const joinDraftHandler = async () => {
    if (!joinCode.trim() || !participantName.trim()) return
    setLoading(true)

    try {
      await joinDraft(joinCode, { name: participantName })
      navigate(`/draft/${joinCode}?participant=${participantName}`)
    } catch (error) {
      console.error('Error joining draft:', error)
      alert(`Failed to join draft: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">FIFA Draft</h1>
          <p className="text-muted-foreground">
            Create or join a FIFA player draft with friends
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {!isCreating && !isJoining && (
              <div className="space-y-4">
                <Button onClick={() => setIsCreating(true)} className="w-full cursor-pointer" size="lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Create New Draft
                </Button>
                
                <Button onClick={() => setIsJoining(true)} variant="outline" className="w-full cursor-pointer" size="lg">
                  <LogIn className="h-5 w-5 mr-2" />
                  Join Existing Draft
                </Button>

                <div className="border-t pt-4">
                  <Button onClick={() => navigate('/players')} variant="secondary" className="w-full cursor-pointer" size="lg">
                    <Search className="h-5 w-5 mr-2" />
                    Browse Players
                  </Button>
                </div>
              </div>
            )}

            {isCreating && (
              <div className="space-y-4">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Create Draft</CardTitle>
                  <CardDescription>Set up a new FIFA draft</CardDescription>
                </CardHeader>
                
                <div className="space-y-4">
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Draft Name"
                  />
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Your Name"
                  />
                  
                  <div className="flex gap-2">
                    <Button onClick={() => setIsCreating(false)} variant="outline" className="flex-1 cursor-pointer">
                      Cancel
                    </Button>
                    <Button onClick={createDraftHandler} disabled={!draftName.trim() || !adminName.trim() || loading} className="flex-1 cursor-pointer">
                      {loading ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isJoining && (
              <div className="space-y-4">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Join Draft</CardTitle>
                  <CardDescription>Enter the draft code</CardDescription>
                </CardHeader>
                
                <div className="space-y-4">
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Draft Code"
                    className="font-mono"
                  />
                  <Input
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Your Name"
                  />
                  
                  <div className="flex gap-2">
                    <Button onClick={() => setIsJoining(false)} variant="outline" className="flex-1 cursor-pointer">
                      Cancel
                    </Button>
                    <Button onClick={joinDraftHandler} disabled={!joinCode.trim() || !participantName.trim() || loading} className="flex-1 cursor-pointer">
                      {loading ? "Joining..." : "Join"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}