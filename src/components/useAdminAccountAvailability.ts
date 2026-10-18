import {useEffect,useState} from "react";
import {Form, type FormInstance} from "antd";
import {apiClient} from "../api/client";
import {getSessionEpoch} from "../auth/session";
type Status="idle"|"checking"|"available"|"taken"|"error";
export function useAdminAccountAvailability(form:FormInstance,open:boolean,excludeUserId?:string){
 const value=Form.useWatch("accountId",form);
 const accountId=typeof value === "string" ? value.trim().toLowerCase() : "";
 const valid=/^[a-z0-9_-]{4,32}$/.test(accountId);
 const [attempt,setAttempt]=useState(0);
 const [result,setResult]=useState<{accountId:string;status:Status}>({accountId:"",status:"idle"});
 useEffect(()=>{
  if(!open || !valid)return;
  let active=true;const controller=new AbortController();const epoch=getSessionEpoch();
  setResult({accountId,status:"checking"});
  const timer=setTimeout(()=>{
   const query=new URLSearchParams({accountId});if(excludeUserId)query.set("excludeUserId",excludeUserId);
   apiClient<{available:boolean}>(`/admin/access/accounts/availability?${query}`,{signal:controller.signal,cache:"no-store",retryOnUnauthorized:false}).then(response=>{
    if(active && getSessionEpoch()===epoch)setResult({accountId,status:response.available === true ? "available":"taken"});
   }).catch(()=>{if(active && getSessionEpoch()===epoch)setResult({accountId,status:"error"});});
  },350);
  return ()=>{active=false;clearTimeout(timer);controller.abort();};
 },[accountId,valid,open,excludeUserId,attempt]);
 const status:Status=!open || !valid ? "idle" : result.accountId === accountId ? result.status : "checking";
 const help=status === "taken" ? "登录账号已被使用，请更换账号" : status === "checking" ? "正在检查账号是否可用…" : status === "available" ? "该账号可以使用" : status === "error" ? "暂时无法检查账号，请重新检查" : undefined;
 return {available:status === "available",status,help,retry:()=>setAttempt(value=>value+1)};
}
