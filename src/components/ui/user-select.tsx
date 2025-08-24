import React, { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { User } from '@/lib/db/schema-interface'
import { getAllUsers } from '@/lib/db/users-db'
import { useUser } from '@/contexts/UserContext'

interface UserSelectProps {
  value?: number
  onValueChange: (userId: number) => void
  placeholder?: string
  disabled?: boolean
  users?: User[]
  onUsersLoaded?: (users: User[]) => void
}

export function UserSelect({ value, onValueChange, placeholder = "בחר משתמש", disabled = false, users: usersProp, onUsersLoaded }: UserSelectProps) {
  const [users, setUsers] = useState<User[]>(usersProp || [])
  const [loading, setLoading] = useState(!usersProp)
  const { currentUser } = useUser()

  useEffect(() => {
    if (usersProp) {
      setUsers(usersProp)
      setLoading(false)
      if ((!value || value === 0) && currentUser?.id) {
        onValueChange(currentUser.id)
      }
      return
    }

    const loadUsers = async () => {
      try {
        const usersData = await getAllUsers()
        setUsers(usersData)
        if (onUsersLoaded) onUsersLoaded(usersData)
        if ((!value || value === 0) && currentUser?.id) {
          onValueChange(currentUser.id)
        }
      } catch (error) {
        console.error('Error loading users:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [value, currentUser, onValueChange, usersProp])

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full">
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select
      value={value && value > 0 ? value.toString() : ""}
      onValueChange={(stringValue) => onValueChange(parseInt(stringValue))}
      disabled={disabled}
      dir="rtl"
    >
      <SelectTrigger disabled={disabled}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id!.toString()}>
            <div className="flex items-center gap-2">
              <span>{user.full_name || user.username}</span>
              <span className="text-xs text-muted-foreground">
                ({user.role === 'company_ceo' ? 'מנכ"ל החברה' : 
                  user.role === 'clinic_manager' ? 'מנהל מרפאה' : 
                  user.role === 'clinic_worker' ? 'עובד מרפאה' : 'צופה מרפאה'})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
} 