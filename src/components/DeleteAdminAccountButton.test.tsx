import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,within,waitFor} from '@testing-library/react';
import {beforeEach,it,expect,vi} from 'vitest';
import {DeleteAdminAccountButton} from './DeleteAdminAccountButton';
import {apiClient} from '../api/client';
let epoch=0;
vi.mock('../api/client',()=>({apiClient:vi.fn()}));vi.mock('../auth/session',()=>({getSessionEpoch:()=>epoch}));
beforeEach(()=>{vi.clearAllMocks();epoch=0;});
function show(ownAccount=false){const onDeleted=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><DeleteAdminAccountButton account={{id:'target',accountId:'support_01',nickname:'客服小张',consoleRole:'SUPPORT',version:3}} ownAccount={ownAccount} onDeleted={onDeleted}/></QueryClientProvider>);return onDeleted;}
it('requires a reason and submits the selected account version before refreshing the list',async()=>{
 vi.mocked(apiClient).mockResolvedValue({deleted:true});const done=show();fireEvent.click(screen.getByRole('button',{name:/删\s*除/}));const dialog=within(screen.getByRole('dialog'));
 fireEvent.change(dialog.getByLabelText('删除原因'),{target:{value:'管理员离职'}});fireEvent.click(dialog.getByRole('button',{name:'确认删除'}));await waitFor(()=>expect(done).toHaveBeenCalledOnce());
 expect(apiClient).toHaveBeenCalledWith('/admin/access/accounts/target',{method:'DELETE',retryOnUnauthorized:false,body:JSON.stringify({version:3,reason:'管理员离职'})});
});
it('disables deletion of the current administrator',()=>{show(true);expect(screen.getByRole('button',{name:/删\s*除/})).toBeDisabled();});
it('shows backend protection errors without removing the row',async()=>{
 vi.mocked(apiClient).mockRejectedValue(new Error('必须保留至少一个可用超级管理员'));const done=show();fireEvent.click(screen.getByRole('button',{name:/删\s*除/}));const dialog=within(screen.getByRole('dialog'));
 fireEvent.change(dialog.getByLabelText('删除原因'),{target:{value:'删除账号'}});fireEvent.click(dialog.getByRole('button',{name:'确认删除'}));expect(await dialog.findByText('必须保留至少一个可用超级管理员')).toBeInTheDocument();expect(done).not.toHaveBeenCalled();
});
