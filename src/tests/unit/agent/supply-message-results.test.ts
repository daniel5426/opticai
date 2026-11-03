import { describe, expect, it } from 'vitest';
import { supplyMessageResults } from '@/components/agent/supply-message-results';
const tool = (name: string, output: unknown, state='output-available') => ({kind:'tool',toolName:name,state,output});
describe('supply receipts in conversation history',()=>{
  it('accepts new and historical persisted receipts and deduplicates job IDs',()=>{
    expect(supplyMessageResults([
      tool('prepare_supply',{type:'supply_proposal',job_id:'one'}),
      tool('prepare_supply',{job_id:'one',rows:[]}),
      tool('prepare_supply',{kind:'tool_result',content:JSON.stringify({job_id:'two'})}),
    ])).toEqual(['one','two']);
  });
  it('ignores prose, failed/incomplete tools, invalid IDs and unrelated jobs',()=>{
    const prose = {kind:'text',text:'{"type":"supply_proposal","job_id":"fake"}'};
    expect(supplyMessageResults([
      prose,
      tool('prepare_supply',{job_id:'bad'},'output-error'),
      tool('prepare_supply',{job_id:'../outside'}),
      tool('prepare_supply',{kind:'tool_result',content:'truncated'}),
      tool('run_report',{type:'report_run',job_id:'report'}),
    ])).toEqual([]);
  });
});
