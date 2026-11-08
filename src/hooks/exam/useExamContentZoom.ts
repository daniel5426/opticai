import { useLayoutEffect, useState, type RefObject } from "react";

// The cards are sized for a laptop-width exam area; wider screens scale them up instead of stretching them thin.
export const EXAM_CONTENT_BASE_WIDTH = 1400;
export const EXAM_CONTENT_MAX_ZOOM = 1.6;

export const examContentZoom = (width: number) =>
  Math.min(EXAM_CONTENT_MAX_ZOOM, Math.max(1, Math.round((width / EXAM_CONTENT_BASE_WIDTH) * 100) / 100));

/** Zoom for the exam's cards, following the width of `ref`'s element. */
export function useExamContentZoom(ref: RefObject<HTMLElement | null>) {
  const [zoom, setZoom] = useState(1);
  const [element, setElement] = useState<HTMLElement | null>(null);
  // The exam area mounts only once the exam has loaded.
  useLayoutEffect(() => {
    if (ref.current !== element) setElement(ref.current);
  });
  useLayoutEffect(() => {
    if (!element) return;
    const update = () => setZoom(examContentZoom(element.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return zoom;
}
