import React from "react"
import { Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAppLocale } from "@/localization/use-app-locale"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setTheme } from "@/helpers/theme_helpers"

export function ModeToggle() {
  const { t } = useTranslation()
  const { direction } = useAppLocale()
  const handleSetTheme = (theme: "light" | "dark" | "system") => {
    // The shared owner applies immediately; optional server persistence runs afterwards.
    void setTheme(theme).catch(error => console.error("Error setting theme:", error))
  }

  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"
          className="w-10 h-8 rounded-none text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t("appearanceMode")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleSetTheme("light")}>{t("appearanceLight")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("dark")}>{t("appearanceDark")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("system")}>{t("appearanceSystem")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
