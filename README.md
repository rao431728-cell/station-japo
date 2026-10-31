# Station Japo

> **Development disclosure:** AI coding assistance was used during development. Requirements, acceptance decisions, testing and publication review remained under human control.

## Source-backed football research

The Research page supports provider-independent discovery, field-level fact/inference evidence, deterministic six-factor scoring, target-market priorities, reviewed CRM saving, manual outreach queues and persisted research jobs. See [RESEARCH_PROVIDER.md](RESEARCH_PROVIDER.md) for the gateway contract and server configuration. No provider is configured by default; disconnected searches return no results, not fixtures. Manual source-backed findings work without credentials. No contact is ever sent a message automatically.

A personal football outreach system with a dark responsive interface. New personal workspaces start with zero clubs, contacts, messages, replies, conversations and opportunities.

## Run

```sh
npm install
npm run dev
```

Uses React, TypeScript, the Next.js App Router-compatible Vinext runtime, Tailwind CSS, shadcn/Radix primitives and Lucide icons. The preview prints its local URL. `npm run build` produces a Cloudflare-compatible worker build.

## Boundaries

- Research searches saved records only. Message generation, reply analysis and import parsing are deterministic and rule-based; review interpretations. No AI or Gmail account is connected.
- Demo fixtures are available only through Settings → Load Demo Data, in separate storage with a persistent DEMO DATA banner. Returning or reloading opens personal storage; no demo records are copied into it.
- Legacy automatic seed data is excluded from the personal workspace. The original `station-japo-v1` key is preserved as a recoverable backup, exportable from Settings. Real saved contacts, their dependent records, player edits and assets survive migration.
- Dashboard counts have one centralized selector (`lib/provenance.ts`). Clicking a count lists contributing records and IDs. Replies count inbound Received messages, not conversation rows; clubs count unique clubs associated with saved contacts; trial stages are matched exactly. Historical metrics retain archived records; active conversations exclude archived, Closed and Dormant contacts.
- Settings can merge real clubs, contacts and messages from a validated Station Japo JSON backup. Imports preserve original message dates, deduplicate repeated records, exclude demo contacts, and reject explicitly marked demo-workspace backups.
- No outbound messages are sent. Users review, copy, manually send, and then record the message.
- Personal profiles and CRM records persist in D1 under the authenticated user's ID, with revision checks to prevent concurrent overwrites. Only confirmed saves update dashboard data. The first load migrates existing real local records, retaining old browser storage as a backup. Demo data stays isolated in localStorage.
- Local preview uses a local database and local sign-in simulation. Hosted data and local preview data are separate. Use Settings → Export workspace JSON for backups. JSON contains asset metadata, not uploaded file bytes.
- CVs, photos and certificates upload privately to R2 (PDF/Word/JPEG/PNG/WebP, 10 MB max). Files are owner-scoped, downloaded as attachments, and not public share links. Footage and other links use user-provided HTTP(S) URLs. Removing an asset reference retains its uploaded bytes; permanent file deletion is not implemented.

## Personal setup and imports

- Player Profile stores personal/football details, strength tags, structured achievements, goals, markets, and travel/trial availability. Documents stores multiple player assets. All intelligence consumers read the saved profile; no profile values are embedded in presentation components.
- Import Outreach accepts labeled conversations, email threads and RFC-style CSV (quoted commas/newlines supported; max 500 rows). The downloadable template is header-only, with no invented contacts.
- Review Import is mandatory. Correct identities, club, platform, status, sender directions, message text/dates, next actions and optional opportunities/follow-ups. Missing dates stay unknown. CSV statuses never generate fake messages or replies.
- Identity matching uses normalized email, name + club, Instagram handle or LinkedIn URL. Conflicting matches stop import. Matching message occurrences are skipped on reimport, while legitimate repeated utterances remain separate.
- Referrals are detected from explicit phrases such as “email Angelo at ...”. Referred people are optional, require club confirmation, and retain an evidence-backed relationship to the source contact.
- Screenshot selection is UI preparation only: `parseConversationImage()` returns a pending-service result and does not upload or extract anything.
- Setup progress derives from five persisted milestones. Quick Add supports contacts, clubs, import, opportunities, message logging and follow-up scheduling.

## Architecture

### LinkedIn-assisted outreach

The LinkedIn workspace is manual assistance only: no account connection, scraping, enrichment, bulk action or outbound API exists. `lib/linkedin.ts` exposes the replaceable `LinkedInService` interface with `saveLinkedInProfile`, `linkLinkedInProfileToContact`, `generateLinkedInMessage`, `logLinkedInMessageSent`, `importLinkedInConversation` and `analyzeLinkedInReply`.

Profile URLs are normalized and reviewed before saving; real source notes and optional last-checked dates are retained without changing verification flags. Connection acceptance is explicitly recorded, separately from sent/replied status. LinkedIn message types, actual dates, status events, reviewed imports, referrals and opportunities remain in the authenticated workspace data.

The dedicated composer has five message types, tone/asset controls, editable drafts, Copy and explicitly confirmed Mark Sent. The 200-character connection-note target is an app writing target, not a claim about current LinkedIn limits. Duplicate introductions, repeated exact messages, recent unanswered outreach and excessive unanswered follow-ups are guarded. Historical imports still require review and do not infer accepted connections. Next actions derive from saved profiles, messages, referrals and scheduled follow-ups.

- `types/index.ts`: typed entities and versioned database shape.
- `data/seed.ts`: demo fixture factory.
- `lib/repository.ts`: legacy migration and isolated demo adapter.
- `lib/cloud-repository.ts`, `app/api/workspace`: authenticated D1 persistence with revision control.
- `app/api/assets`: owner-scoped R2 upload/download.
- `lib/outreach-import.ts`: replaceable parser interface, CSV reader, reviewed import transaction and identity matching.
- `lib/player-profile.ts`: shared player context and setup selectors.
- `lib/store.tsx`: audited mutations, duplicate merging, message recording, reply ingestion, opportunity creation and follow-up lifecycle.
- `lib/intelligence.ts`: deterministic score breakdown, history-aware draft generation, reply extraction and next-action ranking.
- `components/`: separated dashboard, contacts, composer, inbox, research, player/assets and pipeline views.

Future AI/vision providers should implement the parser interface while preserving mandatory review. Add credential handling, delivery receipts and explicit approval before connecting live sending. Private Sites use platform sign-in; workspace and file routes reject missing identity and scope all records by owner.

Local database setup after the first build: apply the generated `drizzle/0000_optimal_archangel.sql` once with Wrangler D1 `--local --config dist/server/wrangler.json --persist-to .wrangler/state`. Hosted publishing applies migrations separately.

## Checks

```sh
npx tsc --noEmit
npm run build
node --input-type=module -e 'import {build} from "esbuild";const r=await build({entryPoints:["lib/intelligence.test.ts"],bundle:true,platform:"node",format:"esm",write:false});await import("data:text/javascript;base64,"+Buffer.from(r.outputFiles[0].text).toString("base64"))'
```

The rule tests cover seed integrity, reply extraction, negative replies, requested-month follow-ups, relationship-aware messages, duplicates, priority scoring and repeat-contact protection.

At the 1 November 2026 portfolio audit, the production build and TypeScript check passed,
and the core deterministic intelligence test passed. The current lint run still reports
16 errors and 37 warnings; these are disclosed here rather than presenting the repository
as warning-free.
