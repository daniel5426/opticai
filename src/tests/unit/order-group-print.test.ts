import {expect,test,vi} from 'vitest';
import {printOrderGroup} from '@/lib/order-docx/print-order-group';
import {printHtml} from '@/lib/pdf-exporter';
vi.mock('@/lib/pdf-exporter',()=>({printHtml:vi.fn().mockResolvedValue({success:true})}));
vi.mock('@/lib/order-docx/load-order-export-context',()=>({loadOrderExportContext:vi.fn(async({orderId,kind})=>({kind,order:{id:orderId,client_id:orderId,order_date:'2026-10-13',order_data:{}},client:{id:orderId,first_name:orderId===1?'Alice':'Bob',last_name:'Client'},user:null,billing:{total_after_discount:100,prepayment_amount:30,currency:'ILS'},lineItems:[],clinicsById:{}}))}));
test('prints separate client pages with the shared financial summary once',async()=>{
 await printOrderGroup([{id:1,position:0,kind:'regular',order:{id:1}},{id:2,position:1,kind:'contact',order:{id:2}}]);
 const html=vi.mocked(printHtml).mock.calls[0][0];
 expect(html).toContain('Alice Client');expect(html).toContain('Bob Client');
 expect(html.match(/class="group-print-page"/g)).toHaveLength(2);
 expect(html.match(/סיכום כספי/g)).toHaveLength(1);
});
