"use client";
import { useEffect,useState } from "react";
import { type CompanionTask,type CompanionJob } from "./companion-contract";
import { CompanionWindowError,closeCompanionWindow,requestThroughCompanionWindow } from "./companion-window";
const key="station-japo-local-companion-token";
export class LocalCompanionError extends Error{constructor(public code:string,message:string){super(message);}}
export function companionToken(){return typeof window!=="undefined"?sessionStorage.getItem(key)||"":"";}
export function pairCompanion(token:string){if(token&&!/^[a-f0-9]{64}$/.test(token.trim()))throw new Error("Paste only the 64-character token printed by the running companion, without the surrounding instructions.");if(token)sessionStorage.setItem(key,token.trim());else{sessionStorage.removeItem(key);closeCompanionWindow();}window.dispatchEvent(new Event("station-companion-pairing"));}
export async function companionRequest(path:string,options:RequestInit={},signal?:AbortSignal){
  const token=companionToken();if(!token)throw new LocalCompanionError("NOT_PAIRED","Paste the companion token to connect Local Codex.");
  let response;try{response=await requestThroughCompanionWindow(path,options.method||"GET",typeof options.body==="string"?options.body:"",token,signal);}catch(e){if(e instanceof CompanionWindowError)throw new LocalCompanionError(e.code,e.message);throw e;}
  const data=response.data;if(response.status<200||response.status>=300)throw new LocalCompanionError(data?.error?.code||"HTTP_ERROR",data?.error?.message||`Companion returned HTTP ${response.status}`);return data;
}
export async function companionRetry(path:string,options:RequestInit={},signal?:AbortSignal){
  for(let attempt=0;;attempt++){try{return await companionRequest(path,options,signal);}catch(e){if(!(e instanceof LocalCompanionError)||e.code!=="NETWORK"||attempt>=2||signal?.aborted)throw e;await pause(1000*2**attempt,signal);}}
}
function pause(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal?.aborted){reject(new DOMException("Cancelled","AbortError"));return;}const onAbort=()=>{clearTimeout(timer);reject(new DOMException("Cancelled","AbortError"));};const timer=setTimeout(()=>{signal?.removeEventListener("abort",onAbort);resolve();},ms);signal?.addEventListener("abort",onAbort,{once:true});});}
export async function runCompanionTask(task:CompanionTask,onUpdate:(job:CompanionJob)=>void,signal?:AbortSignal,id=crypto.randomUUID()){
  const accepted=await companionRetry("/v1/tasks",{method:"POST",body:JSON.stringify({id,task})},signal);
  const cancel=()=>{void companionRequest(`/v1/tasks/${id}`,{method:"DELETE"}).catch(()=>{});};signal?.addEventListener("abort",cancel,{once:true});
  try{while(true){const job=await companionRetry(`/v1/tasks/${id}`,{},signal) as CompanionJob;if(job.instanceId!==accepted.instanceId)throw new LocalCompanionError("SESSION_CHANGED","Companion restarted. The old task was not automatically rerun.");onUpdate(job);if(job.state==="succeeded")return job.result;if(job.state!=="running")throw new LocalCompanionError(job.error?.code||"TASK_FAILED",job.error?.message||"Task did not succeed.");await pause(1800,signal);}}finally{signal?.removeEventListener("abort",cancel);}
}
export function useCompanion(){
  const [state,setState]=useState<{connected:boolean;paired:boolean;detail:string}>({connected:false,paired:false,detail:"Local Codex is not paired."});const [revision,setRevision]=useState(0);
  useEffect(()=>{const changed=()=>setRevision(n=>n+1);window.addEventListener("station-companion-pairing",changed);return()=>window.removeEventListener("station-companion-pairing",changed);},[]);
  useEffect(()=>{let stopped=false,timer:ReturnType<typeof setTimeout>,failures=0;const abort=new AbortController();async function check(){if(!companionToken()){setState({connected:false,paired:false,detail:"Start the Mac companion and paste its temporary token."});return;}try{const h=await companionRequest("/v1/health",{},abort.signal);if(stopped)return;failures=0;setState({connected:h.available===true,paired:true,detail:h.detail});timer=setTimeout(check,30000);}catch(e){if(stopped)return;setState({connected:false,paired:true,detail:(e as Error).message});if(e instanceof LocalCompanionError&&e.code==="TOKEN_REJECTED")return;timer=setTimeout(check,Math.min(60000,3000*2**failures++));}}void check();return()=>{stopped=true;clearTimeout(timer);abort.abort();};},[revision]);
  return {...state,recheck:()=>setRevision(n=>n+1)};
}
