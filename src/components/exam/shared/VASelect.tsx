import React from "react"
import { UI_CONFIG } from "@/config/ui-config"
import { cn } from "@/utils/tailwind"
import { VA_METER_VALUES, VA_DECIMAL_VALUES } from "../data/exam-constants"
import { useUser } from "@/contexts/UserContext"

interface VASelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

const VA_CONVERSION_MAP: Record<string, string> = {
  // Meter to Decimal
  "6/6": "1.0",
  "6/7.5": "0.8",
  "6/9": "0.7",
  "6/10": "0.6",
  "6/12": "0.5",
  "6/15": "0.4",
  "6/18": "0.3",
  "6/24": "0.25",
  "6/60": "0.1",
  "6/120": "0.05",
  // Decimal to Meter
  "1.0": "6/6",
  "0.8": "6/7.5",
  "0.7": "6/9",
  "0.6": "6/10",
  "0.5": "6/12",
  "0.4": "6/15",
  "0.3": "6/18",
  "0.2": "6/30",
  "0.1": "6/60",
};

export function convertVA(value: string, targetMode: "meter" | "decimal"): string {
  if (!value) return "";
  const modifierMatch = value.match(/([\+\-]\d+)$/);
  const modifier = modifierMatch ? modifierMatch[1] : "";
  const base = modifier ? value.replace(modifier, "") : value;

  const isMeter = base.startsWith("6/");
  if (targetMode === "meter" && isMeter) return value;
  if (targetMode === "decimal" && !isMeter) return value;

  if (targetMode === "decimal") {
    if (VA_CONVERSION_MAP[base]) return VA_CONVERSION_MAP[base] + modifier;
    const denom = parseFloat(base.replace("6/", ""));
    if (isNaN(denom)) return value;
    return (6 / denom).toFixed(1) + modifier;
  } else {
    if (VA_CONVERSION_MAP[base]) return VA_CONVERSION_MAP[base] + modifier;
    const dec = parseFloat(base);
    if (isNaN(dec)) return value;
    const denom = (6 / dec).toFixed(1).replace(".0", "");
    return `6/${denom}${modifier}`;
  }
}

export function VASelect({
  value,
  onChange,
  disabled = false,
  className = ""
}: VASelectProps) {
  const { currentUser } = useUser()
  const mode = currentUser?.va_format as "meter" | "decimal" || "meter"

  // Translate incoming value to current mode
  const translatedValue = convertVA(value, mode);

  // Parse value: "6/6+1" -> base="6/6", modifier="+1"
  const val = translatedValue || ""
  const modifierMatch = val.match(/([\+\-]\d+)$/)
  const modifier = modifierMatch ? modifierMatch[1] : ""
  const baseValue = modifier ? val.replace(modifier, "") : val

  // denominator for meter, or the whole string for decimal
  const displayValue = mode === "meter" ? baseValue.replace("6/", "") : baseValue

  const options = mode === "meter" ? VA_METER_VALUES : VA_DECIMAL_VALUES

  const handleModifierClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (disabled) return

    const modifiers = ["", "+1", "+2", "+3", "-1", "-2", "-3"]
    const currentIndex = modifiers.indexOf(modifier)
    const nextIndex = (currentIndex + 1) % modifiers.length
    onChange(`${baseValue}${modifiers[nextIndex]}`)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputVal = e.target.value.trim();
    if (!inputVal) {
      onChange("");
      return;
    }

    // Strip manual modifiers to keep them in the dedicated button
    let base = inputVal.replace(/[\+\-]\d+$/, "");

    if (mode === "meter") {
      // If they type just the number, add 6/
      if (!base.startsWith("6/")) {
        base = `6/${base}`;
      }
      onChange(`${base}${modifier}`);
    } else {
      onChange(`${base}${modifier}`);
    }
  }

  const stepBase = (direction: 'up' | 'down') => {
    const currentNum = parseFloat(displayValue)
    if (isNaN(currentNum)) {
      const defaultValue = mode === 'meter' ? '6' : '1.0'
      onChange(`${mode === 'meter' ? '6/' : ''}${defaultValue}${modifier}`)
      return
    }

    const numericOptions = options.map(opt => parseFloat(opt.replace("6/", "")))

    let nextVal: number | undefined
    if (mode === "meter") {
      // "Up" means better vision -> smaller denominator.
      // "Down" means worse vision -> larger denominator.
      if (direction === 'up') {
        nextVal = numericOptions.filter(v => v < currentNum).sort((a, b) => b - a)[0]
      } else {
        nextVal = numericOptions.filter(v => v > currentNum).sort((a, b) => a - b)[0]
      }
    } else {
      // "Up" means better vision -> larger decimal.
      // "Down" means worse vision -> smaller decimal.
      if (direction === 'up') {
        nextVal = numericOptions.filter(v => v > currentNum).sort((a, b) => a - b)[0]
      } else {
        nextVal = numericOptions.filter(v => v < currentNum).sort((a, b) => b - a)[0]
      }
    }

    if (nextVal !== undefined) {
      const targetString = options.find(opt => parseFloat(opt.replace("6/", "")) === nextVal)
      if (targetString) {
        onChange(`${targetString}${modifier}`)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      stepBase('up')
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      stepBase('down')
    }
  }
  let noBorder = false;
  if (disabled && UI_CONFIG.noBorderOnDisabled) {
    noBorder = true;
  }
  return (
    <div
      className={cn(
        "flex items-center w-full group h-8 border border-input rounded-md transition-shadow relative bg-background min-w-0",
        !disabled ? "bg-white" : "bg-accent/50",
        noBorder ? "border-none" : "",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[1px]",
        className
      )}
    >
      {mode === "meter" && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground select-none font-medium pointer-events-none z-10">
          6/
        </span>
      )}

      <input
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => {
          if (!e.target.value || isNaN(parseFloat(e.target.value))) {
            const defaultValue = mode === 'meter' ? '6' : '1.0'
            onChange(`${mode === 'meter' ? '6/' : ''}${defaultValue}${modifier}`)
          }
        }}
        disabled={disabled}
        autoComplete="off"
        size={1}
        className={cn(
          "flex-1 bg-transparent border-none focus:outline-none text-sm h-full min-w-0 disabled:cursor-default",
          mode === "meter" ? "pl-5" : "pl-1.5",
          "pr-4"
        )}
      />

      <button
        type="button"
        onClick={handleModifierClick}
        disabled={disabled}
        tabIndex={-1}
        className={cn(
          "absolute px-1 right-0 top-0 w-5 h-full text-[10px] font-bold flex items-center justify-center transition-all border-none focus:outline-none z-10",
          modifier ? "text-primary bg-primary/5" : "text-muted-foreground/0 group-hover:text-muted-foreground/30",
          !disabled && "hover:bg-accent/40"
        )}
      >
        {modifier || "±"}
      </button>
    </div>
  )
}
