import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/localization/i18n';
import { ScannerHistoryButton, ScannerProvider } from '@/components/scanner/ScannerProvider';
import { apiClient } from '@/lib/api-client';
import { replayScan } from '@/lib/scanner';

const locale=vi.hoisted(()=>({direction:'ltr',locale:'en'}));
vi.mock('@/contexts/UserContext',()=>({useUser:()=>({currentClinic:{id:33,name:'QA clinic'},currentUser:{id:1}})}));
vi.mock('@/localization/use-app-locale',()=>({useAppLocale:()=>locale}));
vi.mock('@tanstack/react-router',()=>({useLocation:()=>({pathname:'/inventory',searchStr:''}),useNavigate:()=>vi.fn()}));
vi.mock('@/lib/api-client',()=>({apiClient:{scannerRequest:vi.fn(),scannerFetch:vi.fn()}}));
vi.mock('@/components/ui/sidebar',()=>({SidebarMenuAction:React.forwardRef<HTMLButtonElement,React.ComponentProps<'button'>>((props,ref)=><button ref={ref} {...props}/>)}));
vi.mock('@/lib/scanner',async importOriginal=>({...await importOriginal<typeof import('@/lib/scanner')>(),replayScan:vi.fn(async(_id,onReady)=>{onReady?.();})}));

const item=(id:number)=>({id:String(id),variant_id:id,barcode:'2900330000252',created_at:Date.now()/1000,summary:{name:'Frame '+id,category:'frame'}});
beforeEach(()=>{
 vi.clearAllMocks();localStorage.clear();
 vi.mocked(replayScan).mockImplementation(async(_id,onReady)=>{onReady?.();});
 vi.mocked(apiClient.scannerRequest).mockImplementation(async path=>({data:path==='/status'?{enabled:true}:path.includes('offset=1')?{items:[item(6)],has_more:false}:{items:[item(5)],has_more:true}} as any));
});
afterEach(()=>{cleanup();localStorage.clear();});
const mount=()=>render(<ScannerProvider><ScannerHistoryButton/></ScannerProvider>);
async function open(){
 const trigger=screen.getByRole('button',{name:i18n.t('scanner.history')});
 await waitFor(()=>expect(apiClient.scannerRequest).toHaveBeenCalledWith('/status',undefined));
 fireEvent.keyDown(trigger,{key:'ArrowDown'});
 return screen.findByRole('menu',{name:i18n.t('scanner.history')});
}
test.each(['he','en','fr'])('opens an anchored menu rather than a history dialog in %s',async lang=>{
 await i18n.changeLanguage(lang);locale.direction=lang==='he'?'rtl':'ltr';locale.locale=lang;
 mount();const menu=await open();
 expect(menu).toHaveAttribute('dir',locale.direction);
 expect(await screen.findByRole('menuitem',{name:/Frame 5/})).toBeVisible();
 expect(screen.queryByRole('dialog')).toBeNull();
 await userEvent.click(screen.getByRole('menuitem',{name:/Frame 5/}));
 expect(replayScan).toHaveBeenCalledWith(5,expect.any(Function));
 await waitFor(()=>expect(screen.queryByRole('menu')).toBeNull());
});
test.each(['he','en','fr'])('keeps the history visible with a spinner until the selected item is ready in %s',async lang=>{
 await i18n.changeLanguage(lang);locale.direction=lang==='he'?'rtl':'ltr';locale.locale=lang;
 let ready!:()=>void,complete!:()=>void;
 vi.mocked(replayScan).mockImplementation((_id,onReady)=>{ready=onReady!;return new Promise(resolve=>{complete=resolve;});});
 mount();await open();
 const selected=await screen.findByRole('menuitem',{name:/Frame 5/});
 await userEvent.click(selected);
 expect(screen.getByRole('menu')).toBeVisible();
 expect(selected).toHaveAttribute('aria-busy','true');
 expect(within(selected).getByRole('status',{name:i18n.t('loading')})).toBeVisible();
 expect(screen.getByRole('menuitem',{name:i18n.t('scanner.connect')})).toHaveAttribute('aria-disabled','true');
 await userEvent.click(selected);
 expect(replayScan).toHaveBeenCalledOnce();
 await act(async()=>{ready();});
 expect(screen.queryByRole('menu')).toBeNull();
 // Closing follows readiness, rather than waiting for modal dismissal or acknowledgement.
 await act(async()=>{complete();});
});

test('keeps the menu open and permits retry when loading fails',async()=>{
 await i18n.changeLanguage('en');locale.direction='ltr';locale.locale='en';
 vi.mocked(replayScan).mockRejectedValueOnce(new Error('scanner.offline'));
 mount();await open();
 await userEvent.click(await screen.findByRole('menuitem',{name:/Frame 5/}));
 expect(screen.getByRole('menu')).toBeVisible();
 expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('scanner.offline'));
 expect(screen.queryByRole('status',{name:i18n.t('loading')})).toBeNull();
 expect(screen.getByRole('menuitem',{name:/Frame 5/})).not.toHaveAttribute('aria-disabled','true');
 await userEvent.click(screen.getByRole('menuitem',{name:/Frame 5/}));
 await waitFor(()=>expect(screen.queryByRole('menu')).toBeNull());
 expect(replayScan).toHaveBeenCalledTimes(2);
});
test('loads more inside the dropdown and opens pairing as a separate dialog',async()=>{
 await i18n.changeLanguage('en');locale.direction='ltr';locale.locale='en';mount();await open();
 await userEvent.click(await screen.findByRole('menuitem',{name:i18n.t('scanner.more')}));
 expect(await screen.findByRole('menuitem',{name:/Frame 6/})).toBeVisible();
 expect(screen.getByRole('menu')).toBeVisible();
 await userEvent.click(screen.getByRole('menuitem',{name:i18n.t('scanner.connect')}));
 expect(await screen.findByRole('dialog',{name:i18n.t('scanner.connect')})).toBeVisible();
 expect(screen.queryByRole('menu')).toBeNull();
 expect(screen.getByRole('textbox',{name:i18n.t('scanner.name')})).toHaveFocus();
});
