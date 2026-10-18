import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Form, Input, Modal, Typography } from "antd";
import { apiClient } from "../api/client";
import { clearSession, getSessionEpoch } from "../auth/session";
import type { AdminAccount } from "../api/platform";
import { getErrorMessage } from "../utils/errors";
export function ResetAdminPasswordButton({account,ownAccount}:{account:AdminAccount;ownAccount:boolean}){
 const [open,setOpen]=useState(false);const [form]=Form.useForm();const epoch=useRef(0);
 const mutation=useMutation({mutationFn:({newPassword,reason}:{newPassword:string;reason:string})=>{
  if(getSessionEpoch()!==epoch.current)throw new Error("登录状态已变化，请重新登录");
  return apiClient(`/admin/access/accounts/${account.id}/password`,{method:"PATCH",retryOnUnauthorized:false,body:JSON.stringify({newPassword,reason:reason.trim()})});
 },onSuccess:()=>{form.resetFields();setOpen(false);if(ownAccount && getSessionEpoch()===epoch.current)clearSession();}});
 return <><Button onClick={()=>{epoch.current=getSessionEpoch();form.resetFields();mutation.reset();setOpen(true);}}>重置密码</Button>
 <Modal title={`重置管理员密码：${account.nickname || account.accountId}`} open={open} okText="确认重置" cancelText="取消" confirmLoading={mutation.isPending} onOk={()=>{if(!mutation.isPending)form.submit();}} onCancel={()=>{if(!mutation.isPending){form.resetFields();setOpen(false);}}}>
  <Typography.Paragraph>重置后，该管理员的现有登录会话将失效，需要使用新密码重新登录。{ownAccount ? "你正在修改自己的密码，完成后将退出登录。" : "请通过可信方式告知对方新密码。"}</Typography.Paragraph>
  {mutation.error && <Alert type="error" message={getErrorMessage(mutation.error,"重置失败，请重试")}/>}
  <Form name={`reset-admin-password-${account.id}`} form={form} layout="vertical" onFinish={({newPassword,reason})=>mutation.mutate({newPassword,reason})}>
   <Form.Item name="newPassword" label="新密码" rules={[{required:true},{min:12,max:64,message:"密码需为 12–64 位"},{pattern:/^(?=.*[A-Za-z])(?=.*\d)[\s\S]+$/,message:"密码需包含字母和数字"}]}><Input.Password autoComplete="new-password" disabled={mutation.isPending}/></Form.Item>
   <Form.Item name="confirmation" label="确认新密码" dependencies={['newPassword']} rules={[{required:true},({getFieldValue})=>({validator:(_,value)=>value===getFieldValue('newPassword')?Promise.resolve():Promise.reject(new Error('两次输入的密码不一致'))})]}><Input.Password autoComplete="new-password" disabled={mutation.isPending}/></Form.Item>
   <Form.Item name="reason" label="重置原因" rules={[{required:true,whitespace:true,min:2,max:500}]}><Input.TextArea maxLength={500} disabled={mutation.isPending}/></Form.Item>
  </Form>
 </Modal></>;
}
