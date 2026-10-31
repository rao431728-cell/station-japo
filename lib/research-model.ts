import { z } from "zod";

export const sourceTypes = ["Official Club Website", "Official League Website", "Official Federation Website", "Official Staff Page", "LinkedIn", "Official Instagram", "Public Directory", "Secondary Source"] as const;
export const fields = ["club", "country", "league", "level", "division", "person", "role", "email", "instagram", "linkedin", "website", "academy", "reserveTeam", "U23", "U21", "U20", "U18"] as const;
export type ResearchField = typeof fields[number];
export const confidenceLevels = ["UNVERIFIED", "MEDIUM CONFIDENCE", "HIGH CONFIDENCE", "VERIFIED"] as const;
export const marketStatuses = ["HIGH PRIORITY", "ACTIVE", "EXPLORING", "PAUSED"] as const;
export type MarketStatus = typeof marketStatuses[number];
export const targetCountries = ["Australia", "UAE", "Netherlands", "Belgium", "Germany", "Croatia", "Portugal", "Spain", "England", "USA"];
export function publicURL(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && u.hostname.includes(".") && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) && !u.hostname.endsWith(".local") && !u.hostname.includes(":");
  } catch { return false; }
}
const timestamp = z.string().datetime().refine(s => Date.parse(s) <= Date.now() + 60000, "Future verification dates are not allowed");
export const sourceSchema = z.object({
  id: z.string().min(1).max(100), title: z.string().min(1).max(300), url: z.string().max(2000).refine(publicURL, "Use a public HTTPS source URL"),
  type: z.enum(sourceTypes), excerpt: z.string().min(1).max(5000), checkedAt: timestamp,
  checkedBy: z.enum(["provider", "user"]),
});
export type ResearchSource = z.infer<typeof sourceSchema>;
export const factSchema = z.object({ value: z.string().min(1).max(1000), kind: z.enum(["FACT", "INFERENCE"]), sourceIds: z.array(z.string()).max(20) });
export const resultSchema = z.object({
  id: z.string().min(1).max(150), facts: z.record(z.enum(fields), factSchema), sources: z.array(sourceSchema).max(30),
  notes: z.string().max(5000).default(""), reviewedAt: timestamp.optional(), savedContactId: z.string().optional(), dismissed: z.boolean().optional(),
}).superRefine((r, ctx) => {
  if(new Set(r.sources.map(s=>s.id)).size!==r.sources.length)ctx.addIssue({code:"custom",message:"Source IDs must be unique within a finding",path:["sources"]});
  for (const [key, f] of Object.entries(r.facts)) if (f) {
    if (f.kind === "FACT" && (!f.sourceIds.length || f.sourceIds.some(id => !r.sources.some(s => s.id === id)))) ctx.addIssue({code:"custom",message:`${key}: every fact needs an existing source`,path:["facts",key]});
    if (key === "email" && !z.string().email().safeParse(f.value).success) ctx.addIssue({code:"custom",message:"Invalid email",path:["facts",key]});
    if (key === "email" && f.kind === "FACT" && !r.sources.some(s=>f.sourceIds.includes(s.id)&&s.excerpt.toLowerCase().includes(f.value.toLowerCase()))) ctx.addIssue({code:"custom",message:"A factual email must appear literally in its cited source extract. Otherwise mark it INFERENCE.",path:["facts",key]});
    if (["website", "linkedin"].includes(key) && !publicURL(f.value)) ctx.addIssue({code:"custom",message:"Invalid public profile/site URL",path:["facts",key]});
    if (key === "linkedin" && !/^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+\/?(?:[?#].*)?$/i.test(f.value)) ctx.addIssue({code:"custom",message:"Use a personal LinkedIn /in/ URL",path:["facts",key]});
    if (key === "instagram" && !/^@?[a-z0-9._]{1,30}$/i.test(f.value)) ctx.addIssue({code:"custom",message:"Use an Instagram handle, not a URL",path:["facts",key]});
  }
  if (!r.facts.club) ctx.addIssue({code:"custom",message:"A sourced club name is required",path:["facts","club"]});
});
export type ResearchResult = z.infer<typeof resultSchema>;
export const filtersSchema = z.object({country:z.string().max(100),league:z.string().max(150),level:z.string().max(100),ageGroup:z.string().max(50),role:z.string().max(100),method:z.enum(["Any", "Email", "LinkedIn", "Instagram"]),minConfidence:z.enum(confidenceLevels)});
export type ResearchFilters = z.infer<typeof filtersSchema>;
export const requestSchema = z.object({query:z.string().trim().min(5).max(1500),filters:filtersSchema});
export type ResearchRequest = z.infer<typeof requestSchema>;
export type ResearchStage = "Understanding search" | "Finding clubs" | "Finding staff and public contact routes" | "Checking evidence" | "Removing duplicates" | "Ranking leads";
export interface ResearchProgress { stage: ResearchStage; date: string; detail: string; count: number }
export interface ResearchJob {
  id: string; query: string; date: string; filters: ResearchFilters;
  provider: string; status: "Running" | "Needs Review" | "Complete" | "Provider not connected" | "Failed" | "Interrupted";
  progress: ResearchProgress[]; results: ResearchResult[]; clubs: ResearchResult[]; error?: string;
  reviewedAt?: string;
}
export interface ResearchScore { total: number; breakdown: {label:string;points:number;max:number;reason:string}[]; why: string }
export const researchJobSchema = z.object({id:z.string(),query:z.string(),date:timestamp,filters:filtersSchema,provider:z.string(),status:z.enum(["Running","Needs Review","Complete","Provider not connected","Failed","Interrupted"]),progress:z.array(z.object({stage:z.enum(["Understanding search","Finding clubs","Finding staff and public contact routes","Checking evidence","Removing duplicates","Ranking leads"]),date:timestamp,detail:z.string(),count:z.number().int().nonnegative()})).max(100),results:z.array(resultSchema).max(500),clubs:z.array(resultSchema).max(500),error:z.string().optional(),reviewedAt:timestamp.optional()});
export interface ResearchProvider {
  readonly name: string;
  researchClubs(request: ResearchRequest, signal?: AbortSignal): Promise<ResearchResult[]>;
  researchContacts(request: ResearchRequest, clubs: ResearchResult[], signal?: AbortSignal): Promise<ResearchResult[]>;
}
export type ResearchEvent = {type:"progress";progress:ResearchProgress} | {type:"clubs";clubs:ResearchResult[]} | {type:"results";results:ResearchResult[]} | {type:"done"} | {type:"error";error:string};
