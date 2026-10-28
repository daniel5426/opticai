import * as React from "react"
import { Check, Filter, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  describeColumnFilter,
  hasColumnFilters,
  isActiveColumnFilter,
  setColumnFilter,
  type ColumnFilterDefinition,
  type ColumnFilters,
  type ColumnFilterValue,
  type DateRangeFilter,
} from "@/lib/column-filters"
import { useAppLocale } from "@/localization/use-app-locale"
import { cn } from "@/utils/tailwind"

const TEXT_APPLY_DELAY_MS = 350
const OPTION_SEARCH_THRESHOLD = 8

interface ColumnFiltersContextValue {
  filters: ColumnFilters
  definitions: readonly ColumnFilterDefinition<any>[]
  onChange: (filters: ColumnFilters) => void
}

const ColumnFiltersContext = React.createContext<ColumnFiltersContextValue | null>(null)

export function ColumnFiltersProvider({
  filters,
  definitions,
  onChange,
  children,
}: ColumnFiltersContextValue & { children: React.ReactNode }) {
  const value = React.useMemo(() => ({ filters, definitions, onChange }), [filters, definitions, onChange])
  return <ColumnFiltersContext.Provider value={value}>{children}</ColumnFiltersContext.Provider>
}

/** Column filters for a table: controlled by the page (URL/server) when provided, otherwise local. */
export function useColumnFilterState(
  controlled: ColumnFilters | undefined,
  onControlledChange: ((filters: ColumnFilters) => void) | undefined,
) {
  const [local, setLocal] = React.useState<ColumnFilters>({})
  const filters = controlled ?? local
  const setFilters = React.useCallback(
    (next: ColumnFilters) => (onControlledChange ? onControlledChange(next) : setLocal(next)),
    [onControlledChange],
  )
  return { filters, setFilters, active: hasColumnFilters(filters) }
}

function useColumnFilter(filterKey: string | undefined) {
  const context = React.useContext(ColumnFiltersContext)
  if (!context || !filterKey) return null
  const definition = context.definitions.find((item) => item.key === filterKey)
  if (!definition) return null
  const value = context.filters[filterKey]
  return {
    definition,
    value,
    active: isActiveColumnFilter(value),
    setValue: (next: ColumnFilterValue | undefined) => context.onChange(setColumnFilter(context.filters, filterKey, next)),
  }
}

const todayIso = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
const daysAgoIso = (days: number) => {
  const date = new Date(`${todayIso()}T00:00:00`)
  date.setDate(date.getDate() - days)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function useFormatFilterDate() {
  const { locale } = useAppLocale()
  return React.useCallback(
    (isoDate: string) => {
      const [year, month, day] = isoDate.split("-").map(Number)
      return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale, { day: "2-digit", month: "2-digit", year: "numeric" })
        .format(new Date(year, month - 1, day))
    },
    [locale],
  )
}

