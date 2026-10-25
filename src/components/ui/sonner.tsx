import React from "react";
import { useTheme } from "@/components/theme-provider";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { useAppLocale } from "@/localization/use-app-locale";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedMode } = useTheme();
  const { direction } = useAppLocale();

  return (
    <Sonner
      theme={resolvedMode}
      className="toaster group"
      dir={direction}
      position={direction === "rtl" ? "bottom-left" : "bottom-right"}
      toastOptions={{
        style: {
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "var(--radius-md)",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
