import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {MemoryRouter} from "react-router-dom";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {beforeEach,it,expect,vi} from "vitest";
import {LoginPage} from "./LoginPage";
import {login,getMe} from "../api/auth";
import {setSession} from "../auth/session";
vi.mock("../api/auth",()=>({login:vi.fn(),getMe:vi.fn()}));
vi.mock("../auth/session",()=>({setSession:vi.fn(),clearSession:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();});
it("logs in using the administrator account name without requiring an email",async()=>{
 vi.mocked(login).mockResolvedValue({accessToken:'access',refreshToken:'refresh'});
 vi.mocked(getMe).mockResolvedValue({id:'admin',accountId:'support_01',nickname:'客服',role:'ADMIN',status:'ACTIVE'});
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><LoginPage/></MemoryRouter></QueryClientProvider>);
 fireEvent.change(screen.getByLabelText('登录账号'),{target:{value:' support_01 '}});fireEvent.change(screen.getByLabelText('密码'),{target:{value:'AccountPass1234'}});fireEvent.click(screen.getByRole('button',{name:/登\s*录/}));
 await waitFor(()=>expect(setSession).toHaveBeenCalledWith({accessToken:'access',refreshToken:'refresh'}));
 expect(login).toHaveBeenCalledWith({identifier:'support_01',password:'AccountPass1234'});
});
