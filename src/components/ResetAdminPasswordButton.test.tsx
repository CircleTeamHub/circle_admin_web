import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ResetAdminPasswordButton } from "./ResetAdminPasswordButton";
import { apiClient } from "../api/client";
import { clearSession } from "../auth/session";
let epoch=0;
vi.mock("../api/client",()=>({apiClient:vi.fn()}));
vi.mock("../auth/session",()=>({getSessionEpoch:()=>epoch,clearSession:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();epoch=0;});
function show(ownAccount=false){
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><ResetAdminPasswordButton account={{id:'target',accountId:'12345',nickname:'客服小张',consoleRole:'SUPPORT',status:'ACTIVE',version:1}} ownAccount={ownAccount}/></QueryClientProvider>);
 fireEvent.click(screen.getByRole('button',{name:'重置密码'}));const dialog=within(screen.getByRole('dialog'));
 for(const [label,value] of [['新密码','NewPassword5678'],['确认新密码','NewPassword5678'],['重置原因','管理员申请重置']])fireEvent.change(dialog.getByLabelText(label),{target:{value}});
 return dialog;
}
it('resets a selected administrator password without ending the super administrator session',async()=>{
 vi.mocked(apiClient).mockResolvedValue({changed:true});const dialog=show();fireEvent.click(dialog.getByRole('button',{name:'确认重置'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 expect(apiClient).toHaveBeenCalledWith('/admin/access/accounts/target/password',{method:'PATCH',retryOnUnauthorized:false,body:JSON.stringify({newPassword:'NewPassword5678',reason:'管理员申请重置'})});expect(clearSession).not.toHaveBeenCalled();
});
it('returns to login after resetting the current super administrator password',async()=>{
 vi.mocked(apiClient).mockResolvedValue({changed:true});const dialog=show(true);fireEvent.click(dialog.getByRole('button',{name:'确认重置'}));await waitFor(()=>expect(clearSession).toHaveBeenCalledOnce());
});
it('rejects mismatched passwords before sending a request',async()=>{
 const dialog=show();fireEvent.change(dialog.getByLabelText('确认新密码'),{target:{value:'DifferentPass1234'}});fireEvent.click(dialog.getByRole('button',{name:'确认重置'}));expect(await dialog.findByText('两次输入的密码不一致')).toBeInTheDocument();expect(apiClient).not.toHaveBeenCalled();
});
it('does not submit from a previous login session',async()=>{
 const dialog=show();epoch++;fireEvent.click(dialog.getByRole('button',{name:'确认重置'}));expect(await dialog.findByText('登录状态已变化，请重新登录')).toBeInTheDocument();expect(apiClient).not.toHaveBeenCalled();
});
