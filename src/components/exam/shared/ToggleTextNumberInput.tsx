import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/utils/tailwind";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { FastInput, inputSyncManager } from "./OptimizedInputs";
import { ChevronDown } from "lucide-react";

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
  const measureRef = useRef<HTMLSpanElement>(null);
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
  const shownTextValue = optimisticText ?? selectValue;
  const shownValue = optimisticText ?? displayValue;
  const isShownAsText = isTextValue || !!optimisticText;

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
      ? Math.max(textWidthPx + 32, 64)
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
        "relative h-8 transition-[width] duration-300 ease-in-out overflow-hidden rounded-md",
        isShownAsText ? "w-fit max-w-full" : "w-full",
        className,
      )}
      style={dynamicTextWidth ? { width: `${dynamicTextWidth}px` } : undefined}
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
        onChange={(val) => {
          // Ignore stale sync events right after dropdown selection.
          if (open || Date.now() < suppressInputUntilRef.current) return;

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
          "transition-all duration-300 ease-in-out",
          isShownAsText ? "pr-1 pl-[18px] text-left font-medium" : "pr-1 pl-5",
          numericProps?.className,
        )}
      />
      <Select
        value={shownTextValue}
        onValueChange={commitSelectChange}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
      >
        <SelectTrigger
          className={cn(
            "absolute top-0 left-0 z-10 max-h-full h-full w-[14px] rounded-tl-md rounded-bl-md border-none bg-transparent p-0 shadow-none focus:ring-0 focus:ring-offset-0 transition-colors duration-200 ease-in-out flex items-center justify-center",
            selectValue
              ? "text-primary bg-primary/5 hover:bg-primary/10"
              : "text-muted-foreground/30 hover:bg-accent/50 hover:text-muted-foreground/50",
          )}
          hideIcon
          noBorder
          aria-label="Choose text preset"
        >
          <ChevronDown 
            className={cn(
              "size-2.5 transition-transform duration-300 ease-in-out",
              open && "rotate-180"
            )} 
          />
        </SelectTrigger>
        <SelectContent className="w-fit min-w-16" sideOffset={4}>
          {textOptions.map((opt) => (
            <SelectItem
              key={opt}
              value={opt}
              dir="ltr"
              className="justify-center"
              onClick={() => commitSelectChange(opt)}
            >
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
