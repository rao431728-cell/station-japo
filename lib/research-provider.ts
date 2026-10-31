import { z } from "zod";
import { publicURL, resultSchema, type ResearchProvider, type ResearchRequest, type ResearchResult } from "./research-model";

/** Server-only adapter for an operator-configured research gateway. No web-page scraping. */
export class GatewayResearchProvider implements ResearchProvider {
  readonly name = "Configured research gateway";
  constructor(private endpoint:string, private token:string) {
    if(!publicURL(endpoint)) throw new Error("Research gateway must be a public HTTPS endpoint.");
  }
  private async call(operation:"clubs"|"contacts", request:ResearchRequest, clubs:ResearchResult[], signal?:AbortSignal) {
    const url = this.endpoint.replace(/\/$/,"")+"/"+operation;
    const response = await fetch(url,{method:"POST",redirect:"error",headers:{"Content-Type":"application/json",Authorization:`Bearer ${this.token}`},body:JSON.stringify({version:1,request,clubs}),signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000)});
    if(!response.ok) throw new Error(`Research provider returned HTTP ${response.status}. No invented fallback was used.`);
    const reader=response.body?.getReader(); if(!reader) throw new Error("Research provider returned no data.");
    let raw=""; const decoder=new TextDecoder();
    try { while(true) {const chunk=await reader.read(); if(chunk.done)break;raw+=decoder.decode(chunk.value,{stream:true});if(raw.length>900000)throw new Error("Research provider response exceeds the size limit.");} raw+=decoder.decode(); } finally { await reader.cancel(); }
    const data=z.object({results:z.array(resultSchema).max(50)}).parse(JSON.parse(raw));
    if(operation === "contacts" && data.results.some(r=>r.facts.person?.kind !== "FACT")) throw new Error("Contact results must identify a source-backed person or department.");
    // Upstream cannot claim user approval or create CRM links.
    return data.results.map(r=>({...r,id:crypto.randomUUID(),reviewedAt:undefined,savedContactId:undefined,dismissed:false,sources:r.sources.map(s=>({...s,checkedBy:"provider" as const}))}));
  }
  researchClubs(request:ResearchRequest,signal?:AbortSignal) {return this.call("clubs",request,[],signal);}
  researchContacts(request:ResearchRequest,clubs:ResearchResult[],signal?:AbortSignal) {return this.call("contacts",request,clubs,signal);}
}
export function researchClubs(provider:ResearchProvider,request:ResearchRequest,signal?:AbortSignal) { return provider.researchClubs(request,signal); }
export function researchContacts(provider:ResearchProvider,request:ResearchRequest,clubs:ResearchResult[],signal?:AbortSignal) { return provider.researchContacts(request,clubs,signal); }
