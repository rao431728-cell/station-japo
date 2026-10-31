import { env } from "cloudflare:workers";
import { requestSchema, type ResearchEvent, type ResearchStage } from "@/lib/research-model";
import { GatewayResearchProvider, researchClubs, researchContacts } from "@/lib/research-provider";
import { deduplicateResults } from "@/lib/research";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
function configured(){return !!env.RESEARCH_PROVIDER_URL && !!env.RESEARCH_PROVIDER_TOKEN;}
export async function GET(request:Request){
  if(!request.headers.get("oai-authenticated-user-id")) return json({error:"Sign in required"},401);
  return json({connected:configured(),name:configured()?"Configured research gateway":"Research provider not connected",detail:"Configuration does not guarantee provider availability. Live requests may fail; no invented fallback is used."});
}
export async function POST(request:Request){
  if(!request.headers.get("oai-authenticated-user-id"))return json({error:"Sign in required"},401);
  if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Invalid origin"},403);
  if(!configured())return json({code:"PROVIDER_NOT_CONNECTED",error:"Research provider not connected. Connect a research gateway in server settings, or add manual source-backed findings."},503);
  let input;
  try {const raw=await request.text();if(raw.length>10000)return json({error:"Request too large"},413);input=requestSchema.parse(JSON.parse(raw));}catch{return json({error:"Enter a research request and valid filters."},400);}
  let provider:GatewayResearchProvider;
  try {provider=new GatewayResearchProvider(env.RESEARCH_PROVIDER_URL!,env.RESEARCH_PROVIDER_TOKEN!);}catch{return json({error:"Invalid research provider configuration."},503);}
  const encoder=new TextEncoder();
  const stream=new ReadableStream({async start(controller){
    const emit=(event:ResearchEvent)=>controller.enqueue(encoder.encode(JSON.stringify(event)+"\n"));
    const progress=(stage:ResearchStage,detail:string,count:number)=>emit({type:"progress",progress:{stage,detail,count,date:new Date().toISOString()}});
    try {
      progress("Understanding search","Validating the query and explicit filters; no unsupported interpretation is invented.",0);
      progress("Finding clubs","Waiting for sourced club results from the configured research gateway.",0);
      const clubs=await researchClubs(provider,input,request.signal);
      emit({type:"clubs",clubs});
      progress("Finding staff and public contact routes","Waiting for evidence-backed staff results. No LinkedIn scraping or automatic contact.",0);
      const contacts=await researchContacts(provider,input,clubs,request.signal);
      progress("Checking evidence","Validating field citations and source metadata. Provider reports are not independently verified by Station Japo.",contacts.length);
      progress("Removing duplicates","Matching email, LinkedIn, Instagram and name + club identities.",contacts.length);
      const results=deduplicateResults(contacts);
      emit({type:"results",results});
      progress("Ranking leads","Results ready for deterministic ranking against your saved market settings.",results.length);
      emit({type:"done"});
    }catch(e){console.error("Research gateway failure",e instanceof Error ? e.name : "Unknown");emit({type:"error",error:"Research stopped: the provider timed out, failed or returned invalid evidence. Earlier findings are retained for review. No invented results were added."});}
    finally{controller.close();}
  }});
  return new Response(stream,{headers:{"Content-Type":"application/x-ndjson","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
