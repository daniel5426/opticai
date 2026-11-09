import type { ScanCommand } from '@/lib/scanner';

export const cameraScanOptions = { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 120 };
export const scanPending = (scan?: ScanCommand) => !!scan && ['pending','awaiting_confirmation'].includes(scan.status);

// A held barcode counts once. An observation blocked by delivery is never consumed.
export class ScanLatch {
  private accepted = '';
  private seen = 0;
  reset() { this.accepted='';this.seen=0; }
  observe(code:string|undefined,blocked:boolean,now=Date.now(),counting=false) {
    if(!code){if(counting&&now-this.seen>=350)this.accepted='';return false;}
    this.seen=now;
    if(blocked||this.accepted===code)return false;
    this.accepted=code;return true;
  }
}

export function resolveScanResponse(response:ScanCommand,early?:ScanCommand) {
  return early?.id===response.id ? early : response;
}

export function scanFeedback(scan:ScanCommand|undefined,pending:boolean,error:string) {
  if(error||scan&&['rejected','expired'].includes(scan.status))return 'error';
  if(scan?.summary.archived||scan?.status==='displayed'&&!scan.variant_id)return 'attention';
  if(scan?.status==='awaiting_confirmation')return 'attention';
  if(pending||scan?.status==='pending')return 'pending';
  if(scan?.status==='applied')return 'confirmed';
  return 'idle';
}
