import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function OrderSheetSkeleton() {
  return <div aria-hidden="true" data-order-sheet-skeleton>
    <div className="space-y-4 border-b p-4">
      <div className="flex items-center justify-between"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-12" /></div>
      <div className="grid grid-cols-9 gap-2">{Array.from({ length: 9 }, (_, index) => <Skeleton key={index} className="h-3" />)}</div>
      {[0, 1].map(row => <div key={row} className="grid grid-cols-9 gap-2">{Array.from({ length: 9 }, (_, index) => <Skeleton key={index} className="h-7" />)}</div>)}
    </div>
    <div className="grid sm:grid-cols-2">
      {[0, 1].map(section => <div key={section} className="space-y-4 border-b p-4 first:sm:border-e">
        <Skeleton className="mx-auto h-5 w-20" />
        <div className="grid grid-cols-3 gap-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-10" /><Skeleton className="h-7" /></div>)}</div>
        <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-7" />)}</div>
      </div>)}
    </div>
    {[0, 1].map(row => <div key={row} className="flex h-12 items-center justify-center border-b last:border-0"><Skeleton className="h-4 w-24" /></div>)}
  </div>;
}
