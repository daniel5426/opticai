import React from "react"
import { cn } from "@/utils/tailwind"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-gray-200 dark:bg-slate-700 animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
