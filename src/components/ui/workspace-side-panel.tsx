import React, { useEffect, useRef, useState } from 'react';
import { PanelLeftIcon } from 'lucide-react';
import { Card } from './card';
import { Button } from './button';
import { useAppLocale } from '@/localization/use-app-locale';
import { useTranslation } from 'react-i18next';

export const PANEL_DEFAULT_WIDTH = 320;
export const PANEL_MIN_WIDTH = 280;
export const PANEL_MAX_WIDTH = 560;
const clamp = (width: number) => Math.round(Math.min(Math.max(width, PANEL_MIN_WIDTH), Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, window.innerWidth - 360))));
interface Props { open: boolean; onClose: () => void; children: React.ReactNode; storageKey?: string; width?: number; resizing?: boolean; panelRef?: React.RefObject<HTMLDivElement | null>; onResizePointerDown?: React.PointerEventHandler<HTMLDivElement>; onResizeKeyDown?: React.KeyboardEventHandler<HTMLDivElement>; resizeLabel?: string; className?: string }
export function WorkspaceSidePanel({open,onClose,children,storageKey='billing-sidebar-width',width:controlledWidth,resizing,panelRef,onResizePointerDown,onResizeKeyDown,resizeLabel,className=''}: Props) {
 const {direction}=useAppLocale(); const {t}=useTranslation();
 const ref=useRef<HTMLDivElement>(null); const target=panelRef || ref;
 const [width,setWidth]=useState(()=>{try{return clamp(Number(localStorage.getItem(storageKey))||PANEL_DEFAULT_WIDTH)}catch{return PANEL_DEFAULT_WIDTH}});
 const [dragging,setDragging]=useState(false); const widthRef=useRef(width);
 const update=(next:number)=>{widthRef.current=clamp(next);setWidth(widthRef.current)};
 useEffect(()=>{const constrain=()=>update(widthRef.current);window.addEventListener('resize',constrain);return()=>window.removeEventListener('resize',constrain)},[]);
 useEffect(()=>{if(!dragging)return;const cursor=document.body.style.cursor,selection=document.body.style.userSelect;document.body.style.cursor='col-resize';document.body.style.userSelect='none';const move=(event:PointerEvent)=>{const bounds=target.current?.getBoundingClientRect();if(bounds)update(direction==='rtl'?event.clientX-bounds.left:bounds.right-event.clientX)};const finish=()=>{setDragging(false);try{localStorage.setItem(storageKey,String(widthRef.current))}catch{}};window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);return()=>{document.body.style.cursor=cursor;document.body.style.userSelect=selection;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish)}},[dragging,direction,storageKey,target]);
 const resolvedWidth=controlledWidth ?? width;
 const keyboard: React.KeyboardEventHandler<HTMLDivElement>=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const increase=direction==='rtl'?event.key==='ArrowRight':event.key==='ArrowLeft';update(widthRef.current+(increase?1:-1)*(event.shiftKey?40:16));try{localStorage.setItem(storageKey,String(widthRef.current))}catch{}};
 return <Card ref={target} inert={!open} aria-hidden={!open} className={`relative max-sm:absolute max-sm:inset-y-0 max-sm:end-0 max-sm:z-30 max-sm:shadow-lg my-5 h-[calc(100%-2.5rem)] min-h-0 shrink-0 overflow-hidden bg-card py-0 gap-0 ${open?'me-6':'me-0'} ${dragging||resizing?'':'transition-[width,margin] duration-300 ease-in-out'} ${className}`} style={{width:open?resolvedWidth:0}}>
 {open&&<div role="separator" aria-label={resizeLabel||t('orderGroupResizeBilling')} aria-orientation="vertical" aria-valuemin={PANEL_MIN_WIDTH} aria-valuemax={PANEL_MAX_WIDTH} aria-valuenow={resolvedWidth} tabIndex={0} onPointerDown={onResizePointerDown||((event)=>{event.preventDefault();setDragging(true)})} onKeyDown={onResizeKeyDown||keyboard} className={`absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none focus-visible:bg-primary/20 ${direction==='rtl'?'right-0':'left-0'}`}/>}
 <div className="flex h-full min-w-0 flex-col" dir={direction}>
 <div className="absolute top-2 start-2 z-10"><Button variant="ghost" size="sm" onClick={onClose} aria-label={t('orderGroupClosePanel')} className="h-8 w-8 p-0"><PanelLeftIcon className="h-4 w-4"/></Button></div>
 {children}</div></Card>;
}
