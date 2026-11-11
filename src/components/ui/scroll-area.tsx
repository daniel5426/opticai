import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/utils/tailwind"

function ScrollArea({
  className,
  children,
  disableScrollBar = false,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & { disableScrollBar?: boolean }) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar disableScrollBar={disableScrollBar}/>
      <ScrollAreaPrimitive.Corner className="bg-transparent" />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  disableScrollBar = false,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & { disableScrollBar?: boolean }) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none border-0 bg-transparent p-0.5 transition-colors select-none",
        orientation === "vertical" &&
          "h-full w-2",
        orientation === "horizontal" &&
          "h-2 flex-col",
        className
      )}
      {...props}
    >
      {!disableScrollBar && (
        <ScrollAreaPrimitive.ScrollAreaThumb
          data-slot="scroll-area-thumb"
          className="bg-muted-foreground/35 relative flex-1 rounded-full"
        />
      )}
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
