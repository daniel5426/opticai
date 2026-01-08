import * as React from "react"
import { UI_CONFIG } from "@/config/ui-config"
import { cn } from "@/utils/tailwind"
import { ChevronUp, ChevronDown } from "lucide-react"

interface InputProps extends React.ComponentProps<"input"> {
  showPlus?: boolean
  noBorder?: boolean
  suffix?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, noBorder, type, showPlus, suffix, ...props }, ref) => {
    const internalRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => internalRef.current!)

    const [localValue, setLocalValue] = React.useState((props.value ?? props.defaultValue ?? "").toString())

    React.useEffect(() => {
      setLocalValue((props.value ?? props.defaultValue ?? "").toString())
    }, [props.value, props.defaultValue])

    const numValue = parseFloat(localValue)
    const hasPlus = showPlus && type === "number" && !isNaN(numValue) && numValue > 0

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

    return (
      <div className={cn("group w-full flex items-center", (hasPlus || suffix || showButtons) ? "relative" : "")}>
        {hasPlus && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none z-10 font-medium">
            +
          </span>
        )}
        <input
          ref={internalRef}
          type={type}
          data-slot="input"
          className={cn(
            `${props.disabled ? "bg-accent/50 dark:bg-accent/50" : "bg-card dark:bg-card"}`,
            `${props.dir === "rtl" ? "justify-end" : "justify-start"}`,
            `disabled:opacity-100 disabled:cursor-default file:text-foreground justify-end placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground ${noBorder ? "border-none" : "border-input border"} flex h-9 w-full min-w-0 rounded-md px-1 py-1 text-base transition-[color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium md:text-sm`,
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            hasPlus && "pl-5",
            showButtons ? (suffix ? "pr-7" : "pr-1") : (suffix ? "pr-8" : ""),
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
        {suffix && (
          <span className={cn(
            "absolute top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none z-10 font-medium",
            showButtons ? "right-2" : "right-2"
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
