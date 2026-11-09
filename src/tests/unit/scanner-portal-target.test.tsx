import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useScanTarget, useScanTargetsVersion, visibleScanTargets } from '@/lib/scanner';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
test('announces count mode when its portal mounts after target registration',async()=>{
 vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as any);
 function Target(){const [mounted,setMounted]=useState(false);const ref=useScanTarget({id:'portal-count',kind:'count',label:'Count',canApply:true,apply:()=>{}});useEffect(()=>setMounted(true),[]);return mounted?createPortal(<div ref={ref}/>,document.body):null;}
 function Observer(){useScanTargetsVersion();return <output>{visibleScanTargets().some(t=>t.kind==='count')?'count-ready':'no-count'}</output>;}
 render(<><Observer/><Target/></>);expect(await screen.findByText('count-ready')).toBeVisible();
});
