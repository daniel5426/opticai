import * as React from "react"
import { UI_CONFIG } from "@/config/ui-config"
import { cn } from "@/utils/tailwind"
import { ChevronUp, ChevronDown, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  focusClinicalNavSibling,
  isInClinicalNavScope,
  normalizeClinicalNumberInput,
} from "@/lib/clinical-input-navigation"

interface InputProps extends React.ComponentProps<"input"> {
  /** Show + sign for positive numbers. Only works with type="number" */
  showPlus?: boolean
  noBorder?: boolean
  suffix?: string
  prefix?: string
  center?: boolean
  leadingOverlay?: React.ReactNode
  leadingOverlayWidth?: number
  showLeadingOverlay?: boolean
  warningMessage?: string | null
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

function isStepAligned(value: number, stepProp: string | number | undefined, minProp: string | number | undefined): boolean {
  if (stepProp === undefined || stepProp === "any") return true

  const step = typeof stepProp === "number" ? stepProp : parseFloat(stepProp)
  if (!Number.isFinite(step) || step <= 0) return true

  const stepBase =
    minProp !== undefined
      ? (typeof minProp === "number" ? minProp : parseFloat(minProp))
      : 0
  const base = Number.isFinite(stepBase) ? stepBase : 0
  const ratio = (value - base) / step
  const nearest = Math.round(ratio)

  return Math.abs(ratio - nearest) < 1e-9
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
  ({
    className,
    noBorder,
    type,
    showPlus,
    suffix,
    prefix,
    center,
    dir,
    leadingOverlay,
    leadingOverlayWidth = 12,
    showLeadingOverlay = false,
    warningMessage,
    ...props
  }, ref) => {
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

    const stepPrecision = React.useMemo(() => {
      if (!props.step) return 0
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

      if (!isNumericInput) {
        const formattedValue = formatValue(newVal)
        if (localValue !== formattedValue) {
          setLocalValue(formattedValue)
        }
        return
      }

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
    const suppressClinicalAutoAdvanceRef = React.useRef(false)

    const stopStep = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    const handleStep = React.useCallback((increment: boolean) => {
      const input = internalRef.current
      if (!input || props.disabled) return

      let newVal: number;
      if (isNumericInput) {
        const rawValue = input.value
        const parsed = parseSignedNumber(rawValue)
        const step = parseFloat(props.step as string) || 1
        const minValue = props.min !== undefined ? parseFloat(props.min as string) : undefined
        const hasValue = rawValue !== "" && !isNaN(parsed)

        if (!hasValue) {
          if (minValue !== undefined && !isNaN(minValue)) {
            newVal = minValue
          } else {
            newVal = 0
          }
        } else {
          newVal = increment ? parsed + step : parsed - step
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
      suppressClinicalAutoAdvanceRef.current = true
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      window.setTimeout(() => {
        suppressClinicalAutoAdvanceRef.current = false
      }, 0)
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

    const isAtNavigationBoundary = (
      input: HTMLInputElement,
      direction: "next" | "previous",
    ) => {
      if (input.selectionStart !== input.selectionEnd) return false
      const caret = input.selectionStart ?? 0
      return direction === "next" ? caret >= input.value.length : caret <= 0
    }

    const handleDecimalSeparatorDelete = (input: HTMLInputElement, key: string) => {
      if (!isNumericInput || !isInClinicalNavScope(input)) return false
      if (input.dataset.clinicalNavKind !== "number") return false
      if (key !== "Backspace" && key !== "Delete") return false
      if (input.selectionStart !== input.selectionEnd) return false

      const value = input.value
      const dotIndex = value.indexOf(".")
      if (dotIndex < 0) return false

      const caret = input.selectionStart ?? 0
      const wouldDeleteDot =
        (key === "Backspace" && caret === dotIndex + 1) ||
        (key === "Delete" && caret === dotIndex)
      if (!wouldDeleteDot) return false

      const digitBeforeDotIndex = dotIndex - 1
      if (digitBeforeDotIndex < 0 || !/\d/.test(value[digitBeforeDotIndex])) {
        return false
      }

      const nextValue =
        value.slice(0, digitBeforeDotIndex) + value.slice(dotIndex + 1)
      const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
      nativeValueSetter?.call(input, nextValue)
      setLocalValue(nextValue)
      const nextCaret = Math.min(digitBeforeDotIndex, nextValue.length)
      input.setSelectionRange(nextCaret, nextCaret)
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
      return true
    }

    const numericValue = isNumericInput ? parseSignedNumber(localValue) : NaN
    const minValue = props.min !== undefined ? parseFloat(props.min as string) : undefined
    const rawMaxValue = props.max !== undefined ? parseFloat(props.max as string) : undefined
    const maxValue = (minValue !== undefined && rawMaxValue !== undefined && !isNaN(minValue) && !isNaN(rawMaxValue) && rawMaxValue < minValue)
      ? undefined
      : rawMaxValue
    const isOutOfRange = isNumericInput
      && !isNaN(numericValue)
      && ((minValue !== undefined && !isNaN(minValue) && numericValue < minValue)
        || (maxValue !== undefined && !isNaN(maxValue) && numericValue > maxValue))
    const isStepMismatch = isNumericInput
      && !isNaN(numericValue)
      && localValue !== ""
      && !isStepAligned(numericValue, props.step, props.min)
    const ariaInvalid = props["aria-invalid"] ?? (isOutOfRange || isStepMismatch)

    const hasLeadingOverlay = !!leadingOverlay

    return (
      <div
        dir={effectiveDir}
        className={cn(
          "group w-full flex items-center",
          (prefix || suffix || showButtons || hasLeadingOverlay) ? "relative" : "",
        )}
      >
        {hasLeadingOverlay && (
          <div
            className={cn(
              "absolute left-px top-px bottom-px z-20 overflow-hidden rounded-l-md border-r border-input bg-card",
              "transition-opacity duration-200 ease-out",
              "group-hover:opacity-100",
              showLeadingOverlay ? "opacity-100" : "opacity-0",
            )}
            style={{ width: `${leadingOverlayWidth}px` }}
          >
            {leadingOverlay}
          </div>
        )}
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
            hasLeadingOverlay
              ? ""
              : prefix ? "pl-5.5" : "px-1",
            suffix ? "pr-5.5" : "",
            className
          )}
          {...(() => {
            const { value, defaultValue, ...rest } = props;
            return rest;
          })()}
          aria-invalid={ariaInvalid}
          value={localValue}
          onInput={(e) => {
            let val = e.currentTarget.value

            if (isNumericInput) {
              val = cleanSignedNumberInput(val)
              e.currentTarget.value = val
              const normalized = normalizeClinicalNumberInput(e.currentTarget)
              val = normalized.value

              if (normalized.shouldAdvance && !suppressClinicalAutoAdvanceRef.current) {
                const input = e.currentTarget
                window.setTimeout(() => {
                  focusClinicalNavSibling(input, "next")
                }, 0)
              }
            }

            e.currentTarget.value = val
            setLocalValue(val)
            props.onInput?.(e)
          }}
          onFocus={(e) => {
            if (isNumericInput) {
              e.currentTarget.select()
            }
            props.onFocus?.(e)
          }}
          onChange={(e) => {
            props.onChange?.(e)
          }}
          onKeyDown={(e) => {
            if (handleDecimalSeparatorDelete(e.currentTarget, e.key)) {
              e.preventDefault()
              return
            }
            if (isInClinicalNavScope(e.currentTarget)) {
              if (
                e.key === "ArrowRight" &&
                isAtNavigationBoundary(e.currentTarget, "next")
              ) {
                e.preventDefault()
                focusClinicalNavSibling(e.currentTarget, "next")
                return
              }
              if (
                e.key === "ArrowLeft" &&
                isAtNavigationBoundary(e.currentTarget, "previous")
              ) {
                e.preventDefault()
                focusClinicalNavSibling(e.currentTarget, "previous")
                return
              }
              if (
                e.key === " " &&
                e.currentTarget.dataset.clinicalNavKind === "number"
              ) {
                e.preventDefault()
                focusClinicalNavSibling(e.currentTarget, "next")
                return
              }
            }
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
            let val = localValue
            if (val !== "" && isNumericInput) {
              const num = parseSignedNumber(val)
              if (!isNaN(num)) {
                const finalValue = formatSignedNumber(num, !!showPlus, stepPrecision)

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
        {ariaInvalid && warningMessage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Input warning details"
                className="absolute top-0.5 left-0.5 z-30 flex h-3 w-3 items-center justify-center text-destructive opacity-90"
              >
                <Info className="h-2 w-2" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" className="max-w-64 text-center">
              {warningMessage}
            </TooltipContent>
          </Tooltip>
        )}
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
