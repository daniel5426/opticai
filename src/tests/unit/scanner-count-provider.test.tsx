import React from 'react';
import { afterEach, test, expect, vi } from 'vitest';
import { cleanup, render, waitFor, act } from '@testing-library/react';
import '@/localization/i18n';
import { ScannerProvider } from '@/components/scanner/ScannerProvider';
import { dispatchBarcode, useScanTarget } from '@/lib/scanner';
import { apiClient } from '@/lib/api-client';
vi.mock('@/contexts/UserContext',()=>({useUser:()=>({currentClinic:{id:1,name:'Test clinic'},currentUser:{id:1}})}));
vi.mock('@/localization/use-app-locale',()=>({useAppLocale:()=>({direction:'ltr',locale:'en'})}));
vi.mock('@tanstack/react-router',()=>({useLocation:()=>({pathname:'/orders/1',searchStr:''}),useNavigate:()=>vi.fn()}));
vi.mock('@/lib/api-client',()=>({apiClient:{scannerRequest:vi.fn(),scannerFetch:vi.fn()}}));
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();vi.clearAllMocks();});
test.each([true,false])('counts from the loaded draft or rejects an outside item (loaded: %s)',async loaded=>{
 const kind='count';
 vi.spyOn(document,'hidden','get').mockReturnValue(false);
 localStorage.setItem('prysm:scanner:1',JSON.stringify({id:'device',secret:'secret',clinic_id:1,name:'Test'}));
 let receiver:any,command:any,controller!:ReadableStreamDefaultController;
 const stream=new ReadableStream({start(c){controller=c;}});
 vi.mocked(apiClient.scannerFetch).mockResolvedValue(new Response(stream));
 vi.mocked(apiClient.scannerRequest).mockImplementation(async(path,options)=>{
  const body=options?.body?JSON.parse(String(options.body)):{};
  if(path==='/status')return {data:{enabled:true}} as any;
  if(path.endsWith('/receiver')){receiver=body;return {data:{id:'device',online:true}} as any;}
  if(path.startsWith('/variants/'))return {data:{items:[{id:5,is_stockable:true,product:{category:'frame',model:'Test frame'},attributes:{},balance:{available:1}}]}} as any;
  if(path.endsWith('/scans')){
   command={id:'scan',device_id:'device',clinic_id:1,request_id:body.request_id,lease:body.lease,context:body.context,source:'reader',barcode:body.barcode,variant_id:5,status:'pending',created_at:Date.now()/1000,summary:{name:'Test frame'}};
   controller.enqueue(new TextEncoder().encode(`id: 1\ndata: ${JSON.stringify({type:'scan',scan:command})}\n\n`));
   return {data:command} as any;
  }
  return {data:{success:true}} as any;
 });
 const apply=vi.fn(()=>{if(!loaded)throw new Error('barcode.outsideCount');});
 function Card(){const ref=useScanTarget({id:'test-frame',category:'frame',kind,label:'Frame',canApply:true,apply,resolveCountVariant:loaded?id=>id===5?{id:5,is_stockable:true,product:{category:'frame'},attributes:{}} as any:undefined:undefined});return <div ref={ref}/>;}
 const view=render(<ScannerProvider><Card/></ScannerProvider>);
 vi.spyOn(view.container.firstElementChild!,'getClientRects').mockReturnValue([{}] as any);
 await waitFor(()=>expect(receiver).toBeDefined());
 await act(async()=>{await dispatchBarcode('0012345');});
 await waitFor(()=>expect(apply).toHaveBeenCalledTimes(1));
 expect(command.barcode).toBe('0012345');
 expect(vi.mocked(apiClient.scannerRequest).mock.calls.some(([path])=>path.startsWith('/variants/'))).toBe(!loaded);
 expect(vi.mocked(apiClient.scannerRequest).mock.calls.some(([path,options])=>path==='/scans/scan'&&JSON.parse(String(options?.body)).status===(loaded?'applied':'rejected'))).toBe(true);
 await act(async()=>{controller.enqueue(new TextEncoder().encode(`id: 2\ndata: ${JSON.stringify({type:'scan',scan:command})}\n\n`));});
 expect(apply).toHaveBeenCalledTimes(1);
 controller.close();
});
