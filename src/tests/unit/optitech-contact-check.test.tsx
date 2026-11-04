import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/localization/i18n';
import translations from '@/localization/optitech.json';
import { OptitechContactCheckCard } from '@/components/exam/OptitechContactCheckCard';
import { inputSyncManager } from '@/components/exam/shared/OptimizedInputs';
import { examComponentRegistry } from '@/lib/exam-component-registry';
import {
  applyOptitechContactCheckView,
  keratometryDerived,
  OPTITECH_CONTACT_CHECK_TYPE,
} from '@/lib/optitech-contact-check';
import { applyOptitechGlassesCheckView } from '@/lib/optitech-glasses-check';
import { groupOptitechExams, pickExamForTab } from '@/lib/optitech-exam-tabs';

vi.mock('@/lib/api-client', () => ({ apiClient: {
  saveUnifiedExamData: vi.fn(), getUnifiedExamData: vi.fn(),
  getLookupTable: vi.fn(async () => ({ data: [] })),
} }));
vi.mock('@/components/ui/user-select', () => ({ UserSelect: () => null }));

afterEach(() => cleanup());

// The sample client's OptiTech contact-lens check, as phase 3 stored it.
const imported: Record<string, Record<string, unknown>> = {
  'schirmer-test': { card_instance_id: 'schirmer-test-1', r_mm: 32, l_mm: 21, r_but: 4, l_but: 43 },
  'contact-lens-diameters': { card_instance_id: 'contact-lens-diameters-1', pupil_diameter: '4', corneal_diameter: 3 },
  'contact-lens-details': { card_instance_id: 'contact-lens-details-1', r_lens_type: 'חד פעמי', r_supplier: 'סופלקס', r_model: 'טוטאל1', r_material: 'SD60', l_model: 'דספו טורי' },
  'contact-lens-exam': { card_instance_id: 'contact-lens-exam-1', r_bc: 2.3, r_oz: 5, r_diam: 2, l_diam: 3, r_sph: -2, r_cyl: -8, r_ax: 7, r_read_ad: 3, r_va: '54', l_va: '28', comb_va: '47' },
  'contact-lens-order': { card_instance_id: 'contact-lens-order-1', cleaning_solution: 'אופטיפרי', disinfection_solution: 'דספו', branch: 'בדיקה 12/10' },
  'optitech-examination': { card_instance_id: 'optitech-examination-1', ReCheckDate: '2027-09-02' },
  'optitech-contact-measurements': {
    card_instance_id: 'optitech-contact-measurements-1', EyeLidKey: '2.0', Ecolor: 'כחול',
    rHR: '3.40', rHL: '4.40', rVR: '3.30', rVL: '5.50', AxHR: '66', rTR: '4.50', rNR: '5.00', rIR: '6.00', rSR: '1.20',
    BC2R: '3.50', PrR: '0', TintR: '0', PHR: '32', PHL: '12', BlinkFreq: '54', BlinkQual: '33', ClensSolRinseId: '0', ClensId: '3921',
  },
  'notes-notes-1': { card_instance_id: 'notes-1', note: 'הערות לעדשות מגע' },
};

function renderCard(data = imported, isEditing = false) {
  const writeField = vi.fn();
  const blockOf = (component: string) => data[component === 'notes' ? 'notes-notes-1' : component];
  render(<OptitechContactCheckCard isEditing={isEditing} writeField={writeField} readBlock={blockOf}
    readField={(component, field) => blockOf(component)?.[field]} />);
  return writeField;
}

