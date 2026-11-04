import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/localization/i18n';
import translations from '@/localization/optitech.json';
import { OptitechGlassesCheckCard } from '@/components/exam/OptitechGlassesCheckCard';
import { inputSyncManager } from '@/components/exam/shared/OptimizedInputs';
import { examComponentRegistry } from '@/lib/exam-component-registry';
import {
  applyOptitechGlassesCheckView,
  formatOptitechClockTime,
  OPTITECH_GLASSES_CHECK_TYPE,
} from '@/lib/optitech-glasses-check';

vi.mock('@/lib/api-client', () => ({ apiClient: {
  saveUnifiedExamData: vi.fn(), getUnifiedExamData: vi.fn(),
  getLookupTable: vi.fn(async () => ({ data: [] })),
} }));

afterEach(() => cleanup());

// The sample client's OptiTech glasses check, as phase 3 stored it.
const imported: Record<string, Record<string, unknown>> = {
  'uncorrected-va': { card_instance_id: 'uncorrected-va-1', r_fv: '3', l_fv: '4' },
  'final-prescription': { card_instance_id: 'final-prescription-1', r_sph: -3, l_sph: -4, r_cyl: -5.5, r_base: 'UP', r_va: '34', comb_va: '56', r_pd_far: 33, comb_pd_far: 99, r_high: 7 },
  addition: { card_instance_id: 'addition-1', r_read: 2, l_read: 1.25, r_iop: 3, l_iop: 4 },
  'optitech-examination': { card_instance_id: 'optitech-examination-1', AmslerR: 'חזק', NPAL: '3.0', CTD: '43234', IOPTime: '12/30/0/ 23:33:00', ReCheckDate: '2027-09-02', LowVisionNote: 'kept' },
  'optitech-prescription': { card_instance_id: 'optitech-prescription-1', PHR: '12', AddBaseR: 'IN', AddPrisR: '9.00', PAddBaseR: '0' },
  'optitech-prescription-optitech-prescription-previous-1': { card_instance_id: 'optitech-prescription-previous-1', BaseR1: '0', RetTypeId1: '0' },
  'optitech-prescription-optitech-prescription-previous-2': { card_instance_id: 'optitech-prescription-previous-2', SphR2: '-1.00' },
  'notes-notes-1': { card_instance_id: 'notes-1', note: 'הערה' },
};

function renderCard(isEditing = false) {
  const writeField = vi.fn();
  // Like the renderer, notes resolve to their "notes-notes-1" card.
  const blockOf = (component: string) => imported[component === 'notes' ? 'notes-notes-1' : component];
  render(<OptitechGlassesCheckCard isEditing={isEditing} writeField={writeField}
    readBlock={blockOf}
    readField={(component, field) => blockOf(component)?.[field]} />);
  return writeField;
}

describe('OptiTech glasses check card', () => {
  test('shows the imported values the way OptiTech does', async () => {
    await i18n.changeLanguage('he');
    renderCard();
    expect(screen.getByText(translations.he.glassesCheck.title)).toBeTruthy();
    expect(screen.getByDisplayValue('הערה')).toBeTruthy();
    for (const value of ['-3.00', '-5.50', '33.0', '99.0', '2.00', '1.25', '9.00', '43234', 'חזק', '3.0', '23:33']) {
      expect(screen.getByDisplayValue(value)).toBeTruthy();
    }
    // VA/FV/PH store the denominator; the card shows the full 6/x value.
    for (const value of ['6/3', '6/34', '6/56', '6/12']) expect(screen.getByDisplayValue(value)).toBeTruthy();
  });

  test('editing Read updates the addition and the prescription ADD together', async () => {
    await i18n.changeLanguage('en');
    const writeField = renderCard(true);
    const read = screen.getByLabelText('Read R-read');
    fireEvent.focus(read); fireEvent.input(read, { target: { value: '2.25' } }); fireEvent.blur(read);
    inputSyncManager.flush();
    expect(writeField).toHaveBeenCalledWith('addition', 'r_read', '2.25');
    expect(writeField).toHaveBeenCalledWith('final-prescription', 'r_ad', '2.25');
  });

  test('editing a shown 6/x acuity keeps storing the OptiTech denominator', async () => {
    await i18n.changeLanguage('en');
    const writeField = renderCard(true);
    const va = screen.getByLabelText('VA R-va');
    fireEvent.focus(va); fireEvent.input(va, { target: { value: '6/9' } }); fireEvent.blur(va);
    inputSyncManager.flush();
    expect(writeField).toHaveBeenCalledWith('final-prescription', 'r_va', '9');
  });

  test('keeps source fields it has no cell for, and drops empty "no base" codes', async () => {
    await i18n.changeLanguage('en');
    renderCard();
    fireEvent.click(screen.getByText('1 more source field'));
    expect(screen.getByDisplayValue('kept')).toBeTruthy();
    expect(screen.queryByLabelText('PAddBaseR')).toBeNull();
  });
});

test('shows an NPC imported under the older "NPC" column name', async () => {
  await i18n.changeLanguage('en');
  const legacy = { 'optitech-examination': { NPC: '323' } } as Record<string, Record<string, unknown>>;
  render(<OptitechGlassesCheckCard isEditing={false} writeField={vi.fn()}
    readBlock={(component) => legacy[component]}
    readField={(component, field) => legacy[component]?.[field]} />);
  expect(screen.getByLabelText('NPC')).toHaveProperty('value', '323');
  expect(screen.queryByText(/more source field/)).toBeNull();
});

describe('OptiTech glasses all-data view', () => {
  const cards = Object.entries(imported).map(([key, value]) => ({
    id: String(value.card_instance_id),
    type: key.startsWith('notes-') ? 'notes' : key.startsWith('optitech-prescription') ? 'optitech-prescription' : key,
  }));

  test('replaces the generic imported cards with one OptiTech card', () => {
    expect(applyOptitechGlassesCheckView(cards, imported)).toEqual([
      { id: 'optitech-glasses-check-1', type: OPTITECH_GLASSES_CHECK_TYPE },
      { id: 'optitech-prescription-previous-2', type: 'optitech-prescription' },
    ]);
  });

  test('leaves contact-lens and non-OptiTech exams alone', () => {
    const contact = { ...imported, 'contact-lens-exam': { r_bc: 8.6 } };
    expect(applyOptitechGlassesCheckView(cards, contact)).toBe(cards);
    const standard = { 'final-prescription': imported['final-prescription'] };
    expect(applyOptitechGlassesCheckView(cards, standard)).toBe(cards);
  });

  test('is registered but never offered in the layout editor', () => {
    expect(examComponentRegistry.get(OPTITECH_GLASSES_CHECK_TYPE)).toBeTruthy();
    expect(examComponentRegistry.getLayoutEditorTypes()).not.toContain(OPTITECH_GLASSES_CHECK_TYPE);
  });

  test('reads Access time-only values as the clock time', () => {
    expect(formatOptitechClockTime('12/30/99 09:05:00')).toBe('09:05');
    expect(formatOptitechClockTime('12/30/0/ 23:33:00')).toBe('23:33');
    expect(formatOptitechClockTime('14:10')).toBe('14:10');
  });
});
