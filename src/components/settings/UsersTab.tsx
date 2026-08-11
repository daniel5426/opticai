import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IconPlus, IconEdit, IconTrash } from "@tabler/icons-react"
import { User } from "@/lib/db/schema-interface"
import { getRoleBadgeVariant, getRoleLabel } from "@/lib/role-levels"
import { useAppLocale } from "@/localization/use-app-locale"

interface UsersTabProps {
  users: User[]
  currentUser: User | null
  usersLoading: boolean
  onCreateUser: () => void
  onEditUser: (user: User) => void
  onDeleteUser: (userId: number) => void
}


export function UsersTab({ 
  users, 
  currentUser, 
  usersLoading, 
  onCreateUser, 
  onEditUser, 
  onDeleteUser 
}: UsersTabProps) {
  const { direction } = useAppLocale()

  return (
    <div className="space-y-6" dir={direction}>
      <Card className="">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 text-start">
              <CardTitle className="text-start">ניהול משתמשים</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm text-start">
                הוסף, ערוך ומחק משתמשים במערכת
              </p>
            </div>
            <Button
              onClick={onCreateUser}
              size="icon"
              className="shrink-0 bg-default text-default-foreground hover:bg-accent/90"
              title="הוסף משתמש חדש"
            >
              <IconPlus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  אין משתמשים במערכת
                </div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className={`flex flex-row-reverse items-start justify-between gap-4 rounded-lg border p-4 ${
                    user.id === currentUser?.id ? 'border-primary/50 border-2' : ''
                  }`}>
                    <div className="flex shrink-0 items-center gap-2">
                      {user.id !== currentUser?.id && (
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => onDeleteUser(user.id!)}
                          className="text-red-600 hover:text-red-700 h-8 w-8"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => onEditUser(user)}
                        className="h-8 w-8"
                      >
                        <IconEdit className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="min-w-0 flex-1 text-start">
                      <div className="flex items-center gap-2 text-start">
                        <h3 className="min-w-0 truncate font-medium">{user.username}</h3>
                        <Badge variant={getRoleBadgeVariant(user.role_level)}>
                          {getRoleLabel(user.role_level)}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground mt-1 break-words text-sm">
                        {user.email && <span>אימייל: {user.email}</span>}
                        {user.email && user.phone && <span> • </span>}
                        {user.phone && <span>טלפון: {user.phone}</span>}
                        {!user.email && !user.phone && <span>אין פרטי יצירת קשר</span>}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {user.has_password ? 'מוגן בסיסמה' : 'ללא סיסמה'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
