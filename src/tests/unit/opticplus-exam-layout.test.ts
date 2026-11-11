import { expect, test } from 'vitest';
import { arrangeOpticPlusExam } from '@/lib/opticplus-exam-layout';
import type { GridLayoutItem } from '@/pages/exam-detail/utils';

const cards = (types: string[]): GridLayoutItem[] => types.map((type, index) => ({
  id: `${type}-${index}`, type, x: 0, y: index * 2, w: 24,
}));

test('glasses prescription and additions share a row and actual notes stay together', () => {
  const source = cards(['notes', 'addition', 'uncorrected-va', 'final-prescription', 'notes', 'opticplus-prescription-details', 'notes']);
  const original = structuredClone(source);
  const result = arrangeOpticPlusExam(source);
  expect(result.find(card => card.type === 'addition')?.y).toBe(result.find(card => card.type === 'final-prescription')?.y);
  expect(new Set(result.filter(card => card.type === 'notes').map(card => card.y)).size).toBe(1);
  expect(result.filter(card => card.type === 'notes').map(card => card.id)).toEqual(source.filter(card => card.type === 'notes').map(card => card.id));
  expect(source).toEqual(original);
});

test('assessment gives short measurements proportionate width and retains repeated source cards without overlap', () => {
  const source = cards(['opticplus-ocular-health', 'opticplus-binocular', 'opticplus-questionnaire', 'opticplus-ocular-health', 'opticplus-measurements', 'schirmer-test', 'ocular-motor-assessment', 'anamnesis', 'notes']);
  const result = arrangeOpticPlusExam(source);
  expect(result.map(card => card.id).sort()).toEqual(source.map(card => card.id).sort());
  expect(result.find(card => card.type === 'schirmer-test')!.w).toBeLessThan(result.find(card => card.type === 'opticplus-ocular-health')!.w);
  result.forEach((card, index) => {
    expect(card.x + card.w).toBeLessThanOrEqual(24);
    expect(card.w).toBeGreaterThan(0);
    result.slice(index + 1).filter(other => other.y === card.y).forEach(other => {
      expect(card.x + card.w <= other.x || other.x + other.w <= card.x).toBe(true);
    });
  });
});

test('contact fitting stays with over-refraction and unknown cards are retained', () => {
  const result = arrangeOpticPlusExam(cards(['notes', 'contact-lens-exam', 'opticplus-contact-fitting', 'over-refraction', 'keratometer']));
  expect(result.find(card => card.type === 'opticplus-contact-fitting')!.y).toBe(result.find(card => card.type === 'over-refraction')!.y);
  expect(result.find(card => card.type === 'keratometer')).toBeTruthy();
});
