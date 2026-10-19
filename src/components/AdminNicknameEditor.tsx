import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Typography, message } from "antd";
import { useRef, useState } from "react";
import { updateAdminNickname } from "../api/auth";
import { getSessionEpoch } from "../auth/session";
import type { AuthUser } from "../types";
import { getErrorMessage } from "../utils/errors";

export function AdminNicknameEditor({user}:{user:AuthUser}) {
  const [open,setOpen]=useState(false);
  const editingEpoch=useRef(getSessionEpoch());
  const [form]=Form.useForm<{nickname:string}>();
  const client=useQueryClient();
  const mutation=useMutation({
    mutationFn:({nickname,epoch}:{nickname:string;epoch:number})=>{
      if(getSessionEpoch()!==epoch)throw new Error("登录状态已变更，请重试");
      return updateAdminNickname(nickname);
    },
    onSuccess:(updated,variables)=>{
      if(getSessionEpoch()!==variables.epoch || updated.id!==user.id)return;
      const merge=(current:AuthUser|undefined)=>current?.id===updated.id ? {...current,nickname:updated.nickname} : current;
      client.setQueryData<AuthUser>(["me",variables.epoch],merge);
      client.setQueryData<AuthUser>(["auth-me"],merge);
      void client.invalidateQueries({queryKey:["admin-access-accounts"]});
      void client.invalidateQueries({queryKey:["me",variables.epoch]});
      void client.invalidateQueries({queryKey:["auth-me"]});
      setOpen(false);message.success("昵称已更新");
    },
    onError:(error,variables)=>{if(getSessionEpoch()===variables.epoch)message.error(getErrorMessage(error,"昵称修改失败，请重试"));},
  });
  return <>
    <Button size="small" type="text" onClick={()=>{editingEpoch.current=getSessionEpoch();form.setFieldsValue({nickname:user.nickname || ""});setOpen(true);}}>修改昵称</Button>
    <Modal title="修改管理员昵称" open={open} okText="保存" cancelText="取消" confirmLoading={mutation.isPending} onCancel={()=>{if(!mutation.isPending)setOpen(false);}} onOk={()=>{if(!mutation.isPending)form.submit();}}>
      <Typography.Paragraph type="secondary">修改当前管理员的显示名称，不影响登录账号和权限。</Typography.Paragraph>
      <Form name="admin-nickname" form={form} layout="vertical" onFinish={({nickname})=>{
        const epoch=editingEpoch.current;
        if(getSessionEpoch()!==epoch){setOpen(false);return;}
        mutation.mutate({nickname:nickname.trim(),epoch});
      }}><Form.Item name="nickname" label="昵称" rules={[{required:true,whitespace:true,message:"请输入昵称"},{max:50,message:"昵称最多 50 个字符"}]}><Input maxLength={50} showCount disabled={mutation.isPending} autoComplete="off" /></Form.Item></Form>
    </Modal>
  </>;
}
