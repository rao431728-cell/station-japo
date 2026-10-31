# Research provider setup

Station Japo does **not** ship with a search subscription or pretend to have one.
The production site currently has no research credentials. Until configured,
`GET /api/research` reports disconnected and `POST /api/research` returns 503
`PROVIDER_NOT_CONNECTED`. The UI records this job with zero results, without
simulated progress. Manual, reviewed findings remain fully functional.

## Architecture

- `lib/research-model.ts`: provider interface, result and job schemas.
- `lib/research-provider.ts`: server-only HTTPS gateway adapter; `researchClubs()`
  and `researchContacts()` are provider-independent entry points.
- `lib/research.ts`: verifyContact, rankContact, deduplicateContact,
  saveResearchJob, saveContact, getSources, generateOutreach.
- `app/api/research/route.ts`: signed-in, same-origin request boundary and NDJSON
  progress; no private player profile, CRM or conversation history is sent.
- Existing authenticated workspace storage persists jobs, progress, evidence,
  saved-contact links, market priorities and manual outreach queue.

## Configure an authorized provider

Deploy your own trusted extraction gateway, backed by a web search API or an
authorized research service. A raw search-engine API key alone is insufficient:
the gateway must produce the cited field structure below. Do not enable this
adapter until the gateway performs real research. You can instead implement
`ResearchProvider` directly for another provider without changing the UI.

Set these **server-side** runtime variables through Sites environment settings:

- `RESEARCH_PROVIDER_URL`: public HTTPS base URL of your gateway, no credentials
  in URL and no redirects. Endpoints are `${base}/clubs` and `${base}/contacts`.
- `RESEARCH_PROVIDER_TOKEN`: secret bearer credential. Never a `NEXT_PUBLIC_`
  variable, browser-storage value or committed secret.

For local development, use matching entries in ignored `.env` and restart the
preview. The included `.env.example` contains blank values only. For production,
set the server variables and republish. Check the disconnected/connected UI and
run a genuine query; configured does not mean a successful provider health check.

No provider is called from a scheduled process. Requests are user-initiated.
Gateways should impose account quotas/rate limits, honor robots/access rules,
collect only legitimate public professional contact information, and must not
scrape authenticated LinkedIn accounts or send messages. Do not fetch arbitrary
submitted source URLs from Station Japo; source links are displayed for review.

## Gateway contract (version 1)

Both endpoints receive an authenticated `POST` with:

```ts
{
  version: 1,
  request: {
    query: string, // <= 1500 characters
    filters: {
      country: string, league: string, level: string, ageGroup: string,
      role: string, method: 'Any' | 'Email' | 'LinkedIn' | 'Instagram',
      minConfidence: 'UNVERIFIED' | 'MEDIUM CONFIDENCE' | 'HIGH CONFIDENCE' | 'VERIFIED'
    }
  },
  clubs: ResearchResult[] // empty on /clubs; discovered clubs on /contacts
}
```

`Any` means no explicit filter. Interpret the natural-language request in the
gateway and apply explicit filters as constraints; Station Japo also filters
returned facts locally. Do not claim a filter interpretation you did not make.
Return `{ results: ResearchResult[] }`. An honest no-results response is an empty
array. Maximum 50 results and 900 KB per response, 60 seconds per endpoint.
Partial clubs are retained if the contact stage fails.

```ts
type ResearchResult = {
  id: string;
  facts: Partial<Record<
    'club' | 'country' | 'league' | 'level' | 'division' | 'person' | 'role' |
    'email' | 'instagram' | 'linkedin' | 'website' | 'academy' | 'reserveTeam' |
    'U23' | 'U21' | 'U20' | 'U18',
    { value: string; kind: 'FACT' | 'INFERENCE'; sourceIds: string[] }
  >>;
  sources: {
    id: string; title: string; url: string; excerpt: string;
    type: 'Official Club Website' | 'Official League Website' |
      'Official Federation Website' | 'Official Staff Page' | 'LinkedIn' |
      'Official Instagram' | 'Public Directory' | 'Secondary Source';
    checkedAt: string; // actual ISO UTC retrieval/check time, never future
    checkedBy: 'provider';
  }[];
  notes: string;
};
```

Omit unknown fields (do not guess). `club` is required; factual `person` and
`club` are required to save a CRM contact. A general department must be explicitly
identified as such, not a made-up person. Each FACT needs a source whose short
extract directly supports its value. Cite original pages, not search-result
snippets as official verification. Official source labels must be justified by
the source publisher, not inferred solely from a plausible domain name.
Team values are `Yes` / `No`; absent means unknown. Instagram is a handle,
LinkedIn is a personal HTTPS `/in/` URL. No inferred route enters the CRM.

Provider results always have user-review and CRM IDs stripped. Provider checks
are explicitly labeled provider-reported; they never become `VERIFIED` by
themselves. Verification requires the user's explicit source review. Review
completion alone does not verify fields. Source confidence is not evidence of
a trial opening or suitability for a minor.

## Persistence and resilience

Streaming stages correspond to actual gateway waits, validation and dedup work,
not artificial timers. The browser durably saves each received event. Closing the
page aborts its request; a persisted Running job is presented as interrupted on
reopen rather than silently resuming or inventing completion. Saving failures
retain a retryable in-memory snapshot while the page stays open. Existing
optimistic workspace revisions prevent overwriting concurrent edits.

The six score factors are deterministic, shown with their contributing evidence
and maxima. Paused markets receive zero market points and no research action
prompts. Scores and relevance text are inferences, never verified facts.
Exported results include evidence, source dates and score breakdowns.

Use `lib/research.test.ts` for in-memory contract/safety checks. Test an actual
gateway separately with a known real public source before enabling production.
No live discovery has been tested while no provider is configured.
