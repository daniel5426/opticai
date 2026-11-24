import React from "react";
import { createPortal } from "react-dom";
import { Ban, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ExamCardDropFit } from "@/pages/exam-detail/utils";

/** A still copy of a rendered card, without the editor's own controls. */
function copyCard(card: HTMLElement) {
  const copy = card.cloneNode(true) as HTMLElement;
  Array.from(copy.children).forEach((child) => {
    if (child.matches("button, [data-resize-handle]")) child.remove();
  });
  // Cloning copies attributes, not what is shown in the fields.
  const fields = copy.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  const sources = Array.from(card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"));
  fields.forEach((field, index) => { field.value = sources[index]?.value ?? ""; });
  [copy, ...Array.from(copy.querySelectorAll("[id], [name]"))].forEach((element) => {
    element.removeAttribute("id");
    element.removeAttribute("name");
  });
  copy.removeAttribute("data-grid-card");
  copy.className = "h-full";
  copy.removeAttribute("style");
  return copy;
}

interface ExamCardDragGhostProps {
  card: HTMLElement;
  /** Where in the card it was grabbed. */
  grab: { x: number; y: number };
  /** The pointer, read every frame so the page does not render on each move. */
  pointer: React.RefObject<{ x: number; y: number } | null>;
  fit: ExamCardDropFit;
}

/** The dragged card, translucent under the pointer, saying whether it fits where it is held. */
export function ExamCardDragGhost({ card, grab, pointer, fit }: ExamCardDragGhostProps) {
  const { t, i18n } = useTranslation();
  const frame = React.useRef<HTMLDivElement>(null);
  const content = React.useRef<HTMLDivElement>(null);
  const size = React.useRef(card.getBoundingClientRect());

  React.useLayoutEffect(() => {
    content.current?.replaceChildren(copyCard(card));
  }, [card]);

  React.useLayoutEffect(() => {
    let request = 0;
    const follow = () => {
      if (frame.current && pointer.current) {
        frame.current.style.transform = `translate3d(${pointer.current.x - grab.x}px, ${pointer.current.y - grab.y}px, 0)`;
      }
      request = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(request);
  }, [grab, pointer]);

  const fits = fit === "fits";
  return createPortal(
    <div ref={frame} data-drag-ghost={fit} className="pointer-events-none fixed top-0 left-0 z-[1000]" style={{ width: size.current.width, height: size.current.height }}>
      {/* The lane attribute gives the copy the cards' row heights. */}
      <div ref={content} data-exam-lane dir="ltr" aria-hidden="true" inert
        className={cn("h-full rounded-xl opacity-70 shadow-xl ring-2", fits ? "ring-primary" : "ring-destructive")} />
      {!fits && <div className="bg-destructive/10 absolute inset-0 rounded-xl" />}
      <div role="status" dir={i18n.dir()} className={cn(
        "absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white shadow-md",
        fits ? "bg-primary" : "bg-destructive",
      )}>
        {fits ? <Check className="size-3.5" /> : <Ban className="size-3.5" />}
        {t(fits ? "examPreview.dropFits" : fit === "row-full" ? "examPreview.dropRowFull" : "examPreview.dropBlocked")}
      </div>
    </div>,
    document.body,
  );
}
