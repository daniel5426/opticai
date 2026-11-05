import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/localization/i18n';
import { OpticPlusMigrationCard } from '@/components/exam/OpticPlusMigrationCard';
import { OPTICPLUS_CARD_TYPES, importedExamName } from '@/lib/opticplus-cards';
import { examComponentRegistry } from '@/lib/exam-component-registry';
import labels from '@/localization/opticplus-cards.json';

afterEach(cleanup);
test.each(['en', 'he', 'fr'])('imported text follows %s direction while numeric notation stays LTR', async locale => {
  await i18n.changeLanguage(locale);
  render(<OpticPlusMigrationCard type="opticplus-contact-fitting" data={{card_instance_id:'direction',cnrtype:'lens type',cnrsph:'-3.25'}} isEditing={false} onChange={vi.fn()} />);
  const text = screen.getByRole('textbox', {name:i18n.t('opticplusCards.fields.cnrtype')});
  const number = screen.getByRole('textbox', {name:i18n.t('opticplusCards.fields.cnrsph')});
  expect(text.getAttribute('dir')).toBe(locale === 'he' ? 'rtl' : 'ltr');
  expect(number.getAttribute('dir')).toBe('ltr');
  expect(text.style.textAlign).toBe(locale === 'he' ? 'right' : 'left');
});
describe.each(['en', 'he', 'fr'] as const)('OpticPlus cards %s', locale => {
  test('shows false and zero, translates fields, and edits booleans without losing their type', async () => {
    await i18n.changeLanguage(locale);
    const onChange=vi.fn();
    render(<OpticPlusMigrationCard type="opticplus-questionnaire" data={{ card_instance_id:'questionnaire-1',source_table:'tb_quest',source_key:'1',layout_instance_id:-1,source_layout_instance_id:4,qyes1:true,qno1:false,remk1:'0' }} isEditing onChange={onChange} />);
    expect(screen.getByText(labels[locale].cards['opticplus-questionnaire']).closest('[dir]')?.getAttribute('dir')).toBe(locale==='he'?'rtl':'ltr');
    expect(screen.queryByText(/source_layout_instance_id/)).toBeNull();
    expect(screen.getByRole('checkbox',{name:labels[locale].fields.qno1}).getAttribute('aria-checked')).toBe('false');
    expect((screen.getByLabelText(labels[locale].fields.remk1) as HTMLInputElement).value).toBe('0');
    expect(screen.getByLabelText(labels[locale].fields.remk1).getAttribute('dir')).toBe('ltr');
    expect((screen.getByLabelText(labels[locale].fields.remk1) as HTMLInputElement).style.textAlign).toBe(locale === 'he' ? 'right' : 'left');
    fireEvent.click(screen.getByRole('checkbox',{name:labels[locale].fields.qno1}));
    expect(onChange).toHaveBeenCalledWith('qno1',true);
    expect(importedExamName(i18n.t.bind(i18n),'opticplus.exam.contact')).toBe(labels[locale].exam.contact);
  });
});
test('all OpticPlus cards are registered but unavailable to layout building',()=>{
  for(const type of OPTICPLUS_CARD_TYPES) expect(examComponentRegistry.get(type)?.showInLayoutEditor).toBe(false);
  expect(examComponentRegistry.getLayoutEditorTypes().some(type => (OPTICPLUS_CARD_TYPES as readonly string[]).includes(type))).toBe(false);
});
test('every new label exists in all three languages',()=>{
  const paths=(value:Record<string,unknown>,prefix=''):string[]=>Object.entries(value).flatMap(([key,item])=>typeof item==='object'?paths(item as Record<string,unknown>,prefix+key+'.'):[prefix+key]);
  expect(paths(labels.en).sort()).toEqual(paths(labels.he).sort());
  expect(paths(labels.en).sort()).toEqual(paths(labels.fr).sort());
});

test('bound fields read and edit the standard card instead of an independent copy',async()=>{
  await i18n.changeLanguage('en');
  const onChange=vi.fn(),writeBinding=vi.fn();
  render(<OpticPlusMigrationCard type="opticplus-prescription-details" data={{card_instance_id:'extra',crvisus:'6/9',bindings:{crvisus:{component:'final-prescription',field:'r_va',cardInstanceId:'final-prescription-1'}}}}
    isEditing onChange={onChange} readBinding={()=>'6/6'} writeBinding={writeBinding} />);
  const input=screen.getByLabelText(labels.en.fields.crvisus) as HTMLInputElement;
  expect(input.value).toBe('6/6');
  fireEvent.focus(input);fireEvent.input(input,{target:{value:'6/12'}});fireEvent.blur(input);
  expect(writeBinding).toHaveBeenCalledWith('final-prescription','r_va','6/12','final-prescription-1');
  expect(onChange).not.toHaveBeenCalled();
});

test.each([[false,false,'Not recorded'],[true,true,'Both yes and no selected'],[true,false,'Yes'],[false,true,'No']])('questionnaire source flags %s/%s retain their own answer state',async(yes,no,status)=>{
  await i18n.changeLanguage('en');
  render(<OpticPlusMigrationCard type="opticplus-questionnaire" data={{card_instance_id:'state',qyes1:yes,qno1:no,remk1:'note'}} isEditing={false} onChange={vi.fn()} />);
  expect(screen.getByText(String(status),{exact:true})).toBeTruthy();
  expect(screen.getByRole('textbox',{name:'Visit reason'})).toBeTruthy();
});

test('bilateral measurements share a row and retain the missing eye instead of copying it',async()=>{
  await i18n.changeLanguage('en');
  render(<OpticPlusMigrationCard type="opticplus-measurements" data={{card_instance_id:'paired',gijr:'0',gijl:'6',kr:'11'}} isEditing={false} onChange={vi.fn()} />);
  const right=screen.getByLabelText(labels.en.fields.gijr),left=screen.getByLabelText(labels.en.fields.gijl);
  expect(right.closest('tr')).toBe(left.closest('tr'));
  expect((right as HTMLInputElement).value).toBe('0');
  expect(screen.getByLabelText('Not recorded')).toBeTruthy();
});

test('OpticPlus instance layouts are retained without requiring a selectable library template',async()=>{
  const {hasOpticPlusLayout}=await import('@/lib/opticplus-cards');
  const instance={layout_data:JSON.stringify({version:2,items:[{id:'native',type:'addition'}]})};
  expect(hasOpticPlusLayout({instance,exam_data:{addition:{opticplus_source:{table:'checks'}}}})).toBe(true);
  expect(hasOpticPlusLayout({instance,exam_data:{'opticplus-measurements':{gijr:'5'}}})).toBe(true);
  expect(hasOpticPlusLayout({instance,exam_data:{addition:{r_bif:1.75}}})).toBe(false);
  expect(hasOpticPlusLayout({instance:{layout_data:'invalid'},exam_data:{'opticplus-measurements':{gijr:'5'}}})).toBe(false);
});


test('formats binary decimal noise for display without changing source text or identifiers', async () => {
  const {opticPlusDisplayValue}=await import('@/lib/opticplus-cards');
  expect(opticPlusDisplayValue(i18n.t.bind(i18n),'8.199999999999999','en')).toBe('8.2');
  expect(opticPlusDisplayValue(i18n.t.bind(i18n),'0000000004','en')).toBe('0000000004');
  expect(opticPlusDisplayValue(i18n.t.bind(i18n),'6/6/9','en')).toBe('6/6/9');
});
