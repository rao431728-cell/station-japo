"use client";
import {COMPANION_URL} from "./companion-contract";
const protocol="station-japo-bridge-v1";
let popup:Window|null=null,channel="",ready=false,dispose:(()=>void)|undefined;
type Pending={resolve:(value:{status:number;data:any})=>void;reject:(reason:Error)=>void};
const pending=new Map<string,Pending>();
export class CompanionWindowError extends Error {constructor(public code:string,message:string){super(message);}}
const changed=()=>window.dispatchEvent(new Event("station-companion-pairing"));
export function closeCompanionWindow(){
  dispose?.();dispose=undefined;ready=false;
  for(const p of pending.values())p.reject(new CompanionWindowError("BRIDGE_CLOSED","The companion window was closed. Click Open companion window to reconnect."));
  pending.clear();popup?.close();popup=null;
}
// Must be called directly from a user click, never from an automatic retry.
export function openCompanionWindow(){
  if(popup&&!popup.closed&&ready){popup.focus();changed();return;}
  closeCompanionWindow();channel=crypto.randomUUID();
  popup=window.open(`${COMPANION_URL}/bridge#${channel}`,"_blank","popup,width=560,height=420");
  if(!popup)throw new CompanionWindowError("POPUP_BLOCKED","Safari did not open the companion window. Allow this site's requested pop-up, then click Open companion window again.");
  const activePopup=popup,activeChannel=channel;
  const receive=(e:MessageEvent)=>{
    if(e.origin!==COMPANION_URL||e.source!==activePopup||e.data?.channel!==activeChannel||e.data?.protocol!==protocol)return;
    if(e.data.type==="ready"){if(!ready){ready=true;changed();}return;}
    if(e.data.type==="response"&&typeof e.data.id==="string"&&Number.isInteger(e.data.status))pending.get(e.data.id)?.resolve({status:e.data.status,data:e.data.data});
  };
  window.addEventListener("message",receive);
  const start=Date.now();
  const heartbeat=setInterval(()=>{
    if(activePopup.closed){closeCompanionWindow();changed();return;}
    if(!ready&&Date.now()-start<20000)activePopup.postMessage({protocol,channel:activeChannel,type:"hello"},COMPANION_URL);
  },250);
  dispose=()=>{clearInterval(heartbeat);window.removeEventListener("message",receive);};
  changed();
}
export function requestThroughCompanionWindow(path:string,method:string,body:string,token:string,signal?:AbortSignal){
  if(!popup||popup.closed)throw new CompanionWindowError("BRIDGE_CLOSED","Click Open companion window to connect. Keep that window and the terminal open.");
  if(!ready)throw new CompanionWindowError("BRIDGE_NOT_READY","Waiting for the local window. If it shows an error, restart the companion with npm run companion, then click Open companion window again.");
  return new Promise<{status:number;data:any}>((resolve,reject)=>{
    const id=crypto.randomUUID();
    const cleanup=()=>{clearTimeout(timer);pending.delete(id);signal?.removeEventListener("abort",abort);};
    const abort=()=>{cleanup();reject(new DOMException("Cancelled","AbortError"));};
    const timer=setTimeout(()=>{cleanup();reject(new CompanionWindowError("NETWORK","The companion window did not respond. Keep it open and check the companion terminal."));},15000);
    pending.set(id,{resolve:v=>{cleanup();resolve(v);},reject:e=>{cleanup();reject(e);}});
    signal?.addEventListener("abort",abort,{once:true});if(signal?.aborted){abort();return;}
    popup!.postMessage({protocol,channel,type:"request",id,path,method,body,token},COMPANION_URL);
  });
}
