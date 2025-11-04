"use client"

import React, { createContext, useCallback, useContext, useMemo, useRef } from "react"

type GuardHandler = (next: () => void) => void

interface NavigationGuardContextValue {
  registerGuard: (guard: GuardHandler | null) => void
  runGuard: (next: () => void) => void
  hasGuard: () => boolean
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null)

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<GuardHandler | null>(null)

  const registerGuard = useCallback((guard: GuardHandler | null) => {
    guardRef.current = guard
  }, [])

  const runGuard = useCallback((next: () => void) => {
    const guard = guardRef.current
    if (guard) {
      guard(next)
      return
    }
    next()
  }, [])

  const hasGuard = useCallback(() => guardRef.current !== null, [])

  const value = useMemo(
    () => ({ registerGuard, runGuard, hasGuard }),
    [registerGuard, runGuard, hasGuard],
  )

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
    </NavigationGuardContext.Provider>
  )
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext)
  if (!ctx) {
    throw new Error("useNavigationGuard must be used within NavigationGuardProvider")
  }
  return ctx
}


