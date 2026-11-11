// Release builds stay disabled unless explicitly enabled for a reviewed environment.
export function campaignsAvailable(development: boolean, flag?: string): boolean {
  return flag === undefined ? development : flag === 'true';
}
export const campaignsEnabled = campaignsAvailable(import.meta.env.DEV, import.meta.env.VITE_CAMPAIGNS_ENABLED);
