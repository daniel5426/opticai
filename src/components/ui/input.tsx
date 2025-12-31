import * as React from "react"
import { UI_CONFIG } from "@/config/ui-config"
import { cn } from "@/utils/tailwind"
import { ChevronUp, ChevronDown } from "lucide-react"

interface InputProps extends React.ComponentProps<"input"> {
  showPlus?: boolean
  noBorder?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, noBorder, type, showPlus, ...props }, ref) => {
    const internalRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => internalRef.current!)

    const value = props.value?.toString() || ""
    const numValue = parseFloat(value)
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

    return (
      <div className={cn("group w-full", (hasPlus || (type === "number" && !props.disabled)) ? "relative" : "")}>
        {hasPlus && (
          <span className="absolute left-2 top-1/2 -translate-y-[55%] text-xs text-muted-foreground pointer-events-none z-10 font-medium">
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
            `disabled:opacity-100 disabled:cursor-default file:text-foreground justify-end placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground ${noBorder ? "border-none" : "border-input border"} flex h-9 w-full min-w-0 rounded-md px-3 py-1 text-base transition-[color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium md:text-sm`,
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            hasPlus && "pl-5",
            type === "number" && !props.disabled && "pr-8",
            className
          )}
          {...props}
        />
        {type === "number" && !props.disabled && (
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
