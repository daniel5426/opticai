import { useEffect, useState } from 'react';

/** Refresh open catalog pickers after a reviewed supply change without touching order drafts. */
export function useSupplyRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('supply-applied', refresh);
    return () => window.removeEventListener('supply-applied', refresh);
  }, []);
  return revision;
}
