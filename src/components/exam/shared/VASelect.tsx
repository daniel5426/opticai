import React, { useRef, useEffect, useState, memo, useCallback, useContext } from "react"
import { UI_CONFIG } from "@/config/ui-config"
import { cn } from "@/utils/tailwind"
import { VA_METER_VALUES, VA_DECIMAL_VALUES, sortVAOptions } from "../data/exam-constants"
import { useUser } from "@/contexts/UserContext"
import { SettingsContext } from "@/contexts/SettingsContext"
import { useLookupData } from "@/hooks/useLookupData"
import { inputSyncManager } from "./OptimizedInputs"
import { flushSync } from 'react-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface VASelectProps {
  value: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
}


const VA_CONVERSION_MAP: Record<string, string> = {
  // Meter to Decimal
  "6/190": "-0.3",
  "6/150": "-0.2",
  "6/120": "-0.1",
  "6/96": "0.0",
  "6/75": "0.1",
  "6/60": "0.2",
  "6/48": "0.3",
  "6/38": "0.4",
  "6/30": "0.5",
  "6/24": "0.6",
  "6/18": "0.7",
  "6/15": "0.8",
  "6/12": "0.9",
  "6/9": "1.0",
  "6/7.5": "1.1",
  "6/6": "1.2",
  "6/4.5": "1.3",
  "6/3": "1.5",
  // Decimal to Meter
  "-0.3": "6/190",
  "-0.2": "6/150",
  "-0.1": "6/120",
  "0.0": "6/96",
  "0.1": "6/75",
  "0.2": "6/60",
  "0.3": "6/48",
  "0.4": "6/38",
  "0.5": "6/30",
  "0.6": "6/24",
  "0.7": "6/18",
  "0.8": "6/15",
  "0.9": "6/12",
  "1.0": "6/9",
  "1.1": "6/7.5",
  "1.2": "6/6",
  "1.3": "6/4.5",
  "1.5": "6/3",
};

const VA_MODIFIER_REGEX = /([\+\-]\d+)$/
const VA_METER_REGEX = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/

export function normalizeVATestDistance(value: unknown): number {
  const distance = typeof value === "number" ? value : Number(value)
  return Number.isInteger(distance) && distance >= 2 && distance <= 6 ? distance : 6
}

function splitVAModifier(value: string) {
  const modifierMatch = value.match(VA_MODIFIER_REGEX)
  const modifier = modifierMatch ? modifierMatch[1] : ""
  const base = modifier ? value.replace(modifier, "") : value
  return { base, modifier }
}

function parseMeterVA(value: string) {
  const match = value.match(VA_METER_REGEX)
  if (!match) return null

  const numerator = Number(match[1])
  const denominator = Number(match[2])
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) {
    return null
  }

  return { numerator, denominator }
}

function isMeterVAValue(value: string) {
  return parseMeterVA(value) !== null
}

function formatVANumber(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return rounded.toFixed(2).replace(/\.?0+$/, "")
}

export function displayMeterVAForDistance(value: string, testDistance: number): string {
  if (!value) return ""

  const distance = normalizeVATestDistance(testDistance)
  const { base, modifier } = splitVAModifier(value)
  const parsed = parseMeterVA(base)
  if (!parsed) return value

  const displayDenominator = parsed.denominator * distance / parsed.numerator
  return `${distance}/${formatVANumber(displayDenominator)}${modifier}`
}

export function canonicalizeMeterVAForDistance(value: string): string {
  if (!value) return ""

  const { base, modifier } = splitVAModifier(value)
  const parsed = parseMeterVA(base)
  if (!parsed) return value

  const canonicalDenominator = parsed.denominator * 6 / parsed.numerator
  return `6/${formatVANumber(canonicalDenominator)}${modifier}`
}

export function buildMeterVAOptionsForDistance(canonicalOptions: readonly string[], testDistance: number) {
  const displayToCanonicalOption = new Map<string, string>()
  const options = sortVAOptions(canonicalOptions)
    .filter(isMeterVAValue)
    .map(option => {
      const displayOption = displayMeterVAForDistance(option, testDistance)
      displayToCanonicalOption.set(displayOption, option)
      return displayOption
    })

  return { options, displayToCanonicalOption }
}

export function convertVA(value: string, targetMode: "meter" | "decimal", testDistance = 6): string {
  if (!value) return "";
  const { base, modifier } = splitVAModifier(value);
  const meterValue = parseMeterVA(base);

  if (targetMode === "meter" && meterValue) {
    return displayMeterVAForDistance(
      canonicalizeMeterVAForDistance(value),
      testDistance,
    );
  }
  if (targetMode === "decimal" && !meterValue) return value;

  if (targetMode === "decimal") {
    if (VA_CONVERSION_MAP[base]) return VA_CONVERSION_MAP[base] + modifier;
    if (!meterValue) return value;
    return (meterValue.numerator / meterValue.denominator).toFixed(1) + modifier;
  } else {
    if (VA_CONVERSION_MAP[base]) return VA_CONVERSION_MAP[base] + modifier;
    const dec = parseFloat(base);
    if (isNaN(dec)) return value;
    const denom = (6 / dec).toFixed(1).replace(".0", "");
    return displayMeterVAForDistance(`6/${denom}${modifier}`, testDistance);
  }
}

