import { useAdminAccountAvailability } from "./useAdminAccountAvailability";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Select, Typography, message } from "antd";
import { apiClient } from "../api/client";
import { getSessionEpoch } from "../auth/session";
import { displayLabel } from "../utils/display";
import { getErrorMessage } from "../utils/errors";
import type { ConsoleRole } from "../api/platform";
export interface NewAdminValues {nickname:string;accountId:string;password:string;role:ConsoleRole}
export function CreateAdminButton({onCreated}:{onCreated:()=>void}) {
 const [open,setOpen]=useState(false);const [form]=Form.useForm<NewAdminValues>();const epoch=useRef(0);
 const availability=useAdminAccountAvailability(form,open);
 const mutation=useMutation({mutationFn:({values,sessionEpoch}:{values:NewAdminValues;sessionEpoch:number})=>{
  if(getSessionEpoch()!==sessionEpoch)throw new Error("登录状态已变化，请重试");
  return apiClient('/admin/access/accounts',{method:'POST',retryOnUnauthorized:false,body:JSON.stringify(values)});
 },onSuccess:(_,variables)=>{if(getSessionEpoch()!==variables.sessionEpoch)return;form.resetFields();setOpen(false);onCreated();message.success("管理员已创建，可使用设置的密码登录");},onError:(error,variables)=>{if(getSessionEpoch()===variables.sessionEpoch)message.error(getErrorMessage(error,"创建失败，请核对账号列表后重试"));}});
 return <>
  <Button type="primary" onClick={()=>{epoch.current=getSessionEpoch();form.resetFields();setOpen(true);}}>新增管理员</Button>
  <Modal title="新增管理员" open={open} okText="创建账号" cancelText="取消" confirmLoading={mutation.isPending} okButtonProps={{disabled:!availability.available}} onOk={()=>{if(!mutation.isPending && availability.available)form.submit();}} onCancel={()=>{if(!mutation.isPending){form.resetFields();setOpen(false);}}}>
   <Typography.Paragraph type="secondary">对方使用你设置的账号和密码登录。其他管理员无法自行修改密码，后续由超级管理员统一重置。</Typography.Paragraph>
   <Form name="create-admin" form={form} layout="vertical" initialValues={{role:'OPERATIONS'}} onFinish={values=>{if(getSessionEpoch()!==epoch.current){form.resetFields();setOpen(false);return;}if(!availability.available)return;mutation.mutate({values:{...values,nickname:values.nickname.trim(),accountId:values.accountId.trim().toLowerCase()},sessionEpoch:epoch.current});}}>
    <Form.Item name="nickname" label="昵称" rules={[{required:true,whitespace:true},{max:50}]}><Input maxLength={50} disabled={mutation.isPending}/></Form.Item>
    <Form.Item name="accountId" label="登录账号" validateStatus={availability.status === "taken" || availability.status === "error" ? "error" : availability.status === "checking" ? "validating" : availability.status === "available" ? "success" : undefined} help={availability.help} extra="4–32 位字母、数字、下划线或短横线，不区分大小写" rules={[{required:true},{transform:value=>typeof value === "string" ? value.trim() : value,pattern:/^[a-zA-Z0-9_-]{4,32}$/,message:"账号需为 4–32 位字母、数字、下划线或短横线"}]}><Input maxLength={32} autoComplete="off" disabled={mutation.isPending}/></Form.Item>
    {availability.status === "error" && <Button type="link" size="small" onClick={availability.retry}>重新检查账号</Button>}
    <Form.Item name="password" label="登录密码" rules={[{required:true},{min:12,max:64,message:'密码需为 12–64 位'},{pattern:/^(?=.*[A-Za-z])(?=.*\d)[\s\S]+$/,message:'密码需同时包含字母和数字'}]}><Input.Password maxLength={64} autoComplete="new-password" disabled={mutation.isPending}/></Form.Item>
    <Form.Item name="role" label="管理员角色" rules={[{required:true}]}><Select disabled={mutation.isPending} options={['OPERATIONS','MODERATOR','SUPPORT','SUPER_ADMIN'].map(value=>({value,label:displayLabel('consoleRole',value)}))}/></Form.Item>
   </Form>
  </Modal>
 </>;
}
