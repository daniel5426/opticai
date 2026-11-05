import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FastInput, FastTextarea } from './shared/OptimizedInputs';
import { opticPlusLabel, opticPlusMetadata, opticPlusValue, opticPlusDisplayValue, type OpticPlusCardType } from '@/lib/opticplus-cards';

type Binding = { component: string; field: string; cardInstanceId?: string };
type Props = {
  type: OpticPlusCardType;
  data: Record<string, unknown>;
  isEditing: boolean;
  onChange: (field: string, value: string | boolean) => void;
  readBinding?: (component: string, field: string, cardInstanceId?: string) => unknown;
  writeBinding?: (component: string, field: string, value: string | boolean, cardInstanceId?: string) => void;
};
type Pair = [label: string, right: string, left: string];
const measurements: Pair[] = [
  ['pupilDark', 'gijr', 'gijl'], ['pupilLight', 'gior', 'giol'], ['cornealDiameter', 'kr', 'kl'], ['tbut', 'tbr', 'tbl'],
];
const ocular = ['cd', 'av', 'fr', 'macula', 'amsler', 'visualField', 'eyelids', 'conjunctiva', 'tears',
  'cornea', 'anteriorChamber', 'pupil', 'iris', 'lens', 'vitreous', 'eyePressure', 'angle']
  .map<Pair>((label, index) => [label, `tst${index * 2 + 1}`, `tst${index * 2 + 2}`]);
const contact = ['type', 'comp', 'koter', 'or', 'orv', 'bc', 'ktr', 'sph', 'cyl', 'axis', 'add', 'visus']
  .map<Pair>(field => [field, `cnr${field}`, `cnl${field}`]);
const prescription = ['sph', 'cyl', 'axis', 'visus', 'pvisus', 'nvisus', 'ph', 'add', 'pd', 'high', 'pris', 'prist']
  .map<Pair>(field => [field, `cr${field}`, `cl${field}`]);
const additions: Pair[] = [['intermediate', 'ncriadd', 'ncliadd'], ['bifocal', 'ncrbadd', 'nclbadd'], ['multifocal', 'ncrmadd', 'nclmadd']];
const optionGroups = [
  ['work', ['a1', 'a2', 'a3', 'a4', 'a5']], ['generalHealth', ['m1', 'm2', 'm3', 'm4']],
  ['eyeHealth', ['j1', 'j2']], ['symptoms', ['r1', 'r2', 'r3', 'r4']],
  ['treatments', ['t1', 't2', 't3']], ['familyHistory', ['e1', 'e2', 'e3']],
] as const;

