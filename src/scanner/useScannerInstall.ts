import { useCallback, useEffect, useRef, useState } from 'react';

type InstallChoice = { outcome: 'accepted' | 'dismissed' };
type InstallEvent = Event & {
  prompt: () => Promise<InstallChoice | void>;
  userChoice?: Promise<InstallChoice>;
};
const dismissalKey = 'scanner-install-dismissed-v1';
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function useScannerInstall() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const mobile = ios || /Android/.test(navigator.userAgent);
  const [installed, setInstalled] = useState(standalone);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [offer, setOffer] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(dismissalKey) === '1'; } catch { /* Private browsing can block storage. */ }
    if (mobile && !standalone() && !dismissed) setOffer(true);
    const beforeInstall = (event: Event) => {
      if (standalone()) return;
      event.preventDefault();
      deferred.current = event as InstallEvent;
      setNativeAvailable(true);
    };
    const onInstalled = () => {
      deferred.current = null;
      setNativeAvailable(false);
      setInstalled(true);
      setOffer(false);
    };
    const display = window.matchMedia?.('(display-mode: standalone)');
    const onDisplay = () => { if (standalone()) onInstalled(); };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    display?.addEventListener('change', onDisplay);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      display?.removeEventListener('change', onDisplay);
    };
  }, [mobile]);

  const dismiss = useCallback(() => {
    setOffer(false);
    try { localStorage.setItem(dismissalKey, '1'); } catch { /* Dismiss for this visit if storage is unavailable. */ }
  }, []);
  const install = useCallback(async () => {
    const event = deferred.current;
    if (!event) return false;
    deferred.current = null;
    setNativeAvailable(false);
    try {
      // Call synchronously from the user's click to preserve browser activation.
      const result = await event.prompt();
      const choice = result || await event.userChoice;
      dismiss();
      return choice?.outcome === 'accepted';
    } catch {
      // The drawer falls back to the browser's manual installation steps.
      return false;
    }
  }, [dismiss]);
  return { installed, ios, nativeAvailable, offer, install, dismiss };
}
