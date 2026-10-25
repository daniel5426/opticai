import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Edit, Eye, Glasses, Loader2, MoreVertical, Plus, Printer, Receipt, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Client } from "@/lib/db/schema-interface";
import type { OrderKind } from "@/lib/order-groups";
import { OrderMetaFields, type OrderMetaValues } from "@/components/orders/OrderMetaStrip";
import { cn } from "@/utils/tailwind";

export interface OrderTabEntry {
  key: string;
  client: Client;
  label: string;
  values: OrderMetaValues;
}

interface OrderGroupTabsProps {
  entries: OrderTabEntry[];
  activeKey: string;
  editing: boolean;
  addDisabled: boolean;
  direction: "rtl" | "ltr";
  onSelect: (key: string) => void;
  onReorder: (from: string, to: string) => void;
  onRemove: (key: string) => void;
  onMetadataChange: (key: string, patch: Partial<OrderMetaValues>) => void;
  onAdd: (kind: OrderKind) => void;
}

const initialsOf = (client: Client) =>
  `${client.first_name?.[0] || ""}${client.last_name?.[0] || ""}`.toLocaleUpperCase();

export function OrderGroupTabs({
  entries,
  activeKey,
  editing,
  addDisabled,
  direction,
  onSelect,
  onReorder,
  onRemove,
  onMetadataChange,
  onAdd,
}: OrderGroupTabsProps) {
  const { t } = useTranslation();
  const tabRefs = useRef(new Map<string, HTMLDivElement>());

  const focusTab = (key: string) => {
    onSelect(key);
    requestAnimationFrame(() => tabRefs.current.get(key)?.focus());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(entries[index].key);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const step = (event.key === "ArrowRight" ? 1 : -1) * (direction === "rtl" ? -1 : 1);
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? entries.length - 1
          : (index + step + entries.length) % entries.length;
    focusTab(entries[target].key);
  };

  return (
    <div className="flex min-w-0 flex-1 items-end gap-1">
      <div className="no-scrollbar relative top-px -ms-3 -mt-3 -mb-2 min-w-0 overflow-x-auto">
        <div
          role="tablist"
          aria-label={t("orderWorkspace.orderTabs")}
          className="flex min-w-0 items-end gap-1 ps-3 pe-3 pt-3 pb-2"
        >
        {entries.map((entry, index) => {
          const selected = entry.key === activeKey;
          const fullName = `${entry.client.first_name || ""} ${entry.client.last_name || ""}`.trim();
          return (
            <div
              key={entry.key}
              ref={(element) => {
                if (element) tabRefs.current.set(entry.key, element);
                else tabRefs.current.delete(entry.key);
              }}
              id={`order-tab-${entry.key}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`order-panel-${entry.key}`}
              tabIndex={selected ? 0 : -1}
              title={fullName}
              draggable={editing}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", entry.key)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onReorder(event.dataTransfer.getData("text/plain"), entry.key);
              }}
              data-order-surface={selected ? "" : undefined}
              onClick={() => onSelect(entry.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "group focus-visible:ring-ring/50 relative flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border-0 ps-2.5 text-sm transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-inset",
                "pe-1.5",
                selected
                  ? "bg-card text-foreground z-10 shadow-sm after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-2 after:bg-card after:content-['']"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                  selected ? "bg-primary/10 text-primary" : "bg-muted",
                )}
              >
                {initialsOf(entry.client)}
              </span>
              <span className="max-w-44 truncate font-medium">{entry.label}</span>
              <DropdownMenu dir={direction}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground size-6"
                    aria-label={t("orderGroupMetadata")}
                    title={t("orderGroupMetadata")}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <MoreVertical className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-72 p-3"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <div className="mb-3 truncate text-sm font-medium">{fullName}</div>
                  <OrderMetaFields
                    values={entry.values}
                    editing={editing}
                    onChange={(patch) => onMetadataChange(entry.key, patch)}
                  />
                  {editing && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive mt-3 h-9 justify-center border-t pt-2"
                      onSelect={() => onRemove(entry.key)}
                    >
                      {t("orderGroupRemoveOrder")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        </div>
      </div>
      <DropdownMenu dir={direction}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="mb-1 size-8 shrink-0"
            disabled={addDisabled}
            aria-label={t("orderGroupAddOrder")}
            title={t("orderGroupAddOrder")}
          >
            <Plus className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => onAdd("regular")}>
            <Glasses className="size-4" />
            {t("orderGroupGlasses")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAdd("contact")}>
            <Eye className="size-4" />
            {t("orderGroupContact")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface OrderGroupToolbarProps {
  direction: "rtl" | "ltr";
  printDisabled: boolean;
  printing: boolean;
  onPrint: (all: boolean) => void;
  billingOpen: boolean;
  billingDisabled: boolean;
  onToggleBilling: () => void;
  editing: boolean;
  saving: boolean;
  editDisabled: boolean;
  onEditOrSave: () => void;
}

export function OrderGroupToolbar({
  direction,
  printDisabled,
  printing,
  onPrint,
  billingOpen,
  billingDisabled,
  onToggleBilling,
  editing,
  saving,
  editDisabled,
  onEditOrSave,
}: OrderGroupToolbarProps) {
  const { t } = useTranslation();
  const editLabel = t(editing ? "orderGroupSave" : "orderGroupEdit");

  return (
    <div className="flex shrink-0 items-center gap-1.5 pb-1.5">
      <DropdownMenu dir={direction}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled={printDisabled || printing}
            aria-label={t("orderGroupPrint")}
            title={t("orderGroupPrint")}
          >
            {printing ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onPrint(false)}>{t("orderGroupPrintActive")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPrint(true)}>{t("orderGroupPrintAll")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant={billingOpen ? "secondary" : "outline"}
        size="icon"
        disabled={billingDisabled}
        aria-label={t("orderGroupBilling")}
        title={t("orderGroupBilling")}
        aria-pressed={billingOpen}
        onClick={onToggleBilling}
      >
        <Receipt className="size-4" />
      </Button>
      <Button
        variant={editing ? "default" : "outline"}
        size="icon"
        disabled={editDisabled || saving}
        aria-label={editLabel}
        title={editLabel}
        onClick={onEditOrSave}
      >
        {saving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : editing ? (
          <Save className="size-4" />
        ) : (
          <Edit className="size-4" />
        )}
      </Button>
    </div>
  );
}

export function OrderGroupPanelSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-hidden="true">
      <Skeleton className="h-36" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
