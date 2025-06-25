import React, { createContext, useContext, useEffect, useState } from "react"
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize theme on startup - sync with Electron's native theme
  useEffect(() => {
    const initializeTheme = async () => {
      const themeMode = (window as any).themeMode
      if (!themeMode) {
        setIsInitialized(true)
        return
      }

      try {
        const savedTheme = localStorage.getItem(storageKey) as Theme
        
        if (savedTheme) {
          // If we have a saved theme, apply it to both React and Electron
          switch (savedTheme) {
            case "dark":
              await themeMode.dark()
              break
            case "light":
              await themeMode.light()
              break
            case "system":
              await themeMode.system()
              break
          }
          setTheme(savedTheme)
        } else {
          // No saved theme - determine current state from Electron and save it
          const currentThemeSource = await themeMode.current()
          const determinedTheme = currentThemeSource === "system" ? "system" : currentThemeSource
          localStorage.setItem(storageKey, determinedTheme)
          setTheme(determinedTheme)
        }
      } catch (error) {
        console.error('Error initializing theme:', error)
      } finally {
        setIsInitialized(true)
      }
    }

    initializeTheme()
  }, [storageKey])

  useEffect(() => {
    if (!isInitialized) return

    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    let actualTheme = theme
    if (theme === "system") {
      actualTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
    }

    root.classList.add(actualTheme)
    
    if (actualTheme === "dark") {
      root.style.removeProperty('--primary')
      root.style.removeProperty('--secondary')
    } else {
      applyThemeColorsFromSettings()
    }
  }, [theme, isInitialized])

  // Sync with Electron native theme when theme changes
  useEffect(() => {
    if (!isInitialized) return

    const syncElectronTheme = async () => {
      const themeMode = (window as any).themeMode
      if (!themeMode) return

      try {
        switch (theme) {
          case "dark":
            await themeMode.dark()
            break
          case "light":
            await themeMode.light()
            break
          case "system":
            await themeMode.system()
            break
        }
      } catch (error) {
        console.error('Error syncing theme with Electron:', error)
      }
    }

    syncElectronTheme()
  }, [theme, isInitialized])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
