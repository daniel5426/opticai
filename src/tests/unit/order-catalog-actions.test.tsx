import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';
import { FrameSection } from '@/components/orders/regular/FrameSection';
import { LensSection } from '@/components/orders/regular/LensSection';
import type { CatalogVariant, InventorySelection } from '@/lib/inventory';

const mocks = vi.hoisted(() => ({
  role: 2,
  getInventoryVariants: vi.fn(),
  createCatalogEntry: vi.fn(),
  updateCatalogVariant: vi.fn(),
}));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentClinic: { id: 1 }, currentUser: { role_level: mocks.role } }) }));
vi.mock('@/lib/api-client', () => ({ apiClient: {
  getInventoryVariants: mocks.getInventoryVariants,
  createCatalogEntry: mocks.createCatalogEntry,
  updateCatalogVariant: mocks.updateCatalogVariant,
  getLookupTable: vi.fn(async () => ({ data: [] })),
} }));
vi.mock('@/components/inventory/BarcodeScanButton', () => ({ ProductBarcodeScan: () => null }));

const variant = {
  id: 8, company_id: 1, product_id: 8, currency: 'ILS', default_retail: 100, is_stockable: true,
  product: { id: 8, company_id: 1, category: 'frame', brand: 'Atlas', model: 'A101' },
  display_name: 'Atlas A101 — Black / 50', attributes: { color: 'Black', eye_size: 50 },
} as CatalogVariant;
const selected: InventorySelection = { component: 'frame', variant_id: 8, variant, quantity: 1, fulfillment_source: 'supplier_ordered' };
const frame = { order_id: 1, manufacturer: 'Atlas', model: 'A101', color: 'Black', width: 50 };

function mount(element: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{element}</QueryClientProvider>);
}
function frameCard(props: Partial<React.ComponentProps<typeof FrameSection>> = {}) {
  return <FrameSection clinicId={1} frame={frame} price={34} currency="ILS" isEditing
    onFrameFieldChange={vi.fn()} onInventorySelect={vi.fn()} onInventoryClear={vi.fn()} {...props}/>;
}
function createLabel(name = 'Atlas A101') { return i18n.t('orderWorkspace.catalogCreateProduct', { name }); }
function updateLabel(price = '34.00') { return i18n.t('orderWorkspace.catalogUpdatePrice', { price, currency: 'ILS' }); }

beforeEach(() => {
  mocks.role = 2;
  mocks.getInventoryVariants.mockReset().mockResolvedValue({ data: { items: [] } });
  mocks.createCatalogEntry.mockReset().mockResolvedValue({ data: { ...variant, default_retail: 34 } });
  mocks.updateCatalogVariant.mockReset().mockResolvedValue({ data: { ...variant, default_retail: 34 } });
});
afterEach(cleanup);

