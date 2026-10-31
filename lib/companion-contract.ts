import { z } from "zod";
import { filtersSchema, resultSchema } from "./research-model";
export const COMPANION_URL="http://127.0.0.1:4318";
export const STATION_ORIGIN="https://station-japo.rao431728.chatgpt.site";
export const actionNames=["research_contacts","generate_outreach","analyze_reply","parse_conversation","rank_contacts","next_best_actions"] as const;
const short=z.string().max(500);
export const taskSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("research_contacts"),payload:z.object({query:z.string().trim().min(5).max(1500),filters:filtersSchema,depth:z.enum(["Quick","Deep"]),maxClubs:z.number().int().min(1).max(10),maxContacts:z.number().int().min(1).max(25),refresh:z.boolean()}).strict()}).strict(),
  z.object({action:z.literal("generate_outreach"),payload:z.object({contact:z.object({name:short,role:short,club:short,country:short}).strict(),player:z.object({name:short,position:short,goals:short,availability:short}).strict(),platform:z.enum(["Email","LinkedIn","Instagram DM"]),tone:z.enum(["Natural","Confident","Professional","Casual"]),context:z.string().max(15000)}).strict()}).strict(),
  z.object({action:z.literal("analyze_reply"),payload:z.object({text:z.string().trim().min(1).max(20000)}).strict()}).strict(),
  z.object({action:z.literal("parse_conversation"),payload:z.object({text:z.string().trim().min(1).max(30000)}).strict()}).strict(),
  z.object({action:z.literal("rank_contacts"),payload:z.object({results:z.array(resultSchema).max(25),filters:filtersSchema,markets:z.array(short).max(30)}).strict()}).strict(),
  z.object({action:z.literal("next_best_actions"),payload:z.object({contacts:z.array(z.object({id:short,name:short,role:short,status:short,lastContacted:short,nextFollowUp:short,latestReply:z.string().max(3000)}).strict()).max(25)}).strict()}).strict(),
]);
export type CompanionTask=z.infer<typeof taskSchema>;
export const envelopeSchema=z.object({id:z.string().uuid(),task:taskSchema}).strict();
export type CompanionJob={id:string;instanceId:string;action:CompanionTask["action"];state:"running"|"succeeded"|"failed"|"cancelled";events:{date:string;text:string}[];result?:unknown;error?:{code:string;message:string};createdAt:string;finishedAt?:string};
