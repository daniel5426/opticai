import React from 'react';
import { afterEach, test, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, waitFor, act, screen, fireEvent } from '@testing-library/react';
import i18n from '@/localization/i18n';
import { ScannerProvider } from '@/components/scanner/ScannerProvider';
import { dispatchBarcode, replayScan, useScanTarget } from '@/lib/scanner';
import { apiClient } from '@/lib/api-client';
vi.mock('@/contexts/UserContext',()=>({useUser:()=>({currentClinic:{id:1,name:'Test clinic'},currentUser:{id:1}})}));
vi.mock('@/localization/use-app-locale',()=>({useAppLocale:()=>({direction:'ltr',locale:'en'})}));
vi.mock('@tanstack/react-router',()=>({useLocation:()=>({pathname:'/orders/1',searchStr:''}),useNavigate:()=>vi.fn()}));
vi.mock('@/lib/api-client',()=>({apiClient:{scannerRequest:vi.fn(),scannerFetch:vi.fn()}}));
beforeEach(()=>vi.clearAllMocks());
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();});
test('a command arriving through POST and SSE applies once and is acknowledged after application',async()=>{
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
 const apply=vi.fn();
 function Card(){const ref=useScanTarget({id:'test-frame',category:'frame',kind:'order',label:'Frame',canApply:true,apply});return <div ref={ref}/>;}
 const view=render(<ScannerProvider><Card/></ScannerProvider>);
 vi.spyOn(view.container.firstElementChild!,'getClientRects').mockReturnValue([{}] as any);
 await waitFor(()=>expect(receiver).toBeDefined());
 await act(async()=>{await dispatchBarcode('0012345');});
 await waitFor(()=>expect(apply).toHaveBeenCalledTimes(1));
 expect(command.barcode).toBe('0012345');
 expect(vi.mocked(apiClient.scannerRequest).mock.calls.some(([path,options])=>path==='/scans/scan'&&JSON.parse(String(options?.body)).status==='applied')).toBe(true);
 await act(async()=>{controller.enqueue(new TextEncoder().encode(`id: 2\ndata: ${JSON.stringify({type:'scan',scan:command})}\n\n`));});
 expect(apply).toHaveBeenCalledTimes(1);
 controller.close();
});

test.each([false,true])('an early SSE echo shares the response or recovers a stalled POST, without waiting for acknowledgement (stalled: %s)', async stalled => {
 vi.spyOn(document,'hidden','get').mockReturnValue(false);
 localStorage.setItem('prysm:scanner:1',JSON.stringify({id:'device',secret:'secret',clinic_id:1,name:'Test'}));
 let receiver:any, command:any, streamController!:ReadableStreamDefaultController;
 let finishPost!:()=>void, finishAck!:()=>void;
 const postReady=new Promise<void>(resolve=>{finishPost=resolve;});
 const ackReady=new Promise<void>(resolve=>{finishAck=resolve;});
 const statuses:string[]=[];
 const variant={id:5,is_stockable:true,currency:'ILS',default_retail:234,product:{category:'frame',brand:'Atlas',model:'A101'},attributes:{color:'Black'},balance:{available:2}};
 const stream=new ReadableStream({start(controller){streamController=controller;}});
 vi.mocked(apiClient.scannerFetch).mockResolvedValue(new Response(stream));
 vi.mocked(apiClient.scannerRequest).mockImplementation(async(path,options)=>{
  const body=options?.body?JSON.parse(String(options.body)):{};
  if(path==='/status')return {data:{enabled:true}} as any;
  if(path.endsWith('/receiver')){receiver=body;return {data:{id:'device',online:true}} as any;}
  if(path.startsWith('/variants/'))return {data:{items:[variant]}} as any;
  if(path.endsWith('/scans')){
   command={id:'fast-scan',device_id:'device',clinic_id:1,request_id:body.request_id,lease:body.lease,context:body.context,source:body.source,barcode:'0012345',variant_id:5,status:'pending',created_at:Date.now()/1000,summary:{name:'Atlas A101'}};
   streamController.enqueue(new TextEncoder().encode(`id: 1\ndata: ${JSON.stringify({type:'scan',scan:command})}\n\n`));
   await postReady;
   return {data:{...command,variant}} as any;
  }
  if(path==='/scans/fast-scan'){
   statuses.push(body.status);
   if(body.status==='awaiting_confirmation')await ackReady;
  }
  return {data:{success:true}} as any;
 });
 render(<ScannerProvider><span/></ScannerProvider>);
 await waitFor(()=>expect(receiver).toBeDefined());
 await waitFor(()=>expect(apiClient.scannerFetch).toHaveBeenCalledOnce());
 const receiverCalls=vi.mocked(apiClient.scannerRequest).mock.calls.filter(([path])=>path.endsWith('/receiver')).length;
 const ready=vi.fn();
 let pending!:Promise<void>;
 await act(async()=>{pending=replayScan(5,ready);});
 await waitFor(()=>expect(command).toBeDefined());
 expect(ready).not.toHaveBeenCalled();
 expect(apiClient.scannerRequest).not.toHaveBeenCalledWith(expect.stringContaining('/variants/'),expect.anything());
 if(!stalled)await act(async()=>{finishPost();});
 expect(await screen.findByRole('dialog',{name:'Atlas A101'})).toBeVisible();
 expect(ready).toHaveBeenCalledOnce();
 expect(screen.getByText('234 ILS')).toBeVisible();
 expect(statuses).toEqual(['awaiting_confirmation']);
 expect(vi.mocked(apiClient.scannerRequest).mock.calls.filter(([path])=>path.endsWith('/receiver'))).toHaveLength(receiverCalls);
 expect(vi.mocked(apiClient.scannerRequest).mock.calls.filter(([path])=>path.startsWith('/variants/'))).toHaveLength(stalled ? 1 : 0);
 fireEvent.click(screen.getByRole('button',{name:i18n.t('scanner.openInventory')}));
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(statuses).toEqual(['awaiting_confirmation']);
 await act(async()=>{finishPost();finishAck();await pending;});
 expect(statuses).toEqual(['awaiting_confirmation','displayed']);
 streamController.close();
});