describe.each(['he', 'en', 'fr'])('catalog actions in %s', locale => {
  beforeEach(async () => { await i18n.changeLanguage(locale); });

  it('creates an unlinked frame from the footer with the current order price', async () => {
    const select = vi.fn();
    const view = mount(frameCard({ onInventorySelect: select }));
    const create = await screen.findByRole('button', { name: createLabel() });
    expect(view.container.querySelector('[data-product-link-row]')).toContainElement(create);
    expect(mocks.createCatalogEntry).not.toHaveBeenCalled();
    fireEvent.click(create);
    await waitFor(() => expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 8 }), 'supplier_ordered'));
    expect(mocks.createCatalogEntry).toHaveBeenCalledWith(expect.objectContaining({
      clinic_id: 1, category: 'frame', variant: expect.objectContaining({ default_retail: 34, currency: 'ILS' }),
    }));
  });

  it('updates only the catalog price when explicitly requested', async () => {
    const select = vi.fn(), changePrice = vi.fn(), changeFields = vi.fn();
    mocks.getInventoryVariants.mockResolvedValue({ data: { items: [variant] } });
    mount(frameCard({ selectedInventory: selected, onInventorySelect: select, onPriceChange: changePrice, onFrameFieldChange: changeFields }));
    const update = await screen.findByRole('button', { name: updateLabel() });
    expect(mocks.updateCatalogVariant).not.toHaveBeenCalled();
    mocks.getInventoryVariants.mockResolvedValue({ data: { items: [{ ...variant, default_retail: 34 }] } });
    fireEvent.click(update);
    await waitFor(() => expect(mocks.updateCatalogVariant).toHaveBeenCalledWith(8, { default_retail: 34 }));
    await waitFor(() => expect(screen.queryByRole('button', { name: updateLabel() })).not.toBeInTheDocument());
    expect(select).not.toHaveBeenCalled();
    expect(changePrice).not.toHaveBeenCalled();
    expect(changeFields).not.toHaveBeenCalled();
    expect(screen.getByLabelText(i18n.t('orderWorkspace.framePrice'))).toHaveValue('34.00');
  });

  it('keeps failed catalog updates retryable without losing the draft price', async () => {
    mocks.updateCatalogVariant.mockResolvedValueOnce({ error: 'Unavailable' });
    mount(frameCard({ selectedInventory: selected }));
    fireEvent.click(await screen.findByRole('button', { name: updateLabel() }));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('orderWorkspace.catalogSaveError'));
    expect(screen.getByRole('button', { name: updateLabel() })).toBeEnabled();
    expect(screen.getByLabelText(i18n.t('orderWorkspace.framePrice'))).toHaveValue('34.00');
  });

  it('creates a lens from the product footer for both matching eyes', async () => {
    const select = vi.fn();
    const lens = { ...variant, product: { ...variant.product, category: 'spectacle_lens' as const, model: 'Custom lens' } };
    mocks.createCatalogEntry.mockResolvedValue({ data: lens });
    const view = mount(<LensSection clinicId={1} layoutKey="create" isEditing lens={{ order_id: 1, right_model: 'Custom lens', left_model: 'Custom lens' }} onLensFieldChange={vi.fn()} onInventorySelect={select}/>);
    const create = await screen.findByRole('button', { name: createLabel('Custom lens') });
    expect(view.container.querySelector('[data-product-link-row]')).toContainElement(create);
    fireEvent.click(create);
    await waitFor(() => expect(select).toHaveBeenCalledWith('both', lens, 'supplier_ordered'));
    expect(mocks.createCatalogEntry).toHaveBeenCalledWith(expect.objectContaining({ category: 'spectacle_lens', product: expect.objectContaining({ model: 'Custom lens' }) }));
  });
});

it('preserves a zero price when creating a frame', async () => {
  mount(frameCard({ price: 0 }));
  fireEvent.click(await screen.findByRole('button', { name: createLabel() }));
  await waitFor(() => expect(mocks.createCatalogEntry).toHaveBeenCalledWith(expect.objectContaining({ variant: expect.objectContaining({ default_retail: 0 }) })));
});

it.each([
  { price: 100 },
  { price: -1 },
  { price: undefined },
  { currency: 'USD' },
  { isEditing: false },
  { clinicId: 2 },
  { selectedInventory: { ...selected, lifecycle_state: 'consumed' as const } },
])('does not offer an invalid or unnecessary catalog price update: %j', async props => {
  mount(frameCard({ selectedInventory: selected, ...props }));
  await waitFor(() => expect(mocks.getInventoryVariants).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: /34\.00|100\.00|-1\.00/ })).not.toBeInTheDocument();
  expect(mocks.updateCatalogVariant).not.toHaveBeenCalled();
});

it('does not offer catalog writes to a read-only user', async () => {
  mocks.role = 1;
  const view = mount(frameCard({ selectedInventory: selected }));
  await waitFor(() => expect(mocks.getInventoryVariants).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: updateLabel() })).not.toBeInTheDocument();
  view.unmount();
  mount(frameCard());
  await waitFor(() => expect(mocks.getInventoryVariants).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('button', { name: createLabel() })).not.toBeInTheDocument();
});
