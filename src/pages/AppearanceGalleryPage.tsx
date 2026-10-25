import React, { useEffect, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import appI18n from "@/localization/i18n";
import { applyDocumentLocale, getActiveLocale, getDirection, supportedLocales, type AppLocale } from "@/localization/locale";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTheme } from "@/components/theme-provider";
import { AppearanceMenu } from "@/components/appearance-menu";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import { APPEARANCE_STYLES, COLOR_THEMES, isAppearanceStyle, isColorTheme, isThemeMode } from "@/lib/appearance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPageHeader } from "@/components/list-page-header";
import { TableFiltersBar } from "@/components/table-filters-bar";
import { TablePagination } from "@/components/table-pagination";
import { FastInput } from "@/components/exam/shared/OptimizedInputs";
import { ToggleTextNumberInput } from "@/components/exam/shared/ToggleTextNumberInput";
import { EXAM_FIELDS } from "@/components/exam/data/exam-field-definitions";
import { CalendarHeader } from "@/pages/HomePage/CalendarHeader";
import { MonthView } from "@/pages/HomePage/MonthView";
import type { CalendarView } from "@/pages/HomePage/types";
import { addDays, addMonths, addWeeks, format, startOfMonth, startOfWeek } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis } from "recharts";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

const surfaces = ["clients", "appearanceWorkspace", "exams", "orders", "calendar", "inventory", "appearanceSampleActivity", "settings", "appearanceMenu"] as const;
const fixedDate = new Date(2026, 9, 14);
const activity = [{ day: "01", value: 12 }, { day: "02", value: 20 }, { day: "03", value: 16 }, { day: "04", value: 26 }, { day: "05", value: 22 }];

