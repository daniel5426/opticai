import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { SiteHeader } from "@/components/site-header"
import { UsersTable } from "@/components/users-table"
import { UserModal } from "@/components/UserModal"
import { getPaginatedUsers } from "@/lib/db/users-db"
import { User } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { ROLE_LEVELS, isRoleAtLeast } from '@/lib/role-levels'

interface UserWithClinic extends User {
  clinic_name?: string;
}

export default function AllUsersPage() {
  const { t } = useTranslation()
  const { currentUser } = useUser()
  const [users, setUsers] = useState<UserWithClinic[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithClinic | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * pageSize
      const { items, total } = await getPaginatedUsers({ limit: pageSize, offset, order: 'id_desc', search: debouncedSearch || undefined })
      setUsers(items as UserWithClinic[])
      setTotal(total)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [page, pageSize, debouncedSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const handleUserDeleted = (userId: number) => {
    setUsers(prevUsers => prevUsers.filter(user => user.id !== userId))
    setTotal(prevTotal => prevTotal - 1)
    
    // If we deleted the last item on this page and we're not on page 1, go to previous page
    if (users.length === 1 && page > 1) {
      setPage(page - 1)
    }
  }

  const handleUserDeleteFailed = () => {
    loadUsers()
  }

  const handleUserUpdated = (updatedUser: UserWithClinic) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === updatedUser.id ? updatedUser : user
      )
    )
  }

  const handleUserUpdateFailed = () => {
    loadUsers()
  }

  const handleNewUser = () => {
    setEditingUser(null)
    setIsUserModalOpen(true)
  }

  const handleEditUser = (user: UserWithClinic) => {
    setEditingUser(user)
    setIsUserModalOpen(true)
  }

  const handleUserModalClose = () => {
    setIsUserModalOpen(false)
    setEditingUser(null)
  }

  const handleUserChange = () => {
    loadUsers()
  }

  // Check if current user can manage users
  const canManageUsers = isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager)

  if (!canManageUsers) {
    return (
      <>
        <SiteHeader title="משתמשים" />
        <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
          <div className="text-center text-muted-foreground">
            אין לך הרשאה לצפות במשתמשים
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader title="משתמשים" />
      <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="@container/main flex flex-col gap-2">
          <div className="flex flex-col gap-2 md:gap-0">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">כל המשתמשים</h1>
              <Button onClick={handleNewUser} className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                משתמש חדש
              </Button>
            </div>

            <UsersTable 
              data={users} 
              onUserDeleted={handleUserDeleted}
              onUserDeleteFailed={handleUserDeleteFailed}
              onUserUpdated={handleUserUpdated}
              onUserUpdateFailed={handleUserUpdateFailed}
              onNewUser={handleNewUser}
              onEditUser={handleEditUser}
              loading={loading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              hideNewButton={true}
              pagination={{ page, pageSize, total, setPage }}
            />
            
            <div className="h-12"></div>
          </div>
        </div>
      </div>

      <UserModal 
        isOpen={isUserModalOpen}
        onClose={handleUserModalClose}
        editingUser={editingUser as any}
        currentUser={currentUser as any}
        onUserSaved={() => loadUsers()}
        onUserUpdated={() => loadUsers()}
      />
    </>
  )
}
