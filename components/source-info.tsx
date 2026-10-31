import type { SourcedRecord } from "@/types";
import { ResearchEvidence } from "./research-evidence";
import type { ResearchResult } from "@/lib/research-model";
export function SourceInfo({ record }: { record: SourcedRecord & {researchEvidence?:ResearchResult[]} }) {
  const sources = record.provenance || [];
  return <details className="source-info"><summary>Source: {sources.length ? [...new Set(sources.map(s => s.source))].join(" · ") : "Legacy record — source not recorded"}</summary>{sources.map((s, i) => <p key={i}>{s.source} · {new Date(s.recordedAt).toLocaleString()}<br/>{s.detail}{s.batchId && <><br/><small>Import {s.batchId}</small></>}</p>)}{record.researchEvidence?.map(r=><details key={r.id}><summary>View field-level research sources</summary><ResearchEvidence result={r}/></details>)}</details>;
}
