import assert from "node:assert/strict";
import { createEmpty } from "@/data/empty";
import { resultSchema, type ResearchFilters, type ResearchResult } from "./research-model";
import { verifyContact,rankContact,deduplicateResults,deduplicateContact,saveContact,saveResearchJob,generateOutreach,matchesFilters,rolePoints,researchActions } from "./research";
import { dashboardMetrics,personalRecords } from "./provenance";
import { importHistory } from "./import-history";
import { GatewayResearchProvider } from "./research-provider";

// Isolated in-memory fixtures only. Never written into personal or live data.
const filters:ResearchFilters={country:"Any",league:"Any",level:"Any",ageGroup:"U20",role:"Any",method:"Any",minConfidence:"UNVERIFIED"};
const date=new Date().toISOString();
const r:ResearchResult=resultSchema.parse({id:"fixture-result",facts:Object.fromEntries(Object.entries({club:"Fixture Club",country:"Australia",person:"Fixture Coach",role:"Academy Director",league:"Fixture League",website:"https://fixture.example.test",U20:"Yes",linkedin:"https://www.linkedin.com/in/fixture-only"}).map(([key,value])=>[key,{value,kind:"FACT",sourceIds:["s1"]}])),sources:[{id:"s1",title:"Fixture staff source",url:"https://fixture.example.test/staff",type:"Official Staff Page",excerpt:"Fixture Coach is Academy Director at Fixture Club in Australia. U20 team listed. Test only.",checkedAt:date,checkedBy:"provider"}],notes:"In-memory test only"});
assert.equal(verifyContact(r).confidence,"HIGH CONFIDENCE");assert.equal(verifyContact(r).lastVerified,null);
const reviewed=structuredClone(r);reviewed.reviewedAt=date;reviewed.sources[0].checkedBy="user";
assert.equal(verifyContact(reviewed).confidence,"VERIFIED");
const inferred=structuredClone(reviewed);inferred.facts.email={value:"guessed@fixture.example.test",kind:"INFERENCE",sourceIds:[]};
assert(verifyContact(inferred).emailInferred);
const db=createEmpty();db.player.name="Fixture Player";db.player.position="Winger";db.marketPriorities={Australia:"HIGH PRIORITY"};
const score=rankContact(inferred,db,filters);assert.equal(score.total,90);assert.deepEqual(score,rankContact(inferred,db,filters));
assert.equal(rolePoints("Marketing Manager"),0);assert(rolePoints("Sporting Director")>rolePoints("Academy Director"));
db.marketPriorities.Australia="PAUSED";assert.equal(rankContact(inferred,db,filters).total,70);db.marketPriorities.Australia="HIGH PRIORITY";
assert.equal(matchesFilters(r,{...filters,method:"Email"}),false);assert.equal(matchesFilters(r,{...filters,country:"Belgium"}),false);
assert.throws(()=>resultSchema.parse({...r,facts:{...r.facts,role:{value:"Coach",kind:"FACT",sourceIds:[]}}}));
assert.throws(()=>resultSchema.parse({...r,sources:[{...r.sources[0],url:"javascript:alert(1)"}]}));
assert.throws(()=>resultSchema.parse({...r,sources:[{...r.sources[0],checkedAt:"2099-01-01T00:00:00.000Z"}]}));
const same=structuredClone(r);same.id="second-fixture";same.facts.linkedin!.value="https://uk.linkedin.com/in/fixture-only/";same.sources[0].url="https://fixture.example.test/second";
const dedup=deduplicateResults([r,same]);assert.equal(dedup.length,1);assert.equal(dedup[0].sources.length,2);assert.equal(new Set(dedup[0].sources.map(s=>s.id)).size,2);
saveResearchJob(db,{id:"job",query:"Fixture query",date,provider:"Manual test",filters,status:"Needs Review",progress:[],results:[inferred],clubs:[]});
assert.equal(db.contacts.length,0);assert.equal(researchActions(db).length,1);
const id=saveContact(db,inferred,"job");assert.equal(db.contacts.length,1);assert.equal(db.clubs.length,1);assert.equal(db.contacts[0].email,"");assert.equal(db.contacts[0].emailStatus,"Unverified");assert.equal(db.messages.length,0);
assert.equal(saveContact(db,same,"job"),id);assert.equal(deduplicateContact(same,db)?.id,id);assert.equal(db.contacts.length,1);
assert.throws(()=>generateOutreach(db,id,"Email"),/No factual email/);assert(generateOutreach(db,id,"LinkedIn").includes("Fixture"));assert.equal(db.messages.length,0);
assert.equal(dashboardMetrics(db).find(m=>m.label==="Messages sent")?.records.length,0);
const second=structuredClone(reviewed);second.id="second-person";second.facts.person!.value="Different Coach";second.facts.linkedin!.value="https://www.linkedin.com/in/different-fixture";saveContact(db,second,"job");assert.equal(db.clubs.length,1);assert.equal(db.contacts.length,2);
const restored=createEmpty();importHistory(restored,db);assert.equal(restored.researchJobs?.length,1);assert(restored.contacts[0].researchEvidence?.length);assert.equal(restored.researchJobs![0].results[0].savedContactId,restored.contacts[0].id);
assert.equal(personalRecords({...db,workspaceMode:"demo"}).researchJobs?.length,0);
assert.throws(()=>new GatewayResearchProvider("http://localhost:8080","test"));
const originalFetch=globalThis.fetch;let requestBody="";
try {
  globalThis.fetch=async (_url,init)=>{requestBody=String(init?.body);return Response.json({results:[reviewed]});};
  const provider=new GatewayResearchProvider("https://gateway.example.test","fixture-token");
  const results=await provider.researchContacts({query:"Fixture search",filters},[]);
  assert.equal(results[0].reviewedAt,undefined);assert.equal(results[0].sources[0].checkedBy,"provider");assert(!requestBody.includes("Fixture Player"));
  globalThis.fetch=async()=>Response.json({results:[{...r,facts:{person:{value:"Invented",kind:"FACT",sourceIds:[]}}}]});
  await assert.rejects(()=>provider.researchClubs({query:"Fixture search",filters}));
} finally {globalThis.fetch=originalFetch;}
console.log("PASS: research evidence validation, deterministic scoring, market priorities, inferred-email exclusion, dedup, club reuse, CRM handoff, backup round-trip, demo isolation and gateway trust boundaries.");