export const VASelect = memo(function VASelect({
  value,
  onChange,
  disabled = false,
  className = ""
}: VASelectProps) {
  const { currentUser } = useUser()
  const settingsContext = useContext(SettingsContext)
  const mode = (currentUser?.va_format as "meter" | "decimal") || "meter"
  const vaTestDistance = normalizeVATestDistance(settingsContext?.settings?.va_test_distance)

  const lookupType = mode === "meter" ? "vaMeter" : "vaDecimal"
  const { data: lookupData, loading: isLoadingLookup } = useLookupData(lookupType)

  const [modifier, setModifier] = useState("")
  const modifierRef = useRef("")

  const getComponents = useCallback((val: string) => {
    const translated = convertVA(val, mode, vaTestDistance) || ""
    const { base: baseStr, modifier: mod } = splitVAModifier(translated)
    return { baseStr, mod }
  }, [mode, vaTestDistance])

  const { baseStr: currentBase, mod: currentMod } = getComponents(value)

  // Local state for immediate UI feedback
  const [localBase, setLocalBase] = useState(currentBase)

  // Sync local state when external value changes
  useEffect(() => {
    setLocalBase(currentBase)
  }, [currentBase])

  const dynamicOptions = lookupData
    .map(item => item.name)
    .filter(option => mode !== "meter" || isMeterVAValue(option))
  const canonicalOptions: readonly string[] = dynamicOptions.length > 0
    ? dynamicOptions
    : (mode === "meter" ? VA_METER_VALUES : VA_DECIMAL_VALUES)
  const sortedCanonicalOptions = sortVAOptions(canonicalOptions)
  const meterOptions = mode === "meter"
    ? buildMeterVAOptionsForDistance(sortedCanonicalOptions, vaTestDistance)
    : null
  const options: readonly string[] = meterOptions?.options || sortedCanonicalOptions
  const displayToCanonicalOption = meterOptions?.displayToCanonicalOption
    
  const selectValue = options.includes(localBase) ? localBase : ""

  useEffect(() => {
    setModifier(currentMod)
    modifierRef.current = currentMod
  }, [currentMod])

  const handleValueChange = (newBase: string) => {
    if (disabled) return
    setLocalBase(newBase) // Update UI immediately
    const storedBase = mode === "meter"
      ? displayToCanonicalOption?.get(newBase) || canonicalizeMeterVAForDistance(newBase)
      : newBase
    const newVal = `${storedBase}${modifierRef.current}`
    if (onChange) {
      onChange(newVal)
    }
  }

  const handleModifierClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (disabled) return

    const modifiersList = ["", "+1", "+2", "+3", "-1", "-2", "-3"]
    const currentIndex = modifiersList.indexOf(modifierRef.current)
    const nextIndex = (currentIndex + 1) % modifiersList.length
    const nextModifier = modifiersList[nextIndex]

    setModifier(nextModifier)
    modifierRef.current = nextModifier
    
    if (onChange) {
      const storedBase = mode === "meter"
        ? displayToCanonicalOption?.get(localBase) || canonicalizeMeterVAForDistance(localBase)
        : localBase
      onChange(`${storedBase}${nextModifier}`)
    }
  }

  return (
    <div
      data-slot="va-select"
      className={cn(
        "flex items-center w-full group h-8 border border-input rounded-md transition-shadow relative bg-background min-w-0",
        !disabled ? "bg-white" : "bg-accent/50",
        disabled && UI_CONFIG.noBorderOnDisabled ? "border-none" : "",
        "focus-within:border-ring focus-within:ring-ring/30 focus-within:ring-[1px] outline-none",
        className
      )}
    >
      <div  className="flex-1 flex items-center justify-center pr-5 relative min-w-0 h-full">
        <Select
          key={`${mode}-${vaTestDistance}`} // Only force re-render on mode/distance change
          value={selectValue}
          onValueChange={handleValueChange}
          disabled={disabled || isLoadingLookup}
          onOpenChange={(open) => {
            const container = document.querySelector('[data-slot="va-select"]:hover') || 
                              document.activeElement?.closest('[data-slot="va-select"]');
            
            if (open && container) {
              container.classList.add('border-ring', 'ring-ring/1', 'ring-[1px]');
            } else if (!open) {
              const allContainers = document.querySelectorAll('[data-slot="va-select"]');
              allContainers.forEach(c => c.classList.remove('border-ring', 'ring-ring/1', 'ring-[1px]'));
              
              setTimeout(() => {
                if (document.activeElement instanceof HTMLElement && 
                    document.activeElement.getAttribute('data-slot') === 'select-trigger') {
                  document.activeElement.blur();
                }
              }, 0);
            }
          }}
        >
          <SelectTrigger dir="ltr"
            className="border-none focus:ring-0 focus:ring-offset-0 h-full w-full bg-transparent shadow-none px-2"
            size="sm"
            centered
          >
            <SelectValue placeholder="" />
          </SelectTrigger>
          <SelectContent className="min-w-16 w-fit">
            {options.map((opt) => (
              <SelectItem key={opt} value={opt} dir="ltr" className="justify-center">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        onClick={handleModifierClick}
        disabled={disabled}
        tabIndex={-1}
        className={cn(
          "absolute rounded-tr-md rounded-br-md px-1 right-0 top-0 w-5 h-full text-[10px] font-bold flex items-center justify-center transition-all border-none focus:outline-none",
          modifier ? "text-primary bg-primary/5" : "text-muted-foreground/30",
          !disabled && "hover:text-accent-foreground hover:bg-accent"
        )}
      >
        {modifier || "±"}
      </button>
    </div>
  )
})
