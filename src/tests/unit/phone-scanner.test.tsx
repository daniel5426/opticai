import React from 'react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useScanTarget, visibleScanTargets, provenance, scanned, readScannerEvents, setScanDispatcher, dispatchBarcode } from '@/lib/scanner';
afterEach(()=>{cleanup();setScanDispatcher(undefined);});
describe('phone scanner dispatch',()=>{
  test('registers explicit visible targets and removes them on unmount',()=>{
    const apply=vi.fn();
    function Card(){const ref=useScanTarget({id:'frame-test',category:'frame',kind:'order',label:'Frame',canApply:true,apply});return <div ref={ref}/>;}
    const view=render(<Card/>);const el=view.container.firstElementChild!;
    vi.spyOn(el,'getClientRects').mockReturnValue([{}] as any);
    expect(visibleScanTargets().map(t=>t.id)).toContain('frame-test');
    view.unmount();expect(visibleScanTargets().map(t=>t.id)).not.toContain('frame-test');
  });
  test('selection provenance survives serialization but expires on manual product changes',()=>{
    const fields={model:'Frame',width:52};
    const data={...fields,_scan_provenance:provenance({},'frame',fields,{id:5} as any,{source:'phone',created_at:100} as any)};
    expect(scanned(JSON.parse(JSON.stringify(data)),'frame')).toBe(true);
    expect(scanned({...data,model:'Other'},'frame')).toBe(false);
    expect(scanned({...data,_scan_provenance:'{}'},'frame')).toBe(false);
  });
  test('preserves leading zeros when dispatching keyboard reader input',async()=>{
    const run=vi.fn().mockResolvedValue(undefined);setScanDispatcher(run);
    expect(await dispatchBarcode('0012345')).toBe(true);
    expect(run).toHaveBeenCalledWith({barcode:'0012345',source:'reader'});
  });
  test('decodes split UTF-8 and multiline SSE events with replay cursors',async()=>{
    const value='id: 9\nevent: device\ndata: {"name":\ndata: "עמדה"}\n\n: heartbeat\n\n';
    const bytes=new TextEncoder().encode(value);
    const stream=new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=3)controller.enqueue(bytes.slice(i,i+3));controller.close();}});
    const receive=vi.fn();await readScannerEvents(new Response(stream),new AbortController().signal,receive);
    expect(receive).toHaveBeenCalledExactlyOnceWith('device',{name:'עמדה'},'9');
  });
});
