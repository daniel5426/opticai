import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/tailwind";
import { FastInput, inputSyncManager } from "./OptimizedInputs";
import { ChevronDown } from "lucide-react";

const PRESET_TRIGGER_WIDTH_PX = 12;
const PRESET_TRIGGER_GUTTER_PX = 8;

interface ToggleTextNumberInputProps {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  textOptions?: string[];
  textValueAliases?: Record<string, string>;
  numericProps?: Omit<
    React.ComponentProps<typeof FastInput>,
    "value" | "onChange" | "disabled" | "type"
  >;
  className?: string;
}

export function ToggleTextNumberInput({
  value,
  onChange,
  disabled = false,
  textOptions = [],
  textValueAliases = {},
  numericProps,
  className,
}: ToggleTextNumberInputProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [textWidthPx, setTextWidthPx] = useState<number | null>(null);
  const [optimisticText, setOptimisticText] = useState<string | null>(null);
  const lastSelectionRef = useRef<{ label: string; ts: number } | null>(null);
  const suppressInputUntilRef = useRef(0);

  const reverseAliases = useMemo(() => {
    const entries = Object.entries(textValueAliases);
    const map: Record<string, string> = {};

    const numericVariants = (raw: string): string[] => {
      const cleaned = raw.trim().replace(/^\+/, "");
      const numeric = Number(cleaned);
      if (!Number.isFinite(numeric)) return [];

      return Array.from(
        new Set([numeric.toString(), numeric.toFixed(1), numeric.toFixed(2)]),
      );
    };

    entries.forEach(([label, stored]) => {
      const trimmedStored = stored.trim();
      map[trimmedStored] = label;
      numericVariants(trimmedStored).forEach((variant) => {
        map[variant] = label;
      });
    });

    return map;
  }, [textValueAliases]);

  const normalizedValue = value.trim();
  const normalizedUnsignedValue = normalizedValue.replace(/^\+/, "");

  const isTextValue =
    textOptions.includes(normalizedValue) ||
    !!reverseAliases[normalizedValue] ||
    !!reverseAliases[normalizedUnsignedValue];

  const selectValue = useMemo(() => {
    if (textOptions.includes(normalizedValue)) return normalizedValue;
    if (reverseAliases[normalizedValue]) return reverseAliases[normalizedValue];
    if (reverseAliases[normalizedUnsignedValue])
      return reverseAliases[normalizedUnsignedValue];
    return "";
  }, [normalizedValue, normalizedUnsignedValue, textOptions, reverseAliases]);

  const displayValue = isTextValue ? selectValue : value;
  const shownValue = optimisticText ?? displayValue;
  const isShownAsText = isTextValue || !!optimisticText;
  const effectiveSuffix = isShownAsText ? undefined : numericProps?.suffix;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        left: rect.left,
        top: rect.bottom + 4,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!optimisticText) return;
    if (selectValue === optimisticText) {
      setOptimisticText(null);
    }
  }, [optimisticText, selectValue]);

  useLayoutEffect(() => {
    if (!isShownAsText || !shownValue) {
      setTextWidthPx(null);
      return;
    }

    const measured = measureRef.current?.getBoundingClientRect().width ?? 0;
    setTextWidthPx(Math.ceil(measured));
  }, [shownValue, isShownAsText]);

  const dynamicTextWidth =
    isShownAsText && textWidthPx !== null
      ? Math.max(
          textWidthPx + PRESET_TRIGGER_WIDTH_PX + PRESET_TRIGGER_GUTTER_PX,
          92,
        )
      : null;

  const commitSelectChange = (label: string) => {
    if (disabled) return;
    const now = Date.now();
    const last = lastSelectionRef.current;
    if (last && last.label === label && now - last.ts < 200) return;

    lastSelectionRef.current = { label, ts: now };
    suppressInputUntilRef.current = now + 250;
    setOptimisticText(label);
    inputSyncManager.flush();
    const stored = textValueAliases[label] ?? label;
    onChange?.(stored);
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "relative h-8 w-full overflow-visible rounded-md transition-[width] duration-200 ease-out",
        className,
      )}
      ref={rootRef}
      style={
        dynamicTextWidth
          ? {
              width: "100%",
              minWidth: `${dynamicTextWidth}px`,
            }
          : { width: "100%" }
      }
    >
      {isShownAsText && (
        <span
          ref={measureRef}
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0 left-0 -z-10 text-xs font-medium whitespace-pre opacity-0",
            numericProps?.className,
          )}
        >
          {shownValue}
        </span>
      )}
      <FastInput
        {...numericProps}
        type={isShownAsText ? "text" : "number"}
        dir={isShownAsText ? "ltr" : undefined}
        center={false}
        value={shownValue}
        suffix={effectiveSuffix}
        leadingOverlayWidth={PRESET_TRIGGER_WIDTH_PX}
        showLeadingOverlay={open}
        leadingOverlay={
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || textOptions.length === 0}
            aria-label="Choose text preset"
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              "relative block h-full w-full border-none bg-transparent p-0 shadow-none",
              "rounded-none focus-visible:ring-0 focus-visible:outline-none disabled:cursor-default",
              selectValue
                ? "text-primary hover:bg-primary/5"
                : "text-muted-foreground hover:bg-accent/70",
            )}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              if (disabled || textOptions.length === 0) return;
              setOpen((current) => !current);
            }}
          >
            <ChevronDown
              className={cn(
                "absolute top-1/2 left-1/2 block size-2.5 shrink-0 -translate-x-1/2 -translate-y-[calc(50%+2px)] transform-gpu transition-transform duration-200 ease-out",
                open && "rotate-180",
              )}
            />
          </button>
        }
        onChange={(val) => {
          // Ignore stale sync events right after dropdown selection.
          if (open || Date.now() < suppressInputUntilRef.current) return;

          if (val.trim() === "") {
            setOptimisticText(null);
            onChange?.("");
            return;
          }

          if (isShownAsText && textOptions.includes(val)) {
            const stored = textValueAliases[val] ?? val;
            setOptimisticText(val);
            onChange?.(stored);
            return;
          }
          setOptimisticText(null);
          onChange?.(val);
        }}
        disabled={disabled}
        className={cn(
          "w-full transition-all duration-200 ease-out",
          isShownAsText ? "px-1.5 text-center font-medium" : "pr-2 pl-1",
          numericProps?.className,
        )}
      />
      {open &&
        textOptions.length > 0 &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="border-border bg-popover text-popover-foreground fixed z-[9999] w-fit min-w-16 overflow-hidden rounded-md border p-1 shadow-md"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
            }}
          >
            {textOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={opt === selectValue}
                dir="ltr"
                className={cn(
                  "relative flex h-8 w-full min-w-14 cursor-default items-center justify-center rounded-sm px-2 text-sm outline-none select-none",
                  "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                  opt === selectValue && "bg-accent/70 text-accent-foreground",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => commitSelectChange(opt)}
              >
                {opt}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