describe('OptiTech contact lens check card', () => {
  test('shows the imported values in the OptiTech layout', async () => {
    await i18n.changeLanguage('he');
    renderCard();
    expect(screen.getByText(translations.he.contactCheck.title)).toBeTruthy();
    for (const value of ['3.40', '3.30', '66', '4.50', 'חד פעמי', 'סופלקס', 'טוטאל1', '2.0', '2.30', '3.50', '3.00', '-2.00', '-8.00',
      'SD60', '6/54', '6/47', '6/28', '32', '12', '4', '21', '43', 'כחול', '33', '54', 'אופטיפרי', 'דספו', 'הערות לעדשות מגע']) {
      expect(screen.getAllByDisplayValue(value).length).toBeGreaterThan(0);
    }
    // Lookup code 0 is OptiTech's "no selection".
    expect(screen.getAllByDisplayValue('[ללא]').length).toBe(3);
    // Aver and corneal Cyl are derived from rH/rV exactly as OptiTech shows them.
    expect(screen.getByLabelText('Aver R').textContent).toBe('3.35');
    expect(screen.getByLabelText('Cyl. L').textContent).toBe('+15.34');
  });

  test('edits go back to the field the value came from', async () => {
    await i18n.changeLanguage('en');
    const withPrism = { ...imported, 'optitech-contact-measurements': { ...imported['optitech-contact-measurements'], PrR: '2' } };
    const writeField = renderCard(withPrism, true);
    const edit = (label: string, value: string) => {
      const input = screen.getByLabelText(label);
      fireEvent.focus(input); fireEvent.input(input, { target: { value } }); fireEvent.blur(input);
    };
    edit('rH R-rH', '7.80');
    edit('VA R-va', '6/9');
    edit('Tint R-tint', 'Blue');
    edit('Pr. R-prism', '[ללא]');
    inputSyncManager.flush();
    expect(writeField).toHaveBeenCalledWith('optitech-contact-measurements', 'rHR', '7.80');
    expect(writeField).toHaveBeenCalledWith('contact-lens-exam', 'r_va', '9');
    // Tint has no resolved lookup, so it stays on the source field; [ללא] is stored as code 0.
    expect(writeField).toHaveBeenCalledWith('optitech-contact-measurements', 'TintR', 'Blue');
    expect(writeField).toHaveBeenCalledWith('optitech-contact-measurements', 'PrR', '0');
  });

  test('picks up a mires column from newer OptiTech versions and keeps unplaced fields', async () => {
    await i18n.changeLanguage('en');
    renderCard({ ...imported, 'optitech-contact-measurements': { ...imported['optitech-contact-measurements'], MiresR: '12' } });
    expect(screen.getByLabelText('Mires mires')).toHaveProperty('value', '12');
    fireEvent.click(screen.getByText(/more source field/));
    expect(screen.getByDisplayValue('3921')).toBeTruthy();
    expect(screen.getByDisplayValue('בדיקה 12/10')).toBeTruthy();
  });
});

describe('OptiTech contact lens all-data view', () => {
  const cards = Object.entries(imported).map(([key, value]) => ({
    id: String(value.card_instance_id),
    type: key.startsWith('notes-') ? 'notes' : key,
  }));

  test('replaces the generic imported contact-lens cards with one OptiTech card', () => {
    expect(applyOptitechContactCheckView(cards, imported)).toEqual([{ id: 'optitech-contact-check-1', type: OPTITECH_CONTACT_CHECK_TYPE }]);
    // The glasses view never claims a contact-lens exam.
    expect(applyOptitechGlassesCheckView(cards, imported)).toBe(cards);
    expect(examComponentRegistry.getLayoutEditorTypes()).not.toContain(OPTITECH_CONTACT_CHECK_TYPE);
  });

  test('derives keratometry like OptiTech and leaves incomplete input blank', () => {
    expect(keratometryDerived('3.40', '3.30')).toEqual({ average: '3.35', cylinder: '-3.01' });
    expect(keratometryDerived('', '3.30')).toEqual({ average: '', cylinder: '' });
  });
});

describe('OptiTech exam tabs', () => {
  const exams = [
    { id: 1, test_name: 'OptiTech Glasses Exam', exam_date: '2026-09-02' },
    { id: 2, test_name: 'OptiTech Contact Lens Exam', exam_date: '2025-01-01' },
    { id: 3, test_name: 'OptiTech Contact Lens Exam', exam_date: '2026-09-02' },
    { id: 4, test_name: 'OptiTech vision', exam_date: '2026-09-02' },
    { id: 5, test_name: 'בדיקה רגילה', exam_date: '2026-09-02' },
  ] as any[];

  test('counts each OptiTech tab and ignores regular exams', () => {
    const groups = groupOptitechExams(exams);
    expect(Object.fromEntries(Object.entries(groups).map(([kind, list]) => [kind, list.length])))
      .toEqual({ glasses: 1, contact: 2, review: 0, diagnosis: 0, vision: 1 });
  });

  test('opens the same visit first, otherwise the latest exam of that kind', () => {
    const { contact } = groupOptitechExams(exams);
    expect(pickExamForTab(contact, '2026-09-02')?.id).toBe(3);
    expect(pickExamForTab(contact, '2020-01-01')?.id).toBe(3);
    expect(pickExamForTab([], '2026-09-02')).toBeUndefined();
  });
});
