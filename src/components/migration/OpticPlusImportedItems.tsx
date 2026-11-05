import { opticPlusLabel, opticPlusDisplayValue } from "@/lib/opticplus-cards";
import { useTranslation } from "react-i18next";
import { OrderSection } from "@/components/orders/layout/OrderSheet";

const specs = ['color', 'qpart', 'ob_comp', 'ob_type', 'ob_size', 'ocolor', 'ocomp', 'og_type',
  'oheight', 'aheight', 'adds', 'cover', 'frame_supplier_name', 'lens_supplier_name'];
const quantities = ['amount', 'ar', 'al'];
const prices = ['bprice', 'gpricet', 'pbprice', 'pgpricet', 'pdisc', 'pdisct'];
const contextFields = ['odate', 'ordernum', 'mwdate', 'yeda', 'qmsgr', 'heshbonit', 'gprice', 'gf_price', 'tpay', 'gpay', 'greduce', 'gdisc'];
const populated = (value: unknown) => value !== null && value !== '' && value !== undefined;

/** Source slots are products, never inferred eyes or pairs. Values remain read-only. */
export function OpticPlusImportedItems({ orderData }: { orderData: unknown }) {
  const { t, i18n } = useTranslation();
  const source = orderData && typeof orderData === 'object' ? (orderData as Record<string, any>).opticplus_source : null;
  if (!Array.isArray(source?.slots)) return null;
  const fields = (values: Record<string, unknown>, names: string[], compact = false) => <dl className={`grid gap-x-4 gap-y-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 xl:grid-cols-3'}`}>
    {names.filter(field => populated(values[field])).map(field => <div key={field} className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{opticPlusLabel(t, field)}</dt>
      <dd dir="auto" style={{textAlign: i18n.dir() === 'rtl' ? 'right' : 'left'}} className="m-0 whitespace-pre-wrap break-words text-sm leading-snug tabular-nums">{opticPlusDisplayValue(t, values[field], i18n.language)}</dd>
    </div>)}
  </dl>;
  const details = (section: string, values: Record<string, unknown>, names: string[]) => names.some(field => populated(values[field])) ? <details className="group border-t border-border/50 pt-3">
    <summary className="cursor-pointer py-1 text-xs font-medium text-muted-foreground">{t(`opticplus.itemSections.${section}`)}</summary>
    <div className="pt-3">{fields(values, names, true)}</div>
  </details> : null;
  return <section className="space-y-4 rounded-xl bg-muted/40 p-4" dir={i18n.dir()} aria-label={t('opticplus.items')}>
    <header className="space-y-1"><h3 className="text-sm font-semibold">{t('opticplus.items')}</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('opticplus.sourceLabel')}</p></header>
    <div className={`grid items-start gap-4 ${source.slots.length > 1 ? 'xl:grid-cols-2' : ''}`}>
      {source.slots.map((slot: any) => <article key={String(slot.slot)} className="min-w-0 overflow-hidden rounded-lg bg-card shadow-sm">
        <OrderSection collapsible defaultOpen title={t('opticplus.slot', {slot:slot.slot})} bodyClassName="space-y-4">
        {fields(slot.values || {}, specs)}
        <section className="space-y-3 border-t border-border/50 pt-3" aria-label={t('opticplus.itemSections.quantities')}>
          <h5 className="text-xs font-medium text-muted-foreground">{t('opticplus.itemSections.quantities')}</h5>
          {fields(slot.values || {}, quantities, true)}
        </section>
        {details('prices',slot.values || {},prices)}
        </OrderSection>
      </article>)}
    </div>
    {details('context',source.context || {},contextFields)}
    {details('extras',source.extras || {},Object.keys(source.extras || {}))}
  </section>;
}
