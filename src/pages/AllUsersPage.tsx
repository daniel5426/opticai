import React, { useState, useEffect } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { UsersTable } from "@/components/users-table"
import { UserModal } from "@/components/UserModal"
import { getPaginatedUsers } from "@/lib/db/users-db"
import { User } from "@/lib/db/schema-interface"
import { useUser } from "@/contexts/UserContext"
import { ROLE_LEVELS, isRoleAtLeast } from '@/lib/role-levels'
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { buildTableSearch } from "@/lib/list-page-search"

interface UserWithClinic extends User {
  clinic_name?: string;
}

export default function AllUsersPage() {
  const search = useSearch({ from: "/users" })
  const navigate = useNavigate()
  const { currentUser, currentClinic } = useUser()
  const [users, setUsers] = useState<UserWithClinic[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithClinic | null>(null)
  const [searchInput, setSearchInput] = useState(search.q)

  useEffect(() => {
    setSearchInput(search.q)
  }, [search.q])

  const buildSearchState = (
    overrides?: Partial<{ q: string; page: number; role: string; clinicScope: string }>
  ) =>
    buildTableSearch(
      {
        q: searchInput.trim(),
        page: search.page,
        role: search.role,
        clinicScope: search.clinicScope,
        ...overrides,
      },
      {
        q: "",
        page: 1,
        role: ALL_FILTER_VALUE,
        clinicScope: ALL_FILTER_VALUE,
      },
    )

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search.q) return
      navigate({
        to: "/users",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      })
    }, 400)
    return () => clearTimeout(t)
  }, [navigate, search.q, searchInput])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const offset = (search.page - 1) * pageSize
      const { items, total } = await getPaginatedUsers({
        limit: pageSize,
        offset,
        order: 'id_desc',
        q: search.q || undefined,
        roleLevel: search.role !== ALL_FILTER_VALUE ? Number(search.role) : undefined,
        clinic_id:
          search.clinicScope === "current" && currentClinic?.id
            ? currentClinic.id
            : undefined,
      })
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
  }, [currentClinic?.id, pageSize, search.clinicScope, search.page, search.q, search.role])

  const handleUserDeleted = (userId: number) => {
    setUsers(prevUsers => prevUsers.filter(user => user.id !== userId))
    if (users.length === 1 && search.page > 1) {
      navigate({
        to: "/users",
        search: buildSearchState({ page: search.page - 1 }),
      })
      return
    }
    setTotal(prevTotal => prevTotal - 1)
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
              searchQuery={searchInput}
              onSearchChange={setSearchInput}
              roleFilter={search.role}
              onRoleFilterChange={(value) =>
                navigate({
                  to: "/users",
                  search: buildSearchState({ role: value, page: 1 }),
                })
              }
              clinicScopeFilter={search.clinicScope}
              onClinicScopeFilterChange={(value) =>
                navigate({
                  to: "/users",
                  search: buildSearchState({ clinicScope: value, page: 1 }),
                })
              }
              companyId={currentUser?.company_id}
              currentClinicId={currentClinic?.id}
              hideNewButton={false}
              pagination={{
                page: search.page,
                pageSize,
                total,
                setPage: (page) =>
                  navigate({
                    to: "/users",
                    search: buildSearchState({ page }),
                  }),
              }}
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
