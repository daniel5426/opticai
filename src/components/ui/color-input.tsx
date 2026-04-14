import * as React from "react"
import { cn } from "@/utils/tailwind"

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i

export const isValidHexColor = (value?: string | null): value is string => {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
}

export const getSafeHexColor = (value?: string | null, fallback = "#000000") => {
  return isValidHexColor(value) ? value : fallback
}

interface ColorInputProps extends Omit<React.ComponentProps<"input">, "type" | "value"> {
  value?: string | null
  fallbackColor?: string
}

const ColorInput = React.forwardRef<HTMLInputElement, ColorInputProps>(
  ({ className, value, fallbackColor = "#000000", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="color"
        value={getSafeHexColor(value, fallbackColor)}
        dir="ltr"
        className={cn(
          "h-12 w-16 cursor-pointer rounded-md border border-input bg-card p-1 shadow-sm outline-none transition-colors",
          "focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60",
          "[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0",
          "[&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0",
          className
        )}
        {...props}
      />
    )
  }
)

ColorInput.displayName = "ColorInput"

export { ColorInput }
