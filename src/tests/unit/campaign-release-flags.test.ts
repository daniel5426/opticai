import { describe, expect, it } from 'vitest';
import { campaignsAvailable } from '@/lib/feature-flags';

describe('campaign release flags', () => {
  it('keeps release builds disabled unless explicitly opted in', () => {
    expect(campaignsAvailable(false)).toBe(false);
    expect(campaignsAvailable(false, 'false')).toBe(false);
    expect(campaignsAvailable(false, 'true')).toBe(true);
    expect(campaignsAvailable(false, 'TRUE')).toBe(false);
  });
  it('allows local development and explicit opt-out', () => {
    expect(campaignsAvailable(true)).toBe(true);
    expect(campaignsAvailable(true, 'false')).toBe(false);
  });
});
