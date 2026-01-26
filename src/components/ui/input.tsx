import * as React from "react"
import { UI_CONFIG } from "@/config/ui-config"
import { cn } from "@/utils/tailwind"
import { ChevronUp, ChevronDown } from "lucide-react"

interface InputProps extends React.ComponentProps<"input"> {
  /** Show + sign for positive numbers. Only works with type="number" */
  showPlus?: boolean
  noBorder?: boolean
  suffix?: string
  prefix?: string
  center?: boolean
}

/**
 * Formats a numeric value with an optional + sign for positive numbers.
 * Returns empty string for empty/invalid input.
 */
function formatSignedNumber(value: string | number, showPlus: boolean, precision?: number): string {
  if (value === "" || value === undefined || value === null) return ""

  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return typeof value === "string" ? value : ""

  // Determine precision from the value itself if not specified
  const strVal = value.toString()
  const decimalPart = strVal.split(".")[1]
  const valuePrecision = decimalPart?.length ?? 0
  const finalPrecision = precision ?? valuePrecision

  const formatted = finalPrecision > 0 ? num.toFixed(finalPrecision) : num.toString()

  if (showPlus && num > 0) {
    return `+${formatted}`
  }
  return formatted
}

/**
 * Parses a signed number string, stripping the + sign if present.
 * Returns the numeric value or NaN if invalid.
 */
function parseSignedNumber(value: string): number {
  // Remove leading + sign for parsing
  const cleaned = value.replace(/^\+/, "")
  return parseFloat(cleaned)
}

/**
 * Validates and cleans input for signed number fields.
 * Allows: digits, one decimal point, and one leading +/- sign.
 */
