import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash,randomBytes,timingSafeEqual,randomUUID } from "node:crypto";
import { envelopeSchema,actionNames,STATION_ORIGIN,type CompanionJob,type CompanionTask } from "../lib/companion-contract";
import { CompanionError,codexHealth,executeTask } from "./codex";
import { bridgeDocument } from "./bridge";
type Runner=(task:CompanionTask,signal:AbortSignal,onEvent:(text:string)=>void)=>Promise<unknown>;
export function createCompanion(options:{token:string;port?:number;dev?:boolean;runner?:Runner;health?:typeof codexHealth;taskLimit?:number}) {
  const port=options.port??4318,instanceId=randomUUID();
  const origins=new Set([STATION_ORIGIN,...(options.dev?["http://localhost:5173"]:[])]);
  const jobs=new Map<string,{hash:string;job:CompanionJob;abort:AbortController}>();
  const rate:{requests:number[];tasks:number[]}={requests:[],tasks:[]};
  let active=false,healthAt=0,healthValue:{available:boolean;detail:string}|undefined,healthPending:Promise<{available:boolean;detail:string}>|undefined;
  const runner=options.runner||executeTask;
  async function health(){if(healthValue&&Date.now()-healthAt<30000)return healthValue;if(!healthPending)healthPending=(options.health||codexHealth)().then(v=>{healthValue=v;healthAt=Date.now();return v;}).finally(()=>healthPending=undefined);return healthPending;}
  const reply=(res:ServerResponse,status:number,body:unknown)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(body));};
  const fail=(res:ServerResponse,status:number,code:string,message:string)=>reply(res,status,{error:{code,message}});
  const server=createServer(async(req,res)=>{
    const now=Date.now();rate.requests=rate.requests.filter(t=>now-t<60000);
    if(rate.requests.length>=180){res.setHeader("Retry-After","60");fail(res,429,"RATE_LIMIT","Too many companion requests. Retry in a minute.");return;}rate.requests.push(now);
    if(req.socket.remoteAddress!=="127.0.0.1"||req.headers.host!==`127.0.0.1:${port}`){fail(res,403,"HOST_REJECTED","Only the local companion address is allowed.");return;}
    if(req.method==="GET"&&req.url==="/bridge"){
      const {html,nonce}=bridgeDocument([...origins]);
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"same-origin","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Content-Security-Policy":`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`});res.end(html);return;
    }
    const origin=req.headers.origin;
    const localOrigin=`http://127.0.0.1:${port}`;
    // Same-origin GET may omit Origin in Safari. Require our custom header and
    // exact bridge Referer instead; authentication remains mandatory below.
    const fromBridge=req.headers["x-station-bridge"]==="1"&&req.headers.referer===`${localOrigin}/bridge`&&(!origin||origin===localOrigin)&&(!req.headers["sec-fetch-site"]||req.headers["sec-fetch-site"]==="same-origin");
    if(!fromBridge&&(!origin||!origins.has(origin))){fail(res,403,"ORIGIN_REJECTED","This companion accepts only Station Japo.");return;}
    if(origin)res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin");
    if(req.method==="OPTIONS"){
      const method=req.headers["access-control-request-method"];
      const headers=String(req.headers["access-control-request-headers"]||"").toLowerCase().split(",").map(x=>x.trim()).filter(Boolean);
      if(!["GET","POST","DELETE"].includes(String(method))||headers.some(x=>!["authorization","content-type"].includes(x))){fail(res,403,"PREFLIGHT_REJECTED","Request not allowed.");return;}
      res.writeHead(204,{"Access-Control-Allow-Methods":"GET, POST, DELETE","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Private-Network":"true","Access-Control-Max-Age":"300"});res.end();return;
    }
    const supplied=Buffer.from(String(req.headers.authorization||"").replace(/^Bearer /,""));const expected=Buffer.from(options.token);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){fail(res,401,"TOKEN_REJECTED","Local token is missing or expired. Paste the token printed by the running companion.");return;}
    try {
      if(req.method==="GET"&&req.url==="/v1/health"){const h=await health();reply(res,200,{instanceId,status:h.available?"Codex connected":"Codex unavailable",...h,actions:actionNames,busy:active});return;}
      const match=/^\/v1\/tasks\/([0-9a-f-]{36})$/.exec(req.url||"");
      if(match&&(req.method==="GET"||req.method==="DELETE")){
        const record=jobs.get(match[1]);if(!record){fail(res,404,"JOB_NOT_FOUND","Task not found in this companion session. It has not been restarted automatically.");return;}
        if(req.method==="DELETE"&&record.job.state==="running")record.abort.abort();
        if(record.job.finishedAt&&now-Date.parse(record.job.finishedAt)>3600000){fail(res,410,"RESULT_EXPIRED","Task result expired from local memory. Start a new task only if needed.");return;}
        reply(res,200,record.job);return;
      }
      if(req.method!=="POST"||req.url!=="/v1/tasks"){fail(res,404,"UNKNOWN_REQUEST","Unknown route or method. No command execution endpoint exists.");return;}
      if(!/^application\/json(?:;|$)/i.test(String(req.headers["content-type"]))){fail(res,415,"CONTENT_TYPE","JSON requests only.");return;}
      if(Number(req.headers["content-length"]||0)>200000){fail(res,413,"BODY_LIMIT","Task exceeds 200 KB.");return;}
      let raw="";for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>200000){fail(res,413,"BODY_LIMIT","Task exceeds 200 KB.");return;}}
      const parsed=envelopeSchema.safeParse(JSON.parse(raw));if(!parsed.success){fail(res,400,"INVALID_TASK","Unknown action, extra fields or invalid task data. Nothing executed.");return;}
      const {id,task}=parsed.data,hash=createHash("sha256").update(JSON.stringify(task)).digest("hex");
      const prior=jobs.get(id);if(prior){if(prior.hash!==hash){fail(res,409,"ID_CONFLICT","This request ID belongs to different task data.");return;}reply(res,200,{id,instanceId,state:prior.job.state});return;}
      rate.tasks=rate.tasks.filter(t=>now-t<3600000);
      if(rate.tasks.length>=(options.taskLimit??30)||rate.tasks.filter(t=>now-t<60000).length>=4){res.setHeader("Retry-After","60");fail(res,429,"TASK_RATE_LIMIT","Limit reached: 4 new tasks/minute and 30/hour. Existing tasks can still be checked.");return;}
      if(active){fail(res,409,"BUSY","One task is already running. Wait for it to finish or cancel it.");return;}
      if(jobs.size>=100){fail(res,429,"SESSION_LIMIT","This companion session reached 100 tasks. Restart it to rotate the token and clear local memory.");return;}
      const abort=new AbortController(),job:CompanionJob={id,instanceId,action:task.action,state:"running",events:[],createdAt:new Date().toISOString()};
      jobs.set(id,{hash,job,abort});active=true;rate.tasks.push(now);
      reply(res,202,{id,instanceId,state:"running"});
      void runner(task,abort.signal,text=>{if(job.events.length<100)job.events.push({date:new Date().toISOString(),text});}).then(result=>{job.result=result;job.state="succeeded";}).catch(e=>{
        const error=e instanceof CompanionError?e:new CompanionError("TASK_FAILED","The local task failed. No successful AI result was produced.");job.state=error.code==="CANCELLED"?"cancelled":"failed";job.error={code:error.code,message:error.message};
        console.error(JSON.stringify({event:"companion_task_failed",id,action:task.action,code:error.code,date:new Date().toISOString()}));
      }).finally(()=>{active=false;job.finishedAt=new Date().toISOString();healthAt=0;
        const expiry=setTimeout(()=>{delete job.result;job.events=[];},3600000);expiry.unref();
      });
    }catch{fail(res,400,"INVALID_REQUEST","Malformed request. Nothing executed.");}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=30;
  server.on("close",()=>{for(const r of jobs.values())r.abort.abort();});
  return {server,instanceId,stop:()=>{for(const r of jobs.values())r.abort.abort();server.close();},listen:()=>new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",()=>resolve());})};
}
export function createToken(){return randomBytes(32).toString("hex");}
