import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { PostDetails } from "./PostDetails";
import { getPost } from "../api/moderation";
vi.mock("../api/moderation", () => ({ getPost: vi.fn() }));
function show() { return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><PostDetails postID="post-1" /></MemoryRouter></QueryClientProvider>); }
it("shows real post text, images and identity rather than only its internal ID", async () => {
 vi.mocked(getPost).mockResolvedValue({id:"post-1",content:"周末一起骑行\n上午九点出发",images:["https://example.com/photo.jpg"],tags:["骑行"],status:"ACTIVE",createdAt:"2026-10-17T00:00:00Z",updatedAt:"2026-10-17T00:00:00Z",author:{id:"user-1",accountId:"xiaoming",nickname:"小明"},circle:{id:"circle-1",name:"骑行圈"},signupCount:3});
 show(); expect(await screen.findByText(/上午九点出发/)).toBeInTheDocument(); expect(screen.getByAltText("帖子图片 1")).toHaveAttribute("src","https://example.com/photo.jpg"); expect(screen.getByText("骑行圈")).toBeInTheDocument(); expect(screen.getByText("账号 ID：xiaoming")).toBeInTheDocument();expect(screen.queryByText("post-1")).not.toBeInTheDocument();
});
it("shows an actionable error when the post cannot be loaded",async()=>{vi.mocked(getPost).mockRejectedValue(new Error("Unavailable")); show(); expect(await screen.findByText("帖子内容暂不可用，可能已删除或无权查看")).toBeInTheDocument();});