function cleanSignedNumberInput(value: string): string {
  // Allow empty
  if (!value) return ""

  // Only allow: digits, one decimal point, and leading +/- sign
  let result = value.replace(/[^\d.+-]/g, "")

  // Extract sign (must be at start)
  const signMatch = result.match(/^[+-]/)
  const sign = signMatch ? signMatch[0] : ""
  const rest = signMatch ? result.substring(1) : result

  // Remove any additional + or - signs from the rest
  let cleaned = rest.replace(/[+-]/g, "")

  // Ensure only one decimal point
  const parts = cleaned.split(".")
  cleaned = parts[0] + (parts.length > 1 ? "." + parts.slice(1).join("") : "")

  return sign + cleaned
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, noBorder, type, showPlus, suffix, prefix, center, dir, ...props }, ref) => {
    const internalRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => internalRef.current!)

    // For numeric inputs, we use type="text" with inputMode="decimal"
    // This gives us full control over the displayed value including trailing dots and the + sign
    const isNumericInput = type === "number"
    const effectiveType = isNumericInput ? "text" : type
    const inputMode = isNumericInput ? "decimal" : props.inputMode

    // Logic for direction:
    // If it's a number (native or signed text), or has numeric decimal input mode, default to LTR.
    // Otherwise default to RTL for standard text strings.
    // An explicitly provided 'dir' prop always wins.
    const isNumeric = isNumericInput || inputMode === "decimal" || inputMode === "numeric"
    const effectiveDir = dir ?? (isNumeric ? "ltr" : "rtl")

    // Get precision from step prop (e.g., step="0.25" = 2 decimals)
    const stepPrecision = React.useMemo(() => {
      if (!props.step) return 2
      const stepStr = props.step.toString()
      const decimal = stepStr.split(".")[1]
      return decimal?.length ?? 0
    }, [props.step])

    // Helper to safely extract value (handles readonly string[] from React's types)
    const extractValue = (val: string | number | readonly string[] | undefined): string | number => {
      if (val === undefined || val === null) return ""
      if (typeof val === "string") return val
      if (typeof val === "number") return val
      // Fallback for arrays (readonly string[])
      return val[0] ?? ""
    }

    // Format the initial/controlled value
    const formatValue = React.useCallback((val: string | number) => {
      if (!isNumericInput) return (val ?? "").toString()
      return formatSignedNumber(val, !!showPlus, undefined) // Don't force precision while typing
    }, [isNumericInput, showPlus])

    const initialValue = extractValue(props.value ?? props.defaultValue)
    const [localValue, setLocalValue] = React.useState(() => formatValue(initialValue))

    // Sync with controlled value changes
    React.useEffect(() => {
      const newVal = extractValue(props.value ?? props.defaultValue)
      const currentNumeric = parseSignedNumber(localValue)
      const newNumeric = typeof newVal === "string" ? parseSignedNumber(newVal) : newVal

      // Only update if the numeric value actually changed (to avoid cursor jumps while typing)
      if (currentNumeric !== newNumeric || (newVal === "" && localValue !== "")) {
        setLocalValue(formatValue(newVal))
      }
    }, [props.value, props.defaultValue, formatValue])

    if (props.disabled && UI_CONFIG.noBorderOnDisabled) {
      noBorder = true
    }

    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

    const stopStep = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    const handleStep = React.useCallback((increment: boolean) => {
      const input = internalRef.current
      if (!input || props.disabled) return

      let newVal: number;
      if (isNumericInput) {
        // For numeric inputs, manually calculate the step to support signed formatting and trailing dots
        const currentVal = parseSignedNumber(input.value) || 0
        const step = parseFloat(props.step as string) || 0.25
        newVal = increment ? currentVal + step : currentVal - step

        // Apply min/max constraints
        if (props.min !== undefined) {
          newVal = Math.max(newVal, parseFloat(props.min as string))
        }
        if (props.max !== undefined) {
          newVal = Math.min(newVal, parseFloat(props.max as string))
        }

        // Format with sign and proper precision
        const formatted = formatSignedNumber(newVal, !!showPlus, stepPrecision)
        
        // Use native setter to ensure React's onChange is triggered
        const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
        nativeValueSetter?.call(input, formatted)
        setLocalValue(formatted)
      } else {
        // Use native stepUp/stepDown for regular number inputs
        try {
          if (increment) input.stepUp()
          else input.stepDown()
          setLocalValue(input.value)
        } catch {
          // Fallback for types that don't support stepUp/stepDown
          const currentVal = parseFloat(input.value) || 0
          const step = parseFloat(props.step as string) || 1
          newVal = increment ? currentVal + step : currentVal - step
          
          const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
          nativeValueSetter?.call(input, newVal.toString())
          setLocalValue(input.value)
        }
      }

      // Trigger both input and change events
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, [isNumericInput, showPlus, props.disabled, props.step, props.min, props.max, stepPrecision])

    const startStep = (increment: boolean) => {
      handleStep(increment)
      stopStep()
      timerRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          handleStep(increment)
        }, 60)
      }, 400)
    }

    const showButtons = type === "number" && !props.disabled

    return (
      <div dir={effectiveDir} className={cn("group w-full flex items-center", (prefix || suffix || showButtons) ? "relative" : "")}>
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none z-10 font-medium">
            {prefix}
          </span>
        )}
        <input
          ref={internalRef}
          type={effectiveType}
          inputMode={inputMode}
          dir={effectiveDir}
          data-slot="input"
          className={cn(
            `${props.disabled ? "bg-accent/50 dark:bg-accent/50" : "bg-card dark:bg-card"}`,
            type === "number" || center ? "text-center" : (effectiveDir === "rtl" ? "text-right" : "text-left"),
            `disabled:opacity-100 disabled:cursor-default file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground ${noBorder ? "border-none" : "border-input border"} flex h-9 w-full min-w-0 rounded-md py-1 text-base transition-[color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium md:text-sm`,
            "focus-visible:outline-none focus-visible:border-ring ring-0 outline-none",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            prefix ? "pl-5.5" : "px-1",
            suffix ? "pr-5.5" : "",
            className
          )}
          {...(() => {
            const { value, defaultValue, ...rest } = props;
            return rest;
          })()}
          value={localValue}
          onInput={(e) => {
            let val = e.currentTarget.value

            if (isNumericInput) {
              val = cleanSignedNumberInput(val)
            }

            e.currentTarget.value = val 
            setLocalValue(val)
            props.onInput?.(e)
          }}
          onChange={(e) => {
            props.onChange?.(e)
          }}
          onKeyDown={(e) => {
            if (isNumericInput) {
              if (e.key === "ArrowUp") {
                e.preventDefault()
                handleStep(true)
              } else if (e.key === "ArrowDown") {
                e.preventDefault()
                handleStep(false)
              }
            }
            props.onKeyDown?.(e)
          }}
          onBlur={(e) => {
            // Enforce min/max and format on blur
            let val = localValue
            if (val !== "") {
              const num = parseSignedNumber(val)
              if (!isNaN(num)) {
                let clampedNum = num
                if (props.min !== undefined) {
                  const minVal = parseFloat(props.min as string)
                  if (!isNaN(minVal)) clampedNum = Math.max(clampedNum, minVal)
                }
                if (props.max !== undefined) {
                  const maxVal = parseFloat(props.max as string)
                  if (!isNaN(maxVal)) clampedNum = Math.min(clampedNum, maxVal)
                }

                const finalValue = isNumericInput 
                  ? formatSignedNumber(clampedNum, !!showPlus, stepPrecision)
                  : clampedNum.toString()

                if (finalValue !== val) {
                  setLocalValue(finalValue)
                  if (internalRef.current) {
                    const el = internalRef.current
                    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
                    nativeValueSetter?.call(el, finalValue)
                    // Trigger events so React sees the change
                    el.dispatchEvent(new Event('input', { bubbles: true }))
                    el.dispatchEvent(new Event('change', { bubbles: true }))
                  }
                }
              }
            }
            props.onBlur?.(e)
          }}
        />
        {suffix && (
          <span className={cn(
            "absolute top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none z-10 font-medium",
            "right-1"
          )}>
            {suffix}
          </span>
        )}
        {showButtons && (
          <div className="absolute right-px top-px bottom-px flex flex-col border-l border-input opacity-0 group-hover:opacity-100 transition-opacity bg-card rounded-r-md overflow-hidden z-20 w-3">
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
                internalRef.current?.focus()
                startStep(true)
              }}
              onMouseUp={stopStep}
              onMouseLeave={stopStep}
              className="flex-1 flex items-center justify-center hover:bg-accent border-b border-input text-muted-foreground hover:text-foreground active:bg-accent-foreground/10"
            >
              <ChevronUp size={10} />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
                internalRef.current?.focus()
                startStep(false)
              }}
              onMouseUp={stopStep}
              onMouseLeave={stopStep}
              className="flex-1 flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground active:bg-accent-foreground/10"
            >
              <ChevronDown size={10} />
            </button>
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
