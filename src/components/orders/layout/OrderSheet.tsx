import React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/tailwind";

export const OrderSheet = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-order-sheet
    className={cn("bg-card flex flex-col [&>*+*]:border-t [&>*+*]:border-border", className)}
    {...props}
  >
    {children}
  </div>
);

export const OrderSheetRow = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn(
      "bg-card grid [&>*+*]:border-t [&>*+*]:border-border lg:grid-cols-2 lg:[&>*+*]:border-t-0 lg:[&>*+*]:border-s",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

interface OrderSectionProps
  extends Omit<React.ComponentProps<"section">, "title"> {
  title: React.ReactNode;
  start?: React.ReactNode;
  end?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  storageKey?: string;
  summary?: React.ReactNode;
}

const OPEN_STATE_EVENT = "order-section-open";

const readStoredOpen = (key: string, fallback: boolean) => {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? JSON.parse(saved) === true : fallback;
  } catch {
    return fallback;
  }
};

const useSectionOpen = (storageKey: string | undefined, defaultOpen: boolean) => {
  const [open, setOpen] = React.useState(() =>
    storageKey ? readStoredOpen(storageKey, defaultOpen) : defaultOpen,
  );

  React.useEffect(() => {
    if (!storageKey) return;
    const onStored = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; open: boolean }>).detail;
      if (detail?.key !== storageKey) return;
      setOpen((current) => (current === detail.open ? current : detail.open));
    };
    window.addEventListener(OPEN_STATE_EVENT, onStored);
    return () => window.removeEventListener(OPEN_STATE_EVENT, onStored);
  }, [storageKey]);

  const toggle = React.useCallback(() => {
    setOpen((current) => {
      const next = !current;
      if (storageKey) {
        queueMicrotask(() => {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            return;
          }
          window.dispatchEvent(
            new CustomEvent(OPEN_STATE_EVENT, {
              detail: { key: storageKey, open: next },
            }),
          );
        });
      }
      return next;
    });
  }, [storageKey]);

  return [open, toggle] as const;
};

const headerGrid =
  "grid min-h-7 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3";

export const OrderSection = ({
  title,
  start,
  end,
  footer,
  className,
  bodyClassName,
  collapsible = false,
  defaultOpen = true,
  storageKey,
  summary,
  children,
  ...props
}: OrderSectionProps) => {
  const [open, toggle] = useSectionOpen(storageKey, defaultOpen);
  const bodyId = React.useId();
  const expanded = !collapsible || open;

  return (
    <section
      className={cn("bg-card px-4 pt-3", expanded ? "pb-4" : "pb-3", className)}
      {...props}
    >
      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={toggle}
          className={cn(
            headerGrid,
            "group focus-visible:ring-ring/50 rounded-md text-start outline-none focus-visible:ring-2",
            expanded && "mb-3",
          )}
        >
          <span className="text-muted-foreground truncate text-xs">
            {expanded ? null : summary}
          </span>
          <h3 className="text-muted-foreground group-hover:text-foreground font-medium transition-colors">
            {title}
          </h3>
          <span className="flex justify-end">
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "text-muted-foreground size-4 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </span>
        </button>
      ) : (
        <header className={cn(headerGrid, "mb-3")}>
          <div className="flex min-w-0 items-center justify-start gap-2">
            {start}
          </div>
          <h3 className="text-muted-foreground font-medium">{title}</h3>
          <div className="flex min-w-0 items-center justify-end gap-2">{end}</div>
        </header>
      )}
      <div id={bodyId} hidden={!expanded} className={bodyClassName}>
        {children}
      </div>
      {expanded ? footer : null}
    </section>
  );
};

interface OrderFieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export const OrderField = ({
  label,
  htmlFor,
  className,
  children,
}: OrderFieldProps) => (
  <div className={cn("min-w-0", className)}>
    <label
      htmlFor={htmlFor}
      className="text-muted-foreground mb-1.5 block truncate text-xs"
    >
      {label}
    </label>
    {children}
  </div>
);

export interface OrderSegmentedOption {
  value: string;
  label: React.ReactNode;
}

interface OrderSegmentedProps {
  value: string;
  options: OrderSegmentedOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  dir: "rtl" | "ltr";
  disabled?: boolean;
  allowEmpty?: boolean;
  size?: "sm" | "field";
  className?: string;
}

export const OrderSegmented = ({
  value,
  options,
  onValueChange,
  ariaLabel,
  dir,
  disabled = false,
  allowEmpty = false,
  size = "sm",
  className,
}: OrderSegmentedProps) => (
  <ToggleGroupPrimitive.Root
    type="single"
    dir={dir}
    value={value}
    disabled={disabled}
    aria-label={ariaLabel}
    onValueChange={(next) => {
      if (next || allowEmpty) onValueChange(next);
    }}
    className={cn(
      "bg-muted inline-flex items-center gap-0.5 rounded-md p-0.5",
      size === "field" ? "h-9 w-full" : "h-7",
      className,
    )}
  >
    {options.map((option) => (
      <ToggleGroupPrimitive.Item
        key={option.value}
        value={option.value}
        className={cn(
          "text-muted-foreground focus-visible:ring-ring/50 data-[state=on]:bg-card data-[state=on]:text-foreground inline-flex h-full min-w-0 items-center justify-center rounded-sm px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 disabled:cursor-default data-[state=on]:shadow-sm",
          size === "field" && "flex-1",
          !disabled && "hover:text-foreground",
        )}
      >
        {option.label}
      </ToggleGroupPrimitive.Item>
    ))}
  </ToggleGroupPrimitive.Root>
);
