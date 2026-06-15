import { useEffect, useRef } from "react";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";

interface UseKeyboardSaveConfig {
  enabled: boolean;
  isSaving?: boolean;
  canSave?: boolean;
  onSave: () => void | Promise<void>;
}

export function useKeyboardSave({
  enabled,
  isSaving = false,
  canSave = true,
  onSave,
}: UseKeyboardSaveConfig) {
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "s") return;

      event.preventDefault();
      if (event.repeat || !enabled || !canSave || isSaving) return;

      inputSyncManager.flush();
      void onSaveRef.current();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [canSave, enabled, isSaving]);
}
