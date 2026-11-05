import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from '@/components/ui/input';
import { FastInput, inputSyncManager } from '@/components/exam/shared/OptimizedInputs';
import { ToggleTextNumberInput } from '@/components/exam/shared/ToggleTextNumberInput';
import { useUnsavedChanges } from '@/hooks/shared/useUnsavedChanges';
import { EXAM_FIELDS } from '@/components/exam/data/exam-field-definitions';
import i18n from '@/localization/i18n';

const fixture = vi.hoisted(() => ({ block: () => false, enabled: true, renders: 0, updates: [] as string[] }));
vi.mock('@/contexts/NavigationGuardContext', () => ({ useNavigationGuard: () => ({ registerGuard: () => {} }) }));
vi.mock('@tanstack/react-router', () => ({ useBlocker: (options: any) => {
  fixture.block = options.shouldBlockFn;
  return { status: 'idle' };
} }));

afterEach(() => { act(() => inputSyncManager.flush()); cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function Prescription({ initial = '' }: { initial?: string }) {
  const [sph, setSph] = React.useState(initial);
  return <div data-clinical-nav-scope="true" data-clinical-nav-card="true" dir="ltr">
    <ToggleTextNumberInput value={sph} onChange={setSph} textOptions={EXAM_FIELDS.SPH.textOptions}
      textValueAliases={EXAM_FIELDS.SPH.textValueAliases} numericProps={{ step: '0.25', min: -30, max: 25, showPlus: true, 'aria-label': 'SPH', debounceMs: 0 }} />
    <FastInput value="" type="number" aria-label="CYL" />
  </div>;
}

function GuardedForm() {
  fixture.renders++;
  const [value, setValue] = React.useState('1.00');
  const guard = useUnsavedChanges({ getSerializedState: () => JSON.stringify({ value }), isEditing: true, isNewMode: false, enabled: fixture.enabled });
  React.useEffect(() => guard.setBaseline(), []);
  return <><FastInput aria-label="Value" value={value} onChange={next => { fixture.updates.push(next); setValue(next); }} type="number" step="0.25" debounceMs={1500} />
    <output aria-label="Saved value">{value}</output><output aria-label="Dialog">{String(guard.showUnsavedDialog)}</output>
    <button onClick={() => guard.handleNavigationAttempt(() => {})}>Leave</button></>;
}

describe.each(['he', 'en', 'fr'])('clinical inputs in %s', locale => {
  beforeEach(async () => {
    await i18n.changeLanguage(locale);
    fixture.enabled = true; fixture.renders = 0; fixture.updates = [];
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
  });

  it.each(['-2.25', '+1.25', '0.25'])('keeps %s numeric and advances to CYL after completion', async value => {
    const user = userEvent.setup();
    render(<Prescription />);
    const input = screen.getByLabelText('SPH');
    await user.click(input);
    await user.type(input, value);
    await waitFor(() => expect(screen.getByLabelText('CYL')).toHaveFocus());
    expect(Number((input as HTMLInputElement).value)).toBe(Number(value));
    expect((input as HTMLInputElement).value).not.toContain('(I)');
  });

  it('replaces a loaded Plano alias with a signed prescription', async () => {
    const user = userEvent.setup();
    render(<Prescription initial="0" />);
    expect(screen.getByLabelText('SPH')).toHaveValue('Plano');
    await user.type(screen.getByLabelText('SPH'), '-2.25');
    await waitFor(() => expect(screen.getByLabelText('CYL')).toHaveFocus());
    expect(screen.getByLabelText('SPH')).toHaveValue('-2.25');
  });

  it('preserves the field clicked when blur formats a partial decimal', async () => {
    const user = userEvent.setup();
    render(<div data-clinical-nav-scope="true" data-clinical-nav-card="true">
      <Input aria-label="SPH" type="number" step="0.25" min={-30} max={25} data-clinical-nav-item="true" data-clinical-nav-kind="number" />
      <Input aria-label="CYL" data-clinical-nav-item="true" /><Input aria-label="AX" data-clinical-nav-item="true" />
    </div>);
    await user.type(screen.getByLabelText('SPH'), '2.5');
    await user.click(screen.getByLabelText('AX'));
    await waitFor(() => expect(screen.getByLabelText('AX')).toHaveFocus());
    expect(screen.getByLabelText('SPH')).toHaveValue('2.50');
  });

  it('blocks reload and navigation immediately while keeping parent updates debounced', () => {
    vi.useFakeTimers();
    render(<GuardedForm />);
    const input = screen.getByLabelText('Value');
    act(() => input.focus());
    const initialRenders = fixture.renders;
    for (const value of ['2', '2.', '2.2', '2.25']) fireEvent.input(input, { target: { value } });
    expect(input).toHaveValue('2.25');
    expect(screen.getByLabelText('Saved value')).toHaveTextContent('1.00');
    expect(fixture.renders).toBe(initialRenders);
    expect(fixture.block()).toBe(true);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    act(() => vi.advanceTimersByTime(1499));
    expect(fixture.renders).toBe(initialRenders);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText('Saved value')).toHaveTextContent('2.25');
    expect(fixture.updates).toEqual(['2.25']);
  });

  it('allows reverting a pending number to its unchanged baseline without a warning', () => {
    render(<GuardedForm />);
    const input = screen.getByLabelText('Value');
    act(() => input.focus());
    fireEvent.input(input, { target: { value: '2.25' } });
    fireEvent.input(input, { target: { value: '1.00' } });
    expect(fixture.block()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it('leaves disabled guards inactive even with a pending edit', () => {
    fixture.enabled = false;
    render(<GuardedForm />);
    fireEvent.input(screen.getByLabelText('Value'), { target: { value: '2.25' } });
    expect(fixture.block()).toBe(false);
  });
});
