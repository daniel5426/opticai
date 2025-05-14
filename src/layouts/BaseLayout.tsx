import React from "react";
import DragWindowRegion from "@/components/DragWindowRegion";
import NavigationMenu from "@/components/template/NavigationMenu";
import { ThemeProvider } from "@/components/theme-provider";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <DragWindowRegion title="electron-shadcn" />
        <main className="h-screen pb-20 p-2 bg-sidebar">{children}</main>
      </ThemeProvider>
    </>
  );
}
