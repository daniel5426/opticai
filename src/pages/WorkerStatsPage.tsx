import React from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { User } from "@/lib/db/schema-interface";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";
import { useUser } from "@/contexts/UserContext";
import { useAppLocale } from "@/localization/use-app-locale";
import { TeamHoursDashboard } from "@/components/attendance/TeamHoursDashboard";

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

export default function WorkerStatsPage() {
  const { direction } = useAppLocale();
  const { currentUser, currentClinic } = useUser();
  const clinicId = currentClinic?.id;
  const canEditShifts = isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.ceo);
  const canManageShifts = isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager);

  const usersQuery = useQuery({
    queryKey: ["worker-stats", "users", clinicId ?? "none", currentUser?.id, currentUser?.role_level],
    queryFn: () => getAttendanceUsers(clinicId!, currentUser!),
    enabled: !!clinicId && !!currentUser?.id,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const users = usersQuery.data || [];

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

          {usersQuery.isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : users.length === 0 ? (
            <Card className="">
              <CardContent className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground text-center">
                  <p className="mb-2 text-lg">אין עובדים במערכת</p>
                  <p className="text-sm">הוסף עובדים דרך עמוד ההגדרות</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Every worker the viewer may read, each with their shifts by day; a worker sees only themselves.
            <TeamHoursDashboard key={clinicId} users={users} canEditShifts={canEditShifts} canManageShifts={canManageShifts} />
          )}
        </div>
      </div>
    </>
  );
}
