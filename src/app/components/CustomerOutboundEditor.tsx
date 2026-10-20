"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SubmissionForm, SubmissionButton, submissionFetch } from "./SubmissionFeedback";
import type { CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export function CustomerOutboundEditor({order}:{order:CoreOutboundOrder}) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({channel:order.channel,orderCount:String(order.orderCount),recipientName:order.recipientName??"",
    deliveryAddress:order.deliveryAddress??"",requestedShipDate:order.requestedShipDate??"",note:order.note??"",
    skuLines:(order.skuLines??[]).map(line=>`${line.skuCode},${line.quantity}`).join("\n")});
  if(order.status!=="pending_review"||order.shippedAt||order.interceptStatus==="completed")return null;
  const field=(key:keyof typeof form,value:string)=>setForm(current=>({...current,[key]:value}));
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
      const response=await submissionFetch(`/api/outbounds/${encodeURIComponent(order.id)}/customer`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,expectedUpdatedAt:order.updatedAt??order.createdAt})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"保存失败，请稍后重试");
      setOpen(false);router.refresh();

  }
  const style="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-950";
  return <div className="mt-3">
    <button type="button" className="rounded-md border border-cyan-300 px-3 py-2 text-sm font-semibold text-cyan-800" onClick={()=>setOpen(!open)}>{open?"收起修改":"编辑申请"}</button>
    <SubmissionButton className="ml-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800" onClick={async()=>{
      if(!window.confirm("确认撤回此待审核申请并释放预占库存？")) return false;
      await submissionFetch(`/api/outbounds/${encodeURIComponent(order.id)}/cancel`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedUpdatedAt:order.updatedAt??order.createdAt})});
      router.refresh();
    }}>撤回申请</SubmissionButton>
    {open?<SubmissionForm onSubmit={save} className="mt-3 grid gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm text-slate-800">
      <p>仅待审核申请可修改。保存时会重新核对商品和库存。</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>尾程渠道<input className={style} required value={form.channel} onChange={e=>field("channel",e.target.value)}/></label>
        <label>订单数<input className={style} required type="number" min="1" step="1" value={form.orderCount} onChange={e=>field("orderCount",e.target.value)}/></label>
        <label>收件人<input className={style} required value={form.recipientName} onChange={e=>field("recipientName",e.target.value)}/></label>
        <label>期望发货日<input className={style} type="date" value={form.requestedShipDate} onChange={e=>field("requestedShipDate",e.target.value)}/></label>
      </div>
      <label>商品 SKU 与包材（每行 SKU,数量）<textarea className={style} required rows={4} value={form.skuLines} onChange={e=>field("skuLines",e.target.value)}/><span className="text-xs font-normal">至少填写一条商品；PACKAGING 是包材。</span></label>
      <label>完整收件地址（含英国邮编）<textarea className={style} required rows={3} value={form.deliveryAddress} onChange={e=>field("deliveryAddress",e.target.value)}/></label>
      <label>补充说明<input className={style} value={form.note} onChange={e=>field("note",e.target.value)}/></label>
      <button type="submit" className="w-fit rounded-md bg-cyan-800 px-4 py-2 font-semibold text-white disabled:opacity-60">保存修改</button>
    </SubmissionForm>:null}
  </div>;
}
