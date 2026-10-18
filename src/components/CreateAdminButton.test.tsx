import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CreateAdminButton } from "./CreateAdminButton";
import { apiClient } from "../api/client";
let epoch=0;
vi.mock("../auth/session",()=>({getSessionEpoch:()=>epoch}));
vi.mock("../api/client",()=>({apiClient:vi.fn()}));
beforeEach(()=>{vi.resetAllMocks();epoch=0;vi.mocked(apiClient).mockImplementation(async (path)=>path.startsWith('/admin/access/accounts/availability?')?{available:true}:{id:'new-admin'});});
function show(){const created=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><CreateAdminButton onCreated={created}/></QueryClientProvider>);fireEvent.click(screen.getByRole("button",{name:"新增管理员"}));return {dialog:within(screen.getByRole("dialog")),created};}
function fill(dialog:ReturnType<typeof within>,password="InitialPass1234"){
 fireEvent.change(dialog.getByLabelText("昵称"),{target:{value:"客服小张"}});
 fireEvent.change(dialog.getByLabelText("登录账号"),{target:{value:"support_01"}});
 fireEvent.change(dialog.getByLabelText("登录密码"),{target:{value:password}});
}
it("creates an administrator with the entered identity and selected default role",async()=>{
 const {dialog,created}=show();fill(dialog);await dialog.findByText("该账号可以使用");
 fireEvent.click(dialog.getByRole("button",{name:"创建账号"}));
 await waitFor(()=>expect(created).toHaveBeenCalledOnce());
 expect(apiClient).toHaveBeenCalledWith("/admin/access/accounts",{method:"POST",retryOnUnauthorized:false,body:JSON.stringify({nickname:"客服小张",accountId:"support_01",password:"InitialPass1234",role:"OPERATIONS"})});
});
it("rejects weak initial passwords without sending a request",async()=>{
 const {dialog}=show();fill(dialog,"short");await dialog.findByText("该账号可以使用");fireEvent.click(dialog.getByRole("button",{name:"创建账号"}));
 expect(await dialog.findByText("密码需为 12–64 位")).toBeInTheDocument();expect(vi.mocked(apiClient).mock.calls.filter(([,options])=>options?.method === "POST")).toHaveLength(0);
});
it("does not create an account from a previous login session",async()=>{
 const {dialog}=show();fill(dialog);await dialog.findByText("该账号可以使用");epoch++;fireEvent.click(dialog.getByRole("button",{name:"创建账号"}));
 await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());expect(vi.mocked(apiClient).mock.calls.filter(([,options])=>options?.method === "POST")).toHaveLength(0);
});

it("rejects invalid account names without sending a request",async()=>{
 const {dialog}=show();fill(dialog);fireEvent.change(dialog.getByLabelText("登录账号"),{target:{value:"name@example.com"}});fireEvent.click(dialog.getByRole("button",{name:"创建账号"}));
 expect(await dialog.findByText("账号需为 4–32 位字母、数字、下划线或短横线")).toBeInTheDocument();expect(vi.mocked(apiClient).mock.calls.filter(([,options])=>options?.method === "POST")).toHaveLength(0);
});

it("shows an occupied account while typing and disables creation",async()=>{
 vi.mocked(apiClient).mockResolvedValue({available:false});const {dialog}=show();fill(dialog);expect(dialog.getByRole('button',{name:'创建账号'})).toBeDisabled();expect(await dialog.findByText('登录账号已被使用，请更换账号')).toBeInTheDocument();expect(dialog.getByRole('button',{name:'创建账号'})).toBeDisabled();expect(apiClient).toHaveBeenCalledWith('/admin/access/accounts/availability?accountId=support_01',expect.objectContaining({cache:'no-store',signal:expect.any(AbortSignal)}));
});
it("allows retrying a failed availability check",async()=>{
 vi.mocked(apiClient).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({available:true});const {dialog}=show();fill(dialog);expect(await dialog.findByText('暂时无法检查账号，请重新检查')).toBeInTheDocument();expect(dialog.getByRole('button',{name:'创建账号'})).toBeDisabled();fireEvent.click(dialog.getByRole('button',{name:'重新检查账号'}));expect(await dialog.findByText('该账号可以使用')).toBeInTheDocument();expect(dialog.getByRole('button',{name:'创建账号'})).toBeEnabled();
});
it("ignores an older check after the account name changes",async()=>{
 let finishOld!:(value:unknown)=>void;
 vi.mocked(apiClient).mockImplementation(async(path)=>path.includes('support_01')?await new Promise(resolve=>{finishOld=resolve;}):{available:true});const {dialog}=show();fill(dialog);await waitFor(()=>expect(finishOld).toBeDefined());
 fireEvent.change(dialog.getByLabelText('登录账号'),{target:{value:'support_02'}});expect(await dialog.findByText('该账号可以使用')).toBeInTheDocument();finishOld({available:false});await waitFor(()=>expect(dialog.getByRole('button',{name:'创建账号'})).toBeEnabled());expect(dialog.queryByText('登录账号已被使用，请更换账号')).not.toBeInTheDocument();
});
