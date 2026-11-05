import type { GridLayoutItem } from '@/pages/exam-detail/utils';

/** A display arrangement for imported cards; never overwrites the saved layout. */
export function arrangeOpticPlusExam(items: GridLayoutItem[], availableWidth = Infinity): GridLayoutItem[] {
  const remaining = [...items];
  const result: GridLayoutItem[] = [];
  let y = 0;
  const take = (types: string[]) => types.flatMap(type => remaining.filter(item => item.type === type));
  const row = (cards: GridLayoutItem[], widths?: number[]) => {
    let x = 0;
    cards.forEach((card, index) => {
      const w = widths?.[index] ?? Math.floor(24 / cards.length);
      if (x + w > 24) {y++; x = 0;}
      result.push({...card,x,y,w}); x += w;
      remaining.splice(remaining.findIndex(item => item.id === card.id),1);
    });
    if (cards.length) y++;
  };
  const rows = (cards: GridLayoutItem[], count: number) => {
    for (let i = 0; i < cards.length; i += count) row(cards.slice(i, i + count));
  };
  // Use the actual exam pane, which changes independently of the browser width.
  const clinicalColumns = Math.max(1, Math.min(3, Math.floor((availableWidth + 16) / 456)));
  const prescriptionColumns = availableWidth >= 1280 ? 2 : 1;
  const detailColumns = availableWidth >= 896 ? 2 : 1;
  const noteColumns = Math.max(1, Math.min(3, Math.floor((availableWidth + 16) / 376)));
  const assessment = items.some(item => item.type === 'opticplus-ocular-health' || item.type === 'opticplus-questionnaire');
  if (assessment) {
    const small = take(['opticplus-measurements','schirmer-test','ocular-motor-assessment','anamnesis']);
    const widths: Record<string,number> = availableWidth >= 1400
      ? {'opticplus-measurements':6,'schirmer-test':4,'ocular-motor-assessment':4,anamnesis:10}
      : availableWidth >= 896
        ? {'opticplus-measurements':12,'schirmer-test':6,'ocular-motor-assessment':6,anamnesis:24}
        : {'opticplus-measurements':24,'schirmer-test':12,'ocular-motor-assessment':12,anamnesis:24};
    row(small,small.map(card => widths[card.type]));
    rows(take(['opticplus-ocular-health','opticplus-binocular','opticplus-questionnaire']), clinicalColumns);
  } else if (items.some(item => item.type === 'opticplus-contact-fitting')) {
    rows(take(['contact-lens-exam','old-contact-lenses']), prescriptionColumns);
    rows(take(['over-refraction','opticplus-contact-fitting']), prescriptionColumns);
  } else {
    rows(take(['final-prescription','subjective','objective','old-refraction','addition']), prescriptionColumns);
    rows(take(['opticplus-prescription-details','uncorrected-va']), detailColumns);
  }
  rows(remaining.filter(card => card.type !== 'notes'), detailColumns);
  // Keep all actual notes together, in source order, at the same visual level.
  rows(take(['notes']), noteColumns);
  return result;
}
