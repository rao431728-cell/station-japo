"use client";
import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/store";
import { setupProgress } from "@/lib/player-profile";
import type { Navigate } from "./shared";
export function SetupPanel({ navigate }: { navigate: Navigate }) {
  const { db } = useStore();
  const { steps, percent } = setupProgress(db);
  if (percent === 100) return <details className="panel"><summary>Station Setup complete · 100%</summary>{steps.map(s => <p key={s.label}>{s.label} — saved</p>)}</details>;
  return <section className="panel setup-panel"><span className="eyebrow">START BUILDING YOUR STATION</span><div className="row-between"><h3>Station Setup</h3><strong title={`${steps.filter(s => s.done).length} of ${steps.length} saved milestones complete`}>{percent}%</strong></div><Progress value={percent}/><div className="setup-steps">{steps.map((s, i) => <button className={"setup-step " + (s.done ? "complete" : "")} key={s.label} onClick={() => navigate(s.route)}><span>{s.done ? <Check size={16}/> : i + 1}</span>{s.label}<small>{s.done ? "Complete" : "Continue"}</small></button>)}</div><p className="panel-sub">Completion comes from your saved profile, CV and highlight assets, imported contacts, target countries and a saved research task.</p></section>;
}
