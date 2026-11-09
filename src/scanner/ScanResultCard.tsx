import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Circle, CircleDot, Glasses, Loader2, ScanBarcode, TriangleAlert } from 'lucide-react';
import { spring } from '@/lib/springs';
import type { ScanCommand } from '@/lib/scanner';
import { scanFeedback } from './scan-feedback';

type Props={scan?:ScanCommand;pending:boolean;error:string;counting:boolean;status:string;t:(key:string)=>string};
export function ScanResultCard({scan,pending,error,counting,status,t}:Props) {
  const reduce=useReducedMotion();const feedback=scanFeedback(scan,pending,error);
  const confirmed=feedback==='confirmed';
  const unknown=!!scan&&!scan.variant_id&&scan.status!=='pending';
  const label=error?status:scan?.summary.archived?t('archived'):unknown?t('notFound'):confirmed&&counting?t('counted'):status;
  const ProductIcon=scan?.summary.category==='frame'?Glasses:scan?.summary.category==='spectacle_lens'?Circle:scan?.summary.category==='contact_lens'?CircleDot:ScanBarcode;
  return <div className="result-slot" role={feedback==='error'?'alert':'status'} aria-label={label} aria-live="polite" aria-atomic="true">
    <span className="scanner-sr-only">{scan?.summary.name} {label}</span>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div key={scan?.request_id||scan?.id||'ready'} className="result-card" data-feedback={feedback} aria-hidden="true"
        initial={{y:reduce?0:58,opacity:0}} animate={{y:0,opacity:1}} exit={{y:reduce?0:-58,opacity:0}} transition={spring.moderate}>
        <span className="result-symbol" aria-hidden="true"><ProductIcon size={27}/></span>
        <div className="result-copy">
          <strong title={scan?.summary.name}>{scan?.summary.name||(unknown?t('notFound'):pending?t('recognizing'):counting?t('readyToCount'):t('readyToScan'))}</strong>
          {scan?<><span className="result-category">{scan.summary.category?t(`category.${scan.summary.category}`):'\u00a0'}</span><bdi className="result-barcode">{scan.barcode}</bdi></>:<span className="result-category">{status}</span>}
          {(feedback==='error'||feedback==='attention')&&<span className="result-message">{label}</span>}
        </div>
        <div className="result-outcome">
          {feedback==='pending'?<Loader2 size={23} className="result-spinner"/>:feedback==='error'||feedback==='attention'?<TriangleAlert size={24}/>:confirmed?<><Check size={20}/>{counting&&<bdi className="count-increment">+1</bdi>}</>:<ScanBarcode size={21}/>}
        </div>
      </motion.div>
    </AnimatePresence>
  </div>;
}
