import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,within,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {apiClient} from '../api/client';
import {Modal} from 'antd';
import {AdminAccessPage} from './AdminAccessPage';
import {getPlatformAccess,platformList,platformWrite} from '../api/platform';
import {getMe} from '../api/auth';
vi.mock('../api/platform',()=>({getPlatformAccess:vi.fn(),platformList:vi.fn(),platformWrite:vi.fn()}));vi.mock('../api/auth',()=>({getMe:vi.fn()}));
vi.mock('../api/client',async(importOriginal)=>({...await importOriginal<typeof import('../api/client')>(),apiClient:vi.fn()}));
const own={id:'self',accountId:'admin',nickname:'超级管理员',status:'ACTIVE',consoleRole:'SUPER_ADMIN',version:1} as const;
const other={id:'target',accountId:'support_01',nickname:'客服小张',status:'ACTIVE',consoleRole:'SUPPORT',version:2} as const;
beforeEach(()=>{vi.clearAllMocks();vi.mocked(apiClient).mockResolvedValue({available:true});vi.mocked(getMe).mockResolvedValue({...own,role:'ADMIN'});vi.mocked(getPlatformAccess).mockResolvedValue({role:'SUPER_ADMIN',permissions:['ACCESS_MANAGE'],version:1});vi.mocked(platformList).mockResolvedValue({items:[own,other],total:2,page:1,limit:20});vi.mocked(platformWrite).mockResolvedValue({role:'SUPPORT',version:3});});
afterEach(()=>Modal.destroyAll());
function show(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AdminAccessPage/></QueryClientProvider>);}
it('edits nickname and account with the current role and optimistic version',async()=>{
 show();const row=(await screen.findByText('客服小张')).closest('tr')!;fireEvent.click(within(row).getByRole('button',{name:/编\s*辑/}));const dialog=within(screen.getByRole('dialog'));
 expect(dialog.getByLabelText('昵称')).toHaveValue('客服小张');expect(dialog.getByLabelText('登录账号')).toHaveValue('support_01');
 fireEvent.change(dialog.getByLabelText('昵称'),{target:{value:'客服小李'}});fireEvent.change(dialog.getByLabelText('登录账号'),{target:{value:'support_02'}});fireEvent.change(dialog.getByLabelText('修改原因'),{target:{value:'更新资料'}});await dialog.findByText('该账号可以使用');fireEvent.click(dialog.getByRole('button',{name:'OK'}));
 await screen.findAllByText('确认保存管理员资料');fireEvent.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button',{name:'OK'}));
 await waitFor(()=>expect(platformWrite).toHaveBeenCalledWith('/admin/access/accounts/target','PATCH',{nickname:'客服小李',accountId:'support_02',role:'SUPPORT',reason:'更新资料',version:2}));
});
it('allows editing own nickname and account but disables own role and deletion',async()=>{
 show();await screen.findByText('客服小张');const row=screen.getByText('admin').closest('tr')!;expect(within(row).getByRole('button',{name:/删\s*除/})).toBeDisabled();fireEvent.click(within(row).getByRole('button',{name:/编\s*辑/}));const dialog=within(screen.getByRole('dialog'));expect(dialog.getByLabelText('角色')).toBeDisabled();expect(dialog.getByLabelText('昵称')).not.toBeDisabled();
});
