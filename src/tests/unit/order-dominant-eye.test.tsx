import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OrderFinalPrescriptionTab } from '@/components/orders/OrderFinalPrescriptionTab';
import { normalizeDominantEye } from '@/hooks/client/useClientDominantEye';
import i18n from '@/localization/i18n';

afterEach(cleanup);

it('reads the dominant eye however exams and imports stored it', () => {
  expect(['R', 'right', 'ימין', ' r '].map(normalizeDominantEye)).toEqual(['R', 'R', 'R', 'R']);
  expect(['L', 'Left', 'שמאל'].map(normalizeDominantEye)).toEqual(['L', 'L', 'L']);
  expect([null, '', 'x'].map(normalizeDominantEye)).toEqual([null, null, null]);
});

it('shows the dominant eye beside the prescription title only when known', async () => {
  await i18n.changeLanguage('he');
  const props = { finalPrescriptionData: {} as any, onFinalPrescriptionChange: () => {}, isEditing: false };
  const { rerender } = render(<OrderFinalPrescriptionTab {...props} />);
  expect(screen.queryByLabelText(/עין דומיננטית/)).toBeNull();
  rerender(<OrderFinalPrescriptionTab {...props} dominantEye="L" dominantEyeFromExam />);
  const pill = screen.getByLabelText('עין דומיננטית: שמאל');
  expect(pill.getAttribute('title')).toBe('מהבדיקה האחרונה של הלקוח');
});
