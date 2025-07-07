import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, RotateCcw, Settings, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Heart, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getPlayers, getPlayerEnums, type Player, type PlayerEnumsResponse } from '@/lib/api'
import PlayerDetailModal from '@/components/PlayerDetailModal'

const SHORTLIST_STORAGE_KEY = 'eafc-draft-shortlist'

// Debounce utility
const debounce = <T extends (...args: any[]) => any>(func: T, delay: number) => {
  let timeoutId: number
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => func(...args), delay)
  }
}

// Position sorting utility - from goalkeeper to striker
const positionOrder = ['GK', 'CB', 'LB', 'LWB', 'RB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST']

const sortPositions = (positions: string[]): string[] => {
  return [...positions].sort((a, b) => {
    const indexA = positionOrder.indexOf(a)
    const indexB = positionOrder.indexOf(b)
    
    // If position not found in order, put it at the end
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    
    return indexA - indexB
  })
}

// Unaccent utility for frontend text normalization
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics/accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
    .trim()
}

// Searchable Multi-Select Component
const SearchableMultiSelect = ({ 
  label, 
  options, 
  selected, 
  onSelectionChange,
  placeholder = "Select options..."
}: { 
  label: string; 
  options: string[]; 
  selected: string[]; 
  onSelectionChange: (value: string, checked: boolean) => void;
  placeholder?: string;
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [triggerRef, setTriggerRef] = useState<HTMLDivElement | null>(null)
  
  const filteredOptions = options.filter(option => 
    normalizeText(option).includes(normalizeText(searchTerm))
  )

  const getDropdownPosition = () => {
    if (!triggerRef) return { top: 0, left: 0, width: 0 }
    const rect = triggerRef.getBoundingClientRect()
    return {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <div 
          ref={setTriggerRef}
          className="flex min-h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selected.slice(0, 2).map(item => (
                <Badge key={item} variant="secondary" className="text-xs h-5">
                  {item}
                  <button 
                    className="ml-1 hover:text-red-600 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectionChange(item, false)
                    }}
                  >
                    ×
                  </button>
                </Badge>
              ))
            )}
            {selected.length > 2 && (
              <Badge variant="secondary" className="text-xs h-5">
                +{selected.length - 2} more
              </Badge>
            )}
          </div>
          <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {/* Portal the dropdown to body to avoid z-index issues */}
      {isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div 
            className="fixed z-[9999] bg-white border rounded-md shadow-lg max-h-60 overflow-hidden"
            style={getDropdownPosition()}
          >
            <div className="p-2 border-b">
              <Input
                placeholder={`Search ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No options found</div>
              ) : (
                filteredOptions.map(option => (
                  <div 
                    key={option} 
                    className="flex items-center space-x-2 p-2 hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      onSelectionChange(option, !selected.includes(option))
                    }}
                  >
                    <Checkbox
                      checked={selected.includes(option)}
                      onCheckedChange={() => {}}
                    />
                    <span className="text-sm">{option}</span>
                  </div>
                ))
              )}
            </div>
            {selected.length > 0 && (
              <div className="p-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-7 text-xs cursor-pointer"
                  onClick={() => {
                    selected.forEach(item => onSelectionChange(item, false))
                  }}
                >
                  Clear All
                </Button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

interface PlayerFilters {
  // Text fields
  name: string
  first_name: string
  last_name: string
  common_name: string
  nationality_label: string[]
  team_label: string[]
  league_name: string[]
  position_short_label: string[]
  alternate_positions: string
  player_abilities_labels: string[]
  
  // Numeric range fields - ONLY REAL DATABASE COLUMNS
  id: { min?: number; max?: number }
  overall_rating: { min?: number; max?: number }
  skill_moves: { min?: number; max?: number }
  weak_foot: { min?: number; max?: number }
  preferred_foot: { min?: number; max?: number }
  // ALL STAT COLUMNS FROM DATABASE
  stat_acceleration: { min?: number; max?: number }
  stat_agility: { min?: number; max?: number }
  stat_jumping: { min?: number; max?: number }
  stat_stamina: { min?: number; max?: number }
  stat_strength: { min?: number; max?: number }
  stat_aggression: { min?: number; max?: number }
  stat_balance: { min?: number; max?: number }
  stat_ball_control: { min?: number; max?: number }
  stat_composure: { min?: number; max?: number }
  stat_crossing: { min?: number; max?: number }
  stat_curve: { min?: number; max?: number }
  stat_def: { min?: number; max?: number }
  stat_defensive_awareness: { min?: number; max?: number }
  stat_dri: { min?: number; max?: number }
  stat_dribbling: { min?: number; max?: number }
  stat_finishing: { min?: number; max?: number }
  stat_free_kick_accuracy: { min?: number; max?: number }
  stat_gk_diving: { min?: number; max?: number }
  stat_gk_handling: { min?: number; max?: number }
  stat_gk_kicking: { min?: number; max?: number }
  stat_gk_positioning: { min?: number; max?: number }
  stat_gk_reflexes: { min?: number; max?: number }
  stat_heading_accuracy: { min?: number; max?: number }
  stat_interceptions: { min?: number; max?: number }
  stat_long_passing: { min?: number; max?: number }
  stat_long_shots: { min?: number; max?: number }
  stat_pac: { min?: number; max?: number }
  stat_pas: { min?: number; max?: number }
  stat_penalties: { min?: number; max?: number }
  stat_phy: { min?: number; max?: number }
  stat_positioning: { min?: number; max?: number }
  stat_reactions: { min?: number; max?: number }
  stat_sho: { min?: number; max?: number }
  stat_short_passing: { min?: number; max?: number }
  stat_shot_power: { min?: number; max?: number }
  stat_sliding_tackle: { min?: number; max?: number }
  stat_sprint_speed: { min?: number; max?: number }
  stat_standing_tackle: { min?: number; max?: number }
  stat_vision: { min?: number; max?: number }
  stat_volleys: { min?: number; max?: number }
}

interface ColumnConfig {
  key: string
  label: string
  visible: boolean
  category: 'basic' | 'physical' | 'technical' | 'mental' | 'goalkeeping'
}

interface SortConfig {
  key: string | null
  direction: 'asc' | 'desc'
}

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalItems: number
  hasNext: boolean
  hasPrevious: boolean
}

// Move RangeFilter outside to prevent recreating on every render
const RangeFilter = ({ label, filterKey, min = 0, max = 99, filters, updateRangeFilter }: { 
  label: string; 
  filterKey: keyof PlayerFilters; 
  min?: number; 
  max?: number; 
  filters: PlayerFilters;
  updateRangeFilter: (key: keyof PlayerFilters, type: 'min' | 'max', value: string) => void;
}) => {
  const range = filters[filterKey] as { min?: number; max?: number }
  const [minValue, setMinValue] = useState(range.min?.toString() || '')
  const [maxValue, setMaxValue] = useState(range.max?.toString() || '')
  
  // Update local state when filters change from outside
  useEffect(() => {
    setMinValue(range.min?.toString() || '')
    setMaxValue(range.max?.toString() || '')
  }, [range.min, range.max])
  
  // Debounced update functions
  const debouncedUpdateMin = useCallback(
    debounce((value: string) => updateRangeFilter(filterKey, 'min', value), 300),
    [filterKey, updateRangeFilter]
  )
  
  const debouncedUpdateMax = useCallback(
    debounce((value: string) => updateRangeFilter(filterKey, 'max', value), 300),
    [filterKey, updateRangeFilter]
  )
  
  const handleMinChange = (value: string) => {
    setMinValue(value)
    debouncedUpdateMin(value)
  }
  
  const handleMaxChange = (value: string) => {
    setMaxValue(value)
    debouncedUpdateMax(value)
  }
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder={`${min}`}
          min={min}
          max={max}
          value={minValue}
          onChange={(e) => handleMinChange(e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          type="number"
          placeholder={`${max}`}
          min={min}
          max={max}
          value={maxValue}
          onChange={(e) => handleMaxChange(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
    </div>
  )
}

const defaultColumns: ColumnConfig[] = [
  // Basic info
  { key: 'name', label: 'Name', visible: true, category: 'basic' },
  { key: 'overall_rating', label: 'OVR', visible: true, category: 'basic' },
  { key: 'position', label: 'Position', visible: true, category: 'basic' },
  { key: 'alternate_positions', label: 'Alt Positions', visible: false, category: 'basic' },
  { key: 'team', label: 'Team', visible: false, category: 'basic' },
  { key: 'nationality', label: 'Nationality', visible: false, category: 'basic' },
  { key: 'league', label: 'League', visible: false, category: 'basic' },
  { key: 'skill_moves', label: 'SM', visible: false, category: 'basic' },
  { key: 'weak_foot', label: 'WF', visible: false, category: 'basic' },
  { key: 'preferred_foot', label: 'Foot', visible: false, category: 'basic' },
  
  // Main FIFA stats (visible by default)
  { key: 'stat_pac', label: 'PAC', visible: true, category: 'physical' },
  { key: 'stat_sho', label: 'SHO', visible: true, category: 'technical' },
  { key: 'stat_pas', label: 'PAS', visible: true, category: 'technical' },
  { key: 'stat_dri', label: 'DRI', visible: true, category: 'technical' },
  { key: 'stat_def', label: 'DEF', visible: true, category: 'mental' },
  { key: 'stat_phy', label: 'PHY', visible: true, category: 'physical' },
  
  // Physical stats
  { key: 'stat_acceleration', label: 'Acceleration', visible: false, category: 'physical' },
  { key: 'stat_sprint_speed', label: 'Sprint Speed', visible: false, category: 'physical' },
  { key: 'stat_agility', label: 'Agility', visible: false, category: 'physical' },
  { key: 'stat_balance', label: 'Balance', visible: false, category: 'physical' },
  { key: 'stat_jumping', label: 'Jumping', visible: false, category: 'physical' },
  { key: 'stat_stamina', label: 'Stamina', visible: false, category: 'physical' },
  { key: 'stat_strength', label: 'Strength', visible: false, category: 'physical' },
  
  // Technical stats
  { key: 'stat_finishing', label: 'Finishing', visible: false, category: 'technical' },
  { key: 'stat_shot_power', label: 'Shot Power', visible: false, category: 'technical' },
  { key: 'stat_long_shots', label: 'Long Shots', visible: false, category: 'technical' },
  { key: 'stat_volleys', label: 'Volleys', visible: false, category: 'technical' },
  { key: 'stat_penalties', label: 'Penalties', visible: false, category: 'technical' },
  { key: 'stat_crossing', label: 'Crossing', visible: false, category: 'technical' },
  { key: 'stat_curve', label: 'Curve', visible: false, category: 'technical' },
  { key: 'stat_free_kick_accuracy', label: 'FK Accuracy', visible: false, category: 'technical' },
  { key: 'stat_short_passing', label: 'Short Passing', visible: false, category: 'technical' },
  { key: 'stat_long_passing', label: 'Long Passing', visible: false, category: 'technical' },
  { key: 'stat_ball_control', label: 'Ball Control', visible: false, category: 'technical' },
  { key: 'stat_dribbling', label: 'Dribbling', visible: false, category: 'technical' },
  
  // Mental stats
  { key: 'stat_vision', label: 'Vision', visible: false, category: 'mental' },
  { key: 'stat_composure', label: 'Composure', visible: false, category: 'mental' },
  { key: 'stat_defensive_awareness', label: 'Defensive Awareness', visible: false, category: 'mental' },
  { key: 'stat_standing_tackle', label: 'Standing Tackle', visible: false, category: 'mental' },
  { key: 'stat_sliding_tackle', label: 'Sliding Tackle', visible: false, category: 'mental' },
  { key: 'stat_interceptions', label: 'Interceptions', visible: false, category: 'mental' },
  { key: 'stat_heading_accuracy', label: 'Heading Accuracy', visible: false, category: 'mental' },
  { key: 'stat_aggression', label: 'Aggression', visible: false, category: 'mental' },
  { key: 'stat_reactions', label: 'Reactions', visible: false, category: 'mental' },
  { key: 'stat_positioning', label: 'Positioning', visible: false, category: 'mental' },
  
  // Goalkeeping stats
  { key: 'stat_gk_diving', label: 'GK Diving', visible: false, category: 'goalkeeping' },
  { key: 'stat_gk_handling', label: 'GK Handling', visible: false, category: 'goalkeeping' },
  { key: 'stat_gk_kicking', label: 'GK Kicking', visible: false, category: 'goalkeeping' },
  { key: 'stat_gk_positioning', label: 'GK Positioning', visible: false, category: 'goalkeeping' },
  { key: 'stat_gk_reflexes', label: 'GK Reflexes', visible: false, category: 'goalkeeping' },
]

const statCategories = [
  {
    name: 'Main Stats',
    stats: [
      { key: 'overall_rating', label: 'Overall Rating' },
      { key: 'stat_pac', label: 'Pace' },
      { key: 'stat_sho', label: 'Shooting' },
      { key: 'stat_pas', label: 'Passing' },
      { key: 'stat_dri', label: 'Dribbling' },
      { key: 'stat_def', label: 'Defending' },
      { key: 'stat_phy', label: 'Physical' },
    ]
  },
  {
    name: 'Pace',
    stats: [
      { key: 'stat_acceleration', label: 'Acceleration' },
      { key: 'stat_sprint_speed', label: 'Sprint Speed' },
    ]
  },
  {
    name: 'Shooting',
    stats: [
      { key: 'stat_finishing', label: 'Finishing' },
      { key: 'stat_shot_power', label: 'Shot Power' },
      { key: 'stat_long_shots', label: 'Long Shots' },
      { key: 'stat_volleys', label: 'Volleys' },
      { key: 'stat_penalties', label: 'Penalties' },
    ]
  },
  {
    name: 'Passing',
    stats: [
      { key: 'stat_crossing', label: 'Crossing' },
      { key: 'stat_curve', label: 'Curve' },
      { key: 'stat_free_kick_accuracy', label: 'FK Accuracy' },
      { key: 'stat_short_passing', label: 'Short Passing' },
      { key: 'stat_long_passing', label: 'Long Passing' },
      { key: 'stat_vision', label: 'Vision' },
    ]
  },
  {
    name: 'Dribbling',
    stats: [
      { key: 'stat_ball_control', label: 'Ball Control' },
      { key: 'stat_dribbling', label: 'Dribbling' },
      { key: 'stat_composure', label: 'Composure' },
      { key: 'stat_agility', label: 'Agility' },
      { key: 'stat_balance', label: 'Balance' },
      { key: 'stat_reactions', label: 'Reactions' },
    ]
  },
  {
    name: 'Defending',
    stats: [
      { key: 'stat_defensive_awareness', label: 'Defensive Awareness' },
      { key: 'stat_standing_tackle', label: 'Standing Tackle' },
      { key: 'stat_sliding_tackle', label: 'Sliding Tackle' },
      { key: 'stat_interceptions', label: 'Interceptions' },
      { key: 'stat_heading_accuracy', label: 'Heading Accuracy' },
    ]
  },
  {
    name: 'Physical',
    stats: [
      { key: 'stat_jumping', label: 'Jumping' },
      { key: 'stat_stamina', label: 'Stamina' },
      { key: 'stat_strength', label: 'Strength' },
      { key: 'stat_aggression', label: 'Aggression' },
    ]
  },
  {
    name: 'Goalkeeping',
    stats: [
      { key: 'stat_gk_diving', label: 'GK Diving' },
      { key: 'stat_gk_handling', label: 'GK Handling' },
      { key: 'stat_gk_kicking', label: 'GK Kicking' },
      { key: 'stat_gk_positioning', label: 'GK Positioning' },
      { key: 'stat_gk_reflexes', label: 'GK Reflexes' },
    ]
  }
]

export default function PlayersPage() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [enums, setEnums] = useState<PlayerEnumsResponse | null>(null)
  const [enumsLoading, setEnumsLoading] = useState(true)
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'desc' })
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNext: false,
    hasPrevious: false
  })
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false)
  const [showShortlistOnly, setShowShortlistOnly] = useState(false)
  const [filters, setFilters] = useState<PlayerFilters>({
    // Text fields
    name: '',
    first_name: '',
    last_name: '',
    common_name: '',
    nationality_label: [],
    team_label: [],
    league_name: [],
    position_short_label: [],
    alternate_positions: '',
    player_abilities_labels: [],
    
    // Numeric range fields - ONLY REAL COLUMNS
    id: {},
    overall_rating: {},
    skill_moves: {},
    weak_foot: {},
    preferred_foot: {},
    stat_acceleration: {},
    stat_agility: {},
    stat_jumping: {},
    stat_stamina: {},
    stat_strength: {},
    stat_aggression: {},
    stat_balance: {},
    stat_ball_control: {},
    stat_composure: {},
    stat_crossing: {},
    stat_curve: {},
    stat_def: {},
    stat_defensive_awareness: {},
    stat_dri: {},
    stat_dribbling: {},
    stat_finishing: {},
    stat_free_kick_accuracy: {},
    stat_gk_diving: {},
    stat_gk_handling: {},
    stat_gk_kicking: {},
    stat_gk_positioning: {},
    stat_gk_reflexes: {},
    stat_heading_accuracy: {},
    stat_interceptions: {},
    stat_long_passing: {},
    stat_long_shots: {},
    stat_pac: {},
    stat_pas: {},
    stat_penalties: {},
    stat_phy: {},
    stat_positioning: {},
    stat_reactions: {},
    stat_sho: {},
    stat_short_passing: {},
    stat_shot_power: {},
    stat_sliding_tackle: {},
    stat_sprint_speed: {},
    stat_standing_tackle: {},
    stat_vision: {},
    stat_volleys: {},
  })

  // Collapsible states
  const [basicInfoOpen, setBasicInfoOpen] = useState(true)
  const [playerInfoOpen, setPlayerInfoOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  // Load enums on mount
  useEffect(() => {
    const loadEnums = async () => {
      try {
        setEnumsLoading(true)
        const enumsData = await getPlayerEnums()
        setEnums(enumsData)
      } catch (error) {
        console.error('Failed to load enums:', error)
      } finally {
        setEnumsLoading(false)
      }
    }
    loadEnums()
  }, [])

  // Helper functions for shortlist
  const getShortlistIds = (): number[] => {
    try {
      const stored = localStorage.getItem(SHORTLIST_STORAGE_KEY)
      const items = stored ? JSON.parse(stored) : []
      return items.map((item: any) => item.id)
    } catch {
      return []
    }
  }

  const toggleShortlistFilter = () => {
    setShowShortlistOnly(!showShortlistOnly)
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  // Trigger search whenever showShortlistOnly changes
  useEffect(() => {
    handleSearch(1)
  }, [showShortlistOnly])

  const handleSearch = async (page = 1, customSortConfig?: SortConfig) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '50'
      }

      // Add sorting parameters (use custom sort config if provided, otherwise use state)
      const currentSort = customSortConfig || sortConfig
      if (currentSort.key) {
        params.sort_by = currentSort.key
        params.sort_direction = currentSort.direction
      }

      // Add shortlist filter if enabled
      if (showShortlistOnly) {
        const shortlistIds = getShortlistIds()
        if (shortlistIds.length === 0) {
          // No shortlisted players, return empty result
          setPlayers([])
          setPagination({
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
            hasNext: false,
            hasPrevious: false
          })
          setLoading(false)
          return
        }
        params.id = `in:${shortlistIds.join(',')}`
      }

      // Add text filters
      if (filters.name) params.name = filters.name
      if (filters.first_name) params.first_name = filters.first_name
      if (filters.last_name) params.last_name = filters.last_name
      if (filters.common_name) params.common_name = filters.common_name
      if (filters.alternate_positions) params.alternate_positions = filters.alternate_positions
      
      // Add array filters
      if (filters.team_label.length > 0) params.team_label = filters.team_label.join(',')
      if (filters.league_name.length > 0) params.league_name = filters.league_name.join(',')
      if (filters.nationality_label.length > 0) params.nationality_label = filters.nationality_label.join(',')
      if (filters.position_short_label.length > 0) params.position_short_label = filters.position_short_label.join(',')
      if (filters.player_abilities_labels.length > 0) params.player_abilities_labels = filters.player_abilities_labels.join(',')

      // Add range filters for ALL numeric fields
      Object.entries(filters).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const range = value as { min?: number; max?: number }
          if (range.min !== undefined || range.max !== undefined) {
            const parts = []
            if (range.min !== undefined) parts.push(`gte:${range.min}`)
            if (range.max !== undefined) parts.push(`lte:${range.max}`)
            if (parts.length > 0) {
              params[key] = parts.join(',')
            }
          }
        }
              })

      const response = await getPlayers(params)
      let players = response.players || []
      
      // Check if any main stats are filtered (exclude goalkeepers when main stats are used)
      const mainStats = ['stat_pac', 'stat_sho', 'stat_pas', 'stat_dri', 'stat_def', 'stat_phy']
      const hasMainStatFilter = mainStats.some(stat => {
        const range = filters[stat as keyof PlayerFilters] as { min?: number; max?: number }
        return range && (range.min !== undefined || range.max !== undefined)
      })
      
      // Filter out goalkeepers if main stats are applied
      if (hasMainStatFilter) {
        players = players.filter(player => player.positionShortLabel !== 'GK')
      }
      
      setPlayers(players)
      
      // Use actual pagination from backend
      setPagination({
        currentPage: response.pagination?.page || 1,
        totalPages: response.pagination?.totalPages || 1,
        totalItems: response.pagination?.totalItems || 0,
        hasNext: response.pagination?.hasNext || false,
        hasPrevious: response.pagination?.hasPrevious || false
      })
    } catch (error) {
      console.error('Failed to fetch players:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = async () => {
    const resetFilterValues = {
      // Text fields
      name: '',
      first_name: '',
      last_name: '',
      common_name: '',
      nationality_label: [],
      team_label: [],
      league_name: [],
      position_short_label: [],
      alternate_positions: '',
      player_abilities_labels: [],
      
      // Numeric range fields - ONLY REAL COLUMNS
      id: {},
      overall_rating: {},
      skill_moves: {},
      weak_foot: {},
      preferred_foot: {},
      stat_acceleration: {},
      stat_agility: {},
      stat_jumping: {},
      stat_stamina: {},
      stat_strength: {},
      stat_aggression: {},
      stat_balance: {},
      stat_ball_control: {},
      stat_composure: {},
      stat_crossing: {},
      stat_curve: {},
      stat_def: {},
      stat_defensive_awareness: {},
      stat_dri: {},
      stat_dribbling: {},
      stat_finishing: {},
      stat_free_kick_accuracy: {},
      stat_gk_diving: {},
      stat_gk_handling: {},
      stat_gk_kicking: {},
      stat_gk_positioning: {},
      stat_gk_reflexes: {},
      stat_heading_accuracy: {},
      stat_interceptions: {},
      stat_long_passing: {},
      stat_long_shots: {},
      stat_pac: {},
      stat_pas: {},
      stat_penalties: {},
      stat_phy: {},
      stat_positioning: {},
      stat_reactions: {},
      stat_sho: {},
      stat_short_passing: {},
      stat_shot_power: {},
      stat_sliding_tackle: {},
      stat_sprint_speed: {},
      stat_standing_tackle: {},
      stat_vision: {},
      stat_volleys: {},
    }
    
    setFilters(resetFilterValues)
    setSortConfig({ key: null, direction: 'desc' })
    setShowShortlistOnly(false)
    setPagination(prev => ({ ...prev, currentPage: 1 }))
    
    // Perform search with empty filters (same as initial load)
    try {
      setLoading(true)
      const response = await getPlayers({
        page: '1',
        limit: '50'
      })
      
      setPlayers(response.players)
      setPagination({
        currentPage: response.pagination.page,
        totalPages: response.pagination.totalPages,
        totalItems: response.pagination.totalItems,
        hasNext: response.pagination.hasNext,
        hasPrevious: response.pagination.hasPrevious
      })
    } catch (error) {
      console.error('Error resetting filters:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load initial data
  useEffect(() => {
    handleSearch()
  }, [])

  const getPlayerDisplayName = (player: Player) => {
    return player.commonName || `${player.firstName || ''} ${player.lastName || ''}`.trim()
  }

  const getCellValue = (player: Player, columnKey: string): string | number => {
    switch (columnKey) {
      case 'name':
        return getPlayerDisplayName(player)
      case 'overall_rating':
        return player.overallRating || 0
      case 'position':
        return player.positionShortLabel || ''
      case 'alternate_positions':
        // Replace pipe separators with comma and space
        return (player.alternatePositions || '').replace(/\|/g, ', ')
      case 'team':
        return player.teamLabel || ''
      case 'nationality':
        return player.nationalityLabel || ''
      case 'league':
        return player.leagueName || ''
      case 'skill_moves':
        return player.skillMoves || 0
      case 'weak_foot':
        return player.weakFoot || 0
      case 'preferred_foot':
        // Map preferred foot: 1 = Right, 2 = Left
        const footValue = player.preferredFoot || 0
        if (footValue === 1) return 'Right'
        if (footValue === 2) return 'Left'
        return footValue
      default:
        // Handle stat columns - convert snake_case to camelCase
        const camelCaseKey = columnKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        return (player as any)[camelCaseKey] || 0
    }
  }

  const getStatColor = (value: number): string => {
    if (value >= 90) return 'text-green-900 bg-green-800 text-white'
    if (value >= 80) return 'text-green-800 bg-green-100'
    if (value >= 70) return 'text-yellow-800 bg-yellow-200'
    if (value >= 60) return 'text-orange-800 bg-orange-300'
    return 'text-red-900 bg-red-400 text-white'
  }

  const isStatColumn = (columnKey: string): boolean => {
    return columnKey.startsWith('stat_') || columnKey === 'overall_rating'
  }

  const handleSort = (columnKey: string) => {
    let direction: 'asc' | 'desc' = 'desc'
    
    if (sortConfig.key === columnKey && sortConfig.direction === 'desc') {
      direction = 'asc'
    }
    
    const newSortConfig = { key: columnKey, direction }
    setSortConfig(newSortConfig)
    
    // Reset to page 1 when sorting and trigger new search with sort parameters
    setPagination(prev => ({ ...prev, currentPage: 1 }))
    handleSearch(1, newSortConfig)
  }

  const getSortIcon = (columnKey: string) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 opacity-50" />
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="w-3 h-3 text-blue-600" /> : 
      <ArrowDown className="w-3 h-3 text-blue-600" />
  }

  const visibleColumns = columns.filter(col => col.visible)

  const toggleColumn = (columnKey: string) => {
    setColumns(prev => prev.map(col => 
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    ))
  }

  const toggleCategoryColumns = (category: string, visible: boolean) => {
    setColumns(prev => prev.map(col => 
      col.category === category ? { ...col, visible } : col
    ))
  }

  const updateArrayFilter = useCallback((key: keyof PlayerFilters, value: string, checked: boolean) => {
    setFilters(prev => {
      const currentArray = prev[key] as string[]
      if (checked) {
        return { ...prev, [key]: [...currentArray, value] }
      } else {
        return { ...prev, [key]: currentArray.filter(item => item !== value) }
      }
    })
  }, [])

  const updateRangeFilter = useCallback((key: keyof PlayerFilters, type: 'min' | 'max', value: string) => {
    setFilters(prev => {
      const currentRange = prev[key] as { min?: number; max?: number }
      return {
        ...prev,
        [key]: {
          ...currentRange,
          [type]: value ? parseInt(value) : undefined
        }
      }
    })
  }, [])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      handleSearch(newPage)
    }
  }

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player)
    setIsPlayerModalOpen(true)
  }

  const handleClosePlayerModal = () => {
    setIsPlayerModalOpen(false)
    setSelectedPlayer(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(1)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-full mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Player Database</h1>
              <p className="text-slate-600 mt-1">Search and filter through player data</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate('/compare-players')}
                variant="outline"
                className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
              >
                <Users className="w-4 h-4" />
                Compare Players
              </Button>
              <Button
                onClick={toggleShortlistFilter}
                variant={showShortlistOnly ? "default" : "outline"}
                className={`flex items-center gap-2 cursor-pointer ${
                  showShortlistOnly 
                    ? "bg-green-600 hover:bg-green-700 text-white" 
                    : "hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filter for Shortlist
                {showShortlistOnly && (
                  <Badge variant="secondary" className="ml-1 bg-white/20 text-white border-white/30">
                    {getShortlistIds().length}
                  </Badge>
                )}
              </Button>
              <Button
                onClick={() => navigate('/shortlist')}
                variant="outline"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Heart className="w-4 h-4" />
                View Shortlist
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - WIDER */}
          <div className="col-span-4 relative z-50">
            <Card className="sticky top-6 max-h-[80vh] flex flex-col">
              <CardHeader className="pb-4 flex-shrink-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 overflow-y-auto scrollbar-minimal pb-0 flex-1 relative">
                {enumsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full"></div>
                      <span className="text-gray-600 font-medium">Loading filters...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Basic Info Section */}
                <Collapsible open={basicInfoOpen} onOpenChange={setBasicInfoOpen}>
                  <CollapsibleTrigger asChild>
                                         <Button variant="ghost" className="w-full justify-between p-3 h-10 bg-gradient-to-r from-green-600 to-green-700 text-white hover:bg-green-700 rounded-lg shadow-md cursor-pointer">
                       <span className="text-sm font-bold tracking-wide">📊 BASIC INFO</span>
                       <ChevronDown className={`w-4 h-4 transition-transform ${basicInfoOpen ? 'rotate-180' : ''}`} />
                     </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mt-2">
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Name</label>
                    <Input
                      placeholder="Search players..."
                      value={filters.name}
                      onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                      onKeyDown={handleKeyDown}
                      className="h-8"
                    />
                  </div>
                  
                  {enums && (
                    <SearchableMultiSelect
                      label="Club"
                      options={enums.clubs}
                      selected={filters.team_label}
                      onSelectionChange={(value: string, checked: boolean) => updateArrayFilter('team_label', value, checked)}
                      placeholder="Select clubs..."
                    />
                  )}

                  {enums && (
                    <>
                      <SearchableMultiSelect
                        label="League"
                        options={enums.leagues}
                        selected={filters.league_name}
                        onSelectionChange={(value: string, checked: boolean) => updateArrayFilter('league_name', value, checked)}
                        placeholder="Select leagues..."
                      />

                      <SearchableMultiSelect
                        label="Nationality"
                        options={enums.nationalities}
                        selected={filters.nationality_label}
                        onSelectionChange={(value: string, checked: boolean) => updateArrayFilter('nationality_label', value, checked)}
                        placeholder="Select nationalities..."
                      />
                    </>
                  )}

                    <RangeFilter label="Overall Rating" filterKey="overall_rating" min={40} max={99} filters={filters} updateRangeFilter={updateRangeFilter} />
                  </CollapsibleContent>
                </Collapsible>

                {/* Player Traits Section */}
                <Collapsible open={playerInfoOpen} onOpenChange={setPlayerInfoOpen}>
                  <CollapsibleTrigger asChild>
                                         <Button variant="ghost" className="w-full justify-between p-3 h-10 bg-gradient-to-r from-green-600 to-green-700 text-white hover:bg-green-700 rounded-lg shadow-md cursor-pointer">
                       <span className="text-sm font-bold tracking-wide">⚽ PLAYER TRAITS</span>
                       <ChevronDown className={`w-4 h-4 transition-transform ${playerInfoOpen ? 'rotate-180' : ''}`} />
                     </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mt-2">
                    <RangeFilter label="Skill Moves" filterKey="skill_moves" min={1} max={5} filters={filters} updateRangeFilter={updateRangeFilter} />
                    <RangeFilter label="Weak Foot" filterKey="weak_foot" min={1} max={5} filters={filters} updateRangeFilter={updateRangeFilter} />
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Preferred Foot</label>
                      <Select value={filters.preferred_foot.min?.toString() || "all"} onValueChange={(value) => {
                        if (value && value !== "all") {
                          setFilters(prev => ({ 
                            ...prev, 
                            preferred_foot: { min: parseInt(value), max: parseInt(value) }
                          }))
                        } else {
                          setFilters(prev => ({ 
                            ...prev, 
                            preferred_foot: {}
                          }))
                        }
                      }}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select foot..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Foot</SelectItem>
                          <SelectItem value="1">Right Foot</SelectItem>
                          <SelectItem value="2">Left Foot</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {enums && (
                      <>
                        <SearchableMultiSelect
                          label="Position"
                          options={sortPositions(enums.positions)}
                          selected={filters.position_short_label}
                          onSelectionChange={(value: string, checked: boolean) => updateArrayFilter('position_short_label', value, checked)}
                          placeholder="Select positions..."
                        />

                        <SearchableMultiSelect
                          label="Player Abilities"
                          options={enums.playerAbilities}
                          selected={filters.player_abilities_labels}
                          onSelectionChange={(value: string, checked: boolean) => updateArrayFilter('player_abilities_labels', value, checked)}
                          placeholder="Select abilities..."
                        />
                      </>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Stats Filters */}
                <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
                  <CollapsibleTrigger asChild>
                                         <Button variant="ghost" className="w-full justify-between p-3 h-10 bg-gradient-to-r from-green-600 to-green-700 text-white hover:bg-green-700 rounded-lg shadow-md cursor-pointer">
                       <span className="text-sm font-bold tracking-wide">📈 STATS</span>
                       <ChevronDown className={`w-4 h-4 transition-transform ${statsOpen ? 'rotate-180' : ''}`} />
                     </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-3">
                    {statCategories.map(category => (
                      <div key={category.name} className="bg-slate-50 rounded-lg p-3 space-y-2">
                        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{category.name}</h4>
                        <div className="space-y-2">
                          {category.stats.map(stat => (
                                                      <RangeFilter
                            key={stat.key}
                            label={stat.label}
                            filterKey={stat.key as keyof PlayerFilters}
                            min={0}
                            max={99}
                            filters={filters}
                            updateRangeFilter={updateRangeFilter}
                          />
                          ))}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
                  </>
                )}

              </CardContent>
              
              {/* Sticky Action Buttons */}
              <div className="bg-white border-t p-4 space-y-2 flex-shrink-0">
                <Button 
                  onClick={() => handleSearch(1)} 
                  className="w-full h-9 cursor-pointer" 
                  disabled={loading}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Searching...' : 'Search'}
                </Button>
                <Button onClick={resetFilters} variant="outline" className="w-full h-9 cursor-pointer">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </Card>
          </div>

          {/* Main Content - WIDER */}
          <div className="col-span-8">
            <Card className="sticky top-6 max-h-[80vh] flex flex-col">
              <CardHeader className="pb-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Results</CardTitle>
                    <p className="text-sm text-slate-600">
                      {pagination.totalItems} players found
                    </p>
                  </div>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="cursor-pointer">
                        <Settings className="w-3 h-3 mr-2" />
                        Columns ({visibleColumns.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Column Settings</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {['basic', 'physical', 'technical', 'mental', 'goalkeeping'].map(category => (
                          <div key={category} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium capitalize">{category}</h4>
                              <div className="space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleCategoryColumns(category, true)}
                                  className="cursor-pointer"
                                >
                                  Show All
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleCategoryColumns(category, false)}
                                  className="cursor-pointer"
                                >
                                  Hide All
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {columns
                                .filter(col => col.category === category)
                                .map(column => (
                                  <div key={column.key} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={column.key}
                                      checked={column.visible}
                                      onCheckedChange={() => toggleColumn(column.key)}
                                      className="cursor-pointer"
                                    />
                                    <label htmlFor={column.key} className="text-sm">
                                      {column.label}
                                    </label>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="overflow-y-auto scrollbar-minimal pb-0 flex-1 p-0 flex flex-col">
                {loading ? (
                  <div className="flex items-center justify-center flex-1">
                    <div className="text-center">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-slate-600">Loading players...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative h-full overflow-auto scrollbar-minimal">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            {visibleColumns.map(column => (
                              <TableHead 
                                key={column.key} 
                                className="cursor-pointer hover:bg-slate-100 font-medium text-slate-700 h-10 px-3 bg-slate-50"
                                onClick={() => handleSort(column.key)}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">{column.label}</span>
                                  {getSortIcon(column.key)}
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(players || []).map((player, index) => (
                            <TableRow 
                              key={player.id} 
                              className={`hover:bg-slate-50 cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-slate-25'}`}
                              onClick={() => handlePlayerClick(player)}
                            >
                              {visibleColumns.map(column => (
                                <TableCell key={column.key} className={`h-16 px-3 py-2 ${column.key === 'name' ? 'min-w-0 max-w-48' : ''}`}>
                                  {column.key === 'name' ? (
                                    <div className="flex items-center gap-3 min-w-0">
                                      <img 
                                        src={`https://cdn.futbin.com/content/fifa25/img/players/${player.id}.png`}
                                        alt={getPlayerDisplayName(player)}
                                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                                      />
                                      <span className="font-medium text-slate-900 truncate">
                                        {getPlayerDisplayName(player)}
                                      </span>
                                    </div>
                                  ) : isStatColumn(column.key) ? (
                                    <span className={`px-2 py-1 rounded-md font-medium text-sm ${getStatColor(Number(getCellValue(player, column.key)))}`}>
                                      {getCellValue(player, column.key)}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-slate-700">
                                      {getCellValue(player, column.key)}
                                    </span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {(players || []).length === 0 && !loading && (
                      <div className="flex items-center justify-center flex-1 text-slate-500">
                        <div className="text-center">
                          <div className="text-4xl mb-4">🔍</div>
                          <h3 className="font-medium mb-2">No players found</h3>
                          <p className="text-sm">Try adjusting your search criteria</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Pagination - Sticky at bottom */}
                    {pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0">
                        <div className="text-sm text-slate-600">
                          Page {pagination.currentPage} of {pagination.totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.currentPage - 1)}
                            disabled={!pagination.hasPrevious}
                            className={!pagination.hasPrevious ? "cursor-not-allowed" : "cursor-pointer"}
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const page = i + 1
                            return (
                              <Button
                                key={page}
                                variant={page === pagination.currentPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className="w-8 h-8 p-0 cursor-pointer"
                              >
                                {page}
                              </Button>
                            )
                          })}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.currentPage + 1)}
                            disabled={!pagination.hasNext}
                            className={!pagination.hasNext ? "cursor-not-allowed" : "cursor-pointer"}
                          >
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Player Detail Modal */}
      <PlayerDetailModal
        isOpen={isPlayerModalOpen}
        onClose={handleClosePlayerModal}
        player={selectedPlayer}
      />
    </div>
  )
} 