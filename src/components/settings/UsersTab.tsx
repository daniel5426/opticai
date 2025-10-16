import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IconPlus, IconEdit, IconTrash } from "@tabler/icons-react"
import { User } from "@/lib/db/schema-interface"

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
  return (
    <div className="space-y-6">
      <Card className="shadow-md border-none">
        <CardHeader>
          <div className="flex justify-between">
            <Button 
              onClick={onCreateUser} 
              size="icon"
              className="mr-4 bg-default text-default-foreground hover:bg-accent/90"
              title="הוסף משתמש חדש"
            >
              <IconPlus className="h-4 w-4" />
            </Button>
            <div></div>
            <div className="text-right">
              <CardTitle className="text-right">ניהול משתמשים</CardTitle>
              <p className="text-sm text-muted-foreground text-right">הוסף, ערוך ומחק משתמשים במערכת</p>
            </div>
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
                  <div key={user.id} className={`flex items-center justify-between p-4 border rounded-lg ${
                    user.id === currentUser?.id ? 'border-primary/50 border-2' : ''
                  }`}>
                    <div className="flex items-center gap-2">
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
                    <div className="text-right flex-1">
                      <div className="flex items-center gap-2 justify-end">
                        <Badge variant={
                          user.role === 'company_ceo' ? 'default' : 
                          user.role === 'clinic_manager' ? 'secondary' : 
                          user.role === 'clinic_worker' ? 'outline' :
                          'outline'
                        }>
                          {user.role === 'company_ceo' ? 'מנכ"ל החברה' : 
                           user.role === 'clinic_manager' ? 'מנהל מרפאה' : 
                           user.role === 'clinic_worker' ? 'עובד מרפאה' : 
                           'צופה מרפאה'}
                        </Badge>
                        <h3 className="font-medium">{user.username}</h3>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {user.email && <span>אימייל: {user.email}</span>}
                        {user.email && user.phone && <span> • </span>}
                        {user.phone && <span>טלפון: {user.phone}</span>}
                        {!user.email && !user.phone && <span>אין פרטי יצירת קשר</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {user.password ? 'מוגן בסיסמה' : 'ללא סיסמה'}
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


