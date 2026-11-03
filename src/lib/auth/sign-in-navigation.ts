import { localizeHref } from '@/localization/locale';

/** Finish an expired web session outside the mounted protected React tree. */
export function replaceBrowserSignInRoute(path: '/user-selection' | '/control-center'): boolean {
  if (typeof window === 'undefined' || window.location.protocol === 'file:' || window.electronAPI) return false;
  const target = localizeHref(path);
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== target) {
    window.location.replace(target);
  }
  return true;
}
