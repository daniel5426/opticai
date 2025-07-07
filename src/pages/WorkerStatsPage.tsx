import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { IconClock, IconCalendar, IconChartBar } from "@tabler/icons-react"
import { getAllUsers } from "@/lib/db/users-db"
import { getWorkShiftStats, getWorkShiftsByUserAndDate } from "@/lib/db/work-shifts-db"
import { User, WorkShift } from "@/lib/db/schema"
import { useUser } from "@/contexts/UserContext"

export default function WorkerStatsPage() {
  const { currentUser } = useUser()
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [userStats, setUserStats] = useState<{
    totalShifts: number;
    totalMinutes: number;
    averageMinutes: number;
  }>({ totalShifts: 0, totalMinutes: 0, averageMinutes: 0 })
  const [dayShifts, setDayShifts] = useState<WorkShift[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await getAllUsers()
        const workers = allUsers.filter(user => user.role !== 'viewer')
        setUsers(workers)
        if (workers.length > 0 && !selectedUserId) {
          setSelectedUserId(workers[0].id!)
        }
      } catch (error) {
        console.error('Error loading users:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [selectedUserId])

  useEffect(() => {
    const loadUserStats = async () => {
      if (!selectedUserId) return

      try {
        const stats = await getWorkShiftStats(selectedUserId, selectedYear, selectedMonth)
        setUserStats(stats)
      } catch (error) {
        console.error('Error loading user stats:', error)
      }
    }

    loadUserStats()
  }, [selectedUserId, selectedMonth, selectedYear])

  useEffect(() => {
    const loadDayShifts = async () => {
      if (!selectedUserId || !selectedDate) return

      try {
        const shifts = await getWorkShiftsByUserAndDate(selectedUserId, selectedDate)
        setDayShifts(shifts)
      } catch (error) {
        console.error('Error loading day shifts:', error)
      }
    }

    loadDayShifts()
  }, [selectedUserId, selectedDate])

  if (currentUser?.role !== 'admin') {
    return (
      <>
        <SiteHeader title="סטטיסטיקות עובדים" />
        <div className="flex flex-col items-center justify-center h-full" dir="rtl">
          <div className="text-lg text-red-600">אין לך הרשאה לצפות בעמוד זה</div>
        </div>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <SiteHeader title="סטטיסטיקות עובדים" />
        <div className="flex flex-col items-center justify-center h-full" dir="rtl">
          <div className="text-lg">טוען נתונים...</div>
        </div>
      </>
    )
  }

  const selectedUser = users.find(u => u.id === selectedUserId)
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }

  return (
    <>
      <SiteHeader title="סטטיסטיקות עובדים" />
      <div className="h-full overflow-auto bg-muted/30" style={{scrollbarWidth: 'none'}} dir="rtl">
        <div className="max-w-6xl mx-auto p-6 pb-20 space-y-6">
          
          {/* Header */}
          <div className="text-right space-y-2 mb-8">
            <h1 className="text-2xl font-bold">סטטיסטיקות עובדים</h1>
            <p className="text-muted-foreground">צפה בנתוני נוכחות ומשמרות של העובדים</p>
          </div>

          {users.length === 0 ? (
            <Card className="shadow-md border-none">
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg mb-2">אין עובדים במערכת</p>
                  <p className="text-sm">הוסף עובדים דרך עמוד ההגדרות</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue={selectedUserId?.toString()} className="w-full" orientation="vertical">
              <div className="flex gap-6">
                {/* Content on the Left */}
                <div className="flex-1">
                  {users.map((user) => (
                    <TabsContent key={user.id} value={user.id!.toString()} className="space-y-6 mt-0">
                      {/* User Stats Overview */}
                      <Card className="shadow-md border-none">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? 'מנהל' : 'עובד'}
                            </Badge>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <CardTitle>{user.username}</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  סטטיסטיקות לחודש {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
                                </p>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                {user.profile_picture ? (
                                  <img src={user.profile_picture} alt={user.username} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-semibold">
                                    {user.username.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Month/Year Selector */}
                          <div className="flex items-center gap-4 justify-end mb-6">
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="px-3 py-1 text-sm border rounded-md bg-background"
                              >
                                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                  <option key={year} value={year}>{year}</option>
                                ))}
                              </select>
                              <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="px-3 py-1 text-sm border rounded-md bg-background"
                              >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                  <option key={month} value={month}>
                                    {new Date(2024, month - 1).toLocaleDateString('he-IL', { month: 'long' })}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                              <div className="flex items-center justify-center mb-2">
                                <IconCalendar className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="text-2xl font-bold text-blue-600">{userStats.totalShifts}</div>
                              <div className="text-sm text-muted-foreground">משמרות החודש</div>
                            </div>
                            
                            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                              <div className="flex items-center justify-center mb-2">
                                <IconClock className="h-5 w-5 text-green-600" />
                              </div>
                              <div className="text-2xl font-bold text-green-600">
                                {formatDuration(userStats.totalMinutes)}
                              </div>
                              <div className="text-sm text-muted-foreground">סה"כ שעות</div>
                            </div>
                            
                            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                              <div className="flex items-center justify-center mb-2">
                                <IconChartBar className="h-5 w-5 text-orange-600" />
                              </div>
                              <div className="text-2xl font-bold text-orange-600">
                                {formatDuration(userStats.averageMinutes)}
                              </div>
                              <div className="text-sm text-muted-foreground">ממוצע למשמרת</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Day View */}
                      <Card className="shadow-md border-none">
                        <CardHeader>
                          <CardTitle className="text-right">צפייה לפי יום</CardTitle>
                          <p className="text-sm text-muted-foreground text-right">בחר תאריך לצפייה בשעות הגעה ויציאה</p>
                        </CardHeader>
                        <CardContent className="space-y-4" >
                          <div className="flex items-center gap-4 justify-end">
                            <Input
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              className="w-auto text-center"
                            />
                            <Label className="text-sm font-medium">:תאריך</Label>
                          </div>
                          
                          {dayShifts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              אין משמרות לתאריך זה
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {dayShifts.map((shift, index) => (
                                <div key={shift.id || index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={
                                      shift.status === 'completed' ? 'default' :
                                      shift.status === 'active' ? 'destructive' :
                                      'outline'
                                    }>
                                      {shift.status === 'completed' ? 'הושלמה' :
                                       shift.status === 'active' ? 'פעילה' :
                                       'בוטלה'}
                                    </Badge>
                                    {shift.status === 'completed' && shift.duration_minutes && (
                                      <span className="text-sm text-muted-foreground">
                                        ({formatDuration(shift.duration_minutes)})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">
                                      {shift.start_time.slice(0, 5)} - {shift.end_time ? shift.end_time.slice(0, 5) : 'פעילה'}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      משמרת {index + 1}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  ))}
                </div>

                {/* Vertical TabsList on the Right */}
                <TabsList className="flex flex-col h-fit w-48 p-1">
                  {users.map((user) => (
                    <TabsTrigger 
                      key={user.id} 
                      value={user.id!.toString()} 
                      className="w-full justify-end text-right"
                      onClick={() => setSelectedUserId(user.id!)}
                    >
                      <div className="text-right">
                        <div className="font-medium">{user.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.role === 'admin' ? 'מנהל' : 'עובד'}
                        </div>
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          )}
        </div>
      </div>
    </>
  )
} 