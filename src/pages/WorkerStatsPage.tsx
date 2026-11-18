import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconClock,
  IconCalendar,
  IconChartBar,
} from "@tabler/icons-react";
import { apiClient } from "@/lib/api-client";
import { User } from "@/lib/db/schema-interface";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";
import { useUser } from "@/contexts/UserContext";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";
import { TeamHoursDashboard } from "@/components/attendance/TeamHoursDashboard";

type WorkerStats = {
  totalShifts: number;
  totalMinutes: number;
  averageMinutes: number;
};

type WorkShiftStatsResponse = {
  total_shifts: number;
  total_minutes: number;
  average_minutes: number;
};

const workerStatsQueryKeys = {
  users: (clinicId: number | null | undefined) =>
    ["worker-stats", "users", clinicId ?? "none"] as const,
  monthlyStats: (userId: number | null, year: number, month: number) =>
    ["worker-stats", "monthly-stats", userId, year, month] as const,
};

const normalizeDisplayNumber = (
  value: number | null | undefined,
  fractionDigits = 0,
) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;

  return Number(numericValue.toFixed(fractionDigits));
};

const emptyWorkerStats: WorkerStats = {
  totalShifts: 0,
  totalMinutes: 0,
  averageMinutes: 0,
};

const getAttendanceUsers = async (clinicId: number, viewer: User) => {
  const response = await apiClient.getUsersByClinic(clinicId);
  if (response.error) throw new Error(response.error);

  // The clinic endpoint also returns company owners without a clinic assignment.
  // Match the shift API's read scope so every listed person has a readable log.
  return (response.data || []).filter(
    (user) =>
      user.id === viewer.id ||
      isRoleAtLeast(viewer.role_level, ROLE_LEVELS.ceo) ||
      (isRoleAtLeast(viewer.role_level, ROLE_LEVELS.manager) && user.clinic_id === clinicId),
  );
};

const getMonthlyStats = async (
  userId: number,
  year: number,
  month: number,
): Promise<WorkerStats> => {
  const response = await apiClient.getWorkShiftStats(userId, year, month);
  if (response.error) throw new Error(response.error);

  const stats = response.data as WorkShiftStatsResponse | undefined;
  if (!stats) return emptyWorkerStats;

  return {
    totalShifts: normalizeDisplayNumber(stats.total_shifts),
    totalMinutes: normalizeDisplayNumber(stats.total_minutes),
    averageMinutes: normalizeDisplayNumber(stats.average_minutes),
  };
};

