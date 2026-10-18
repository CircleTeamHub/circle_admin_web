import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { listAnnouncements, setAnnouncementScrolling, publishAnnouncement, editAnnouncement, deleteAnnouncement } from "../api/moderation";
vi.mock("../api/moderation", () => ({publishAnnouncement:vi.fn(), editAnnouncement:vi.fn().mockResolvedValue({}),deleteAnnouncement:vi.fn().mockResolvedValue({deleted:true}), listAnnouncements:vi.fn().mockResolvedValue({items:[]}), setAnnouncementScrolling:vi.fn().mockResolvedValue({})}));
it("requires a separate title and previews title with body before publishing",async()=>{
 render(<QueryClientProvider client={new QueryClient()}><AnnouncementsPage /></QueryClientProvider>);
 expect(screen.getByRole("checkbox")).not.toBeChecked();
 fireEvent.click(screen.getByRole("checkbox"));
 const title=screen.getByLabelText("公告标题");
 const body=screen.getByLabelText("公告正文");
 expect(title).toHaveAttribute("maxlength","100");
 fireEvent.change(title,{target:{value:"版本维护通知"}});
 fireEvent.change(body,{target:{value:"今晚进行维护，请提前保存。"}});
 fireEvent.click(screen.getByRole("button",{name:"预览并确认"}));
 expect(await screen.findByRole("heading",{name:"版本维护通知"})).toBeInTheDocument();
 expect(within(screen.getByRole("dialog")).getByText("今晚进行维护，请提前保存。")).toBeInTheDocument();
 expect(publishAnnouncement).not.toHaveBeenCalled();
});

it("lets admins stop scrolling without publishing another notification",async()=>{
 vi.mocked(listAnnouncements).mockResolvedValue({items:[{id:"a1",title:"维护通知",content:"正文",scrolling:true,createdAt:"2026-10-17T00:00:00Z",fanoutCompletedAt:"2026-10-17T00:00:00Z"}]});
 render(<QueryClientProvider client={new QueryClient()}><AnnouncementsPage /></QueryClientProvider>);
 fireEvent.click(await screen.findByRole("switch",{name:"维护通知的滚动播报"}));
 await vi.waitFor(()=>expect(setAnnouncementScrolling).toHaveBeenCalledWith("a1",false));
 expect(publishAnnouncement).not.toHaveBeenCalled();
});

it("edits the stored title and body without republishing",async()=>{
 vi.mocked(listAnnouncements).mockResolvedValue({items:[{id:"edit-a",title:"原公告",content:"原正文",scrolling:false,createdAt:"2026-10-17T00:00:00Z",fanoutCompletedAt:"2026-10-17T00:00:00Z"}]});
 render(<QueryClientProvider client={new QueryClient()}><AnnouncementsPage /></QueryClientProvider>);
 fireEvent.click(await screen.findByRole("button",{name:/编\s*辑/}));
 const dialog=within(screen.getByRole("dialog"));
 fireEvent.change(dialog.getByLabelText("标题"),{target:{value:"新标题"}});fireEvent.change(dialog.getByLabelText("正文"),{target:{value:"新正文"}});
 fireEvent.click(dialog.getByRole("button",{name:"保存修改"}));
 await vi.waitFor(()=>expect(editAnnouncement).toHaveBeenCalledWith("edit-a",{title:"新标题",content:"新正文"}));
 expect(publishAnnouncement).not.toHaveBeenCalled();
});
it("requires confirmation before deleting an announcement",async()=>{
 vi.mocked(listAnnouncements).mockResolvedValue({items:[{id:"delete-a",title:"待删除公告",content:"正文",scrolling:true,createdAt:"2026-10-17T00:00:00Z",fanoutCompletedAt:"2026-10-17T00:00:00Z"}]});
 render(<QueryClientProvider client={new QueryClient()}><AnnouncementsPage /></QueryClientProvider>);
 fireEvent.click(await screen.findByRole("button",{name:/删\s*除/}));
 expect(deleteAnnouncement).not.toHaveBeenCalled();
 fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"删除公告"}));
 await vi.waitFor(()=>expect(deleteAnnouncement).toHaveBeenCalledWith("delete-a",expect.anything()));
});
