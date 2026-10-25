import { CanvasGradientEditor } from "@/components/canvas-gradient-editor";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider";
import { setTheme } from "@/helpers/theme_helpers";
import { APPEARANCE_STYLES, COLOR_THEMES, isAppearanceStyle, isColorTheme, isThemeMode } from "@/lib/appearance";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

/** Development gallery shortcuts; application controls live in Settings. */
export function AppearanceMenu({ persistMode = true }: { persistMode?: boolean }) {
  const { t } = useTranslation();
  const { style, mode, palette, canvasElevation, setTheme: setLocalMode, setStyle, setPalette, setCanvasElevation, previewPalette } = useTheme();
  useEffect(() => () => previewPalette(null), [previewPalette]);
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>{t("appearanceStyle")}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={style} onValueChange={value => { if (isAppearanceStyle(value)) setStyle(value); }}>
            {Object.entries(APPEARANCE_STYLES).map(([value, definition]) => (
              <DropdownMenuRadioItem key={value} value={value}>{t(definition.labelKey)}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuCheckboxItem
        checked={canvasElevation === "lift"}
        onCheckedChange={checked => setCanvasElevation(checked ? "lift" : "flat")}
      >
        {t("appearanceRaisedSurfaces")}
      </DropdownMenuCheckboxItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>{t("appearanceMode")}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={mode} onValueChange={value => { if (isThemeMode(value)) { if (persistMode) void setTheme(value); else setLocalMode(value); } }}>
            <DropdownMenuRadioItem value="light">{t("appearanceLight")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">{t("appearanceDark")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">{t("appearanceSystem")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <CanvasGradientEditor />
      {APPEARANCE_STYLES[style].supportsPalettes ? (
        <DropdownMenuSub onOpenChange={open => { if (!open) previewPalette(null); }}>
          <DropdownMenuSubTrigger>{t("colorAppearance")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent onPointerLeave={() => previewPalette(null)}>
            <DropdownMenuRadioGroup value={palette} onValueChange={value => { if (isColorTheme(value)) setPalette(value); }}>
              {Object.entries(COLOR_THEMES).map(([value, theme]) => (
                <DropdownMenuRadioItem key={value} value={value}
                  onPointerEnter={() => { if (isColorTheme(value)) previewPalette(value); }}
                  onFocus={() => { if (isColorTheme(value)) previewPalette(value); }}>
                  {t(theme.labelKey)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
    </>
  );
}
