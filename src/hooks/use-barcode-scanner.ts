import { useSyncExternalStore } from "react";
import { useUser } from "@/contexts/UserContext";

const eventName = "prysm-barcode-preference";
export const barcodePreferenceKey = (userId?: number) => `prysm-barcode-scanner:v1:${userId || 0}`;
const subscribe = (callback: () => void) => {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", callback);
  };
};

export function useBarcodeScanner() {
  const { currentUser } = useUser();
  const key = barcodePreferenceKey(currentUser?.id);
  const enabled = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) === "true"; } catch { return false; }
  }, () => false);
  return {
    enabled,
    setEnabled(value: boolean) {
      localStorage.setItem(key, String(value));
      window.dispatchEvent(new Event(eventName));
    },
  };
}
