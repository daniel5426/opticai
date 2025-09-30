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

window.__APP_ROOT__.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const hot = (import.meta as any).hot;
if (hot) {
  hot.dispose(() => {
    window.__APP_ROOT__?.unmount();
    window.__APP_ROOT__ = undefined;
  });
}


