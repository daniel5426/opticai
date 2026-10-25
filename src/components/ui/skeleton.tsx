import React from "react"
import { cn } from "@/utils/tailwind"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-skeleton animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
