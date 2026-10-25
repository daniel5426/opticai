import React, { useEffect, useId, useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider";
import { useAppLocale } from "@/localization/use-app-locale";
import { COLOR_THEMES } from "@/lib/appearance";
import { canvasGradientVariables, DEFAULT_CANVAS_GRADIENT, type CanvasGradient } from "@/lib/canvas-gradient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const swatches = ["#ffffff", "#cbd5e1", "#2389dc", "#67c8f0", "#14b8a6", "#86c99b", "#c4b5fd", "#a78bfa", "#f0abcb", "#fda4af", "#fdba74", "#fde68a"];

function ColorPalette({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const valid = /^#[0-9a-f]{6}$/i.test(hex);
  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-sm font-medium">{label}</legend>
    <div className="grid grid-cols-6 gap-2">
      {swatches.map(color => <button key={color} type="button"
        className="flex h-9 w-full items-center justify-center rounded-md border border-border/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={{ backgroundColor: color }} aria-label={t("gradientChooseColor", { color })}
        aria-pressed={value.toLowerCase() === color} onClick={() => onChange(color)}>
        {value.toLowerCase() === color ? <Check className="size-4 text-slate-900" aria-hidden="true" /> : null}
      </button>)}
    </div>
    <div className="flex items-center gap-2">
      <label className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border" style={{ backgroundColor: value }}>
        <span className="sr-only">{t("gradientCustomColor", { label })}</span>
        <input type="color" value={value} onChange={event => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="sr-only">{t("gradientHex", { label })}</Label>
        <Input id={id} value={hex} dir="ltr" maxLength={7} spellCheck={false} aria-invalid={!valid}
          onBlur={() => { if (!valid) setHex(value); }}
          onChange={event => { setHex(event.target.value); if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value); }} />
      </div>
    </div>
  </fieldset>;
}

function GradientRange({ label, value, max, unit, onChange }: { label: string; value: number; max: number; unit: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3"><Label htmlFor={id}>{label}</Label><output htmlFor={id} dir="ltr" className="text-muted-foreground text-xs tabular-nums">{value}{unit}</output></div>
    <input id={id} type="range" min={0} max={max} step={1} value={value} dir="ltr"
      className="h-6 w-full cursor-pointer accent-primary" onChange={event => onChange(Number(event.target.value))} />
  </div>;
}

/** Drafts preview live; Save commits and leaving the editor discards the preview. */
export function CanvasGradientEditor({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const { canvasGradient, palette, setCanvasGradient, previewCanvasGradient } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CanvasGradient | null>(canvasGradient);
  const backgroundTypeId = useId();
  const defaults = { ...DEFAULT_CANVAS_GRADIENT, colorOne: palette === "bloom" ? DEFAULT_CANVAS_GRADIENT.colorOne : COLOR_THEMES[palette].primary };
  const value = draft ?? defaults;
  useEffect(() => () => previewCanvasGradient(undefined), [previewCanvasGradient]);
  useEffect(() => setDraft(canvasGradient), [canvasGradient]);
  const change = (patch: Partial<CanvasGradient>) => {
    const next = { ...value, ...patch };
    setDraft(next);
    previewCanvasGradient(next);
  };
  const close = () => { previewCanvasGradient(undefined); setOpen(false); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(canvasGradient);
  const controls = <div className="space-y-5" data-testid="canvas-background-controls">
    <div className="space-y-2">
      <Label htmlFor={backgroundTypeId}>{t("backgroundType")}</Label>
      <Select value={draft ? draft.type ?? "gradient" : "default"} dir={direction} clearable={false}
        onValueChange={type => {
          if (type === "default") { setDraft(null); previewCanvasGradient(null); }
          else if (type === "solid" || type === "gradient") change({ type, ...(!draft ? { strength: 100, grain: 0 } : {}) });
        }}>
        <SelectTrigger id={backgroundTypeId} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="default">{t("backgroundDefault")}</SelectItem><SelectItem value="solid">{t("backgroundSolid")}</SelectItem><SelectItem value="gradient">{t("backgroundGradient")}</SelectItem></SelectContent>
      </Select>
    </div>
    <div aria-hidden="true" className={`${draft ? "canvas-gradient-preview" : "bg-canvas"} flex h-28 items-center justify-center overflow-hidden rounded-lg border`}
      style={draft ? canvasGradientVariables(draft) as React.CSSProperties : undefined}>
      <div className="bg-card text-card-foreground rounded-md border px-4 py-2 text-sm shadow-sm">{t("gradientPreview")}</div>
    </div>
    {draft ? <>
      <div className={`grid gap-5 ${draft.type === "solid" ? "" : "sm:grid-cols-2"}`}>
        <ColorPalette label={t(draft.type === "solid" ? "backgroundColor" : "gradientColorOne")} value={value.colorOne} onChange={colorOne => change({ colorOne })} />
        {draft.type !== "solid" ? <ColorPalette label={t("gradientColorTwo")} value={value.colorTwo} onChange={colorTwo => change({ colorTwo })} /> : null}
      </div>
      {draft.type !== "solid" ? <div className="grid gap-4 sm:grid-cols-3">
        <GradientRange label={t("gradientDirection")} value={value.angle} max={360} unit="°" onChange={angle => change({ angle })} />
        <GradientRange label={t("gradientStrength")} value={value.strength} max={100} unit="%" onChange={strength => change({ strength })} />
        <GradientRange label={t("gradientGrain")} value={value.grain} max={100} unit="%" onChange={grain => change({ grain })} />
      </div> : null}
    </> : null}
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="ghost" className="me-auto" disabled={!draft} onClick={() => { setDraft(null); previewCanvasGradient(null); }}>{t("gradientReset")}</Button>
      <Button variant="outline" disabled={inline && !dirty} onClick={() => { setDraft(canvasGradient); if (inline) previewCanvasGradient(undefined); else close(); }}>{t("appearanceCancel")}</Button>
      <Button disabled={inline && !dirty} onClick={() => { setCanvasGradient(draft); setOpen(false); }}>{t("appearanceSave")}</Button>
    </div>
  </div>;

  if (inline) return controls;

  return <>
    <DropdownMenuItem onSelect={event => {
      event.preventDefault();
      setDraft(canvasGradient ? { ...canvasGradient } : null);
      setOpen(true);
    }}><SlidersHorizontal aria-hidden="true" />{t("gradientEditor")}</DropdownMenuItem>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent dir={direction} className="max-h-[85svh] overflow-y-auto sm:max-w-[560px]" data-testid="canvas-gradient-editor">
        <DialogHeader><DialogTitle>{t("gradientEditor")}</DialogTitle><DialogDescription>{t("gradientDescription")}</DialogDescription></DialogHeader>
        {controls}
      </DialogContent>
    </Dialog>
  </>;
}