export function OpticPlusMigrationCard({ type, data, isEditing, onChange, readBinding, writeBinding }: Props) {
  const { t, i18n } = useTranslation();
  const bindings = (data.bindings || {}) as Record<string, Binding>;
  const fields = Object.keys(data).filter(key => !opticPlusMetadata.has(key) && !key.startsWith('__') && (data[key] != null || bindings[key]));
  const used = new Set<string>();
  const has = (field: string) => fields.includes(field);
  const valueFor = (field: string) => {
    const binding = bindings[field];
    return binding && readBinding ? readBinding(binding.component, binding.field, binding.cardInstanceId) : data[field];
  };
  const change = (field: string, value: string | boolean) => {
    const binding = bindings[field];
    if (binding && writeBinding) writeBinding(binding.component, binding.field, value, binding.cardInstanceId);
    else onChange(field, value);
  };
  const labelFor = (field: string) => opticPlusLabel(t, field, String(data.source_table || ''));
  const control = (field: string, multiline = false) => {
    if (!has(field)) return <span className="text-muted-foreground/60" aria-label={t('opticplusCards.ui.notRecorded')}>—</span>;
    used.add(field);
    const value = valueFor(field), label = labelFor(field), id = `${data.card_instance_id}-${field}`;
    if (typeof value === 'boolean') return <Checkbox id={id} aria-label={label} checked={value}
      disabled={!isEditing} onCheckedChange={checked => change(field, checked === true)} />;
    const props = { id, title: opticPlusValue(t, value), name: `${type}-${field}`, 'aria-label': label, value: opticPlusValue(t, value),
      onChange: (next: string) => change(field, next), disabled: !isEditing,
      dir: /^[+-]?\d/.test(String(value ?? '')) ? 'ltr' : i18n.dir(), style: {textAlign: i18n.dir() === 'rtl' ? 'right' as const : 'left' as const}, className: 'h-7 min-w-0 text-xs disabled:cursor-default disabled:opacity-100' };
    if (multiline || String(value ?? '').includes('\n') || String(value ?? '').length > 64)
      return <FastTextarea {...props} className="min-h-12 text-xs" />;
    return <FastInput type="text" {...props} value={!isEditing && !bindings[field] ? opticPlusDisplayValue(t, value, i18n.language) : props.value} />;
  };
  const section = (title: string, content: React.ReactNode) => <section className="space-y-1 border-t border-border/40 pt-2 first:border-0 first:pt-0" aria-label={t(`opticplusCards.sections.${title}`)}>
    <h4 className="text-xs font-medium text-muted-foreground">{t(`opticplusCards.sections.${title}`)}</h4>{content}
  </section>;
  const pairs = (title: string, rows: Pair[]) => {
    const visible = rows.filter(([, r, l]) => has(r) || has(l));
    if (!visible.length) return null;
    return section(title, <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-xs">
      <thead><tr><th scope="col" className="w-28 text-start font-normal text-muted-foreground">{t('opticplusCards.ui.measurement')}</th>
        <th scope="col" className="font-normal text-muted-foreground">{t('opticplusCards.ui.right')}</th>
        <th scope="col" className="font-normal text-muted-foreground">{t('opticplusCards.ui.left')}</th></tr></thead>
      <tbody>{visible.map(([label, r, l]) => <tr key={r}>
        <th scope="row" className="pe-2 text-start font-normal text-muted-foreground">{t(`opticplusCards.rows.${label}`)}</th>
        <td className="px-1 align-top">{control(r)}</td><td className="ps-1 align-top">{control(l)}</td>
      </tr>)}</tbody>
    </table>);
  };
  const list = (title: string, names: string[], multiline = false) => {
    const visible = names.filter(has);
    if (!visible.length) return null;
    return section(title, <div className={`grid gap-x-3 gap-y-1.5 sm:grid-cols-2 ${type === 'opticplus-legacy-history' ? 'xl:grid-cols-3' : ''}`}>{visible.map(field => <div key={field} className="min-w-0 space-y-1">
      <label htmlFor={`${data.card_instance_id}-${field}`} className="block text-xs text-muted-foreground">{labelFor(field)}</label>
      {control(field, multiline)}
    </div>)}</div>);
  };
  const context = (names: string[]) => isEditing ? list('examContext', names) : <details className="border-t border-border/40 pt-2">
    <summary className="cursor-pointer py-1 text-xs font-medium text-muted-foreground">{t('opticplusCards.sections.examContext')}
      <span className="inline-block px-2 font-normal" dir="auto">{[data.checkname || data.cadcheckname, data.yeda || data.cyeda].filter(Boolean).map(String).join(' · ')}</span>
    </summary><div className="pt-2">{list('examContext', names)}</div>
  </details>;
  let body: React.ReactNode;
  if (type === 'opticplus-questionnaire') {
    const questions = Array.from({ length: 8 }, (_, i) => i + 1).filter(i => has(`qyes${i}`) || has(`qno${i}`) || has(`remk${i}`));
    body = <>
      <div className="space-y-2">{questions.map(i => {
        const yes = `qyes${i}`, no = `qno${i}`, remark = `remk${i}`;
        used.add(yes); used.add(no);
        const y = valueFor(yes) === true, n = valueFor(no) === true;
        const status = y && n ? 'bothSelected' : y ? 'yes' : n ? 'no' : 'notRecorded';
        return <div key={i} className="grid gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><p className="text-xs font-medium">{opticPlusLabel(t, remark)}</p>
            {isEditing ? <div className="flex flex-wrap gap-3">{[yes, no].filter(has).map(field => <label key={field} className="flex items-center gap-1.5 text-xs">
              <Checkbox aria-label={opticPlusLabel(t, field)} checked={valueFor(field) === true} onCheckedChange={checked => change(field, checked === true)} />
              {t(`opticplusCards.${field === yes ? 'yes' : 'no'}`)}
            </label>)}</div> : null}
            <p className={`text-xs ${y && n ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>{t(status === 'yes' || status === 'no' ? `opticplusCards.${status}` : `opticplusCards.ui.${status}`)}</p>
          </div>
          <div className="min-w-0">{has(remark) ? control(remark) : null}</div>
        </div>;
      })}</div>
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">{optionGroups.map(([title, names]) => {
        const visible = names.filter(has); if (!visible.length) return null;
        visible.forEach(field => used.add(field));
        return <React.Fragment key={title}>{section(title, <div className="flex flex-wrap gap-x-3 gap-y-1.5">{visible.map(field => <label key={field} className="flex items-center gap-1.5 text-xs">
          <Checkbox aria-label={opticPlusLabel(t, field)} checked={valueFor(field) === true} disabled={!isEditing} onCheckedChange={checked => change(field, checked === true)} />
          <span className={valueFor(field) === true ? '' : 'text-muted-foreground'}>{opticPlusLabel(t, field)}</span>
        </label>)}</div>)}</React.Fragment>;
      })}</div>
    </>;
  } else if (type === 'opticplus-ocular-health') body = <>{pairs('posterior', ocular.slice(0, 6))}{pairs('anterior', ocular.slice(6, 15))}{pairs('pressureAngle', ocular.slice(15))}</>;
  else if (type === 'opticplus-measurements') body = pairs('measurements', measurements);
  else if (type === 'opticplus-contact-fitting') body = <>{pairs('lensSpecifications', contact)}{context(['cnvisus', 'cadcheckname', 'cyeda', 'qtyp', 'qdomin'])}</>;
  else if (type === 'opticplus-prescription-details') body = <>{pairs('prescription', prescription)}{pairs('additions', additions)}{context(['checkname', 'yeda', 'ct', 'qtyp', 'qdomin'])}</>;
  else if (type === 'opticplus-binocular') body = <>
    {list('coverTest', ['tst35', 'tst36'])}
    {['tst38', 'tst39', 'tst40', 'tst41'].some(has) ? section('vergence', <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-xs"><thead><tr>
      <th className="w-16 text-start font-normal text-muted-foreground">{t('opticplusCards.ui.distance')}</th><th className="font-normal">BO</th><th className="font-normal">BI</th>
    </tr></thead><tbody>{[['6 m', 'tst38', 'tst39'], ['40 cm', 'tst40', 'tst41']].filter(([, r, l]) => has(r) || has(l)).map(([distance, r, l]) => <tr key={r}>
      <th scope="row" className="text-start font-normal" dir="ltr">{distance}</th><td className="px-1">{control(r)}</td><td className="ps-1">{control(l)}</td>
    </tr>)}</tbody></table>) : null}
    {list('accommodation', ['tst37', 'tst42', 'tst46', 'tst47', 'tst48', 'tst49', 'tst50', 'tst51', 'tst52'])}
    {list('sensory', ['tst43', 'tst44', 'tst53', 'tst54'])}
  </>;
  else body = <>{list('examContext', fields.filter(field => ['yeda','checkname','chdate','ct','qdomin','cyeda','number','insdate'].includes(field)))}
    {list('history', fields.filter(field => /^(?:rem|remark|dremark|khist)/.test(field)), true)}</>;
  const remaining = fields.filter(field => !used.has(field));
  const unknown = remaining.filter(field => !i18n.exists(`opticplusCards.fields.${field}`) && !i18n.exists(`opticplusCards.tableFields.${data.source_table}.${field}`));
  const known = remaining.filter(field => !unknown.includes(field));
  return <Card className="examcard w-full py-2" dir={i18n.dir()}>
    <CardContent className="space-y-2 px-3 [&>section:first-of-type]:border-0 [&>section:first-of-type]:pt-0">
      <h3 className="text-center text-sm font-medium text-muted-foreground" title={t('opticplusCards.sourceContext', { table: data.source_table, key: data.source_key })}>{t(`opticplusCards.cards.${type}`)}</h3>
      {body}
      {known.length ? !isEditing && (type === 'opticplus-prescription-details' || type === 'opticplus-contact-fitting') ? <details className="border-t border-border/40 pt-2">
        <summary className="cursor-pointer py-1 text-xs font-medium text-muted-foreground">{t('opticplusCards.sections.otherSourceFields')}</summary>
        <div className="pt-2">{list('otherSourceFields', known)}</div></details> : list('otherSourceFields', known) : null}
      {unknown.length ? <details open={isEditing || undefined} className="group border-t border-border/40 pt-2">
        <summary className="cursor-pointer py-1 text-xs font-medium text-muted-foreground">{t('opticplusCards.ui.originalFields', {count:unknown.length})}</summary>
        <p className="my-2 text-xs leading-relaxed text-muted-foreground">{t('opticplusCards.ui.unverifiedHelp')}</p>
        <div className="grid gap-3 sm:grid-cols-2">{unknown.map(field => <div key={field} className="min-w-0 space-y-1">
          <label htmlFor={`${data.card_instance_id}-${field}`} className="block text-xs text-muted-foreground" title={labelFor(field)}><span dir="ltr">{field}</span></label>{control(field)}
        </div>)}</div>
      </details> : null}
    </CardContent>
  </Card>;
}
export default OpticPlusMigrationCard;
