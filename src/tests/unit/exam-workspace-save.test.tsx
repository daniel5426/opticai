import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useExamSave } from '@/hooks/exam/useExamSave';
import { saveExamWorkspace } from '@/lib/exam-workspace';
import { examPageDataQueryKey } from '@/lib/db/exams-db';
import { inputSyncManager } from '@/lib/input-sync-manager';

const fixture=vi.hoisted(()=>({navigate:vi.fn(),onSave:vi.fn()}));
vi.mock('@/lib/exam-workspace',async original=>({...await original<object>(),saveExamWorkspace:vi.fn()}));
vi.mock('@/hooks/client/clientTabCache',()=>({syncSavedClientExam:vi.fn()}));
vi.mock('@/lib/exam-component-registry',()=>({examComponentRegistry:{prepareData:(_id:number,data:any)=>data}}));
const page=(count:number)=>({save_token:'a'.repeat(64),exam:{id:1,client_id:2,clinic_id:3,user_id:4,type:'exam',test_name:'Synthetic',exam_date:'2026-11-07'},
  instances:Array.from({length:count},(_,index)=>({instance:{id:index+10,layout_id:1,layout_data:'[]',order:index},layout:{id:1,layout_data:'[]'},exam_data:{notes:{text:'Original'}}}))});

function Editor({initial,newMode=false,extraBuckets={}}:{initial:ReturnType<typeof page>;newMode?:boolean;extraBuckets?:Record<number,any>}) {
  const [exam,setExam]=React.useState<any>(newMode?null:initial.exam);
  const [form,setForm]=React.useState<any>(initial.exam);
  const [data,setData]=React.useState<any>({notes:{text:'Changed'}});
  const [buckets,setBuckets]=React.useState<any>({...Object.fromEntries(initial.instances.map(row=>[row.instance.id,row.exam_data])),...extraBuckets});
  const [tabs,setTabs]=React.useState<any>(initial.instances.map(row=>({...row.instance,name:'Synthetic',isActive:row.instance.id===10})));
  const [active,setActive]=React.useState<number|null>(initial.instances[0]?.instance.id??10);
  const [busy,setBusy]=React.useState(false);
  const formRef=React.useRef<HTMLFormElement>(null);
  const baseline=React.useRef('');
  const [dirty,setDirty]=React.useState(true);
  const {handleSave}=useExamSave({formRef,isSaveInFlight:busy,setIsSaveInFlight:setBusy,isNewMode:newMode,setIsEditing:()=>{},
    formData:form,setFormData:setForm,exam,setExam,examFormData:data,examFormDataByInstance:buckets,setExamFormDataByInstance:setBuckets,
    fullDataSourcesRef:React.useRef({}),layoutTabs:tabs,setLayoutTabs:setTabs,activeInstanceId:active,setActiveInstanceId:setActive,setExamFormData:setData,
    clientId:'2',currentClinic:{id:3},currentUser:{id:4},config:{dbType:'exam'} as any,
    setBaseline:()=>{baseline.current='saved';setDirty(false)},hasUnsavedChanges:dirty,
    allowNavigationRef:React.useRef(false),navigate:fixture.navigate,onSave:fixture.onSave});
  React.useEffect(()=>{const sync=()=>setData({notes:{text:'Latest typed value'}});inputSyncManager.register(sync,()=>false);return()=>inputSyncManager.unregister(sync);},[]);
  return <form ref={formRef}><input aria-label="content" value={data.notes?.text||''} onChange={()=>{}}/><button type="button" onClick={()=>void handleSave()}>Save</button><output>{busy?'saving':'ready'}</output></form>;
}
afterEach(()=>{cleanup();vi.clearAllMocks()});

it.each([1,4,10])('saves %s layouts in one request, sends only the changed layout and retains the editor',async count=>{
  const initial=page(count);const client=new QueryClient();client.setQueryData(examPageDataQueryKey(1),initial);
  let finish!:(value:any)=>void;
  vi.mocked(saveExamWorkspace).mockImplementation(()=>new Promise(resolve=>{finish=resolve}));
  render(<QueryClientProvider client={client}><Editor initial={initial}/></QueryClientProvider>);
  const input=screen.getByLabelText('content');
  fireEvent.click(screen.getByText('Save'));fireEvent.click(screen.getByText('Save'));
  expect(saveExamWorkspace).toHaveBeenCalledTimes(1);
  const payload=vi.mocked(saveExamWorkspace).mock.calls[0][1];
  expect(payload.instances).toHaveLength(1);
  expect(payload.instances[0].exam_data.notes.text).toBe('Latest typed value');
  await act(async()=>finish({exam:initial.exam,instances:[{instance:initial.instances[0].instance,exam_data:payload.instances[0].exam_data}],client_keys:{'10':10},removed_instance_ids:[],save_token:'b'.repeat(64)}));
  await waitFor(()=>expect(screen.getByText('ready')).toBeInTheDocument());
  expect(screen.getByLabelText('content')).toBe(input);
  expect(fixture.navigate).not.toHaveBeenCalled();
  expect(client.getQueryData<any>(examPageDataQueryKey(1)).save_token).toBe('b'.repeat(64));
  fireEvent.click(screen.getByText('Save'));
  expect(saveExamWorkspace).toHaveBeenCalledTimes(1);
});

it('retains the draft on a failed write without a success callback',async()=>{
  const initial=page(1);const client=new QueryClient();client.setQueryData(examPageDataQueryKey(1),initial);
  vi.mocked(saveExamWorkspace).mockRejectedValue(Object.assign(new Error('exam_save_conflict'),{status:409}));
  render(<QueryClientProvider client={client}><Editor initial={initial}/></QueryClientProvider>);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(()=>expect(screen.getByText('ready')).toBeInTheDocument());
  expect(screen.getByLabelText('content')).toHaveValue('Latest typed value');
  expect(fixture.onSave).not.toHaveBeenCalled();
});

it('does not save data a repeated load left without a tab as a layout-less instance',async()=>{
  const initial=page(1);initial.instances[0].instance.id=-1794348488919;
  vi.mocked(saveExamWorkspace).mockRejectedValue(new Error('stop'));
  render(<QueryClientProvider client={new QueryClient()}><Editor initial={initial} newMode extraBuckets={{[-1794348488606]:{notes:{text:"Earlier load"}}}}/></QueryClientProvider>);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(()=>expect(saveExamWorkspace).toHaveBeenCalled());
  expect(vi.mocked(saveExamWorkspace).mock.calls[0][1].instances.map((row:any)=>row.client_key)).toEqual(["-1794348488919"]);
});
