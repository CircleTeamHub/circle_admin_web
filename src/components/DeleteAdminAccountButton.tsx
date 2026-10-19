import {useRef,useState} from "react";
import {useMutation} from "@tanstack/react-query";
import {Alert,Button,Form,Input,Modal,Typography} from "antd";
import {apiClient} from "../api/client";
import {getSessionEpoch} from "../auth/session";
import type {AdminAccount} from "../api/platform";
import {getErrorMessage} from "../utils/errors";
export function DeleteAdminAccountButton({account,ownAccount,onDeleted}:{account:AdminAccount;ownAccount:boolean;onDeleted:()=>void}){
 const [open,setOpen]=useState(false);const [form]=Form.useForm();const epoch=useRef(0);
 const mutation=useMutation({mutationFn:({reason}:{reason:string})=>{
  if(getSessionEpoch()!==epoch.current)throw new Error('登录状态已变化，请重新登录');
  return apiClient(`/admin/access/accounts/${account.id}`,{method:'DELETE',retryOnUnauthorized:false,body:JSON.stringify({version:account.version,reason:reason.trim()})});
 },onSuccess:()=>{if(getSessionEpoch()!==epoch.current)return;form.resetFields();setOpen(false);onDeleted();}});
 return <><Button danger disabled={ownAccount} onClick={()=>{epoch.current=getSessionEpoch();mutation.reset();form.resetFields();setOpen(true);}}>删除</Button>
 <Modal title={`删除管理员：${account.nickname || account.accountId}`} open={open} okText="确认删除" cancelText="取消" okButtonProps={{danger:true}} confirmLoading={mutation.isPending} onOk={()=>{if(!mutation.isPending)form.submit();}} onCancel={()=>{if(!mutation.isPending){form.resetFields();setOpen(false);}}}>
 <Typography.Paragraph>删除后，该账号将从管理员列表移除，现有登录立即失效，无法再次登录。历史操作记录会保留。</Typography.Paragraph>
 {mutation.error && <Alert type="error" message={getErrorMessage(mutation.error,'删除失败，请刷新列表后重试')}/>}
 <Form name={`delete-admin-${account.id}`} form={form} layout="vertical" onFinish={values=>mutation.mutate(values)}><Form.Item name="reason" label="删除原因" rules={[{required:true,whitespace:true,min:2,max:500}]}><Input.TextArea maxLength={500} disabled={mutation.isPending}/></Form.Item></Form>
 </Modal></>;
}
