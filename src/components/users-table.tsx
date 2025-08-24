import * as React from "react"
import { User } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PlusIcon, Trash2, Edit, UserCheck, UserX } from "lucide-react"
import { CustomModal } from "@/components/ui/custom-modal"
import { deleteUser, updateUser } from "@/lib/db/users-db"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface UserWithClinic extends User {
  clinic_name?: string;
}

interface UsersTableProps {
  data: UserWithClinic[]
  onUserDeleted?: (userId: number) => void
  onUserDeleteFailed?: () => void
  onUserUpdated?: (user: UserWithClinic) => void
  onUserUpdateFailed?: () => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  hideSearch?: boolean
  hideNewButton?: boolean
  onNewUser?: () => void
  onEditUser?: (user: UserWithClinic) => void
  loading?: boolean
  pagination?: { page: number; pageSize: number; total: number; setPage: (p: number) => void }
}

export function UsersTable({ 
  data, 
  onUserDeleted, 
  onUserDeleteFailed,
  onUserUpdated,
  onUserUpdateFailed,
  searchQuery: externalSearchQuery,
  onSearchChange,
  hideSearch = false,
  hideNewButton = false,
  onNewUser,
  onEditUser,
  loading = false,
  pagination
}: UsersTableProps) {
  const [internalSearchQuery, setInternalSearchQuery] = React.useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [userToDelete, setUserToDelete] = React.useState<UserWithClinic | null>(null)

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value)
    } else {
      setInternalSearchQuery(value)
    }
  }

  const filteredData = React.useMemo(() => {
    let filtered = data

    if (searchQuery && filtered.length > 0) {
      filtered = filtered.filter((user) => {
        const searchableFields = [
          user.full_name || user.username,
          user.email,
          user.phone,
          user.clinic_name,
        ]

        return searchableFields.some(
          (field) =>
            field && field.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      })
    }

    return filtered
  }, [data, searchQuery])

  const handleDeleteConfirm = async () => {
    if (userToDelete && userToDelete.id !== undefined) {
      try {
        const deletedUserId = userToDelete.id
        onUserDeleted?.(deletedUserId)
        toast.success("משתמש נמחק בהצלחה")

        const success = await deleteUser(deletedUserId)
        if (!success) {
          toast.error("אירעה שגיאה בעת מחיקת המשתמש. מרענן נתונים...")
          onUserDeleteFailed?.()
        }
      } catch (error) {
        toast.error("אירעה שגיאה בעת מחיקת המשתמש")
        onUserDeleteFailed?.()
      } finally {
        setUserToDelete(null)
      }
    }
    setIsDeleteModalOpen(false)
  }

  const handleToggleUserStatus = async (user: UserWithClinic) => {
    try {
      const updatedUser = {
        ...user,
        is_active: !user.is_active
      }

      const result = await updateUser(updatedUser)
      
      if (result) {
        toast.success(`המשתמש ${user.is_active ? 'הושבת' : 'הופעל'} בהצלחה`)
        onUserUpdated?.(updatedUser)
      } else {
        toast.error('שגיאה בעדכון סטטוס המשתמש')
        onUserUpdateFailed?.()
      }
    } catch (error) {
      toast.error('שגיאה בעדכון סטטוס המשתמש')
      onUserUpdateFailed?.()
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'worker': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'מנהל מערכת';
      case 'worker': return 'עובד';
      case 'viewer': return 'צופה';
      default: return role;
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {!hideSearch && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Input
              placeholder="חיפוש משתמשים..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-[250px] bg-card dark:bg-card"
              dir="rtl"
            />
          </div>
          {!hideNewButton && onNewUser && (
            <Button onClick={onNewUser} dir="rtl">
              משתמש חדש
              <PlusIcon className="mr-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">מס' משתמש</TableHead>
              <TableHead className="text-right">שם מלא</TableHead>
              <TableHead className="text-right">תפקיד</TableHead>
              <TableHead className="text-right">אימייל</TableHead>
              <TableHead className="text-right">טלפון</TableHead>
              <TableHead className="text-right">מרפאה</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="w-[100px] text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2 " />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredData.length > 0 ? (
              filteredData.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.id}</TableCell>
                  <TableCell>{user.full_name || user.username || ""}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {getRoleDisplayName(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.email || ""}</TableCell>
                  <TableCell>{user.phone || ""}</TableCell>
                  <TableCell>{user.clinic_name || "גלובלי"}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "פעיל" : "לא פעיל"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0" 
                        onClick={() => onEditUser?.(user)}
                        title="עריכה"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0" 
                        onClick={() => handleToggleUserStatus(user)}
                        title={user.is_active ? "השבתה" : "הפעלה"}
                      >
                        {user.is_active ? (
                          <UserX className="h-4 w-4 text-orange-600" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0" 
                        onClick={() => {
                          setUserToDelete(user);
                          setIsDeleteModalOpen(true);
                        }} 
                        title="מחיקה"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  לא נמצאו משתמשים לתצוגה
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            עמוד {pagination.page} מתוך {Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 1)))} · סה"כ {pagination.total || 0}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pagination.page <= 1}
              onClick={() => pagination.setPage(Math.max(1, pagination.page - 1))}
            >הקודם</Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pagination.page >= Math.ceil((pagination.total || 0) / (pagination.pageSize || 1))}
              onClick={() => pagination.setPage(pagination.page + 1)}
            >הבא</Button>
          </div>
        </div>
      )}

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת משתמש"
        description={userToDelete ? `האם אתה בטוח שברצונך למחוק את המשתמש ${userToDelete.full_name || userToDelete.username}? פעולה זו אינה הפיכה.` : "האם אתה בטוח שברצונך למחוק משתמש זה? פעולה זו אינה הפיכה."}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        className="text-center"
        cancelText="בטל"
        showCloseButton={false}
      />
    </div>
  )
} 