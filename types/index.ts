export type Stage =
  | "Found"
  | "Ready"
  | "Contacted"
  | "Replied"
  | "Follow-up"
  | "Interested"
  | "Opportunity"
  | "Trial"
  | "Closed"
  | "Dormant";
export type Platform = "Email" | "Instagram DM" | "LinkedIn" | "Follow-up";
export interface Achievement {
  id: string;
  title: string;
  team: string;
  year: string;
  description: string;
  importance: "Low" | "Medium" | "High";
}
export interface PlayerProfile {
  name: string;
  age: number;
  nationality: string;
  city: string;
  position: string;
  foot: string;
  strengths: string;
  goals: string;
  achievements: string;
  availability: string;
  markets: string[];
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  secondaryPositions?: string[];
  currentClub?: string;
  previousClubs?: string[];
  heightCm?: string;
  weightKg?: string;
  playingStyle?: string;
  achievementRecords?: Achievement[];
  preferredLeagues?: string[];
  shortTermObjective?: string;
  longTermObjective?: string;
  otherMarkets?: string;
  availableForTrials?: "Yes" | "No" | "Not confirmed";
  travelAvailability?: string;
  travelCountries?: string[];
  upcomingTravel?: string;
  educationCommitments?: string;
  confirmedAt?: string;
}
export type Player = PlayerProfile;
export interface Provenance {
  source: "Manually Added" | "Imported Conversation" | "Imported Email" | "Imported CSV" | "Gmail" | "Instagram" | "LinkedIn" | "AI Research" | "Legacy record";
  recordedAt: string;
  batchId?: string;
  detail?: string;
}
export interface SourcedRecord { provenance?: Provenance[] }
export interface Club extends SourcedRecord {
  researchEvidence?: import("@/lib/research-model").ResearchResult[];
  lastVerified?: string;
  id: string;
  name: string;
  country: string;
  league: string;
  level: string;
  teams: string[];
  site: string;
  notes: string;
}
export interface Contact extends SourcedRecord {
  researchEvidence?: import("@/lib/research-model").ResearchResult[];
  linkedInProfile?: LinkedInProfile;
  linkedInEvents?: LinkedInEvent[];
  id: string;
  name: string;
  clubId: string;
  role: string;
  country: string;
  league: string;
  email: string;
  instagram: string;
  linkedin: string;
  sources: string[];
  sourceLabel: string;
  confidence:
    | "Unverified"
    | "Medium Confidence"
    | "High Confidence"
    | "Verified";
  emailStatus: "Unverified" | "Likely" | "Verified Public";
  status: Stage;
  discoveredAt: string;
  verifiedAt: string | null;
  lastContacted: string | null;
  nextFollowUp: string | null;
  notes: string;
  archived: boolean;
  demo: boolean;
}
export interface Message extends SourcedRecord {
  linkedInType?: LinkedInMessageType;
  id: string;
  contactId: string;
  platform: Platform;
  direction: "in" | "out";
  body: string;
  date: string;
  status: "Draft" | "Sent" | "Received";
  followUp: boolean;
  subject?: string;
  dateUnknown?: boolean;
}
export type LinkedInMessageType = "Connection request" | "First message" | "Follow-up" | "Reply" | "Referral introduction";
export type LinkedInStatus = "Not Contacted" | "Connection Request Sent" | "Connected" | "Messaged" | "Replied" | "Follow-up Needed" | "Opportunity" | "Closed";
export interface LinkedInProfile {
  headline: string;
  relevantRole: string;
  source: string;
  lastChecked: string;
  status: LinkedInStatus;
  connectionConfirmed: boolean;
  connectedAt?: string;
}
export interface LinkedInEvent extends SourcedRecord {
  id: string;
  status: LinkedInStatus;
  date: string;
  recordedAt: string;
  note: string;
}
export interface ReplyAnalysis {
  responseType: string;
  sentiment: string;
  requestedItems: string[];
  trialMentioned: boolean;
  availabilityRequested: boolean;
  deadlineMentioned: string | null;
  personReferredTo: string | null;
  nextAction: string;
  followUpDate: string | null;
  location: string | null;
}
export interface Conversation extends SourcedRecord {
  id: string;
  contactId: string;
  analysis: ReplyAnalysis;
  read: boolean;
}
export interface FollowUp extends SourcedRecord {
  id: string;
  contactId: string;
  date: string;
  status: "Scheduled" | "Completed" | "Skipped";
  sequence: number;
}
export interface Opportunity extends SourcedRecord {
  id: string;
  contactId: string;
  type: string;
  stage: string;
  nextStep: string;
  createdAt: string;
}
export interface ResearchTask extends SourcedRecord {
  id: string;
  query: string;
  region: string;
  results: string[];
  status: "Complete" | "Needs Review";
  date: string;
}
export interface PlayerAsset extends SourcedRecord {
  id: string;
  kind: string;
  name: string;
  url: string;
  fileName: string;
  updatedAt: string;
  storageKey?: string;
}
export interface Referral extends SourcedRecord {
  id: string;
  fromContactId: string;
  toContactId: string;
  evidence: string;
}
export interface Notification {
  id: string;
  text: string;
  read: boolean;
  route: string;
}
export interface AuditEntry {
  id: string;
  action: string;
  date: string;
  contactId?: string;
}
export interface Database {
  researchJobs?: import("@/lib/research-model").ResearchJob[];
  marketPriorities?: Record<string, import("@/lib/research-model").MarketStatus>;
  outreachQueue?: {id: string; contactId: string; date: string; researchJobId: string}[];
  version: 1;
  workspaceMode?: "personal" | "demo";
  player: Player;
  clubs: Club[];
  contacts: Contact[];
  messages: Message[];
  conversations: Conversation[];
  followUps: FollowUp[];
  opportunities: Opportunity[];
  research: ResearchTask[];
  assets: PlayerAsset[];
  notifications: Notification[];
  audit: AuditEntry[];
  referrals?: Referral[];
}
