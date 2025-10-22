import React from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";

declare global {
  interface Window {
    __APP_ROOT__?: ReturnType<typeof createRoot>;
  }
}

const container = document.getElementById("app");
if (!container) {
  throw new Error("#app container not found");
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


