import React, { useState, useEffect, useRef } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { User } from '@/lib/db/schema-interface'
import { getRoleLabel } from '@/lib/role-levels'
import { getAllUsers, getUsersByClinic } from '@/lib/db/users-db'
import { useUser } from '@/contexts/UserContext'

interface UserSelectProps {
  value?: number
  onValueChange: (userId: number) => void
  placeholder?: string
  disabled?: boolean
  users?: User[]
  onUsersLoaded?: (users: User[]) => void
  autoDefaultToCurrentUser?: boolean
}

export function UserSelect({ value, onValueChange, placeholder = "בחר משתמש", disabled = false, users: usersProp, onUsersLoaded, autoDefaultToCurrentUser = true }: UserSelectProps) {
  const [users, setUsers] = useState<User[]>(usersProp || [])
  const [loading, setLoading] = useState(!usersProp)
  const { currentUser, currentClinic } = useUser()
  const initializedRef = useRef(false)

  useEffect(() => {
    if (usersProp) {
      setUsers(usersProp)
      setLoading(false)
      if (autoDefaultToCurrentUser && !initializedRef.current && (!value || value === 0) && currentUser?.id) {
        initializedRef.current = true
        onValueChange(currentUser.id)
      }
      return
    }
    const key = currentClinic?.id ? `users_cache_${currentClinic.id}` : 'users_cache_all'
    try {
      const cachedStr = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
      if (cachedStr) {
        const cached = JSON.parse(cachedStr) as { users: User[]; ts: number }
        setUsers(cached.users || [])
        setLoading(false)
        if (autoDefaultToCurrentUser && !initializedRef.current && (!value || value === 0) && currentUser?.id) {
          initializedRef.current = true
          onValueChange(currentUser.id)
        }
        if (onUsersLoaded) onUsersLoaded(cached.users || [])
      }
    } catch {}

    const loadUsers = async () => {
      try {
        const fetched = currentClinic?.id ? await getUsersByClinic(currentClinic.id) : await getAllUsers()
        setUsers(fetched)
        if (onUsersLoaded) onUsersLoaded(fetched)
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(key, JSON.stringify({ users: fetched, ts: Date.now() }))
          } catch {}
        }
        if (autoDefaultToCurrentUser && !initializedRef.current && (!value || value === 0) && currentUser?.id) {
          initializedRef.current = true
          onValueChange(currentUser.id)
        }
      } catch (error) {
        console.error('Error loading users:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUsers()
  }, [usersProp, currentClinic?.id, currentUser?.id, autoDefaultToCurrentUser])

  if (loading) {
    return (
      <Select
        value={value && value > 0 ? value.toString() : ''}
        onValueChange={() => {}}
        disabled
        dir="rtl"
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent />
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
                ({getRoleLabel(user.role_level)})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
} 