/** Funnel button rendered inside a column header. Renders nothing when the column has no filter definition. */
export function ColumnFilterControl({ filterKey }: { filterKey?: string }) {
  const { t } = useTranslation()
  const { direction } = useAppLocale()
  const filter = useColumnFilter(filterKey)
  const [open, setOpen] = React.useState(false)
  if (!filter) return null
  const { definition, active } = filter
  const label = t("columnFilters.filterColumn", { column: definition.label })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          data-active={active || undefined}
          className={cn(
            "relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground/60 hover:bg-muted/70 hover:text-foreground",
            open && !active && "bg-muted/70 text-foreground",
          )}
        >
          <Filter className={cn("h-3.5 w-3.5", active && "fill-current")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        dir={direction}
        className="w-64 p-0"
        onOpenAutoFocus={(event) => {
          // Let the text field take focus itself; other kinds keep the popover's default focus.
          if (definition.kind === "text") event.preventDefault()
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="truncate text-sm font-medium">{definition.label}</span>
          {active && (
            <button
              type="button"
              onClick={() => filter.setValue(undefined)}
              className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("columnFilters.clear")}
            </button>
          )}
        </div>
        <div className="p-3">
          {definition.kind === "text" && (
            <TextFilterEditor value={typeof filter.value === "string" ? filter.value : ""} onChange={filter.setValue} onSubmit={() => setOpen(false)} />
          )}
          {definition.kind === "options" && (
            <OptionsFilterEditor
              options={definition.options ?? []}
              value={Array.isArray(filter.value) ? filter.value : []}
              onChange={filter.setValue}
            />
          )}
          {definition.kind === "date" && (
            <DateFilterEditor
              value={filter.value && typeof filter.value === "object" && !Array.isArray(filter.value) ? filter.value : {}}
              onChange={filter.setValue}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TextFilterEditor({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (value: ColumnFilterValue | undefined) => void
  onSubmit: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = React.useState(value)
  const committedRef = React.useRef(value)
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  React.useEffect(() => {
    if (value !== committedRef.current) {
      committedRef.current = value
      setDraft(value)
    }
  }, [value])

  const commit = React.useCallback((next: string) => {
    if (next.trim() === committedRef.current.trim()) return
    committedRef.current = next
    onChangeRef.current(next.trim() ? next : undefined)
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => commit(draft), TEXT_APPLY_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [commit, draft])

  return (
    <Input
      autoFocus
      value={draft}
      placeholder={t("columnFilters.containsPlaceholder")}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          commit(draft)
          onSubmit()
        }
      }}
      className="h-8 text-sm"
    />
  )
}

function OptionsFilterEditor({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[]
  value: string[]
  onChange: (value: ColumnFilterValue | undefined) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = React.useState("")
  const visible = query.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const toggle = (optionValue: string) => {
    const next = value.includes(optionValue) ? value.filter((item) => item !== optionValue) : [...value, optionValue]
    onChange(next.length ? next : undefined)
  }

  return (
    <div className="space-y-2">
      {options.length > OPTION_SEARCH_THRESHOLD && (
        <Input
          value={query}
          placeholder={t("columnFilters.searchOptions")}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 text-sm"
        />
      )}
      <div className="-mx-1 max-h-60 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {visible.length === 0 ? (
          <p className="px-1 py-2 text-center text-xs text-muted-foreground">{t("columnFilters.noOptions")}</p>
        ) : (
          visible.map((option) => {
            const checked = value.includes(option.value)
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/70"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(option.value)} />
                <span className="truncate">{option.label}</span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

function DateFilterEditor({
  value,
  onChange,
}: {
  value: DateRangeFilter
  onChange: (value: ColumnFilterValue | undefined) => void
}) {
  const { t } = useTranslation()
  const update = (patch: DateRangeFilter) => {
    const next = { ...value, ...patch }
    onChange(next.from || next.to ? next : undefined)
  }
  const presets = [
    { label: t("columnFilters.today"), range: { from: todayIso(), to: todayIso() } },
    { label: t("columnFilters.last7Days"), range: { from: daysAgoIso(6), to: todayIso() } },
    { label: t("columnFilters.last30Days"), range: { from: daysAgoIso(29), to: todayIso() } },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const selected = value.from === preset.range.from && value.to === preset.range.to
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.range)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
                selected ? "border-primary/40 bg-primary/10 text-primary" : "hover:bg-muted/70",
              )}
            >
              {selected && <Check className="h-3 w-3" />}
              {preset.label}
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">{t("columnFilters.from")}</span>
          <Input type="date" value={value.from ?? ""} max={value.to} onChange={(event) => update({ from: event.target.value || undefined })} className="h-8 text-sm" dir="ltr" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">{t("columnFilters.to")}</span>
          <Input type="date" value={value.to ?? ""} min={value.from} onChange={(event) => update({ to: event.target.value || undefined })} className="h-8 text-sm" dir="ltr" />
        </label>
      </div>
    </div>
  )
}

/** Chips summarizing every active column filter, with per-filter removal and a clear-all action. */
export function ActiveColumnFilters({ className }: { className?: string }) {
  const { t } = useTranslation()
  const context = React.useContext(ColumnFiltersContext)
  const formatDate = useFormatFilterDate()
  if (!context || !hasColumnFilters(context.filters)) return null
  const { filters, definitions, onChange } = context
  const active = definitions.filter((definition) => isActiveColumnFilter(filters[definition.key]))
  if (active.length === 0) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label={t("columnFilters.activeFilters")}>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Filter className="h-3 w-3" />
        {t("columnFilters.activeFilters")}
      </span>
      {active.map((definition) => {
        const summary = describeColumnFilter(definition, filters[definition.key], formatDate)
        return (
          <span
            key={definition.key}
            className="inline-flex h-7 max-w-[18rem] items-center gap-1 rounded-full bg-primary/10 ps-2.5 pe-1 text-xs text-primary"
          >
            <span className="truncate">
              <span className="font-medium">{definition.label}:</span> {summary}
            </span>
            <button
              type="button"
              aria-label={t("columnFilters.removeFilter", { column: definition.label })}
              onClick={() => onChange(setColumnFilter(filters, definition.key, undefined))}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-primary/15"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}
      {active.length > 1 && (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => onChange({})}>
          {t("columnFilters.clearAll")}
        </Button>
      )}
    </div>
  )
}

/** Header cell content for columns that filter but do not sort. */
export function FilterableHeaderLabel({ filterKey, children }: { filterKey?: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{children}</span>
      <ColumnFilterControl filterKey={filterKey} />
    </span>
  )
}
