import {act, renderHook} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {useLayoutTabs} from '@/hooks/exam/useLayoutTabs';
import {VIRTUAL_FULL_DATA_TAB_ID} from '@/pages/exam-detail/utils';
import {setActiveExamLayoutInstance} from '@/lib/db/exam-layouts-db';
vi.mock('@/lib/db/exam-layouts-db',()=>({setActiveExamLayoutInstance:vi.fn().mockResolvedValue(true)}));

function fixture(instanceLayout: boolean, layoutId: number | null = null) {
  const tab={id:17,layout_id:layoutId,instance_layout:instanceLayout,name:'OpticPlus',isActive:false,
    layout_data:JSON.stringify({version:2,items:[{id:'measure',type:'opticplus-measurements',x:0,y:0,w:8}]})};
  const bucket={'opticplus-measurements':{card_instance_id:'measure',gijr:0,gijl:'saved edit'}};
  const props={exam:{id:42},isNewMode:false,layoutTabs:[tab],layoutTabsRef:{current:[tab]},activeInstanceId:VIRTUAL_FULL_DATA_TAB_ID,
    setActiveInstanceId:vi.fn(),setLayoutTabs:vi.fn(),examFormData:{},examFormDataByInstance:{17:bucket},
    setExamFormDataByInstance:vi.fn(),setExamFormData:vi.fn(),setCardRows:vi.fn(),setCustomWidths:vi.fn(),setGridItems:vi.fn(),
    layoutMap:new Map(),fullDataSourcesRef:{current:{}},loadExamComponentData:vi.fn(),initializeFormData:vi.fn(),
    applyLayoutStructure:vi.fn(),setIsAddingLayouts:vi.fn(),tempLayoutIdCounterRef:{current:-1},latestLoadIdRef:{current:0}};
  return {props,bucket};
}

test('switching from All Data to an imported instance restores its own tab, layout and saved values',()=>{
  const {props,bucket}=fixture(true);
  const {result}=renderHook(()=>useLayoutTabs(props));
  act(()=>result.current.handleLayoutTabChange(17));
  expect(props.setActiveInstanceId).toHaveBeenLastCalledWith(17);
  expect(props.setExamFormData).toHaveBeenLastCalledWith(bucket);
  expect(props.setGridItems).toHaveBeenLastCalledWith([expect.objectContaining({id:'measure'})]);
  expect(setActiveExamLayoutInstance).not.toHaveBeenCalled();
});

test('legacy layout-less sources still open All Data',()=>{
  const {props}=fixture(false);
  const {result}=renderHook(()=>useLayoutTabs(props));
  act(()=>result.current.handleLayoutTabChange(17));
  expect(props.setActiveInstanceId).toHaveBeenLastCalledWith(VIRTUAL_FULL_DATA_TAB_ID);
});

test('ordinary template tabs still switch to their saved instance',()=>{
  const {props,bucket}=fixture(false,9);
  const {result}=renderHook(()=>useLayoutTabs(props));
  act(()=>result.current.handleLayoutTabChange(17));
  expect(props.setActiveInstanceId).toHaveBeenLastCalledWith(17);
  expect(props.setExamFormData).toHaveBeenLastCalledWith(bucket);
});
