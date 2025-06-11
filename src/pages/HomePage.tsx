import React, { Suspense, lazy, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";

// Lazy load the DataTable component
const DataTable = lazy(() => import("@/components/data-table").then(module => ({
  default: module.DataTable
})));

// Simple error boundary component for DataTable
class DataTableErrorBoundary extends React.Component<{ children: ReactNode }> {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: unknown, info: unknown) {
    console.error("DataTable error:", error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <h3>Failed to load data table</h3>
          <p>Please try refreshing the page</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function HomePage() {
  const { t } = useTranslation();

  return (  
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset>
        <SiteHeader title="דף הבית" />
        <div className="flex flex-col flex-1">
          <div className="@container/main flex flex-col gap-2">
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
