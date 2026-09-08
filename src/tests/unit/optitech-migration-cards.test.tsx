import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/localization/i18n';
import translations from '@/localization/optitech.json';
import { OptitechMigrationCard } from '@/components/exam/OptitechMigrationCard';
import { ExamCardRenderer, DetailProps } from '@/components/exam/ExamCardRenderer';
import { inputSyncManager } from '@/components/exam/shared/OptimizedInputs';
import { OPTITECH_CARD_TYPES, optitechFieldNames } from '@/lib/optitech-cards';
import { examComponentRegistry } from '@/lib/exam-component-registry';
import { apiClient } from '@/lib/api-client';
import { computeCardGridCols, parseLayoutData } from '@/pages/exam-detail/utils';
import { ensureLayoutDataForRows } from '@/lib/exam-ui-metadata';

vi.mock('@/lib/api-client', () => ({ apiClient: {
  saveUnifiedExamData: vi.fn(), getUnifiedExamData: vi.fn(),
  getLookupTable: vi.fn(async () => ({ data: [] })),
} }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('OptiTech migration card integration', () => {
  test.each(['he', 'en', 'fr'] as const)('renders source values in %s with deliberate direction', async language => {
    await i18n.changeLanguage(language);
    const { container } = render(<OptitechMigrationCard type="optitech-prescription"
      data={{ PHR: '12', AddPrisR: '9.00', UnknownClinicalField: '0' }}
      isEditing={false} onChange={vi.fn()} readBinding={() => undefined} writeBinding={vi.fn()} />);
    expect(screen.getByText(translations[language].cards['optitech-prescription'])).toBeTruthy();
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(language === 'he' ? 'rtl' : 'ltr');
    expect(screen.getByDisplayValue('9.00')).toBeTruthy();
    expect(screen.getByDisplayValue('0')).toBeTruthy();
  });

  test('bound edits go to the canonical field, source-only edits stay on their card', async () => {
    await i18n.changeLanguage('en');
    const bound = vi.fn(), change = vi.fn();
    render(<OptitechMigrationCard type="optitech-prescription" data={{ PHR: '12', bindings: {
      HighR: { component: 'final-prescription', field: 'r_high' },
    } }} isEditing onChange={change} readBinding={() => 7} writeBinding={bound} />);
    const high = screen.getByLabelText('High — R');
    fireEvent.focus(high); fireEvent.input(high, { target: { value: '8' } }); fireEvent.blur(high);
    inputSyncManager.flush();
    expect(bound).toHaveBeenCalledWith('final-prescription', 'r_high', '8');
    expect(change).not.toHaveBeenCalledWith('HighR', expect.anything());
  });

  test('registry save/load preserves migration fields, bindings, and repeated cards', async () => {
    const data = {
      'optitech-prescription': { card_instance_id: 'optitech-prescription-1', PHR: '12', bindings: { HighR: { component: 'final-prescription', field: 'r_high' } } },
      'optitech-prescription-optitech-prescription-previous-1': { card_instance_id: 'optitech-prescription-previous-1', PDDistR1: '33' },
      'optitech-prescription-optitech-prescription-previous-2': { card_instance_id: 'optitech-prescription-previous-2', PDDistR2: '34' },
      'final-prescription': { r_sph: -3, r_high: 7 },
    };
    let persisted: Record<string, unknown> = {};
    vi.spyOn(apiClient, 'saveUnifiedExamData').mockImplementation(async (_id, value) => { persisted = JSON.parse(JSON.stringify(value)); return {} as never; });
    vi.spyOn(apiClient, 'getUnifiedExamData').mockImplementation(async () => ({ data: persisted }) as never);
    await examComponentRegistry.saveAllData(7, data);
    const reopened = await examComponentRegistry.loadAllData(7);
    expect(reopened).toEqual(data);
    for (const type of OPTITECH_CARD_TYPES) {
      expect(examComponentRegistry.getLayoutEditorTypes()).not.toContain(type);
      expect(computeCardGridCols(type)).toBe(12);
    }
    const rows = parseLayoutData(JSON.stringify({ version: 2, grid: { columns: 24 }, items: [
      { id: 'optitech-prescription-previous-1', type: 'optitech-prescription', x: 0, y: 0, w: 12 },
      { id: 'optitech-prescription-previous-2', type: 'optitech-prescription', x: 12, y: 0, w: 12 },
    ] })).rows;
    const normalized = ensureLayoutDataForRows(reopened, rows, 7).examData;
    expect(normalized['optitech-prescription-optitech-prescription-previous-2']).toMatchObject({ PDDistR2: '34' });
  });

  test('real renderer reads the matching repeated card rather than the first card', async () => {
    await i18n.changeLanguage('en');
    const item = { id: 'optitech-prescription-previous-2', type: 'optitech-prescription' as const };
    const detailProps = { isEditing: false, examFormData: {
      'optitech-prescription': { PHR: '12' },
      'optitech-prescription-optitech-prescription-previous-2': { PHR: '34' },
    }, fieldHandlers: {} } as unknown as DetailProps;
    render(<ExamCardRenderer item={item} rowCards={[item]} mode="detail" isEditing={false} detailProps={detailProps} />);
    expect(screen.getByDisplayValue('6/34')).toBeTruthy();
    expect(screen.queryByDisplayValue('6/12')).toBeNull();
  });

  test('metadata never becomes a clinical field', () => {
    expect(optitechFieldNames({ card_instance_id: 'x', layout_instance_id: 7, bindings: {}, PHR: '0' })).toEqual(['PHR']);
  });
});
