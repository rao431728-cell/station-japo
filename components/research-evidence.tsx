"use client";
import type { ResearchResult } from "@/lib/research-model";
import { getSources, verifyContact } from "@/lib/research";
export function ResearchEvidence({result}:{result:ResearchResult}) {
  const checked=verifyContact(result);
  return <div className="research-evidence stack"><p className="notice">{checked.explanation}</p>
    <div className="research-facts">{Object.entries(result.facts).map(([key,f])=>f && <div key={key}><b>{key}</b><span>{f.value}</span><small className={f.kind==="INFERENCE"?"inference":""}>{f.kind === "INFERENCE" ? key==="email"?"INFERRED — NOT VERIFIED · excluded from outreach":"INFERENCE — not a verified fact" : "FACT — source-backed assertion"}</small><small>{getSources(result,key as keyof typeof result.facts).map(s=>s.title).join(" · ") || "No factual evidence"}</small></div>)}</div>
    {result.sources.map(s=><article className="research-source" key={s.id}><h4>{s.title}</h4><a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a><p>{s.type} · {s.checkedBy==="user"?(result.reviewedAt?"User-confirmed source check":"Manually recorded evidence (not verified)"):"Provider-reported check"} · {new Date(s.checkedAt).toLocaleString()}</p><blockquote>{s.excerpt}</blockquote><small>Information attributed here: {Object.entries(result.facts).filter(([,f])=>f?.sourceIds.includes(s.id)).map(([key])=>key).join(", ") || "Context only"}</small></article>)}
    <p>Last verified by you: {checked.lastVerified ? new Date(checked.lastVerified).toLocaleString() : "Not verified"}</p><p className="muted">Research notes: {result.notes || "None recorded"}</p>
  </div>;
}
