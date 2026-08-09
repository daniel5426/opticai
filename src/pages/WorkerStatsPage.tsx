import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AnalyticsChartTooltip,
  AnalyticsMetricCard,
  AnalyticsPanel,
  AnalyticsRangePicker,
  AnalyticsTooltip,
} from "@/components/analytics";
import { ListPageHeader } from "@/components/list-page-header";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/ui/custom-modal";
import { DateInput } from "@/components/ui/date";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/contexts/UserContext";
import { useAnalyticsRange } from "@/hooks/useAnalyticsRange";
import { apiClient } from "@/lib/api-client";
import type { WorkforceAnalyticsResponse } from "@/lib/analytics";
import type { User, WorkShift } from "@/lib/db/schema-interface";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";

const queryKeys = {
  users: ["worker-stats", "users"] as const,
  day: (userId: number | null, value: string) => ["worker-stats", "day", userId, value] as const,
  analytics: (userId: number | null, start: string, end: string) =>
    ["worker-stats", "analytics", userId, start, end] as const,
};

const formatDuration = (minutes: number) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  return `${hours}:${String(total % 60).padStart(2, "0")}`;
};

async function fetchUsers() {
  const response = await apiClient.getUsers();
  if (response.error) throw new Error(String(response.error));
  return (response.data || []).filter((user) => isRoleAtLeast(user.role_level, ROLE_LEVELS.worker));
}

