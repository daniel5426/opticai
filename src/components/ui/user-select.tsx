import React, { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { User } from '@/lib/db/schema'
import { getAllUsers } from '@/lib/db/users-db'
import { useUser } from '@/contexts/UserContext'

interface UserSelectProps {
  value?: number
  onValueChange: (userId: number) => void
  placeholder?: string
  disabled?: boolean
}

export function UserSelect({ value, onValueChange, placeholder = "בחר משתמש", disabled = false }: UserSelectProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const { currentUser } = useUser()

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await getAllUsers()
        setUsers(usersData)
        
        if (!value && currentUser?.id) {
          onValueChange(currentUser.id)
        }
      } catch (error) {
        console.error('Error loading users:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [value, currentUser, onValueChange])

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
      value={value?.toString()}
      onValueChange={(stringValue) => onValueChange(parseInt(stringValue))}
      disabled={disabled}
      dir="rtl"
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id!.toString()}>
            <div className="flex items-center gap-2">
              <span>{user.username}</span>
              <span className="text-xs text-muted-foreground">
                ({user.role === 'admin' ? 'מנהל' : user.role === 'worker' ? 'עובד' : 'צופה'})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
} 