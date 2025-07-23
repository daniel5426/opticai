import * as React from "react"

import { cn } from "@/utils/tailwind"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(`${props.disabled ? "bg-accent/50 dark:bg-accent/50" : "bg-card dark:bg-card"}`,
        `${props.dir === "rtl" ? "justify-end" : "justify-start"}`,
        `disabled:opacity-100 disabled:cursor-default file:text-foreground justify-end placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base transition-[color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium   md:text-sm`,
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
