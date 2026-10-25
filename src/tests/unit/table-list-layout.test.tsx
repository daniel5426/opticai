import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExamsTable } from '@/components/exams-table';
import { OrderGroupList } from '@/components/order-groups/OrderGroupList';
import { useUser } from '@/contexts/UserContext';
import i18n from '@/localization/i18n';

vi.mock('@tanstack/react-router',()=>({useNavigate:()=>vi.fn(),Link:({children}:any)=><a>{children}</a>}));
vi.mock('@/components/ClientSelectModal',()=>({ClientSelectModal:()=>null}));
vi.mock('@/components/exam/ExamPreviewModal',()=>({ExamPreviewModal:()=>null}));
vi.mock('@/lib/db/exam-layouts-db',()=>({getAllExamLayouts:async()=>[]}));
vi.mock('@/lib/api-client',()=>({apiClient:{orderGroupRequest:async()=>({data:{available:true}})}}));
vi.mock('@/lib/order-groups',async original=>({...await original<object>(),groupRequest:async()=>({items:[],total:0})}));

beforeEach(()=>{
  vi.stubGlobal('ResizeObserver',class{observe(){} unobserve(){} disconnect(){}});
  vi.mocked(useUser).mockReturnValue({currentClinic:{id:1},currentUser:{id:1,role_level:2}} as any);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});

describe.each(['he','en','fr'] as const)('shared Orders and Exams layout in %s',locale=>{
  test('uses identical toolbar, table, header and pagination layout in the active direction',async()=>{
    await i18n.changeLanguage(locale);
    const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const result=render(<QueryClientProvider client={cache}>
      <section data-testid="exams"><ExamsTable data={[]} clientId={0} loading={false} fillHeight onExamDeleted={()=>{}} onExamDeleteFailed={()=>{}} pagination={{page:1,pageSize:25,total:0,setPage:()=>{}}}/></section>
      <section data-testid="orders"><OrderGroupList/></section>
    </QueryClientProvider>);
    await screen.findByText(i18n.t('orderGroupNone'));
    const exams=screen.getByTestId('exams'),orders=screen.getByTestId('orders');
    for(const selector of ['[data-slot="table-list-layout"]','[data-canvas-toolbar]','[data-slot="table-container"]','thead']){
      const examElement=exams.querySelector(selector)!,orderElement=orders.querySelector(selector)!;
      expect(orderElement.className).toBe(examElement.className);
    }
    expect(orders.querySelector('[data-slot="table-list-layout"]')).toHaveAttribute('dir',locale==='he'?'rtl':'ltr');
    expect(exams.querySelector('[data-slot="table-list-layout"]')).toHaveAttribute('dir',locale==='he'?'rtl':'ltr');
    expect(within(exams).getByRole('textbox',{name:i18n.t('examList.search')})).toBeInTheDocument();
    expect(within(orders).getByRole('textbox',{name:i18n.t('orderGroupSearch')})).toBeInTheDocument();
    const orderSearch=within(orders).getByRole('textbox');
    fireEvent.change(orderSearch,{target:{value:'Test'}});
    fireEvent.click(within(orders).getByRole('button',{name:i18n.t('clear')}));
    expect(orderSearch).toHaveValue('');
    expect(result.container.querySelectorAll('[data-slot="table-container"]')).toHaveLength(2);
  });

  test('keeps loading rows inside the same table shell with the right number of cells',async()=>{
    await i18n.changeLanguage(locale);
    const {rerender}=render(<ExamsTable data={[]} clientId={0} loading fillHeight onExamDeleted={()=>{}} onExamDeleteFailed={()=>{}}/>);
    const table=screen.getByRole('table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(14);
    expect(table.querySelector('tbody tr')!.children).toHaveLength(6);
    rerender(<ExamsTable data={[]} clientId={0} loading={false} fillHeight onExamDeleted={()=>{}} onExamDeleteFailed={()=>{}}/>);
    expect(screen.getByRole('table')).toBe(table);
    expect(screen.getByText(i18n.t('examList.empty'))).toBeInTheDocument();
  });
});
