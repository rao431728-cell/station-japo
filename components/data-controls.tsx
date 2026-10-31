"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { historySchema, importHistory } from "@/lib/import-history";
import { downloadBackup, validateDatabase } from "@/lib/repository";
import { toast } from "sonner";
export function DataControls() {
  const { db, mode, changeMode, mutate } = useStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<unknown>(null);
  const [error, setError] = useState("");
  return (
    <section className="panel">
      <h3>Data provenance & imports</h3>
      <p className="muted">
        Personal counts use saved records only. Click dashboard metrics to see
        each contributing record and its ID. Demo data lives in separate storage
        and is always labeled DEMO DATA.
      </p>
      <div className="button-row">
        <button className="btn primary" onClick={() => setOpen(true)}>
          Import Station Japo JSON backup
        </button>
        <button
          className="btn"
          onClick={() => changeMode(mode === "personal" ? "demo" : "personal")}
        >
          {mode === "personal"
            ? "Load Demo Data"
            : "Return to personal workspace"}
        </button>
        <button
          className="btn"
          onClick={() => {
            const raw = localStorage.getItem("station-japo-v1");
            if (!raw) {
              toast.info("No legacy workspace backup exists.");
              return;
            }
            try {
              downloadBackup(
                validateDatabase(JSON.parse(raw)),
                "station-japo-legacy-backup.json",
              );
            } catch {
              toast.error("Legacy backup could not be read.");
            }
          }}
        >
          Export original legacy backup
        </button>
      </div>
      <p className="panel-sub">
        Legacy seeded history has been excluded from your personal workspace.
        The original storage is preserved for recovery. Loading demo data never
        changes your personal data.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import saved outreach history</DialogTitle>
            <DialogDescription>
              Choose a Station Japo JSON backup. Real contacts, their clubs and
              messages are merged; duplicates and demo contacts are excluded.
              Original message dates and statuses are preserved.
            </DialogDescription>
          </DialogHeader>
          <input
            aria-label="History backup JSON"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              setInput(null);
              setError("");
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 10_000_000)
                  throw new Error("Choose a file smaller than 10 MB.");
                const v = historySchema.parse(JSON.parse(await f.text()));
                setInput(v);
              } catch {
                setError(
                  "This is not a valid Station Japo outreach backup. Nothing has been imported.",
                );
              }
            }}
          />
          {error && (
            <p role="alert" className="notice amber">
              {error}
            </p>
          )}
          {input !== null && (
            <p className="notice">
              Backup validated. Importing merges actual records into the{" "}
              {mode === "demo" ? "DEMO DATA" : "personal"} workspace. Existing
              records will not be deleted.
            </p>
          )}
          <button
            className="btn primary"
            disabled={!input}
            onClick={async () => {
              const working = structuredClone(db);
              try {
                const added = importHistory(working, input);
                if (
                  await mutate(
                    "Outreach history imported from user-provided backup",
                    (d) => Object.assign(d, working),
                  )
                ) {
                  setOpen(false);
                  setInput(null);
                  toast.success(added + " message records imported");
                }
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Import failed. Nothing was saved.",
                );
              }
            }}
          >
            Merge history
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