export default function WorkerStatsPage() {
  const { currentUser } = useUser();
  const queryClient = useQueryClient();
  const { range, setRange } = useAnalyticsRange("30d");
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
  const [selectedDate, setSelectedDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [modalOpen, setModalOpen] = React.useState(false);
  const [shiftForm, setShiftForm] = React.useState({ start_time: "", end_time: "" });

  const usersQuery = useQuery({ queryKey: queryKeys.users, queryFn: fetchUsers, refetchOnWindowFocus: true });
  const users = usersQuery.data || [];
  const effectiveUserId = users.some((user) => user.id === selectedUserId) ? selectedUserId : (users[0]?.id ?? null);
  const selectedUser = users.find((user) => user.id === effectiveUserId);

  const analyticsQuery = useQuery({
    queryKey: queryKeys.analytics(effectiveUserId, range.startDate, range.endDate),
    queryFn: async () => {
      const response = await apiClient.getWorkforceAnalytics(effectiveUserId!, range);
      if (response.error || !response.data) throw new Error(String(response.error || "טעינת הנתונים נכשלה"));
      return response.data as WorkforceAnalyticsResponse;
    },
    enabled: Boolean(effectiveUserId),
  });

  const dayQuery = useQuery({
    queryKey: queryKeys.day(effectiveUserId, selectedDate),
    queryFn: async () => {
      const response = await apiClient.getWorkShiftsByUserAndDate(effectiveUserId!, selectedDate);
      if (response.error) throw new Error(String(response.error));
      return response.data || [];
    },
    enabled: Boolean(effectiveUserId && selectedDate),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.day(effectiveUserId, selectedDate) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics(effectiveUserId, range.startDate, range.endDate) }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<WorkShift, "id" | "created_at" | "updated_at">) => {
      const response = await apiClient.createWorkShift(payload);
      if (response.error) throw new Error(String(response.error));
      return response.data;
    },
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.deleteWorkShift(id);
      if (response.error) throw new Error(String(response.error));
    },
    onSuccess: invalidate,
  });

  const metrics = React.useMemo(
    () => new Map((analyticsQuery.data?.metrics || []).map((metric) => [metric.key, metric])),
    [analyticsQuery.data?.metrics],
  );
  const chartData = React.useMemo(
    () => (analyticsQuery.data?.series || []).map((point) => ({ ...point, hours: Number((point.minutes / 60).toFixed(2)) })).reverse(),
    [analyticsQuery.data?.series],
  );
  const canManage = isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.manager);

  const createShift = async () => {
    if (!effectiveUserId || !shiftForm.start_time || !shiftForm.end_time) return;
    const start = new Date(`${selectedDate}T${shiftForm.start_time}:00`);
    const end = new Date(`${selectedDate}T${shiftForm.end_time}:00`);
    const duration = Math.floor((end.getTime() - start.getTime()) / 60000);
    if (duration <= 0) {
      toast.error("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }
    try {
      await createMutation.mutateAsync({
        user_id: effectiveUserId,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        duration_minutes: duration,
        date: selectedDate,
        status: "completed",
      });
      setShiftForm({ start_time: "", end_time: "" });
      setModalOpen(false);
      toast.success("המשמרת נוספה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הוספת המשמרת נכשלה");
    }
  };

  return (
    <>
      <SiteHeader title="יומן נוכחות" />
      <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6" dir="rtl">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <ListPageHeader
            title="יומן נוכחות"
            description={selectedUser ? `מגמות ושעות עבודה עבור ${selectedUser.full_name || selectedUser.username}` : "נתוני נוכחות ומשמרות"}
            className="mb-0 items-center"
            actions={
              <>
                <Select value={effectiveUserId?.toString() || ""} onValueChange={(value) => setSelectedUserId(Number(value))}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="בחירת עובד" /></SelectTrigger>
                  <SelectContent dir="rtl">{users.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.full_name || user.username}</SelectItem>)}</SelectContent>
                </Select>
                <AnalyticsRangePicker value={range} onChange={setRange} disabled={analyticsQuery.isFetching} />
              </>
            }
          />

          {!usersQuery.isLoading && !users.length ? (
            <div className="flex h-64 items-center justify-center rounded-md border text-sm text-muted-foreground">אין עובדים להצגה.</div>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AnalyticsMetricCard metric={metrics.get("total_minutes")} formatter={formatDuration} loading={analyticsQuery.isLoading} error={analyticsQuery.isError} polarity="neutral" />
                <AnalyticsMetricCard metric={metrics.get("shifts")} formatter={(value) => Math.round(value).toLocaleString("he-IL")} loading={analyticsQuery.isLoading} error={analyticsQuery.isError} polarity="neutral" />
                <AnalyticsMetricCard metric={metrics.get("active_days")} formatter={(value) => Math.round(value).toLocaleString("he-IL")} loading={analyticsQuery.isLoading} error={analyticsQuery.isError} polarity="neutral" />
                <AnalyticsMetricCard metric={metrics.get("average_minutes")} formatter={formatDuration} loading={analyticsQuery.isLoading} error={analyticsQuery.isError} polarity="neutral" />
              </section>

              <AnalyticsPanel title="שעות עבודה לאורך זמן" description="משך המשמרות שנרשם בכל תקופה" loading={analyticsQuery.isLoading} error={analyticsQuery.isError} empty={!chartData.length}>
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} />
                      <YAxis orientation="right" axisLine={false} tickLine={false} width={38} />
                      <AnalyticsChartTooltip content={<AnalyticsTooltip />} />
                      <Bar dataKey="hours" name="שעות" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AnalyticsPanel>

              <AnalyticsPanel flat title="פירוט יומי" description="שעות כניסה, יציאה ומשך משמרת">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  {canManage ? <Button onClick={() => setModalOpen(true)}>הוספת משמרת <Plus className="size-4" /></Button> : <span />}
                  <DateInput name="selected_date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-44" />
                </div>
                <Table className="bg-card" containerClassName="border-border bg-card" dir="rtl">
                  <TableHeader><TableRow><TableHead>שעת התחלה</TableHead><TableHead>שעת סיום</TableHead><TableHead>משך משמרת</TableHead>{canManage ? <TableHead className="w-16">פעולות</TableHead> : null}</TableRow></TableHeader>
                  <TableBody>
                    {(dayQuery.data || []).map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell className="tabular-nums" dir="ltr">{shift.start_time.slice(0, 5)}</TableCell>
                        <TableCell className="tabular-nums" dir="ltr">{shift.end_time?.slice(0, 5) || "פעילה"}</TableCell>
                        <TableCell className="tabular-nums" dir="ltr">{formatDuration(shift.duration_minutes || 0)}</TableCell>
                        {canManage ? <TableCell><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label="מחיקת משמרת" onClick={() => shift.id && deleteMutation.mutate(shift.id)}><Trash2 className="size-4" /></Button></TableCell> : null}
                      </TableRow>
                    ))}
                    {!dayQuery.isLoading && !dayQuery.data?.length ? <TableRow><TableCell colSpan={canManage ? 4 : 3} className="h-24 text-center text-muted-foreground">אין משמרות בתאריך זה.</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </AnalyticsPanel>
            </>
          )}
        </div>
      </main>

      <CustomModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="הוספת משמרת"
        subtitle={new Date(selectedDate).toLocaleDateString("he-IL")}
        onConfirm={createShift}
        confirmText="הוספה"
        cancelText="ביטול"
        isLoading={createMutation.isPending}
        showCloseButton={false}
      >
        <div className="grid grid-cols-2 gap-4" dir="rtl">
          <label className="grid gap-2"><Label htmlFor="shift-start">שעת התחלה</Label><Input id="shift-start" type="time" value={shiftForm.start_time} onChange={(event) => setShiftForm((current) => ({ ...current, start_time: event.target.value }))} /></label>
          <label className="grid gap-2"><Label htmlFor="shift-end">שעת סיום</Label><Input id="shift-end" type="time" value={shiftForm.end_time} onChange={(event) => setShiftForm((current) => ({ ...current, end_time: event.target.value }))} /></label>
        </div>
      </CustomModal>
    </>
  );
}
