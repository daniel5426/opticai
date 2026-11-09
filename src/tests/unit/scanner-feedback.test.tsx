import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScanLatch, resolveScanResponse, scanFeedback } from '@/scanner/scan-feedback';
import { ScannerScreen } from '@/scanner/ScannerScreen';
import translations from '@/localization/scanner.json';
import type { ScanCommand } from '@/lib/scanner';
afterEach(cleanup);
const scan:ScanCommand={id:'scan',request_id:'request',barcode:'2900330000252',variant_id:25,source:'phone',status:'pending',created_at:0,lease:'lease',context:'context',summary:{name:'Fernando FC-9146F',category:'frame'}};
test('does not lose the next barcode when it is first seen during delivery',()=>{
 const gate=new ScanLatch();expect(gate.observe('A',false,0)).toBe(true);
 expect(gate.observe('B',true,100)).toBe(false);
 expect(gate.observe('B',true,200)).toBe(false);
 expect(gate.observe('B',false,300)).toBe(true);
 expect(gate.observe('B',false,400)).toBe(false);
});
test('counts a held barcode once and requires it to leave view before rearming',()=>{
 const gate=new ScanLatch();expect(gate.observe('A',false,0)).toBe(true);
 expect(gate.observe('A',true,9000)).toBe(false);
 expect(gate.observe('A',false,10000)).toBe(false);
 gate.observe(undefined,false,10100,true);
 expect(gate.observe('A',false,10200)).toBe(false);
 gate.observe(undefined,false,10600,true);
 expect(gate.observe('A',false,10700)).toBe(true);
});
test('retains confirmation arriving over SSE before the submission response',()=>{
 const confirmed={...scan,status:'applied'};
 expect(resolveScanResponse(scan,confirmed)).toEqual(confirmed);
 expect(resolveScanResponse(scan,{...confirmed,id:'other'})).toEqual(scan);
 expect(scanFeedback(scan,true,'')).toBe('pending');
 expect(scanFeedback(confirmed,false,'')).toBe('confirmed');
 expect(scanFeedback(confirmed,false,'scanner.offline')).toBe('error');
});
test.each(['he','en','fr'] as const)('shows +1 only after the workstation confirms a count in %s',lang=>{
 const t=(key:string)=>(translations[lang] as Record<string,string>)['scanner.'+key]||key;
 const props={t,direction:lang==='he'?'rtl' as const:'ltr' as const,devices:[{id:'pc',name:'Counting PC',online:true,destination:'count'}] as any,selected:'pc',active:true,pending:true,last:scan,error:'',torch:false,torchAvailable:false,video:{current:null},drawerOpen:false,setDrawerOpen:vi.fn(),selectDevice:vi.fn(),refresh:vi.fn(),toggleCamera:vi.fn(),toggleTorch:vi.fn(),pair:vi.fn(async()=>true),send:vi.fn(async()=>{}),takeover:vi.fn()};
 const view=render(<ScannerScreen {...props}/>);
 expect(view.container.querySelector('.camera-surface')).toHaveAttribute('data-feedback','pending');
 expect(screen.queryByText('+1')).toBeNull();
 view.rerender(<ScannerScreen {...props} last={{...scan,status:'awaiting_confirmation'}}/>);
 expect(view.container.querySelector('.camera-surface')).toHaveAttribute('data-feedback','attention');
 expect(screen.queryByText('+1')).toBeNull();
 view.rerender(<ScannerScreen {...props} pending={false} last={{...scan,status:'applied'}}/>);
 expect(view.container.querySelector('.camera-surface')).toHaveAttribute('data-feedback','confirmed');
 expect(screen.getByText('+1')).toBeVisible();
 expect(screen.getByText(scan.summary.name!)).toBeVisible();
 expect(screen.getByLabelText(t('counted'))).toBeVisible();
 view.rerender(<ScannerScreen {...props} pending={false} last={{...scan,status:'rejected'}}/>);
 expect(screen.getByRole('alert')).toBeVisible();
 expect(view.container.querySelector('.camera-surface')).toHaveAttribute('data-feedback','error');
 expect(screen.queryByText('+1')).toBeNull();
});

test('does not re-scan the same item outside counting after camera misses',()=>{const latch=new ScanLatch();expect(latch.observe('A',false,0)).toBe(true);latch.observe(undefined,false,10000);expect(latch.observe('A',false,11000)).toBe(false);expect(latch.observe('B',false,12000)).toBe(true);});
