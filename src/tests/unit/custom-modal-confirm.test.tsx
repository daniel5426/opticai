import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomModal } from '@/components/ui/custom-modal';

afterEach(cleanup);

describe('CustomModal confirm', () => {
  it('ignores repeat clicks while an async confirm is running', async () => {
    let finish: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>(resolve => { finish = resolve }));
    render(<CustomModal isOpen onClose={() => {}} title="Delete" onConfirm={onConfirm} confirmText="Confirm" cancelText="Cancel" />);

    const confirm = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await act(async () => { finish() });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
