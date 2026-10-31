import type { Contact, Database, Platform } from "@/types";
import { normalizeIdentity } from "./identity";
import { generateOutreach as composeMessage, outreachWarning } from "./intelligence";
import { generateLinkedInMessage, linkedInState } from "./linkedin";
import { orderMessages } from "./message-history";
import { confidenceLevels, resultSchema, type ResearchField, type ResearchFilters, type ResearchJob, type ResearchResult, type ResearchScore } from "./research-model";

export const value = (r: ResearchResult, key: ResearchField) => r.facts[key]?.value || "";
export const fact = (r: ResearchResult, key: ResearchField) => r.facts[key]?.kind === "FACT" && r.facts[key]?.sourceIds.some(id => r.sources.some(s => s.id === id)) ? value(r,key) : "";
const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g," ");
const countryKey = (v:string) => ({"united arab emirates":"uae","united states":"usa","united states of america":"usa"}[norm(v)] || norm(v));
export const getSources = (r:ResearchResult, field?:ResearchField) => field ? r.sources.filter(s => r.facts[field]?.sourceIds.includes(s.id)) : r.sources;
export function verifyContact(r:ResearchResult) {
  const keys: ResearchField[] = value(r,"person") ? ["club","person","role"] : ["club"];
  const evidence = keys.every(k => !!fact(r,k));
  const reliable = keys.every(k => getSources(r,k).some(s => s.type.startsWith("Official")));
  const manuallyChecked = keys.every(k => getSources(r,k).some(s => s.checkedBy === "user"));
  const checked = evidence && r.reviewedAt && manuallyChecked;
  const confidence = checked && reliable ? "VERIFIED" : evidence && reliable ? "HIGH CONFIDENCE" : evidence ? "MEDIUM CONFIDENCE" : "UNVERIFIED";
  return {confidence, lastVerified: checked ? r.reviewedAt : null, emailInferred:r.facts.email?.kind === "INFERENCE", explanation: confidence === "VERIFIED" ? "Core identity and role have official-source evidence that you marked checked. Other fields retain their own evidence." : "Confidence describes the supplied evidence, not guaranteed accuracy. Provider-reported source checks do not constitute your verification."} as const;
}
export function rolePoints(role:string) {
  if (/marketing|sales|ticket|press|commercial|operations/i.test(role) && !/recruit|sporting|technical|academy|scout/i.test(role)) return 0;
  const rankings: [RegExp,number][] = [[/sporting director/i,30],[/technical director/i,28],[/head of recruitment/i,27],[/recruitment officer/i,26],[/academy director|head of academy/i,25],[/academy.*recruit|recruit.*academy/i,24],[/u(23|21|20).*head coach/i,23],[/youth scout/i,22],[/first.team scout/i,21],[/head coach/i,20],[/recruit/i,24],[/scout/i,19],[/football department/i,12],[/general.*(club|email)|club contact/i,6]];
  return rankings.find(([re])=>re.test(role))?.[1] || 0;
}
export function rankContact(r:ResearchResult, db:Database, filters:ResearchFilters):ResearchScore {
  const role = fact(r,"role"), country = fact(r,"country"), age = filters.ageGroup;
  const market = Object.entries(db.marketPriorities || {}).find(([c])=>countryKey(c)===countryKey(country))?.[1];
  const targeted = db.player.markets.some(c=>countryKey(c)===countryKey(country));
  const official = r.sources.some(s=>s.type.startsWith("Official"));
  const pathway = ["academy","reserveTeam","U23","U21","U20","U18"].filter(k=>/^(yes|true)$/i.test(fact(r,k as ResearchField)));
  const ageMatch = age !== "Any" && (pathway.some(p=>norm(p)===norm(age)) || role.toLowerCase().includes(age.toLowerCase()));
  const parts = [
    {label:"Role relevance",points:rolePoints(role),max:30,reason:role ? `Published role: ${role}` : "No sourced role; no role points"},
    {label:"Target market",points:market === "PAUSED" ? 0 : market === "HIGH PRIORITY" ? 20 : market === "ACTIVE" ? 16 : market === "EXPLORING" ? 8 : targeted ? 16 : filters.country !== "Any" && countryKey(country) === countryKey(filters.country) ? 16 : 0,max:20,reason:country ? `${country}: ${market || (targeted ? "player target market" : "query match or unset")}` : "Country unknown"},
    {label:"Age-group relevance",points:ageMatch ? 15 : age === "Any" && pathway.length ? 8 : 0,max:15,reason:ageMatch ? `Sourced ${age} pathway / role` : pathway.length ? `Known pathways: ${pathway.join(", ")}` : "No sourced age-group match"},
    {label:"Public contact route",points:fact(r,"email") ? 15 : fact(r,"linkedin") || fact(r,"instagram") ? 10 : 0,max:15,reason:fact(r,"email") ? "Email explicitly listed in cited evidence" : fact(r,"linkedin") || fact(r,"instagram") ? "Cited social profile route" : "No factual public route (inferences excluded)"},
    {label:"Source reliability",points:official ? 10 : r.sources.some(s=>s.type === "LinkedIn") ? 6 : r.sources.length ? 3 : 0,max:10,reason:official ? "Official source classification (inspect evidence)" : "Non-official sources or none"},
    {label:"Club / pathway relevance",points:pathway.length ? 10 : fact(r,"club") && fact(r,"website") ? 5 : 0,max:10,reason:pathway.length ? "Published youth/reserve pathway" : "Club and site evidence only; trial suitability not established"},
  ];
  return {total:parts.reduce((n,p)=>n+p.points,0),breakdown:parts,why:rolePoints(role)>0 ? `${role} is prioritized for football outreach${pathway.length ? `; published ${pathway.join(" / ")} pathways may be relevant` : ""}. This is a rule-based relevance inference, not evidence of an available trial.` : "No recognized recruitment role is established. Review suitability before contacting."};
}
function sameIdentity(a:ResearchResult,b:ResearchResult) {
  // Conservative route matching prevents repeated outreach through shared inboxes.
  return (["email","linkedin","instagram"] as const).some(k=>fact(a,k) && fact(b,k) && normalizeIdentity(fact(a,k),k)===normalizeIdentity(fact(b,k),k)) || (!!fact(a,"person") && norm(fact(a,"person"))===norm(fact(b,"person")) && norm(fact(a,"club"))===norm(fact(b,"club")));
}
export function deduplicateContact(r:ResearchResult, db:Database):Contact | undefined {
  return db.contacts.find(c => (["email","linkedin","instagram"] as const).some(k=>fact(r,k) && c[k] && normalizeIdentity(fact(r,k),k)===normalizeIdentity(c[k],k)) || (!!fact(r,"person") && norm(c.name)===norm(fact(r,"person")) && norm(db.clubs.find(b=>b.id===c.clubId)?.name||"")===norm(fact(r,"club"))));
}
export function deduplicateResults(results:ResearchResult[]) {
  const unique:ResearchResult[]=[];
  for(const raw of results) {
    const r=resultSchema.parse(raw);
    const sourceIds=new Map(r.sources.map(s=>[s.id,crypto.randomUUID()]));
    r.sources=r.sources.map(s=>({...s,id:sourceIds.get(s.id)!}));
    for(const f of Object.values(r.facts))if(f)f.sourceIds=f.sourceIds.map(id=>sourceIds.get(id)||id);
    const match=unique.find(x=>sameIdentity(x,r));
    if (!match) unique.push(r);
    else {
      // Retain conflicting values as source notes rather than silently overwriting a fact.
      for(const [key,f] of Object.entries(r.facts)) if(f) {
        if(!match.facts[key as ResearchField]) {match.facts[key as ResearchField]=f;}
        else if(value(match,key as ResearchField)!==f.value) match.notes += `\nConflicting ${key}: ${f.value}. Check ${f.sourceIds.join(", ")}.`;
      }
      for(const s of r.sources) if(!match.sources.some(x=>x.id===s.id)) match.sources.push(s);
    }
  }
  return unique;
}
export function matchesFilters(r:ResearchResult, f:ResearchFilters) {
  const includes=(actual:string,wanted:string)=>wanted==="Any" || actual.toLowerCase().includes(wanted.toLowerCase());
  return (f.country==="Any" || countryKey(fact(r,"country"))===countryKey(f.country)) && includes(fact(r,"league"),f.league) && includes(fact(r,"level"),f.level) && includes(fact(r,"role"),f.role)
    && (f.ageGroup==="Any" || /^(yes|true)$/i.test(fact(r,f.ageGroup as ResearchField)) || fact(r,"role").toLowerCase().includes(f.ageGroup.toLowerCase()))
    && (f.method==="Any" || !!fact(r,({Email:"email",LinkedIn:"linkedin",Instagram:"instagram"} as const)[f.method]))
    && confidenceLevels.indexOf(verifyContact(r).confidence)>=confidenceLevels.indexOf(f.minConfidence);
}
export function saveResearchJob(db:Database, job:ResearchJob) {
  db.researchJobs ||= [];
  const at=db.researchJobs.findIndex(j=>j.id===job.id);
  if(at<0) db.researchJobs.unshift(structuredClone(job)); else db.researchJobs[at]=structuredClone(job);
}
export function saveClub(db:Database, r:ResearchResult) {
  if(!fact(r,"club")) throw new Error("A factual, sourced club name is required.");
  let club=db.clubs.find(b=>norm(b.name)===norm(fact(r,"club")) && (!fact(r,"country") || !b.country || countryKey(b.country)===countryKey(fact(r,"country"))));
  if(!club) {club={id:crypto.randomUUID(),name:fact(r,"club"),country:fact(r,"country"),league:fact(r,"league"),level:fact(r,"level"),teams:[],site:fact(r,"website"),notes:"",researchEvidence:[]};db.clubs.push(club);}
  club.researchEvidence ||= [];
  const clubEvidenceAt=club.researchEvidence.findIndex(x=>x.id===r.id);
  if(clubEvidenceAt<0)club.researchEvidence.push(structuredClone(r));else club.researchEvidence[clubEvidenceAt]=structuredClone(r);
  club.teams=[...new Set([...club.teams,...(["academy","reserveTeam","U23","U21","U20","U18"] as const).filter(k=>/^(yes|true)$/i.test(fact(r,k))).map(k=>k==="academy"?"Academy":k==="reserveTeam"?"Reserve":k)])];
  club.lastVerified=verifyContact(r).lastVerified || club.lastVerified;
  return club;
}
export function saveContact(db:Database, result:ResearchResult, jobId:string):string {
  const r=resultSchema.parse(result);
  if(!fact(r,"person") || !fact(r,"club")) throw new Error("Review a sourced person (or explicitly named club department) and club before saving.");
  const prior=deduplicateContact(r,db);
  if(prior) {
    prior.researchEvidence ||= [];const evidenceAt=prior.researchEvidence.findIndex(x=>x.id===r.id);if(evidenceAt<0)prior.researchEvidence.push(structuredClone(r));else prior.researchEvidence[evidenceAt]=structuredClone(r);
    prior.sources=[...new Set([...prior.sources,...r.sources.map(s=>s.url)])];
    for(const k of ["email","linkedin","instagram"] as const)if(!prior[k]&&fact(r,k))prior[k]=fact(r,k);
    if(norm(db.clubs.find(b=>b.id===prior.clubId)?.name||"")===norm(fact(r,"club")))saveClub(db,r);
    const stored=db.researchJobs?.find(j=>j.id===jobId)?.results.find(x=>x.id===r.id);if(stored)stored.savedContactId=prior.id;
    return prior.id;
  }
  const club=saveClub(db,r), checked=verifyContact(r);
  const emailSources=getSources(r,"email");
  const c:Contact={id:crypto.randomUUID(),name:fact(r,"person"),clubId:club.id,role:fact(r,"role"),country:fact(r,"country"),league:fact(r,"league"),email:fact(r,"email"),instagram:fact(r,"instagram"),linkedin:fact(r,"linkedin"),sources:r.sources.map(s=>s.url),sourceLabel:"Research evidence — inspect fields",confidence:({VERIFIED:"Verified","HIGH CONFIDENCE":"High Confidence","MEDIUM CONFIDENCE":"Medium Confidence",UNVERIFIED:"Unverified"} as const)[checked.confidence],emailStatus:r.reviewedAt && fact(r,"email") && emailSources.some(s=>s.checkedBy==="user" && s.type.startsWith("Official")) ? "Verified Public" : "Unverified",status:"Found",discoveredAt:new Date().toISOString(),verifiedAt:checked.lastVerified || null,lastContacted:null,nextFollowUp:null,notes:r.notes,archived:false,demo:db.workspaceMode==="demo",researchEvidence:[structuredClone(r)],provenance:[{source:"Manually Added",recordedAt:new Date().toISOString(),batchId:jobId,detail:"User-selected research result; field-level source evidence retained. Inferred routes excluded."}]};
  db.contacts.push(c);
  const stored=db.researchJobs?.find(j=>j.id===jobId)?.results.find(x=>x.id===r.id); if(stored) stored.savedContactId=c.id;
  return c.id;
}
export function generateOutreach(db:Database, contactId:string, platform:Platform) {
  const c=db.contacts.find(x=>x.id===contactId); if(!c) throw new Error("Save the reviewed contact before drafting.");
  const warning=outreachWarning(c,db);if(warning)throw new Error(warning);
  if(platform==="Email" && (!c.email || c.emailStatus==="Likely")) throw new Error("No factual email saved. Inferred emails cannot be used.");
  if(platform==="LinkedIn" && !c.linkedin) throw new Error("No factual LinkedIn profile saved.");
  if(platform==="Instagram DM" && !c.instagram) throw new Error("No factual Instagram handle saved.");
  return platform === "LinkedIn" ? generateLinkedInMessage(db,c.id,researchLinkedInType(db,c.id)) : composeMessage(c,db,platform);
}
export function researchLinkedInType(db:Database,id:string) {
  const c=db.contacts.find(c=>c.id===id)!;
  const messages=orderMessages(db.messages.filter(m=>m.contactId===id&&m.platform==="LinkedIn"&&m.status!=="Draft"));
  if(messages.at(-1)?.direction==="in")return "Reply" as const;
  if(messages.some(m=>m.direction==="out"&&m.linkedInType!=="Connection request"))return "Follow-up" as const;
  return linkedInState(c,db).connectionConfirmed ? "First message" as const : "Connection request" as const;
}
export interface ResearchService {
  verifyContact: typeof verifyContact; rankContact:typeof rankContact; deduplicateContact:typeof deduplicateContact;
  saveResearchJob:typeof saveResearchJob; saveContact:typeof saveContact;getSources:typeof getSources;generateOutreach:typeof generateOutreach;
}
export const researchService:ResearchService={verifyContact,rankContact,deduplicateContact,saveResearchJob,saveContact,getSources,generateOutreach};
export function researchActions(db:Database) {
  return (db.researchJobs || []).flatMap(j=> {
    const pending=j.results.filter(r=>!r.dismissed && !deduplicateContact(r,db) && rankContact(r,db,j.filters).total>=60 && Object.entries(db.marketPriorities || {}).find(([c])=>countryKey(c)===countryKey(fact(r,"country")))?.[1]!=="PAUSED");
    return pending.length ? [{jobId:j.id,title:`${pending.length} high-priority research contacts to review`,reason:`${j.query} · saved result records, not contacted`}]:[];
  });
}
