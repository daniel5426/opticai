import * as React from "react"
import { UI_CONFIG } from "@/config/ui-config"
import { cn } from "@/utils/tailwind"
import { ChevronUp, ChevronDown } from "lucide-react"

interface InputProps extends React.ComponentProps<"input"> {
  showPlus?: boolean
  noBorder?: boolean
  suffix?: string
  prefix?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, noBorder, type, showPlus, suffix, prefix, ...props }, ref) => {
    const internalRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => internalRef.current!)

    const [localValue, setLocalValue] = React.useState((props.value ?? props.defaultValue ?? "").toString())

    React.useEffect(() => {
      setLocalValue((props.value ?? props.defaultValue ?? "").toString())
    }, [props.value, props.defaultValue])

    const numValue = parseFloat(localValue)
    const hasPlus = showPlus && type === "number" && !isNaN(numValue) && numValue > 0

    // We reserve space for the prefix if one is explicitly provided OR if showPlus is active
    // This ensures the number doesn't jump horizontally when its sign changes.
    const reservePrefixSpace = prefix !== undefined || (showPlus && type === "number")
    const hasPrefix = prefix !== undefined || hasPlus
    const prefixText = prefix !== undefined ? prefix : (hasPlus ? "+" : "")

    if (props.disabled && UI_CONFIG.noBorderOnDisabled) {
      noBorder = true
    }

    const timerRef = React.useRef<any>(null)
    const intervalRef = React.useRef<any>(null)

    const stopStep = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    const handleStep = (increment: boolean) => {
      const input = internalRef.current
      if (input && !props.disabled) {
        if (increment) input.stepUp()
        else input.stepDown()

        setLocalValue(input.value)

        // Trigger both input and change events to ensure all frameworks/listeners catch it
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

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

    // For number inputs with a prefix, use centered flex overlay approach
    // This ensures the prefix and value appear centered together
    // For suffix-only inputs, use absolute positioning to avoid cursor gap issues
    const useFlexOverlay = hasPrefix && type === "number"

    return (
      <div className={cn("group w-full flex items-center", (hasPrefix || suffix || showButtons) ? "relative" : "")}>
        {/* For non-number inputs or inputs without prefix, use absolute positioning */}
        {hasPrefix && !useFlexOverlay && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none z-10 font-medium">
            {prefixText}
          </span>
        )}
        {/* Centered prefix + value overlay for number inputs with prefix */}
        {useFlexOverlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 gap-0.5">
            <span className="text-xs text-muted-foreground font-medium">
              {prefixText}
            </span>
            <span className="text-base md:text-sm text-foreground">{localValue}</span>
          </div>
        )}
        <input
          ref={internalRef}
          type={type}
          data-slot="input"
          className={cn(
            `${props.disabled ? "bg-accent/50 dark:bg-accent/50" : "bg-card dark:bg-card"}`,
            type === "number" ? "text-center" : (props.dir === "rtl" ? "text-right" : "text-left"),
            `disabled:opacity-100 disabled:cursor-default file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground ${noBorder ? "border-none" : "border-input border"} flex h-9 w-full min-w-0 rounded-md py-1 text-base transition-[color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium md:text-sm`,
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            // For flex overlay mode, make the input text transparent so only overlay shows
            useFlexOverlay ? "text-transparent caret-foreground selection:bg-primary px-3" : (reservePrefixSpace ? "pl-3" : "pl-1"),
            (suffix && !useFlexOverlay) ? "pr-6" : (!useFlexOverlay ? "pr-3" : ""),
            className
          )}
          {...props}
          onInput={(e) => {
            setLocalValue(e.currentTarget.value)
            props.onInput?.(e)
          }}
          onChange={(e) => {
            setLocalValue(e.currentTarget.value)
            props.onChange?.(e)
          }}
        />
        {suffix && !useFlexOverlay && (
          <span className={cn(
            "absolute top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none z-10 font-medium",
            "right-1"
          )}>
            {suffix}
          </span>
        )}
        {showButtons && (
          <div className="absolute right-[1px] top-[1px] bottom-[1px] flex flex-col border-l border-input opacity-0 group-hover:opacity-100 transition-opacity bg-card rounded-r-md overflow-hidden z-20 w-3">
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
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
