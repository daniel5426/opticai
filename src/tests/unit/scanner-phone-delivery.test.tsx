import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ScannerApp } from '@/scanner/main';

const fixture=vi.hoisted(()=>({decode:undefined as undefined|((result?:{getText:()=>string})=>void)}));
vi.mock('react-dom/client',()=>({createRoot:()=>({render:vi.fn()})}));
vi.mock('@/scanner/storage',()=>({phoneToken:async()=>'test-phone'}));
vi.mock('@zxing/browser',()=>({BrowserMultiFormatReader:class {
 async decodeFromConstraints(_constraints:unknown,_video:unknown,callback:typeof fixture.decode){fixture.decode=callback;return {stop:vi.fn()};}
}}));
vi.mock('@/scanner/ScannerScreen',()=>({ScannerScreen:(p:any)=><><video ref={p.video}/><button disabled={!p.devices.length} onClick={p.toggleCamera}>Start</button><output data-testid="state">{JSON.stringify({active:p.active,pending:p.pending,status:p.last?.status,barcode:p.last?.barcode,error:p.error})}</output></>}));

const device={id:'pc',name:'QA',online:true,recipient:'test-user',context:'context',lease:'lease',destination:'count'};
let events:ReadableStreamDefaultController;
let posts:{body:any;resolve:(scan:any)=>void;reject:(error:Error)=>void}[];
const state=()=>JSON.parse(screen.getByTestId('state').textContent!);
const emit=(event:string,value:unknown)=>act(async()=>{events.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));});
const result=(index:number)=>({id:'scan-'+index,request_id:posts[index].body.request_id,barcode:posts[index].body.barcode,context:'context',lease:'lease',source:'phone',status:'applied',created_at:Date.now()/1000,summary:{name:'QA frame'}});
beforeEach(()=>{
 posts=[];localStorage.clear();fixture.decode=undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
  if(url.endsWith('/events'))return new Response(new ReadableStream({start(controller){events=controller;}}));
  if(url.endsWith('/phone/devices'))return Response.json([device]);
  if(url.endsWith('/start'))return Response.json(device);
  if(url.endsWith('/scans'))return new Promise<Response>((resolve,reject)=>posts.push({body:JSON.parse(String(options?.body)),resolve:scan=>resolve(Response.json(scan)),reject}));
  throw new Error('Unexpected request');
 }));
});
afterEach(()=>{cleanup();events?.close();vi.useRealTimers();vi.unstubAllGlobals();localStorage.clear();});
async function start(){render(<ScannerApp/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Start'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Start'}));await waitFor(()=>expect(fixture.decode).toBeDefined());}
const decode=(barcode:string)=>act(async()=>{fixture.decode?.({getText:()=>barcode});});

test('confirms over SSE without waiting for POST and retries a next item seen during delivery',async()=>{
 await start();await decode('A');expect(state()).toMatchObject({pending:true,status:'pending',barcode:'A'});
 await decode('B');expect(posts).toHaveLength(1);
 await emit('message',{type:'result',scan:result(0)});
 expect(state()).toMatchObject({pending:false,status:'applied',barcode:'A'});
 await decode('B');expect(posts).toHaveLength(2);expect(state()).toMatchObject({pending:true,barcode:'B'});
 await act(async()=>posts[0].resolve({...result(0),status:'pending'}));
 expect(state()).toMatchObject({pending:true,barcode:'B'});
 await emit('message',{type:'result',scan:result(1)});
 await act(async()=>posts[1].reject(new Error('late transport failure')));
 expect(state()).toMatchObject({active:true,pending:false,status:'applied',barcode:'B',error:''});
});
test('does not restore a stale confirmation after the desktop changes its count context',async()=>{
 await start();await decode('A');
 await emit('device',{...device,context:'another-count'});
 expect(state()).toMatchObject({pending:false,status:'expired'});
 await emit('message',{type:'result',scan:result(0)});
 await act(async()=>posts[0].resolve({...result(0),status:'pending'}));
 expect(state()).toMatchObject({pending:false,status:'expired'});
});
test('keeps the phone lease alive while products are scanned continuously',async()=>{
 vi.useFakeTimers();render(<ScannerApp/>);await act(async()=>{});
 fireEvent.click(screen.getByRole('button',{name:'Start'}));await act(async()=>{});
 expect(fixture.decode).toBeDefined();
 for(let i=0;i<4;i++){
  await decode('product-'+i);await emit('message',{type:'result',scan:result(i)});
  await act(async()=>{posts[i].resolve({...result(i),status:'pending'});await vi.advanceTimersByTimeAsync(3000);});
 }
 expect(vi.mocked(fetch).mock.calls.filter(([url])=>String(url).endsWith('/start'))).toHaveLength(2);
 expect(state()).toMatchObject({active:true,pending:false,status:'applied'});
});
