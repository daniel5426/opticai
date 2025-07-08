import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { CustomModal } from "@/components/ui/custom-modal"
import { IconClock, IconCalendar, IconChartBar, IconPlus, IconTrash, IconChevronRight, IconChevronLeft } from "@tabler/icons-react"
import { getAllUsers } from "@/lib/db/users-db"
import { getWorkShiftStats, getWorkShiftsByUserAndDate, createWorkShift, deleteWorkShift } from "@/lib/db/work-shifts-db"
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newShiftData, setNewShiftData] = useState({
    start_time: '',
    end_time: ''
  })

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



  const loadDayShifts = async () => {
    if (!selectedUserId || !selectedDate) return

    try {
      const shifts = await getWorkShiftsByUserAndDate(selectedUserId, selectedDate)
      setDayShifts(shifts)
    } catch (error) {
      console.error('Error loading day shifts:', error)
    }
  }

  const loadUserStats = async () => {
    if (!selectedUserId) return

    try {
      const stats = await getWorkShiftStats(selectedUserId, selectedYear, selectedMonth)
      setUserStats(stats)
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  useEffect(() => {
    loadDayShifts()
  }, [selectedUserId, selectedDate])

  useEffect(() => {
    loadUserStats()
  }, [selectedUserId, selectedMonth, selectedYear])

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

  const handleCreateShift = async () => {
    if (!selectedUserId || !newShiftData.start_time || !newShiftData.end_time) return

    try {
      const startTime = new Date(`${selectedDate}T${newShiftData.start_time}:00`)
      const endTime = new Date(`${selectedDate}T${newShiftData.end_time}:00`)
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))

      const shiftData = {
        user_id: selectedUserId,
        start_time: newShiftData.start_time,
        end_time: newShiftData.end_time,
        duration_minutes: durationMinutes,
        date: selectedDate,
        status: 'completed' as const
      }

      await createWorkShift(shiftData)
      setIsCreateModalOpen(false)
      setNewShiftData({ start_time: '', end_time: '' })
      await loadDayShifts()
      await loadUserStats()
    } catch (error) {
      console.error('Error creating shift:', error)
    }
  }

  const handleDeleteShift = async (shiftId: number) => {
    if (!shiftId) return

    try {
      await deleteWorkShift(shiftId)
      await loadDayShifts()
      await loadUserStats()
    } catch (error) {
      console.error('Error deleting shift:', error)
    }
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
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4  bg-accent/70 rounded-lg shadow-md">
                              <div className="flex items-center justify-center mb-2">
                                <IconCalendar className="h-5 w-5 text-primary" />
                              </div>
                              <div className="text-2xl font-bold text-primary">{userStats.totalShifts}</div>
                              <div className="text-sm text-muted-foreground">משמרות החודש</div>
                            </div>
                            
                            <div className="text-center p-4   border-[1px] border-primary rounded-lg shadow-md">
                              <div className="flex items-center justify-center mb-2">
                                <IconClock className="h-5 w-5 " />
                              </div>
                              <div className="text-2xl font-bold ">
                                {formatDuration(userStats.totalMinutes)}
                              </div>
                              <div className="text-sm text-muted-foreground">סה"כ שעות</div>
                            </div>
                            
                            <div className="text-center p-4 bg-accent/70  rounded-lg shadow-md">
                              <div className="flex items-center justify-center mb-2">
                                <IconChartBar className="h-5 w-5 text-primary" />
                              </div>
                              <div className="text-2xl font-bold text-primary">
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
                          <div className="flex items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsCreateModalOpen(true)}
                              className="flex items-center gap-2"
                            >
                              <IconPlus className="h-4 w-4" />
                              הוספת משמרת
                            </Button>
                            <div className="text-right">
                              <CardTitle>צפייה לפי יום</CardTitle>
                              <p className="text-sm text-muted-foreground">בחר תאריך לצפייה בשעות הגעה ויציאה</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                            <div className="text-center py-12 text-muted-foreground">
                              <IconClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="text-lg mb-2">אין משמרות לתאריך זה</p>
                              <p className="text-sm">לחץ על "הוספת משמרת" כדי להוסיף משמרת חדשה</p>
                            </div>
                          ) : (
                            <div className="grid gap-3">
                              {dayShifts.map((shift, index) => (
                                <div key={shift.id || index} className="shadow-md rounded-lg p-4 bg-accent/50 transition-colors">
                                  <div className="flex items-center justify-between mb-3">
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
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteShift(shift.id!)}
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <IconTrash className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      משמרת {index + 1}
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div className="text-center p-3 bg-card shadow-md rounded-lg">
                                      <div className="font-medium text-lg">
                                      {formatDuration(shift.duration_minutes || 0)}                                      </div>
                                      <div className="text-muted-foreground">משך המשמרת</div>
                                    </div>
                                    <div className="text-center p-3 bg-card shadow-md rounded-lg">
                                      <div className="font-medium text-lg">
                                        {shift.end_time ? shift.end_time.slice(0, 5) : 'פעילה'}
                                      </div>
                                      <div className="text-muted-foreground">סיום</div>
                                    </div>
                                    <div className="text-center p-3 bg-card shadow-md rounded-lg">
                                      <div className="font-medium text-lg">
                                        {shift.start_time.slice(0, 5)}
                                      </div>
                                      <div className="text-muted-foreground">התחלה</div>
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
                <TabsList className="flex flex-col h-fit w-48 p-1 bg-cyan-800/10 dark:bg-card/50">
                  {users.map((user) => (
                    <TabsTrigger 
                      key={user.id} 
                      value={user.id!.toString()} 
                      className="w-full justify-end text-right"
                      onClick={() => setSelectedUserId(user.id!)}
                    >
                      <div className="text-right w-full">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-medium">{user.username}</span>
                          <span className="text-muted-foreground px-[2px]"><IconChevronLeft className="h-2 w-2" /></span>
                          <span className="text-muted-foreground text-sm">
                            {user.role === 'admin' ? 'מנהל' : 'עובד'}
                          </span>
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

      {/* Create Shift Modal */}
      <CustomModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setNewShiftData({ start_time: '', end_time: '' })
        }}
        title="הוספת משמרת חדשה"
        subtitle={`תאריך: ${new Date(selectedDate).toLocaleDateString('he-IL')}`}
        width="max-w-md"
        className="px-2"
        onConfirm={handleCreateShift}
        confirmText="הוספה"
        showCloseButton={false}
        cancelText="ביטול"
      >
                <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time" className="text-sm font-medium">שעת התחלה</Label>
              <Input
                id="start_time"
                type="time"
                value={newShiftData.start_time}
                onChange={(e) => setNewShiftData(prev => ({ ...prev, start_time: e.target.value }))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="end_time" className="text-sm font-medium">שעת סיום</Label>
              <Input
                id="end_time"
                type="time"
                value={newShiftData.end_time}
                onChange={(e) => setNewShiftData(prev => ({ ...prev, end_time: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          
          {newShiftData.start_time && newShiftData.end_time && (
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <div className="text-sm text-muted-foreground">משך המשמרת</div>
              <div className="font-medium">
                {(() => {
                  const start = new Date(`${selectedDate}T${newShiftData.start_time}:00`)
                  const end = new Date(`${selectedDate}T${newShiftData.end_time}:00`)
                  const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
                  return formatDuration(duration)
                })()}
              </div>
            </div>
          )}
        </div>
      </CustomModal>
    </>
  )
} 