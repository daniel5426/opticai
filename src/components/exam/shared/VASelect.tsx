import React, { useRef, useEffect, useState, memo, useCallback } from "react"
import { UI_CONFIG } from "@/config/ui-config"
import { cn } from "@/utils/tailwind"
import { VA_METER_VALUES, VA_DECIMAL_VALUES } from "../data/exam-constants"
import { useUser } from "@/contexts/UserContext"
import { inputSyncManager } from "./OptimizedInputs"
import { flushSync } from 'react-dom'

interface VASelectProps {
  value: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
}


const VA_CONVERSION_MAP: Record<string, string> = {
  // Meter to Decimal
  "6/6": "1.0",
  "6/7.5": "0.8",
  "6/9": "0.7",
  "6/10": "0.6",
  "6/12": "0.5",
  "6/15": "0.4",
  "6/18": "0.3",
  "6/24": "0.25",
  "6/60": "0.1",
  "6/120": "0.05",
  // Decimal to Meter
  "1.0": "6/6",
  "0.8": "6/7.5",
  "0.7": "6/9",
  "0.6": "6/10",
  "0.5": "6/12",
  "0.4": "6/15",
  "0.3": "6/18",
  "0.2": "6/30",
  "0.1": "6/60",
};

export function convertVA(value: string, targetMode: "meter" | "decimal"): string {
  if (!value) return "";
  const modifierMatch = value.match(/([\+\-]\d+)$/);
  const modifier = modifierMatch ? modifierMatch[1] : "";
  const base = modifier ? value.replace(modifier, "") : value;

  const isMeter = base.startsWith("6/");
  if (targetMode === "meter" && isMeter) return value;
  if (targetMode === "decimal" && !isMeter) return value;

  if (targetMode === "decimal") {
    if (VA_CONVERSION_MAP[base]) return VA_CONVERSION_MAP[base] + modifier;
    const denom = parseFloat(base.replace("6/", ""));
    if (isNaN(denom)) return value;
    return (6 / denom).toFixed(1) + modifier;
  } else {
    if (VA_CONVERSION_MAP[base]) return VA_CONVERSION_MAP[base] + modifier;
    const dec = parseFloat(base);
    if (isNaN(dec)) return value;
    const denom = (6 / dec).toFixed(1).replace(".0", "");
    return `6/${denom}${modifier}`;
  }
}

