import type { GroupEntry } from '@/lib/order-groups';
import { loadOrderExportContext } from './load-order-export-context';
import { buildContactOrderPrintModel, buildRegularOrderPrintModel } from './build-print-models';
import { renderOrderPdfHtml } from './render-order-pdf';
import { printHtml } from '@/lib/pdf-exporter';

export async function printOrderGroup(entries: GroupEntry[]) {
  if (!entries.length) throw new Error('No saved orders to print');
  const contexts = await Promise.all(entries.map(entry => loadOrderExportContext({orderId:entry.order.id,kind:entry.kind})));
  const documents = contexts.map((context,index) => {
    const data=context.kind==='regular'?buildRegularOrderPrintModel(context):buildContactOrderPrintModel(context);
    return new DOMParser().parseFromString(renderOrderPdfHtml({kind:context.kind,data,includeBilling:index===contexts.length-1}),'text/html');
  });
  const styles=Array.from(documents[0].querySelectorAll('style')).map(style=>style.textContent).join('\n');
  const pages=documents.map(document=>`<section class="group-print-page">${document.body.innerHTML}</section>`).join('');
  const html=`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>${styles}\n.group-print-page{break-after:page}.group-print-page:last-child{break-after:auto}</style></head><body>${pages}</body></html>`;
  return printHtml(html,'order-group.pdf');
}
