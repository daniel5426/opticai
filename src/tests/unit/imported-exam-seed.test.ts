import { describe, expect, test } from 'vitest';
import { seedLayoutFromImportedData } from '@/lib/imported-exam-seed';

// The sample client's imported glasses check (stored outside any layout).
const imported = {
  'uncorrected-va': { layout_instance_id: 1561911, card_instance_id: 'uncorrected-va-1', r_fv: '3', l_fv: '4' },
  'final-prescription': { layout_instance_id: 1561911, card_instance_id: 'final-prescription-1', r_sph: -3, r_va: '34', comb_va: '56', l_va: '6/9' },
  addition: { layout_instance_id: 1561911, card_instance_id: 'addition-1', r_read: 2 },
  'notes-notes-1': { layout_instance_id: 1561911, card_instance_id: 'notes-1', note: 'הערה' },
  'optitech-examination': { card_instance_id: 'optitech-examination-1', AmslerR: 'חזק' },
};

describe('seedLayoutFromImportedData', () => {
  test('fills each card of an empty layout tab from the imported data', () => {
    const seeded = seedLayoutFromImportedData(imported, [
      { id: 'final-prescription-7', type: 'final-prescription' },
      { id: 'addition-2', type: 'addition' },
      { id: 'uncorrected-va-1', type: 'uncorrected-va' },
      { id: 'notes-3', type: 'notes' },
      { id: 'objective-1', type: 'objective' },
    ], 1564684);
    expect(seeded['final-prescription-final-prescription-7']).toMatchObject({
      r_sph: -3, card_instance_id: 'final-prescription-7', layout_instance_id: 1564684, __imported_copy: true,
    });
    expect(seeded['addition-addition-2']).toMatchObject({ r_read: 2, layout_instance_id: 1564684 });
    expect(seeded['notes-notes-3']).toMatchObject({ note: 'הערה', card_instance_id: 'notes-3' });
    // Cards the import has nothing for stay empty rather than inventing values.
    expect(seeded['objective-objective-1']).toBeUndefined();
    // Migration-only cards are not pushed into standard layouts.
    expect(Object.keys(seeded).some((key) => key.startsWith('optitech-'))).toBe(false);
  });

  test('fills a final subjective card from the imported final prescription when the layout has no prescription card', () => {
    const seeded = seedLayoutFromImportedData(imported, [{ id: 'final-subjective-1', type: 'final-subjective' }], 5);
    expect(seeded['final-subjective']).toMatchObject({ r_sph: -3, r_va: '6/34', card_instance_id: 'final-subjective-1' });
    const both = seedLayoutFromImportedData(imported, [
      { id: 'final-subjective-1', type: 'final-subjective' },
      { id: 'final-prescription-1', type: 'final-prescription' },
    ], 5);
    expect(both['final-subjective']).toBeUndefined();
    expect(both['final-prescription']).toMatchObject({ r_sph: -3 });
  });

  test('presents OptiTech acuity denominators in the 6/x notation standard cards use', () => {
    const seeded = seedLayoutFromImportedData(imported, [
      { id: 'final-prescription-1', type: 'final-prescription' },
      { id: 'uncorrected-va-1', type: 'uncorrected-va' },
    ], 9);
    expect(seeded['final-prescription']).toMatchObject({ r_va: '6/34', comb_va: '6/56', l_va: '6/9' });
    expect(seeded['uncorrected-va']).toMatchObject({ r_fv: '6/3', l_fv: '6/4' });
    // The imported record itself is left untouched.
    expect(imported['final-prescription'].r_va).toBe('34');
  });
});
