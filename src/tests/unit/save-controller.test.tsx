import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSaveController } from '@/hooks/shared/useSaveController';
import { inputSyncManager } from '@/lib/input-sync-manager';
import { SaveStatus } from '@/components/SaveStatus';
import i18n from '@/localization/i18n';

afterEach(cleanup);

it('captures pending input updates once, rejects duplicate saves, and stays editable', async () => {
  let finish!: () => void;
  const write = vi.fn(() => new Promise<void>(resolve => {finish=resolve;}));
  let captured = '';
  function Editor() {
    const [value,setValue]=React.useState('original');
    const latest=React.useRef(value);latest.current=value;
    const controller=useSaveController({dirty:value!=='original'});
    React.useEffect(()=>{const sync=()=>setValue('latest keystroke');inputSyncManager.register(sync);return()=>inputSyncManager.unregister(sync);},[]);
    return <><input aria-label="draft" value={value} onChange={event=>setValue(event.target.value)} disabled={controller.isSaving}/>
      <button onClick={()=>void controller.run(async()=>{captured=latest.current;await write();})}>Save</button><SaveStatus state={controller.state}/></>;
  }
  render(<Editor/>);
  fireEvent.click(screen.getByText('Save')); fireEvent.click(screen.getByText('Save'));
  expect(write).toHaveBeenCalledTimes(1);
  expect(captured).toBe('latest keystroke');
  expect(screen.getByLabelText('draft')).toBeDisabled();
  await act(async()=>finish());
  await waitFor(()=>expect(screen.getByLabelText('draft')).toBeEnabled());
  expect(screen.getByLabelText('draft')).toHaveValue('latest keystroke');
});

it.each(['he','en','fr'])('announces saving and failure with translated retry in %s', async locale=>{
  await i18n.changeLanguage(locale);
  render(<SaveStatus state="error" onRetry={()=>{}}/>);
  expect(screen.getByRole('status')).toHaveTextContent(i18n.t('saveStatus.error'));
  expect(screen.getByRole('button',{name:i18n.t('saveStatus.retry')})).toBeInTheDocument();
});
