import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminNicknameEditor } from "./AdminNicknameEditor";
import { updateAdminNickname } from "../api/auth";
let epoch=0;
vi.mock("../auth/session",()=>({getSessionEpoch:()=>epoch}));
vi.mock("../api/auth",()=>({updateAdminNickname:vi.fn()}));
const user={id:"admin-1",accountId:"admin",nickname:"Local Admin",role:"ADMIN" as const,status:"ACTIVE" as const};
function Host(){const q=useQuery({queryKey:["me",0],queryFn:async()=>user,initialData:user,enabled:false});return <><h1>{q.data.nickname}</h1><AdminNicknameEditor user={q.data}/></>;}
function show(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><Host /></QueryClientProvider>);fireEvent.click(screen.getByRole("button",{name:"修改昵称"}));return within(screen.getByRole("dialog"));}
beforeEach(()=>{vi.clearAllMocks();epoch=0;});
it("saves a trimmed nickname and immediately updates the displayed identity",async()=>{
 vi.mocked(updateAdminNickname).mockResolvedValue({id:user.id,nickname:"新管理员"});const dialog=show();
 expect(dialog.getByLabelText("昵称")).toHaveValue("Local Admin");
 fireEvent.change(dialog.getByLabelText("昵称"),{target:{value:"  新管理员  "}});fireEvent.click(dialog.getByRole("button",{name:/保\s*存/}));
 expect(await screen.findByRole("heading",{name:"新管理员"})).toBeInTheDocument();expect(updateAdminNickname).toHaveBeenCalledWith("新管理员");
});
it("rejects a blank nickname",async()=>{
 const dialog=show();fireEvent.change(dialog.getByLabelText("昵称"),{target:{value:"   "}});fireEvent.click(dialog.getByRole("button",{name:/保\s*存/}));
 expect(await dialog.findByText("请输入昵称")).toBeInTheDocument();expect(updateAdminNickname).not.toHaveBeenCalled();
});
it("does not submit a stale dialog after the login session changes",async()=>{
 const dialog=show();fireEvent.change(dialog.getByLabelText("昵称"),{target:{value:"旧账号昵称"}});epoch=1;fireEvent.click(dialog.getByRole("button",{name:/保\s*存/}));
 await vi.waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());expect(updateAdminNickname).not.toHaveBeenCalled();
});
