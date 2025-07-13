import React, { useState, useEffect } from "react"
import { Family, Client } from "@/lib/db/schema"
import { CustomModal } from "@/components/ui/custom-modal"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { getAllClients } from "@/lib/db/clients-db"
import { createFamily, updateFamily, addClientToFamily, removeClientFromFamily, getFamilyMembers } from "@/lib/db/family-db"
import { toast } from "sonner"
import { SearchIcon } from "lucide-react"

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
  const [familyName, setFamilyName] = useState('')
  const [familyNotes, setFamilyNotes] = useState('')
  const [allClients, setAllClients] = useState<Client[]>([])
  const [clientsWithSelection, setClientsWithSelection] = useState<ClientWithSelection[]>([])
  const [filteredClients, setFilteredClients] = useState<ClientWithSelection[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentMembers, setCurrentMembers] = useState<Client[]>([])

  useEffect(() => {
    if (isOpen) {
      loadClients()
      if (family) {
        setFamilyName(family.name)
        setFamilyNotes(family.notes || '')
        loadCurrentMembers()
      } else {
        setFamilyName('')
        setFamilyNotes('')
        setCurrentMembers([])
      }
      setSearchTerm('')
    }
  }, [isOpen, family])

  const loadClients = async () => {
    try {
      const clients = await getAllClients()
      setAllClients(clients)
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const loadCurrentMembers = async () => {
    if (!family?.id) return
    try {
      const members = await getFamilyMembers(family.id)
      setCurrentMembers(members)
    } catch (error) {
      console.error('Error loading current members:', error)
    }
  }

  useEffect(() => {
    if (allClients.length > 0) {
      const clientsWithSelectionData = allClients.map(client => ({
        ...client,
        isSelected: currentMembers.some(member => member.id === client.id),
        selectedRole: currentMembers.find(member => member.id === client.id)?.family_role || 'אחר'
      }))
      setClientsWithSelection(clientsWithSelectionData)
    }
  }, [allClients, currentMembers])

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClients(clientsWithSelection)
    } else {
      const filtered = clientsWithSelection.filter(client => {
        const fullName = `${client.first_name} ${client.last_name}`.toLowerCase()
        const nationalId = client.national_id?.toLowerCase() || ''
        const search = searchTerm.toLowerCase()
        
        return fullName.includes(search) || nationalId.includes(search)
      })
      setFilteredClients(filtered)
    }
  }, [clientsWithSelection, searchTerm])

  const handleClientSelection = (clientId: number, isSelected: boolean) => {
    setClientsWithSelection(prev => 
      prev.map(client => 
        client.id === clientId 
          ? { ...client, isSelected }
          : client
      )
    )
  }

  const handleRoleChange = (clientId: number, role: string) => {
    setClientsWithSelection(prev => 
      prev.map(client => 
        client.id === clientId 
          ? { ...client, selectedRole: role }
          : client
      )
    )
  }

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

      const selectedClients = clientsWithSelection.filter(client => client.isSelected)
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
            await removeClientFromFamily(currentMember.id)
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
    setClientsWithSelection([])
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-right"
              dir="rtl"
            />
          </div>
          
          <div className="max-h-64 overflow-y-auto border rounded-lg p-3" style={{scrollbarWidth: 'none'}}>
            {filteredClients.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {searchTerm ? 'לא נמצאו לקוחות התואמים לחיפוש' : 'טוען לקוחות...'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={client.isSelected}
                        onCheckedChange={(checked) => handleClientSelection(client.id!, checked as boolean)}
                      />
                      <div>
                        <p className="font-medium">{client.first_name} {client.last_name}</p>
                        <p className="text-sm text-muted-foreground">{client.national_id}</p>
                      </div>
                    </div>
                    {client.isSelected && (
                      <div className="w-32">
                        <Select value={client.selectedRole} onValueChange={(value) => handleRoleChange(client.id!, value)}>
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
            {isLoading ? 'שומר...' : family ? 'עדכן משפחה' : 'צור משפחה'}
          </Button>
        </div>
      </div>
    </CustomModal>
  )
} 