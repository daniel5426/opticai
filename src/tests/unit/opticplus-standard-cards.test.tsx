import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VASelect } from '@/components/exam/shared/VASelect';
import { SchirmerTestTab } from '@/components/exam/SchirmerTestTab';
import { AnamnesisTab } from '@/components/exam/AnamnesisTab';
import { ImportedClinicalContext } from '@/lib/imported-clinical-context';
import i18n from '@/localization/i18n';

vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentUser: { va_format: 'decimal' } }) }));
vi.mock('@/hooks/useLookupData', () => ({ useLookupData: () => ({ data: [], loading: false }) }));
afterEach(cleanup);

test.each(['6.7', '1.6', '6/7.5-', '6/6/9', '6/9'])('source VA %s remains literal despite user decimal preference', value => {
  const onChange = vi.fn();
  render(<ImportedClinicalContext.Provider value={{ literalVA: true }}><VASelect value={value} disabled onChange={onChange} /></ImportedClinicalContext.Provider>);
  expect(screen.getByRole('combobox').textContent).toContain(value);
  expect(onChange).not.toHaveBeenCalled();
});

test('BUT-only import shows bilateral tear film results without implying Schirmer results', async () => {
  await i18n.changeLanguage('en');
  render(<ImportedClinicalContext.Provider value={{ butOnly: true }}><SchirmerTestTab schirmerTestData={{layout_instance_id:1,r_but:0,l_but:14}}
    onSchirmerTestChange={vi.fn()} isEditing={false} /></ImportedClinicalContext.Provider>);
  expect(screen.getByText('Tear film · BUT')).toBeTruthy();
  expect(screen.queryByText('Schirmer Test')).toBeNull();
  expect(screen.getAllByRole('textbox')).toHaveLength(2);
  expect(Number((screen.getByRole('textbox',{name:'Right · TBUT (s)'}) as HTMLInputElement).value)).toBe(0);
});

test('imported anamnesis displays only source-established history and no inferred contact-lens flag', async () => {
  await i18n.changeLanguage('en');
  render(<ImportedClinicalContext.Provider value={{fields:['medications','family_history','additional_notes']}}>
    <AnamnesisTab anamnesisData={{layout_instance_id:1,medications:'109',family_history:'110',additional_notes:'111'}} onAnamnesisChange={vi.fn()} isEditing={false} />
  </ImportedClinicalContext.Provider>);
  expect(screen.getByRole('textbox',{name:'Medication'})).toBeTruthy();
  expect(screen.getAllByRole('textbox')).toHaveLength(3);
  expect(screen.queryByRole('switch')).toBeNull();
});