export const VASelect = memo(function VASelect({
  value,
  onChange,
  disabled = false,
  className = ""
}: VASelectProps) {
  const { currentUser } = useUser()
  const mode = (currentUser?.va_format as "meter" | "decimal") || "meter"

  const inputRef = useRef<HTMLInputElement>(null)
  const lastSentValueRef = useRef(value)
  const [modifier, setModifier] = useState("")
  const modifierRef = useRef("")

  const getComponents = useCallback((val: string) => {
    const translated = convertVA(val, mode) || ""
    const modMatch = translated.match(/([\+\-]\d+)$/)
    const mod = modMatch ? modMatch[1] : ""
    const baseStr = mod ? translated.replace(mod, "") : translated
    const disp = mode === "meter" ? baseStr.replace("6/", "") : baseStr
    return { disp, mod, baseStr }
  }, [mode])

  // Sync internal state with external value and mode changes
  useEffect(() => {
    const { disp, mod } = getComponents(value)
    if (inputRef.current && inputRef.current.value !== disp) {
      inputRef.current.value = disp
    }
    setModifier(mod)
    modifierRef.current = mod
    lastSentValueRef.current = value
  }, [value, mode, getComponents])

  const handleSync = useCallback((forceVal?: string, forceMod?: string) => {
    if (!inputRef.current) return
    const currentDisp = forceVal !== undefined ? forceVal : inputRef.current.value.trim()
    const currentMod = forceMod !== undefined ? forceMod : modifierRef.current

    if (!currentDisp) {
      if (lastSentValueRef.current !== "") {
        if (typeof onChange === 'function') {
          flushSync(() => {
            onChange("")
          });
        }
        lastSentValueRef.current = ""
      }
      inputSyncManager.unregister(handleSync)
      return
    }

    let base = currentDisp.replace(/[\+\-]\d+$/, "")
    if (mode === "meter" && !base.startsWith("6/")) {
      base = `6/${base}`
    }

    const newVal = `${base}${currentMod}`
    if (newVal !== lastSentValueRef.current) {
      if (typeof onChange === 'function') {
        flushSync(() => {
          onChange(newVal)
        });
      }
      lastSentValueRef.current = newVal
    }
    inputSyncManager.unregister(handleSync)
  }, [mode, onChange])

  useEffect(() => {
    if (disabled) return
    let timer: NodeJS.Timeout

    const onInput = () => {
      inputSyncManager.register(handleSync)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => handleSync(), 1000)
    }

    const onBlur = () => {
      if (timer) clearTimeout(timer)

      const element = inputRef.current
      if (element && (!element.value || isNaN(parseFloat(element.value)))) {
        const defaultValue = mode === 'meter' ? '6' : '1.0'
        const base = mode === 'meter' ? `6/${defaultValue}` : defaultValue
        const newVal = `${base}${modifierRef.current}`
        if (newVal !== lastSentValueRef.current) {
          if (typeof onChange === 'function') {
            flushSync(() => {
              onChange(newVal)
            });
          }
          lastSentValueRef.current = newVal
        }
        inputSyncManager.unregister(handleSync)
      } else {
        handleSync()
      }
    }

    const element = inputRef.current
    if (element) {
      element.addEventListener('input', onInput)
      element.addEventListener('blur', onBlur)
    }

    return () => {
      if (element) {
        element.removeEventListener('input', onInput)
        element.removeEventListener('blur', onBlur)
      }
      if (timer) clearTimeout(timer)
    }
  }, [mode, onChange, handleSync, disabled])

  const handleModifierClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (disabled) return

    const modifiersList = ["", "+1", "+2", "+3", "-1", "-2", "-3"]
    const currentIndex = modifiersList.indexOf(modifierRef.current)
    const nextIndex = (currentIndex + 1) % modifiersList.length
    const nextModifier = modifiersList[nextIndex]

    setModifier(nextModifier)
    modifierRef.current = nextModifier
    handleSync(undefined, nextModifier)
  }

  const stepBase = (direction: 'up' | 'down') => {
    if (disabled || !inputRef.current) return

    const currentDispValue = inputRef.current.value
    const currentNum = parseFloat(currentDispValue)
    const options = mode === "meter" ? VA_METER_VALUES : VA_DECIMAL_VALUES

    if (isNaN(currentNum)) {
      const defaultValue = mode === 'meter' ? '6' : '1.0'
      const base = mode === 'meter' ? `6/${defaultValue}` : defaultValue
      const newVal = `${base}${modifierRef.current}`
      if (typeof onChange === 'function') {
        onChange(newVal)
      }
      return
    }

    const numericOptions = options.map(opt => parseFloat(opt.replace("6/", "")))

    let nextVal: number | undefined
    if (mode === "meter") {
      if (direction === 'up') {
        nextVal = numericOptions.filter(v => v < currentNum).sort((a, b) => b - a)[0]
      } else {
        nextVal = numericOptions.filter(v => v > currentNum).sort((a, b) => a - b)[0]
      }
    } else {
      if (direction === 'up') {
        nextVal = numericOptions.filter(v => v > currentNum).sort((a, b) => a - b)[0]
      } else {
        nextVal = numericOptions.filter(v => v < currentNum).sort((a, b) => b - a)[0]
      }
    }

    if (nextVal !== undefined) {
      const targetString = options.find(opt => parseFloat(opt.replace("6/", "")) === nextVal)
      if (targetString) {
        const newVal = `${targetString}${modifierRef.current}`
        if (inputRef.current) {
          inputRef.current.value = mode === "meter" ? targetString.replace("6/", "") : targetString
        }
        if (typeof onChange === 'function') {
          onChange(newVal)
        }
        lastSentValueRef.current = newVal
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      stepBase('up')
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      stepBase('down')
    }
  }

  let noBorder = false;
  if (disabled && UI_CONFIG.noBorderOnDisabled) {
    noBorder = true;
  }

  const { disp: currentDisp } = getComponents(value)

  return (
    <div
      className={cn(
        "flex items-center w-full group h-8 border border-input rounded-md transition-shadow relative bg-background min-w-0",
        !disabled ? "bg-white" : "bg-accent/50",
        noBorder ? "border-none" : "",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[1px]",
        className
      )}
    >
      {mode === "meter" && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground select-none font-medium pointer-events-none z-10">
          6/
        </span>
      )}

      <input
        ref={inputRef}
        defaultValue={currentDisp}
        onKeyDown={handleKeyDown}
        onFocus={(e) => e.target.select()}
        disabled={disabled}
        autoComplete="off"
        size={1}
        className={cn(
          "flex-1 bg-transparent border-none focus:outline-none text-sm h-full min-w-0 disabled:cursor-default",
          mode === "meter" ? "pl-5" : "pl-1.5",
          "pr-4"
        )}
      />

      <button
        type="button"
        onClick={handleModifierClick}
        disabled={disabled}
        tabIndex={-1}
        className={cn(
          "absolute px-1 right-0 top-0 w-5 h-full text-[10px] font-bold flex items-center justify-center transition-all border-none focus:outline-none z-10",
          modifier ? "text-primary bg-primary/5" : "text-muted-foreground/0 group-hover:text-muted-foreground/30",
          !disabled && "hover:bg-accent/40"
        )}
      >
        {modifier || "±"}
      </button>
    </div>
  )
})
