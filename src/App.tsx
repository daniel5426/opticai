import React, { useEffect, Suspense, ReactNode } from "react";
import { syncThemeWithLocal, applyUserThemeFromStorage } from "./helpers/theme_helpers";
import { useTranslation } from "react-i18next";
import "./localization/i18n";
import { updateAppLanguage } from "./helpers/language_helpers";
import { router } from "@/routes/router";
import { RouterProvider } from "@tanstack/react-router";
import { UserProvider } from "./contexts/UserContext";

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
    // Apply user's theme colors immediately from localStorage to prevent flash
    applyUserThemeFromStorage();
    // Then sync theme mode settings
    syncThemeWithLocal();
    updateAppLanguage(i18n);

    // Listen for Google OAuth codes from other tabs (system browser redirect)
    const channel = new BroadcastChannel('google-oauth-channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'GOOGLE_AUTH_CODE' && event.data.code) {
        console.log('[App] Received Google OAuth code via BroadcastChannel');
        if (window.electronAPI && (window.electronAPI as any).googleOAuthCodeReceived) {
          (window.electronAPI as any).googleOAuthCodeReceived(event.data.code);
        }
      }
    };

    return () => {
      channel.close();
    };
  }, [i18n]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <RouterProvider router={router} />
      </Suspense>
    </ErrorBoundary>
  );
}

// Rendering is handled in renderer.ts
