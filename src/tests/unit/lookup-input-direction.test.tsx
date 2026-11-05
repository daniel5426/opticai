import React from 'react';
import {afterEach, expect, test, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {CityLookupInput} from '@/components/ui/city-lookup-input';
import {LookupSelect} from '@/components/ui/lookup-select';
import i18n from '@/localization/i18n';
vi.mock('@/hooks/useLookupData', () => ({useLookupData:()=>({data:[],loading:false,createItem:vi.fn(),isCreating:false})}));
afterEach(cleanup);

test.each(['he','en','fr'])('city and shared lookups follow the active %s direction', async locale => {
  await i18n.changeLanguage(locale);
  render(<><CityLookupInput value="Jerusalem" onChange={vi.fn()} /><LookupSelect lookupType="supplier" value="Supplier" onChange={vi.fn()} /></>);
  for (const input of screen.getAllByRole('textbox')) expect(input.getAttribute('dir')).toBe(locale==='he'?'rtl':'ltr');
});
