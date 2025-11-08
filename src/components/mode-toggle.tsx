import React from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setTheme } from "@/helpers/theme_helpers"
import { useUser } from "@/contexts/UserContext"
import { useTheme } from "@/components/theme-provider"

export function ModeToggle() {
  // Safely access user context (may not be available on some routes)
  let currentUser: any | null = null
  try {
    const userContext = useUser()
    currentUser = userContext.currentUser
  } catch (error) {
    // UserContext not available, theme will work without user ID
    console.log('[ModeToggle] UserContext not available')
  }

  // Get ThemeProvider's setTheme to update React state immediately
  const { setTheme: setThemeProviderState } = useTheme()

  const handleSetTheme = (theme: "light" | "dark" | "system") => {
    // STEP 1: Update ThemeProvider state IMMEDIATELY
    // This triggers ThemeProvider's useEffect which:
    // - Updates the DOM class (.dark) instantly
    // - Calls applyCompanyThemeColors() immediately
    // - Sidebar CSS variables update instantly
    setThemeProviderState(theme)

    // STEP 2: Do async work in background (don't await - fire and forget)
    // This handles:
    // - Electron IPC theme sync
    // - Database save
    // But doesn't block the UI update
    setTheme(theme, currentUser?.id, true).catch((error) => {
      console.error('Error setting theme:', error)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="w-10 h-8 rounded-none text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleSetTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
