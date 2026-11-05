import '@/localization/i18n';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { ExamFieldMapper } from '@/lib/exam-field-mappings';
import { useExamClipboard } from '@/hooks/exam/useExamClipboard';
import { copyToClipboard, clearClipboard } from '@/lib/exam-clipboard';
import { toast } from 'sonner';
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}));
afterEach(()=>{cleanup();clearClipboard();});
it('same-type Schirmer paste copies all measurements',()=>{
 const target:any={r_mm:5,l_mm:6,r_but:8,l_but:9};
 const handler=vi.fn((key,value)=>{target[key]=value});
 copyToClipboard('schirmer-test',{r_mm:15,l_mm:16,r_but:18,l_but:19} as any);
 const {result}=renderHook(()=>useExamClipboard({getExamFormData:()=>({'schirmer-test-target':target}),fieldHandlers:{'schirmer-test-target':handler},activeCoverTestTabs:{},computedCoverTestTabs:{},activeOldRefractionTabs:{},computedOldRefractionTabs:{},activeOldRefractionExtensionTabs:{},computedOldRefractionExtensionTabs:{}}));
 act(()=>result.current.handlePaste({id:'target',type:'schirmer-test'} as any));
 expect(target).toMatchObject({r_mm:'15',l_mm:'16',r_but:'18',l_but:'19'});
 expect(toast.success).toHaveBeenCalled();
});
it('compact prescription copy transfers SPH and PD when copying to final prescription',()=>{
 const copied=ExamFieldMapper.copyData({r_sph:-2,r_pd:31,l_sph:-3,l_pd:32,comb_pd:63},{},'compact-prescription','final-prescription');
 expect(copied.r_sph).toBe(-2);expect(copied.r_pd).toBeUndefined();expect(copied.r_pd_far).toBe(31);expect(copied.comb_pd_far).toBe(63);
});
it('final prescription copy preserves PD when copying back to compact prescription',()=>{
 const copied=ExamFieldMapper.copyData({r_sph:-2,r_pd_far:31,l_sph:-3,l_pd_far:32,comb_pd_far:63},{},'final-prescription','compact-prescription');
 expect(copied.r_sph).toBe(-2);expect(copied.r_pd).toBe(31);expect(copied.comb_pd).toBe(63);
});
