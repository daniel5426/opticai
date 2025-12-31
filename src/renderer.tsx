import React from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { googleWebAPI } from "@/lib/google/google-web-api";

declare global {
  interface Window {
    __APP_ROOT__?: ReturnType<typeof createRoot>;
  }
}

const container = document.getElementById("app");
if (!container) {
  throw new Error("#app container not found");
}

// Check if we're in a regular browser environment (no Electron)
if (typeof window !== 'undefined' && !window.electronAPI) {
  console.log('[Renderer] Web mode detected: Initializing web-compatible electronAPI');
  (window as any).electronAPI = {
    // Spread the Google Web API methods
    ...googleWebAPI,
    
    // Add mocks for other Electron-only APIs used in the app to prevent crashes
    emailTestConnection: async () => {
      console.warn('emailTestConnection is not implemented on web');
      return false;
    },
    // We can add more mocks here as needed
  };
}

if (!window.__APP_ROOT__) {
  window.__APP_ROOT__ = createRoot(container);
}

// Only use StrictMode in development for better production performance
const isDevelopment = process.env.NODE_ENV === "development";

window.__APP_ROOT__.render(
  isDevelopment ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
);

const hot = (import.meta as any).hot;
if (hot) {
  hot.dispose(() => {
    window.__APP_ROOT__?.unmount();
    window.__APP_ROOT__ = undefined;
  });
}


