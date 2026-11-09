import React from 'react';
import { render,screen,fireEvent,cleanup } from '@testing-library/react';
import { afterEach,expect,test,vi } from 'vitest';
import { ScannerScreen } from '@/scanner/ScannerScreen';
import translations from '@/localization/scanner.json';
afterEach(cleanup);
const props=(lang:'he'|'en'|'fr',open=false)=>({t:(key:string)=>(translations[lang] as any)['scanner.'+key]||key,direction:lang==='he'?'rtl' as const:'ltr' as const,devices:[{id:'pc',name:'Reception',online:true,recipient:'Clinician',destination:'order'}] as any,selected:'pc',active:false,pending:false,error:'',torch:false,torchAvailable:false,video:{current:null},drawerOpen:open,setDrawerOpen:vi.fn(),selectDevice:vi.fn(),refresh:vi.fn(),toggleCamera:vi.fn(),toggleTorch:vi.fn(),pair:vi.fn(async()=>true),send:vi.fn(async()=>{}),takeover:vi.fn()});
test.each(['he','en','fr'] as const)('keeps pairing fields off the scanner canvas in %s',lang=>{
 const p=props(lang);render(<ScannerScreen {...p}/>);
 expect(screen.getAllByRole('combobox')).toHaveLength(1);
 expect(screen.getByRole('combobox')).toHaveAccessibleName(p.t('chooseComputer'));
 expect(screen.queryByRole('textbox')).toBeNull();
 expect(screen.queryByText(p.t('install'))).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:p.t('connect'),exact:true}));
 expect(p.setDrawerOpen).toHaveBeenCalledWith(true);
 fireEvent.click(screen.getByRole('button',{name:p.t('start'),exact:true}));expect(p.toggleCamera).toHaveBeenCalledOnce();
});
test('opens an accessible pairing drawer with a labelled code input',()=>{
 const p=props('he',true);render(<ScannerScreen {...p}/>);
 expect(screen.getByRole('dialog')).toHaveAttribute('dir','rtl');
 expect(screen.getByRole('textbox',{name:p.t('pairingCode')})).toBeVisible();
 expect(screen.getByRole('button',{name:p.t('pair')})).toBeDisabled();
});
test.each(['he','en','fr'] as const)('shows no placeholder text until a computer is selected in %s',lang=>{
 const p=props(lang);const view=render(<ScannerScreen {...p} devices={[]} selected=""/>);
 expect(screen.getByRole('combobox')).toHaveTextContent(/^$/);
 expect(screen.getByRole('combobox')).toHaveAccessibleName(p.t('chooseComputer'));
 view.rerender(<ScannerScreen {...p}/>);
 expect(screen.getByRole('combobox')).toHaveTextContent('Reception');
});
test('reopens installation instructions from the connection drawer',()=>{
 const p=props('fr',true);render(<ScannerScreen {...p}/>);
 fireEvent.click(screen.getByRole('button',{name:p.t('installTitle'),exact:true}));
 expect(screen.getByRole('dialog')).toHaveAccessibleName(p.t('installTitle'));
 expect(screen.queryByRole('textbox')).toBeNull();
 expect(screen.getByText(p.t('installBrowserAdd'))).toBeVisible();
});
