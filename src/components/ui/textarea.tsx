import * as React from "react"
import { UI_CONFIG } from "@/config/ui-config"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  noBorder?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, noBorder, ...props }, ref) => {
    if (props.disabled && UI_CONFIG.noBorderOnDisabled) {
      noBorder = true
    }
    return (
      <textarea
        className={cn(
          `flex min-h-[80px] ${props.disabled ? "bg-accent/80 dark:bg-accent/50" : "bg-card dark:bg-card"} w-full rounded-md ${noBorder ? "" : "border border-input"} px-3 py-2 text-sm ${noBorder ? "" : "ring-foreground/30"} placeholder:text-muted-foreground focus-visible:outline-none ${noBorder ? "" : "focus-visible:ring-1"} disabled:cursor-not-allowed disabled:opacity-50`,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea } 