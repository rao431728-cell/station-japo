import {randomBytes} from "node:crypto";

// A top-level local page: never embed this HTTP page in the HTTPS site.
// No credentials are placed in its HTML, URL, storage or logs.
export function bridgeDocument(origins:string[]){
  const nonce=randomBytes(18).toString("base64");
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Station Japo · Mac companion</title>
<style nonce="${nonce}">body{color:#eaf0ff;background:#101620;font:16px/1.6 system-ui;padding:28px;max-width:600px;margin:auto}h1{font-size:26px}p{color:#acbbd4}#status{padding:18px;border:1px solid #385277;border-radius:12px;color:#eaf0ff}small{color:#acbbd4}</style>
<h1>Station Japo Mac companion</h1><p id="status" role="status">Waiting for the Station Japo window that opened this page…</p><p>Keep this window and your companion terminal open, then return to Station Japo. Nothing is sent automatically.</p><small>This page accepts only the approved Station Japo website and requires your temporary terminal token for every request. Closing this window disconnects the website.</small>
<script nonce="${nonce}">
(()=>{
  const allowed=${JSON.stringify(origins)}, channel=location.hash.slice(1), openerWindow=window.opener;
  const status=document.getElementById('status');
  if(!openerWindow||!/^[a-f0-9-]{36}$/.test(channel)){status.textContent='Open this window using Connect Codex in Station Japo. Directly opening this address cannot connect.';return;}
  let ownerOrigin=null,active=0;
  const route=(path,method)=>(path==='/v1/health'&&method==='GET')||(path==='/v1/tasks'&&method==='POST')||(/^\\/v1\\/tasks\\/[a-f0-9-]{36}$/.test(path)&&['GET','DELETE'].includes(method));
  window.addEventListener('message',async event=>{
    if(event.source!==openerWindow||!allowed.includes(event.origin))return;
    const data=event.data;
    if(!data||data.channel!==channel||data.protocol!=='station-japo-bridge-v1')return;
    if(ownerOrigin&&ownerOrigin!==event.origin)return;
    ownerOrigin=event.origin;
    const reply=payload=>openerWindow.postMessage({protocol:'station-japo-bridge-v1',channel,...payload},ownerOrigin);
    if(data.type==='hello'){status.textContent='Station Japo window linked. Checking your authenticated Codex connection…';reply({type:'ready'});return;}
    if(data.type!=='request'||typeof data.id!=='string'||!/^[a-f0-9-]{36}$/.test(data.id))return;
    const reject=(code,message)=>reply({type:'response',id:data.id,status:400,data:{error:{code,message}}});
    if(!route(data.path,data.method)||typeof data.token!=='string'||!/^[a-f0-9]{64}$/.test(data.token)||typeof data.body!=='string'||data.body.length>200000){reject('INVALID_REQUEST','Invalid companion-window request. Nothing executed.');return;}
    if(active>=8){reject('BRIDGE_BUSY','Too many pending requests. Wait and try again.');return;}
    active++;
    try{
      const response=await fetch(data.path,{method:data.method,headers:{Authorization:'Bearer '+data.token,'Content-Type':'application/json','X-Station-Bridge':'1'},body:data.method==='POST'?data.body:undefined,credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
      const result=await response.json();
      if(data.path==='/v1/health')status.textContent=response.ok?(result.available?'Codex connected. Return to Station Japo to research or draft.':result.detail):'Token rejected. Paste the current terminal token into Station Japo.';
      reply({type:'response',id:data.id,status:response.status,data:result});
    }catch{status.textContent='The local service is unavailable. Keep the companion terminal running.';reply({type:'response',id:data.id,status:503,data:{error:{code:'NETWORK',message:'The companion window cannot reach the local service. Restart the companion if it stopped, then reconnect with its new token.'}}});}
    finally{active--;}
  });
})();
</script></html>`;
  return {html,nonce};
}
