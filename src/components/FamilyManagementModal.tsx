import React, { useState, useEffect } from "react"
import { Family, Client } from "@/lib/db/schema-interface"
import { CustomModal } from "@/components/ui/custom-modal"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { getPaginatedClients } from "@/lib/db/clients-db"
import { createFamily, updateFamily, addClientToFamily, removeClientFromFamily } from "@/lib/db/family-db"
import { toast } from "sonner"
import { SearchIcon, Loader2 } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { Skeleton } from "@/components/ui/skeleton"

interface FamilyManagementModalProps {
  isOpen: boolean
  onClose: () => void
  family?: Family | null
  onFamilyChange?: () => void
}

interface ClientWithSelection extends Client {
  isSelected: boolean
  selectedRole: string
}

export function FamilyManagementModal({ isOpen, onClose, family, onFamilyChange }: FamilyManagementModalProps) {
  const { currentClinic } = useUser()
  const [familyName, setFamilyName] = useState('')
  const [familyNotes, setFamilyNotes] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const pageSize = 25
  const [isLoading, setIsLoading] = useState(false)
  const [currentMembers, setCurrentMembers] = useState<Client[]>([])
  const [selectedState, setSelectedState] = useState<Record<number, { isSelected: boolean; role: string }>>({})

  useEffect(() => {
    if (isOpen) {
      if (family) {
        setFamilyName(family.name)
        setFamilyNotes(family.notes || '')
        loadCurrentMembers()
      } else {
        setFamilyName('')
        setFamilyNotes('')
        setCurrentMembers([])
        setSelectedState({})
      }
      setClients([])
      setTotal(0)
      setOffset(0)
      setSearchQuery('')
    }
  }, [isOpen, family])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  const fetchPage = async (nextOffset: number, isLoadMore: boolean = false) => {
    if (!currentClinic) return
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      const { items, total } = await getPaginatedClients(currentClinic.id, {
        limit: pageSize,
        offset: nextOffset,
        order: 'id_desc',
        search: debouncedSearch || undefined,
      })
      setClients(prev => (nextOffset === 0 ? items : [...prev, ...items]))
      setTotal(total)
      setOffset(nextOffset + items.length)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      if (isLoadMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }

  const loadCurrentMembers = () => {
    if (!family?.id) return
    const members = Array.isArray(family.clients) ? family.clients : []
    setCurrentMembers(members)
    const initialSelected: Record<number, { isSelected: boolean; role: string }> = {}
    for (const m of members) {
      if (m.id !== undefined) initialSelected[m.id] = { isSelected: true, role: m.family_role || 'אחר' }
    }
    setSelectedState(prev => ({ ...initialSelected, ...prev }))
  }

  useEffect(() => {
    if (isOpen && currentClinic) {
      setClients([])
      setTotal(0)
      setOffset(0)
      fetchPage(0)
    }
  }, [isOpen, currentClinic, debouncedSearch])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const onScroll = () => {
      if (loadingMore || loading) return
      if (clients.length >= total) return
      const threshold = 64
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
        fetchPage(offset, true)
      }
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [clients.length, total, offset, loading, loadingMore])

  const handleClientSelection = (clientId: number, isSelected: boolean) => {
    setSelectedState(prev => ({
      ...prev,
      [clientId]: { isSelected, role: prev[clientId]?.role || 'אחר' }
    }))
  }

  const handleRoleChange = (clientId: number, role: string) => {
    setSelectedState(prev => ({
      ...prev,
      [clientId]: { isSelected: prev[clientId]?.isSelected ?? true, role }
    }))
  }

  const currentMemberIdSet = React.useMemo(() => {
    const s = new Set<number>()
    for (const m of currentMembers) {
      if (m.id !== undefined) s.add(m.id)
    }
    return s
  }, [currentMembers])

  const displayClients = React.useMemo(() => {
    const match = (c: Client) => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase()
      const nid = (c.national_id || '').toLowerCase()
      const q = (debouncedSearch || '').toLowerCase().trim()
      if (!q) return true
      return name.includes(q) || nid.includes(q)
    }
    const head: Client[] = []
    const seen = new Set<number>()
    for (const m of currentMembers) {
      if (m.id !== undefined && match(m)) {
        head.push(m)
        seen.add(m.id)
      }
    }
    const tail: Client[] = []
    for (const c of clients) {
      if (c.id !== undefined && !seen.has(c.id) && match(c)) tail.push(c)
    }
    return head.concat(tail)
  }, [currentMembers, clients, debouncedSearch])

  const handleSave = async () => {
    if (!familyName.trim()) {
      toast.error('נא להזין שם משפחה')
      return
    }

    setIsLoading(true)
    try {
      let familyResult: Family | null = null

      if (family) {
        familyResult = await updateFamily({ 
          ...family, 
          name: familyName.trim(),
          notes: familyNotes.trim() || undefined 
        }) || null
      } else {
        familyResult = await createFamily({ 
          name: familyName.trim(),
          notes: familyNotes.trim() || undefined 
        })
      }

      if (!familyResult) {
        toast.error('אירעה שגיאה בשמירת המשפחה')
        return
      }

      const selectedClients = Object.entries(selectedState)
        .filter(([_, v]) => v.isSelected)
        .map(([k, v]) => ({ id: Number(k), selectedRole: v.role }))
      const currentMemberIds = currentMembers.map(member => member.id)

      for (const client of selectedClients) {
        if (client.id !== undefined) {
          const isCurrentMember = currentMemberIds.includes(client.id)
          
          if (!isCurrentMember) {
            await addClientToFamily(client.id, familyResult.id!, client.selectedRole)
          } else {
            const currentMember = currentMembers.find(member => member.id === client.id)
            if (currentMember?.family_role !== client.selectedRole) {
              await addClientToFamily(client.id, familyResult.id!, client.selectedRole)
            }
          }
        }
      }

      for (const currentMember of currentMembers) {
        if (currentMember.id !== undefined) {
          const isStillSelected = selectedClients.some(client => client.id === currentMember.id)
          if (!isStillSelected) {
            await removeClientFromFamily(currentMember.id, familyResult.id!)
          }
        }
      }

      toast.success(family ? 'המשפחה עודכנה בהצלחה' : 'המשפחה נוצרה בהצלחה')
      onFamilyChange?.()
      onClose()
    } catch (error) {
      console.error('Error saving family:', error)
      toast.error('אירעה שגיאה בשמירת המשפחה')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setFamilyName('')
    setFamilyNotes('')
    setClients([])
    setSelectedState({})
    onClose()
  }

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={handleCancel}
      title={family ? 'עריכת משפחה' : 'משפחה חדשה'}
      description={family ? 'ערוך את פרטי המשפחה והוסף או הסר חברים' : 'צור משפחה חדשה והוסף חברים'}
      showCloseButton={false}
      className="w-full"
    >
      <div className="space-y-6" dir="rtl">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="family-name">שם המשפחה *</Label>
            <Input
              id="family-name"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="הכנס שם משפחה"
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="family-notes">הערות</Label>
            <Textarea
              id="family-notes"
              value={familyNotes}
              onChange={(e) => setFamilyNotes(e.target.value)}
              placeholder="הכנס הערות על המשפחה"
              className="text-right"
              rows={3}
              style={{scrollbarWidth: 'none'}}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">חברי המשפחה</h3>
          
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חפש לקוח לפי שם או תעודת זהות..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-right"
              dir="rtl"
            />
          </div>
          
          <div ref={listRef} className="max-h-64 overflow-y-auto border rounded-lg p-3" style={{scrollbarWidth: 'none'}}>
            {loading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="p-3 border rounded-md mb-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : clients.length === 0 ? (
              <div className="flex justify-center items-center h-20">
                <div className="text-gray-500">לא נמצאו לקוחות</div>
              </div>
            ) : (
              displayClients.map((client) => {
                const isSelected = !!selectedState[client.id!]?.isSelected
                const selectedRole = selectedState[client.id!]?.role || 'אחר'
                return (
                  <div key={`client-${client.id}`} className="p-3 border rounded-md mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleClientSelection(client.id!, checked as boolean)}
                        />
                        <div>
                          <p className="font-medium">{client.first_name} {client.last_name}</p>
                          <p className="text-sm text-muted-foreground">{client.national_id}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-32">
                          <Select value={selectedRole} onValueChange={(value) => handleRoleChange(client.id!, value)}>
                            <SelectTrigger size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="אב">אב</SelectItem>
                              <SelectItem value="אם">אם</SelectItem>
                              <SelectItem value="ילד">ילד</SelectItem>
                              <SelectItem value="אחר">אחר</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            {loadingMore && (
              <div className="space-y-2 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`skeleton-more-${i}`} className="p-3 border rounded-md mb-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            בטל
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !familyName.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (family ? 'עדכן משפחה' : 'צור משפחה')}
          </Button>
        </div>
      </div>
    </CustomModal>
  )
} 