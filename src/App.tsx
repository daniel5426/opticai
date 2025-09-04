import React, { useEffect, Suspense, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { syncThemeWithLocal } from "./helpers/theme_helpers";
import { useTranslation } from "react-i18next";
import "./localization/i18n";
import { updateAppLanguage } from "./helpers/language_helpers";
import { router } from "./routes/router";
import { RouterProvider } from "@tanstack/react-router";
import { UserProvider } from "./contexts/UserContext";
import { RenderGate } from "./components/RenderGate";

// Simple error boundary component
class ErrorBoundary extends React.Component<{ children: ReactNode }> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: unknown, info: unknown) {
    console.error("App error:", error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <p>The application encountered an error. Please try refreshing.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: "8px 16px", marginTop: "16px", cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading component
const Loading = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
    Loading...
  </div>
);

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Theme is already applied in preboot, just sync state
    syncThemeWithLocal();
    updateAppLanguage(i18n);
  }, [i18n]);

  return (
    <RenderGate>
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <UserProvider>
            <RouterProvider router={router} />
          </UserProvider>
        </Suspense>
      </ErrorBoundary>
    </RenderGate>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

