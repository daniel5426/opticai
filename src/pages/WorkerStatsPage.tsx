import React, { useState, useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/ui/custom-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { DateInput } from "@/components/ui/date";
import {
  IconClock,
  IconCalendar,
  IconChartBar,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { apiClient } from "@/lib/api-client";
import { User, WorkShift } from "@/lib/db/schema-interface";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";
import { useUser } from "@/contexts/UserContext";

export default function WorkerStatsPage() {
  const { currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [userStats, setUserStats] = useState<{
    totalShifts: number;
    totalMinutes: number;
    averageMinutes: number;
  }>({ totalShifts: 0, totalMinutes: 0, averageMinutes: 0 });
  const [dayShifts, setDayShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newShiftData, setNewShiftData] = useState({
    start_time: "",
    end_time: "",
  });

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await apiClient.getUsers();
        if (response.data) {
          const workers = response.data.filter((user) =>
            isRoleAtLeast(user.role_level, ROLE_LEVELS.worker),
          );
          setUsers(workers);
          if (workers.length > 0 && !selectedUserId) {
            setSelectedUserId(workers[0].id!);
          }
        }
      } catch (error) {
        console.error("Error loading users:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [selectedUserId]);

  const loadDayShifts = async () => {
    if (!selectedUserId || !selectedDate) return;

    try {
      const response = await apiClient.getWorkShiftsByUserAndDate(
        selectedUserId,
        selectedDate,
      );
      if (response.data) {
        setDayShifts(response.data);
      } else {
        setDayShifts([]);
      }
    } catch (error) {
      console.error("Error loading day shifts:", error);
      setDayShifts([]);
    }
  };

  const loadUserStats = async () => {
    if (!selectedUserId) return;

    try {
      const response = await apiClient.getWorkShiftStats(
        selectedUserId,
        selectedYear,
        selectedMonth,
      );
      if (response.data) {
        const stats = response.data as {
          total_shifts: number;
          total_minutes: number;
          average_minutes: number;
        };
        setUserStats({
          totalShifts: stats.total_shifts || 0,
          totalMinutes: stats.total_minutes || 0,
          averageMinutes: stats.average_minutes || 0,
        });
      } else {
        setUserStats({ totalShifts: 0, totalMinutes: 0, averageMinutes: 0 });
      }
    } catch (error) {
      console.error("Error loading user stats:", error);
      setUserStats({ totalShifts: 0, totalMinutes: 0, averageMinutes: 0 });
    }
  };

  useEffect(() => {
    loadDayShifts();
  }, [selectedUserId, selectedDate]);

  useEffect(() => {
    loadUserStats();
  }, [selectedUserId, selectedMonth, selectedYear]);

  if (loading) {
    return (
      <>
        <SiteHeader title="יומן נוכחות" />
        <div
          className="bg-muted/30 h-full overflow-auto"
          style={{ scrollbarWidth: "none" }}
          dir="ltr"
        >
          <div className="mx-auto max-w-6xl space-y-6 p-6 pb-20" dir="ltr">
            {/* Header */}
            <div className="mb-8 space-y-2 text-right">
              <h1 className="text-xl font-bold">יומן נוכחות</h1>
              <p className="text-muted-foreground">
                צפה בנתוני נוכחות ומשמרות של העובדים
              </p>
            </div>

            <div className="flex gap-6" dir="ltr">
              <div className="flex-1 space-y-6">
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="mb-6 flex items-center justify-end gap-2">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Skeleton className="ml-auto h-6 w-24" />
                          <Skeleton className="mt-2 ml-auto h-4 w-56" />
                        </div>
                        <Skeleton className="h-10 w-10 rounded-full" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Skeleton className="h-24 w-full rounded-lg" />
                      <Skeleton className="h-24 w-full rounded-lg" />
                      <Skeleton className="h-24 w-full rounded-lg" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Skeleton className="h-8 w-36" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="ml-auto h-5 w-28" />
                        <Skeleton className="mt-2 ml-auto h-4 w-56" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-end gap-4">
                      <Skeleton className="h-10 w-40" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="grid gap-3">
                      <Skeleton className="h-20 w-full rounded-lg" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="w-48">
                <div className="dark:bg-card/50 flex h-fit w-48 flex-col gap-1 rounded-md bg-cyan-800/10 p-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="w-full rounded-md px-2 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const formatDuration = (minutes: number) => {
    if (!minutes || isNaN(minutes)) return "0:00";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  const handleCreateShift = async () => {
    if (!selectedUserId || !newShiftData.start_time || !newShiftData.end_time)
      return;

    try {
      const startTime = new Date(
        `${selectedDate}T${newShiftData.start_time}:00`,
      );
      const endTime = new Date(`${selectedDate}T${newShiftData.end_time}:00`);
      const durationMinutes = Math.floor(
        (endTime.getTime() - startTime.getTime()) / (1000 * 60),
      );

      const shiftData = {
        user_id: selectedUserId,
        start_time: newShiftData.start_time,
        end_time: newShiftData.end_time,
        duration_minutes: durationMinutes,
        date: selectedDate,
        status: "completed" as const,
      };

      const response = await apiClient.createWorkShift(shiftData);
      if (response.data) {
        setIsCreateModalOpen(false);
        setNewShiftData({ start_time: "", end_time: "" });
        await loadDayShifts();
        await loadUserStats();
      }
    } catch (error) {
      console.error("Error creating shift:", error);
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    if (!shiftId) return;

    try {
      const response = await apiClient.deleteWorkShift(shiftId);
      if (!response.error) {
        await loadDayShifts();
        await loadUserStats();
      }
    } catch (error) {
      console.error("Error deleting shift:", error);
    }
  };

  return (
    <>
      <SiteHeader title="יומן נוכחות" />
      <div
        className="bg-muted/30 h-full overflow-auto"
        style={{ scrollbarWidth: "none" }}
        dir="rtl"
      >
        <div className="mx-auto max-w-6xl space-y-6 p-6 pb-20">
          {/* Header */}
          <div className="mb-8 space-y-2 text-right">
            <h1 className="text-xl font-bold">יומן נוכחות</h1>
            <p className="text-muted-foreground">
              צפה בנתוני נוכחות ומשמרות של העובדים
            </p>
          </div>

          {users.length === 0 ? (
            <Card className="">
              <CardContent className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground text-center">
                  <p className="mb-2 text-lg">אין עובדים במערכת</p>
                  <p className="text-sm">הוסף עובדים דרך עמוד ההגדרות</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Tabs
              defaultValue={selectedUserId?.toString()}
              className="w-full"
              orientation="vertical"
            >
              <div className="flex gap-6">
                {/* Content on the Left */}
                <div className="flex-1">
                  {users.map((user) => (
                    <TabsContent
                      key={user.id}
                      value={user.id!.toString()}
                      className="mt-0 space-y-6"
                    >
                      {/* User Stats Overview */}
                      <Card className="">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="mb-6 flex items-center justify-end gap-4">
                              <div className="flex items-center gap-2">
                                <select
                                  value={selectedYear}
                                  onChange={(e) =>
                                    setSelectedYear(Number(e.target.value))
                                  }
                                  className="bg-background rounded-md border px-3 py-1 text-sm"
                                >
                                  {Array.from(
                                    { length: 10 },
                                    (_, i) => new Date().getFullYear() - i,
                                  ).map((year) => (
                                    <option key={year} value={year}>
                                      {year}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={selectedMonth}
                                  onChange={(e) =>
                                    setSelectedMonth(Number(e.target.value))
                                  }
                                  className="bg-background rounded-md border px-3 py-1 text-sm"
                                >
                                  {Array.from(
                                    { length: 12 },
                                    (_, i) => i + 1,
                                  ).map((month) => (
                                    <option key={month} value={month}>
                                      {new Date(
                                        2024,
                                        month - 1,
                                      ).toLocaleDateString("he-IL", {
                                        month: "long",
                                      })}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <CardTitle>
                                  {user.full_name || user.username}
                                </CardTitle>
                                <p className="text-muted-foreground text-sm">
                                  נתוני נוכחות לחודש{" "}
                                  {new Date(
                                    selectedYear,
                                    selectedMonth - 1,
                                  ).toLocaleDateString("he-IL", {
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                              <div className="bg-muted flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
                                {user.profile_picture ? (
                                  <img
                                    src={user.profile_picture}
                                    alt={user.full_name || user.username}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="font-semibold">
                                    {(user.full_name || user.username)
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Month/Year Selector */}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="bg-accent/70 rounded-lg p-4 text-center shadow-md">
                              <div className="mb-2 flex items-center justify-center">
                                <IconCalendar className="text-primary h-5 w-5" />
                              </div>
                              <div className="text-primary text-2xl font-bold">
                                {userStats.totalShifts}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                משמרות החודש
                              </div>
                            </div>

                            <div className="border-primary rounded-lg border-[1px] p-4 text-center shadow-md">
                              <div className="mb-2 flex items-center justify-center">
                                <IconClock className="h-5 w-5" />
                              </div>
                              <div className="text-2xl font-bold">
                                {formatDuration(userStats.totalMinutes)}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                סה"כ שעות
                              </div>
                            </div>

                            <div className="bg-accent/70 rounded-lg p-4 text-center shadow-md">
                              <div className="mb-2 flex items-center justify-center">
                                <IconChartBar className="text-primary h-5 w-5" />
                              </div>
                              <div className="text-primary text-2xl font-bold">
                                {formatDuration(userStats.averageMinutes)}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                ממוצע למשמרת
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Day View */}
                      <Card className="">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              {isRoleAtLeast(
                                currentUser?.role_level,
                                ROLE_LEVELS.manager,
                              ) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsCreateModalOpen(true)}
                                  className="flex items-center gap-2"
                                >
                                  <IconPlus className="h-4 w-4" />
                                  הוספת משמרת
                                </Button>
                              )}
                            </div>
                            <div className="text-right">
                              <CardTitle>צפייה לפי יום</CardTitle>
                              <p className="text-muted-foreground text-sm">
                                בחר תאריך לצפייה בשעות הגעה ויציאה
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-end gap-4">
                            <DateInput
                              name="selected_date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              className="w-auto text-center"
                            />
                            <Label className="text-sm font-medium">
                              :תאריך
                            </Label>
                          </div>

                          {dayShifts.length === 0 ? (
                            <div className="text-muted-foreground py-12 text-center">
                              <IconClock className="mx-auto mb-4 h-12 w-12 opacity-50" />
                              <p className="mb-2 text-lg">
                                אין משמרות לתאריך זה
                              </p>
                              <p className="text-sm">
                                לחץ על "הוספת משמרת" כדי להוסיף משמרת חדשה
                              </p>
                            </div>
                          ) : (
                            <div className="grid gap-3">
                              {dayShifts.map((shift, index) => (
                                <div
                                  key={shift.id || index}
                                  className="bg-accent/50 rounded-lg p-4 shadow-md transition-colors"
                                >
                                  <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant={
                                          shift.status === "completed"
                                            ? "default"
                                            : shift.status === "active"
                                              ? "destructive"
                                              : "outline"
                                        }
                                      >
                                        {shift.status === "completed"
                                          ? "הושלמה"
                                          : shift.status === "active"
                                            ? "פעילה"
                                            : "בוטלה"}
                                      </Badge>
                                      {isRoleAtLeast(
                                        currentUser?.role_level,
                                        ROLE_LEVELS.manager,
                                      ) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            handleDeleteShift(shift.id!)
                                          }
                                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                        >
                                          <IconTrash className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                    <div className="text-muted-foreground text-sm">
                                      משמרת {index + 1}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div className="bg-card rounded-lg p-3 text-center shadow-md">
                                      <div className="text-lg font-medium">
                                        {formatDuration(
                                          shift.duration_minutes || 0,
                                        )}{" "}
                                      </div>
                                      <div className="text-muted-foreground">
                                        משך המשמרת
                                      </div>
                                    </div>
                                    <div className="bg-card rounded-lg p-3 text-center shadow-md">
                                      <div className="text-lg font-medium">
                                        {shift.end_time
                                          ? shift.end_time.slice(0, 5)
                                          : "פעילה"}
                                      </div>
                                      <div className="text-muted-foreground">
                                        סיום
                                      </div>
                                    </div>
                                    <div className="bg-card rounded-lg p-3 text-center shadow-md">
                                      <div className="text-lg font-medium">
                                        {shift.start_time.slice(0, 5)}
                                      </div>
                                      <div className="text-muted-foreground">
                                        התחלה
                                      </div>
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
                <TabsList className="dark:bg-card/50 flex h-fit w-48 flex-col bg-cyan-800/10 p-1">
                  {users.map((user) => (
                    <TabsTrigger
                      key={user.id}
                      value={user.id!.toString()}
                      className="w-full justify-end text-right"
                      onClick={() => setSelectedUserId(user.id!)}
                    >
                      <div className="w-full text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-muted-foreground text-sm">
                            {isRoleAtLeast(user.role_level, ROLE_LEVELS.manager)
                              ? "(מנהל)"
                              : "(עובד)"}
                          </span>
                          <span className="font-medium">
                            {user.full_name || user.username}
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
          setIsCreateModalOpen(false);
          setNewShiftData({ start_time: "", end_time: "" });
        }}
        title="הוספת משמרת חדשה"
        subtitle={`תאריך: ${new Date(selectedDate).toLocaleDateString("he-IL")}`}
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
              <Label htmlFor="start_time" className="text-sm font-medium">
                שעת התחלה
              </Label>
              <Input
                id="start_time"
                type="time"
                value={newShiftData.start_time}
                onChange={(e) =>
                  setNewShiftData((prev) => ({
                    ...prev,
                    start_time: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="end_time" className="text-sm font-medium">
                שעת סיום
              </Label>
              <Input
                id="end_time"
                type="time"
                value={newShiftData.end_time}
                onChange={(e) =>
                  setNewShiftData((prev) => ({
                    ...prev,
                    end_time: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
          </div>

          {newShiftData.start_time && newShiftData.end_time && (
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-muted-foreground text-sm">משך המשמרת</div>
              <div className="font-medium">
                {(() => {
                  const start = new Date(
                    `${selectedDate}T${newShiftData.start_time}:00`,
                  );
                  const end = new Date(
                    `${selectedDate}T${newShiftData.end_time}:00`,
                  );
                  const duration = Math.floor(
                    (end.getTime() - start.getTime()) / (1000 * 60),
                  );
                  return formatDuration(duration);
                })()}
              </div>
            </div>
          )}
        </div>
      </CustomModal>
    </>
  );
}
