import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';
import translations from '@/localization/optitech.json';
import { OptitechVisionCheckCard } from '@/components/exam/OptitechVisionCheckCard';
import { inputSyncManager } from '@/components/exam/shared/OptimizedInputs';
import { examComponentRegistry } from '@/lib/exam-component-registry';
import {
  applyOptitechVisionCheckView,
  OPTITECH_VISION_CHECK_TYPE,
  OPTITECH_VISION_ROWS,
  readVisionField,
} from '@/lib/optitech-vision-check';
import { getExamPageData, getExamsByClientId } from '@/lib/db/exams-db';

vi.mock('@/lib/api-client', () => ({ apiClient: {
  saveUnifiedExamData: vi.fn(), getUnifiedExamData: vi.fn(),
  getLookupTable: vi.fn(async () => ({ data: [] })),
} }));
vi.mock('@/components/ui/user-select', () => ({ UserSelect: () => null }));
vi.mock('@/lib/db/exams-db', () => ({ getExamsByClientId: vi.fn(async () => []), getExamPageData: vi.fn() }));

afterEach(() => { cleanup(); vi.mocked(getExamsByClientId).mockResolvedValue([]); });

// The sample client's OptiTech "תפקודי ראייה" row (tblCrdDisDiags, 02/09/26) as phase 3 stored it.
const imported: Record<string, Record<string, unknown>> = {
  'optitech-accommodation': {
    card_instance_id: 'optitech-accommodation-1', PushUp: '2', MinusLens: '3', MonAccFac6: '4', MonAccFac7: '5', MonAccFac8: '4',
    MonAccFac13: '1', BinAccFac6: '6', BinAccFac7: '7', BinAccFac8: '8', BinAccFac13: '8', MEMRet: '6', FusedXCyl: '5', NRA: '4', PRA: '33',
  },
  'optitech-binocular': {
    card_instance_id: 'optitech-binocular-1', CoverDist: '5', CoverNear: '6', DistLatFor: '8', DistVerFor: '9', NearLatFor: '98',
    NearVerFor: '4', ACARatio: '2', SmverBo6M: '2', SmverBi6M: '3', SmverBo40CM: '2', SmverBi40CM: '1', StverBo7: '14', StverBi7: '4',
    StverBo6M: '5', StverBi6M: '75', StverBo40CM: '54', StverBi40CM: '32', JmpVer5: '12', JmpVer8: '76', AccTarget: '96',
    Penlight: '46', PenLightRG: '37', FutureColumn: 'kept',
  },
};

function renderCard(isEditing = false, exam: Record<string, unknown> = {}) {
  const writeField = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OptitechVisionCheckCard isEditing={isEditing} writeField={writeField} readBlock={(component) => imported[component]}
        exam={{ examDate: '2026-09-02', onExamDateChange: vi.fn(), onUserChange: vi.fn(), onDominantEyeChange: vi.fn(), ...exam }} />
    </QueryClientProvider>,
  );
  return writeField;
}

describe('OptiTech visual functions card', () => {
  test('lays out every OptiTech test with its expected findings and the imported value', async () => {
    await i18n.changeLanguage('he');
    renderCard();
    expect(screen.getByText(translations.he.visionCheck.title)).toBeTruthy();
    expect(screen.getByText('Accommodative Findings')).toBeTruthy();
    expect(screen.getByText('Binocular Vision Findings')).toBeTruthy();
    expect(screen.getByText('15-1/4 (age)')).toBeTruthy();
    expect(screen.getByText('02/09/26')).toBeTruthy();
    // Values keep OptiTech's formats: whole diopters, 2-decimal facility/diopter values, text vergences.
    expect(screen.getByLabelText('PushUp 2026-09-02')).toHaveProperty('value', '2');
    expect(screen.getByLabelText('MonAccFac6 2026-09-02')).toHaveProperty('value', '4.00');
    expect(screen.getByLabelText('PRA 2026-09-02')).toHaveProperty('value', '33.00');
    expect(screen.getByLabelText('JmpVer8 2026-09-02')).toHaveProperty('value', '76.00');
    expect(screen.getByLabelText('NearLatFor 2026-09-02')).toHaveProperty('value', '98');
    expect(screen.getByLabelText('PenLightRG 2026-09-02')).toHaveProperty('value', '37');
  });

  test('maps all 36 tblCrdDisDiags measurements to a row', () => {
    const rows = OPTITECH_VISION_ROWS.filter((row) => row.kind === 'test');
    expect(rows).toHaveLength(36);
    for (const row of rows) {
      if (row.kind !== 'test') continue;
      expect(readVisionField(imported[row.component], row.field).value, row.field).not.toBe('');
    }
  });

  test('edits are written back to the imported field', async () => {
    await i18n.changeLanguage('en');
    const writeField = renderCard(true);
    const input = screen.getByLabelText('MEMRet 2026-09-02');
    fireEvent.focus(input); fireEvent.input(input, { target: { value: '0.75' } }); fireEvent.blur(input);
    inputSyncManager.flush();
    expect(writeField).toHaveBeenCalledWith('optitech-accommodation', 'MEMRet', '0.75');
  });

  test('keeps source fields without a row', async () => {
    await i18n.changeLanguage('en');
    renderCard();
    fireEvent.click(screen.getByText(/more source field/));
    expect(screen.getByDisplayValue('kept')).toBeTruthy();
  });

  test('shows the client\'s other vision exams as read-only date columns, newest first', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(getExamsByClientId).mockResolvedValue([
      { id: 1, test_name: 'OptiTech vision', exam_date: '2026-09-02' },
      { id: 2, test_name: 'OptiTech vision', exam_date: '2025-03-01' },
    ] as any);
    vi.mocked(getExamPageData).mockResolvedValue({ instances: [{ exam_data: { 'optitech-accommodation': { PushUp: '7' } } }] });
    renderCard(false, { examId: 1, clientId: 9 });
    expect(await screen.findByText('01/03/25')).toBeTruthy();
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers.slice(3)).toEqual(['02/09/26', '01/03/25']);
    expect(await screen.findByText('7')).toBeTruthy();
  });
});

describe('OptiTech visual functions all-data view', () => {
  test('replaces the generic accommodation and binocular cards with one flowsheet card', () => {
    const cards = [
      { id: 'optitech-accommodation-1', type: 'optitech-accommodation' },
      { id: 'optitech-binocular-1', type: 'optitech-binocular' },
    ];
    expect(applyOptitechVisionCheckView(cards, imported)).toEqual([{ id: 'optitech-vision-check-1', type: OPTITECH_VISION_CHECK_TYPE }]);
    expect(applyOptitechVisionCheckView(cards, { ...imported, 'final-prescription': {} })).toBe(cards);
    expect(examComponentRegistry.getLayoutEditorTypes()).not.toContain(OPTITECH_VISION_CHECK_TYPE);
  });
});