export default function WorkerStatsPage() {
  const { direction, locale } = useAppLocale();
  const { t } = useTranslation();
  const { currentUser, currentClinic } = useUser();
  const clinicId = currentClinic?.id;
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const canEditShifts = isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo);

  const usersQuery = useQuery({
    queryKey: [...workerStatsQueryKeys.users(clinicId), currentUser?.id, currentUser?.role_level],
    queryFn: () => getAttendanceUsers(clinicId!, currentUser!),
    enabled: !!clinicId && !!currentUser?.id,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const users = usersQuery.data || [];
  const selectedUserExists =
    selectedUserId !== null && users.some((user) => user.id === selectedUserId);
  const effectiveSelectedUserId = selectedUserExists
    ? selectedUserId
    : (users[0]?.id ?? null);

  const monthlyStatsQuery = useQuery({
    queryKey: workerStatsQueryKeys.monthlyStats(
      effectiveSelectedUserId,
      selectedYear,
      selectedMonth,
    ),
    queryFn: () =>
      getMonthlyStats(effectiveSelectedUserId!, selectedYear, selectedMonth),
    enabled: !!effectiveSelectedUserId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const userStats = monthlyStatsQuery.data || emptyWorkerStats;
  const dateLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : "he-IL";

  if (usersQuery.isLoading) {
    return (
      <>
        <SiteHeader title="יומן נוכחות" />
        <div
          className="bg-muted/30 h-full overflow-auto"
          style={{ scrollbarWidth: "none" }}
          dir={direction}
        >
          <div className="mx-auto max-w-6xl space-y-6 p-6 pb-20" dir={direction}>
            {/* Header */}
            <div className="mb-8 space-y-2 text-start">
              <h1 className="text-xl font-bold">יומן נוכחות</h1>
              <p className="text-muted-foreground">
                צפה בנתוני נוכחות ומשמרות של העובדים
              </p>
            </div>

            <div className="flex flex-row-reverse gap-6" dir={direction}>
              <div className="flex-1 space-y-6">
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="mb-6 flex items-center justify-end gap-2">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-start">
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
              </div>

              <div className="w-48 shrink-0">
                <div
                  className="no-scrollbar dark:bg-card/50 flex h-fit max-h-[70vh] w-48 flex-col gap-1 overflow-y-auto rounded-md bg-cyan-800/10 p-1"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
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

  const formatDuration = (minutes: number) => {
    const totalMinutes = Math.max(0, normalizeDisplayNumber(minutes));
    if (!totalMinutes) return "0:00";

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <SiteHeader title="יומן נוכחות" />
      <div
        className="bg-muted/30 h-full overflow-auto"
        style={{ scrollbarWidth: "none" }}
        dir={direction}
      >
        <div className="mx-auto max-w-6xl space-y-6 p-6 pb-20">
          {/* Header */}
          <div className="mb-8 space-y-2 text-start">
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
            <>
            {isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager) && users.length > 1 && (
              <TeamHoursDashboard users={users} canEditShifts={canEditShifts} />
            )}
            <div>
            <Tabs
              value={effectiveSelectedUserId?.toString()}
              onValueChange={(value) => setSelectedUserId(Number(value))}
              className="w-full"
              orientation="vertical"
              dir={direction}
            >
              <div className="flex flex-row-reverse gap-6" dir={direction}>
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
                          <div
                            className="flex flex-row-reverse items-center justify-between gap-4"
                            dir={direction}
                          >
                            <div className="flex items-center gap-4">
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
                                      ).toLocaleDateString(dateLocale, {
                                        month: "long",
                                      })}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div
                              className="flex flex-row-reverse items-center gap-3"
                              dir={direction}
                            >
                              <div className="text-start">
                                <CardTitle>
                                  {user.full_name || user.username}
                                </CardTitle>
                                <p className="text-muted-foreground text-sm">
                                  נתוני נוכחות לחודש{" "}
                                  {new Date(
                                    selectedYear,
                                    selectedMonth - 1,
                                  ).toLocaleDateString(dateLocale, {
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

                    </TabsContent>
                  ))}
                </div>

                {/* Vertical TabsList on the Right */}
                <TabsList
                  className="no-scrollbar dark:bg-card/50 flex h-fit max-h-[70vh] w-48 shrink-0 flex-col items-stretch justify-start overflow-y-auto bg-cyan-800/10 p-1"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  dir={direction}
                >
                  {users.map((user) => (
                    <TabsTrigger
                      key={user.id}
                      value={user.id!.toString()}
                      className="w-full justify-start text-start whitespace-nowrap"
                      onClick={() => setSelectedUserId(user.id!)}
                    >
                      <div className="w-full min-w-0 text-start">
                        <div className="flex items-center justify-start gap-2">
                          <span className="min-w-0 truncate font-medium">
                            {user.full_name || user.username}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {isRoleAtLeast(user.role_level, ROLE_LEVELS.ceo)
                              ? t("attendanceRoleOwner")
                              : isRoleAtLeast(user.role_level, ROLE_LEVELS.manager)
                              ? t("attendanceRoleAdmin")
                              : t("attendanceRoleStaff")}
                          </span>
                        </div>
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
            </div>
            </>
          )}
        </div>
      </div>

    </>
  );
}