function CatalogDialog() {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline">{t("appearanceOpenDialog")}</Button></DialogTrigger>
    <DialogContent dir={direction} className="sm:max-w-[650px]" data-testid="gallery-dialog">
      <DialogHeader><DialogTitle>{t("inventory")}</DialogTitle><DialogDescription>{t("appearanceDialogDescription")}</DialogDescription></DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label htmlFor="gallery-product">{t("appearanceField")}</Label><Input id="gallery-product" defaultValue={t("appearanceSampleProduct")} dir={direction} /></div>
        <div className="space-y-2"><Label htmlFor="gallery-status">{t("appearanceFilter")}</Label>
          <Select defaultValue="active" dir={direction} clearable={false}><SelectTrigger id="gallery-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{t("appearanceActive")}</SelectItem><SelectItem value="all">{t("appearanceAll")}</SelectItem></SelectContent></Select>
        </div>
        <div className="space-y-2"><Label htmlFor="gallery-price">{t("inventoryPricing")}</Label><Input id="gallery-price" type="number" defaultValue="450" /></div>
        <div className="space-y-2"><Label htmlFor="gallery-stock">{t("inventoryStock")}</Label><Input id="gallery-stock" type="number" defaultValue="12" /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("appearanceCancel")}</Button><Button onClick={() => setOpen(false)}>{t("appearanceSave")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ClinicalFixture() {
  const { t } = useTranslation();
  const [sph, setSph] = useState("-2.25");
  return <Card appearance="clinical" className="gap-3 py-4" data-testid="gallery-clinical">
    <CardHeader><CardTitle>{t("appearanceClinical")}</CardTitle></CardHeader>
    <CardContent><div dir="ltr" className="overflow-x-auto"><div dir="ltr" className="grid grid-cols-[24px_repeat(4,minmax(80px,1fr))] items-center gap-2">
      <div />{["SPH", "CYL", "AX", "ADD"].map(label => <span key={label} className="text-center text-xs text-muted-foreground">{label}</span>)}
      {["R", "L"].map(eye => <React.Fragment key={eye}><span className="text-center text-sm">{eye}</span>
        <ToggleTextNumberInput value={sph} onChange={setSph} textOptions={["Plano", "Balance"]} numericProps={{ ...EXAM_FIELDS.SPH, className: "h-8 text-xs" }} />
        <FastInput {...EXAM_FIELDS.CYL} value="-0.75" className="h-8 text-xs" /><FastInput {...EXAM_FIELDS.AXIS} value="90" className="h-8 text-xs" /><FastInput {...EXAM_FIELDS.READ_AD} value="1.50" className="h-8 text-xs" />
      </React.Fragment>)}
    </div></div></CardContent>
  </Card>;
}

function ListFixture({ inventory = false, loading = false }: { inventory?: boolean; loading?: boolean }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const rows = Array.from({ length: 5 }, (_, index) => ({ id: (page - 1) * 5 + index + 1, name: `${t(inventory ? "appearanceSampleProduct" : "appearanceSampleClient")} ${index + 1}` }));
  const visible = rows.filter(row => row.name.includes(search));
  return <div data-testid="gallery-list" className="flex min-h-0 flex-col gap-4">
    <TableFiltersBar searchValue={search} onSearchChange={setSearch}
      filters={[{ key: "status", value: filter, onChange: setFilter, placeholder: t("appearanceFilter"), options: [{ value: "all", label: t("appearanceAll") }, { value: "active", label: t("appearanceActive") }] }]}
      actions={inventory ? <CatalogDialog /> : <Button>{t("appearanceDemoButton")}</Button>} />
    <Table containerClassName="bg-card"><TableHeader><TableRow><TableHead className="w-12" /><TableHead>{t("appearanceId")}</TableHead><TableHead>{t("appearanceField")}</TableHead><TableHead>{t("appearanceFilter")}</TableHead><TableHead>{t(inventory ? "inventoryStock" : "orders")}</TableHead></TableRow></TableHeader>
      <TableBody>{loading ? rows.map(row => <TableRow key={row.id}>{Array.from({ length: 5 }, (_, index) => <TableCell key={index}><Skeleton className="my-1 h-4 w-16" /></TableCell>)}</TableRow>) : visible.length ? visible.map(row => <TableRow key={row.id}>
        <TableCell className="w-11 p-0"><div className="flex items-center justify-center"><Checkbox aria-label={`${t("appearanceSelect")} ${row.id}`} /></div></TableCell><TableCell><span dir="ltr">{row.id}</span></TableCell><TableCell>{row.name}</TableCell><TableCell><Badge variant="secondary">{t("appearanceActive")}</Badge></TableCell><TableCell><span dir="ltr">{inventory ? 12 : 3}</span></TableCell>
      </TableRow>) : <TableRow><TableCell colSpan={5} className="h-40 text-center text-muted-foreground">{t("appearanceEmpty")}</TableCell></TableRow>}</TableBody>
    </Table><TablePagination page={page} pageSize={5} total={15} onPageChange={setPage} />
  </div>;
}

function GalleryContent({ locale, onLocaleChange }: { locale: AppLocale; onLocaleChange: (locale: AppLocale) => void }) {
  const { t } = useTranslation();
  const direction = getDirection(locale);
  const { style, mode, palette, setStyle, setTheme, setPalette, previewPalette } = useTheme();
  const [surface, setSurface] = useState<string>("clients");
  const [loading, setLoading] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [calendarDate, setCalendarDate] = useState(fixedDate);
  const monthStart = startOfWeek(startOfMonth(calendarDate), { weekStartsOn: 0 });
  const monthDates = Array.from({ length: 35 }, (_, index) => addDays(monthStart, index));
  const calendarDates = calendarView === "day" ? [calendarDate] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(calendarDate, { weekStartsOn: 0 }), index));
  const navigateCalendar = (direction: "prev" | "next") => {
    const amount = direction === "prev" ? -1 : 1;
    const advance = calendarView === "month" ? addMonths : calendarView === "week" ? addWeeks : addDays;
    setCalendarDate(date => advance(date, amount));
  };
  return <div dir={direction} className="flex h-full min-h-0 flex-col" data-testid="appearance-gallery">
    <div className="bg-background flex shrink-0 flex-wrap items-end gap-4 border-b p-4">
      <div className="me-auto"><h1 className="text-xl font-semibold">{t("appearanceGallery")}</h1><p className="mt-1 text-xs text-muted-foreground">{t("appearanceGalleryDescription")}</p></div>
      <div className="space-y-1"><Label htmlFor="gallery-locale">{t("appearanceLocale")}</Label><select id="gallery-locale" className="bg-field h-9 rounded-md border px-2 text-sm" value={locale} onChange={event => onLocaleChange(event.target.value as AppLocale)}>{supportedLocales.map(value => <option key={value} value={value}>{t(value === "he" ? "appearanceLanguageHebrew" : value === "en" ? "appearanceLanguageEnglish" : "appearanceLanguageFrench")}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="gallery-style">{t("appearanceStyle")}</Label><select id="gallery-style" className="bg-field h-9 rounded-md border px-2 text-sm" value={style} onChange={event => { if (isAppearanceStyle(event.target.value)) setStyle(event.target.value); }}>{Object.entries(APPEARANCE_STYLES).map(([value, definition]) => <option key={value} value={value}>{t(definition.labelKey)}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="gallery-mode">{t("appearanceMode")}</Label><select id="gallery-mode" className="bg-field h-9 rounded-md border px-2 text-sm" value={mode} onChange={event => { if (isThemeMode(event.target.value)) setTheme(event.target.value); }}>{["light", "dark", "system"].map(value => <option key={value} value={value}>{t(`appearance${value[0].toUpperCase()}${value.slice(1)}`)}</option>)}</select></div>
      {APPEARANCE_STYLES[style].supportsPalettes ? <div className="space-y-1"><Label htmlFor="gallery-palette">{t("appearancePalette")}</Label><select id="gallery-palette" className="bg-field h-9 rounded-md border px-2 text-sm" value={palette} onChange={event => { if (isColorTheme(event.target.value)) setPalette(event.target.value); }}>{Object.entries(COLOR_THEMES).map(([value, theme]) => <option key={value} value={value}>{t(theme.labelKey)}</option>)}</select></div> : null}
    </div>
    <SidebarProvider dir={direction} className="min-h-0 flex-1 overflow-hidden">
      <Sidebar collapsible="none" side={direction === "rtl" ? "right" : "left"} className="hidden border-e sm:flex">
        <SidebarHeader className="border-b p-4"><span className="text-lg font-semibold">{t("appName")}</span><span className="text-xs text-muted-foreground">{t("appearanceThemePreview")}</span></SidebarHeader>
        <SidebarContent className="p-2"><SidebarMenu>{surfaces.map(key => <SidebarMenuItem key={key}><SidebarMenuButton isActive={surface === key} onClick={() => setSurface(key)}>{t(key)}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent>
        <SidebarFooter className="border-t p-3"><DropdownMenu dir={direction} onOpenChange={open => { if (!open) previewPalette(null); }}><DropdownMenuTrigger asChild><Button variant="outline" className="w-full">{t("appearanceMenu")}</Button></DropdownMenuTrigger><DropdownMenuContent><AppearanceMenu persistMode={false} /></DropdownMenuContent></DropdownMenu></SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-auto bg-canvas">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-6 py-3">
          <span className="me-auto text-sm font-medium">{t(surface)}</span><CatalogDialog /><Button variant="outline" onClick={() => toast.success(t("appearanceSaved"))}>{t("appearanceNotifications")}</Button>
        </div>
        <div className="space-y-5 p-6" data-testid="gallery-content">
          <div className="sm:hidden"><Select value={surface} onValueChange={setSurface} dir={direction} clearable={false}><SelectTrigger aria-label={t("appearanceThemePreview")}><SelectValue /></SelectTrigger><SelectContent>{surfaces.map(key => <SelectItem key={key} value={key}>{t(key)}</SelectItem>)}</SelectContent></Select></div>
          <ListPageHeader title={t(surface)} actions={<Button variant="outline" onClick={() => setLoading(value => !value)}>{t("appearanceLoading")}</Button>} />
          {surface === "appearanceMenu" ? <div className="max-w-2xl"><AppearanceTab persistMode={false} /></div> : null}
          {surface === "clients" || surface === "inventory" ? <ListFixture inventory={surface === "inventory"} loading={loading} /> : null}
          {surface === "exams" || surface === "orders" || surface === "appearanceWorkspace" ? <><Tabs defaultValue="details" dir={direction}><TabsList><TabsTrigger value="details">{t("clientDetails")}</TabsTrigger><TabsTrigger value="exams">{t("exams")}</TabsTrigger><TabsTrigger value="orders">{t("orders")}</TabsTrigger></TabsList></Tabs><ClinicalFixture /><Card className="gap-3 py-4"><CardHeader><CardTitle>{t("appearanceSampleClient")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Input aria-label={t("appearanceField")} defaultValue={t("appearanceSampleClient")} dir={direction} /><Input aria-label={t("appearanceDisabled")} value="+972 50 123 4567" disabled dir="ltr" /><Input aria-label={t("appearanceInvalid")} type="number" defaultValue="450" aria-invalid /></CardContent></Card></> : null}
          {surface === "calendar" ? <div className="overflow-hidden rounded-md border bg-card"><CalendarHeader currentDate={calendarDate} view={calendarView} onToday={() => setCalendarDate(fixedDate)} onNavigate={navigateCalendar} onViewChange={setCalendarView} />
            {calendarView === "month" ? <MonthView visibleDates={monthDates} currentDate={calendarDate} currentUser={null} holidaysByDate={{}} getAppointmentsForDate={() => []} onDateClick={setCalendarDate} onViewChange={setCalendarView} /> : (
              <Table elevated={false} containerClassName="mt-4"><TableHeader><TableRow><TableHead />{calendarDates.map(date => <TableHead key={date.toISOString()} className="text-center"><span dir="ltr">{format(date, "dd/MM")}</span></TableHead>)}</TableRow></TableHeader>
                <TableBody>{Array.from({ length: 8 }, (_, index) => <TableRow key={index}><TableCell className="w-16 text-center"><span dir="ltr">{String(index + 9).padStart(2, "0")}:00</span></TableCell>{calendarDates.map(date => <TableCell key={date.toISOString()} className="h-12 border-s" />)}</TableRow>)}</TableBody>
              </Table>
            )}</div> : null}
          {surface === "appearanceSampleActivity" ? <><div className="grid gap-4 sm:grid-cols-3">{["clients", "orders", "exams"].map((key, index) => <Card key={key} className="gap-2 py-4"><CardContent><div className="text-sm text-muted-foreground">{t(key)}</div><div className="mt-2 text-2xl font-semibold tabular-nums">{[128, 64, 93][index]}</div></CardContent></Card>)}</div><Card><CardHeader><CardTitle>{t("appearanceSampleActivity")}</CardTitle></CardHeader><CardContent><div className="h-48" dir="ltr"><ResponsiveContainer><BarChart data={activity}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="day" reversed={direction === "rtl"} tick={{ fill: "hsl(var(--muted-foreground))" }} /><Bar dataKey="value" fill="hsl(var(--chart-1))" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></CardContent></Card></> : null}
          {surface === "settings" ? <Card><CardHeader><CardTitle>{t("appearanceSettings")}</CardTitle></CardHeader><CardContent className="space-y-5"><div className="flex items-center gap-3"><Switch id="gallery-reminders" /><Label htmlFor="gallery-reminders">{t("appearanceSwitch")}</Label></div><div className="flex flex-wrap gap-2"><Button>{t("appearanceDemoButton")}</Button><Button variant="outline">{t("appearanceSecondaryButton")}</Button><Button disabled>{t("appearanceDisabled")}</Button><Button variant="destructive">{t("appearanceCancel")}</Button></div><Input aria-label={t("appearanceInvalid")} aria-invalid defaultValue={t("appearanceInvalid")} dir={direction} /><Skeleton className="h-9 w-48" /></CardContent></Card> : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
    <Toaster />
  </div>;
}

export default function AppearanceGalleryPage() {
  const [locale, setLocale] = useState<AppLocale>("he");
  const [galleryI18n] = useState(() => appI18n.cloneInstance({ lng: "he" }));
  useEffect(() => {
    applyDocumentLocale(locale);
    void galleryI18n.changeLanguage(locale);
    return () => applyDocumentLocale(getActiveLocale());
  }, [locale, galleryI18n]);
  return <I18nextProvider i18n={galleryI18n}><GalleryContent locale={locale} onLocaleChange={setLocale} /></I18nextProvider>;
}
