"use client";
import { useState } from "react";
import { Plus, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { Choice, type Navigate } from "./shared";
import { countries } from "@/lib/intelligence";
import { toast } from "sonner";
export function AddClubButton({ first = false, initialOpen = false }: { first?: boolean; initialOpen?: boolean }) {
  const { db, mutate } = useStore();
  const [open, setOpen] = useState(initialOpen);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("Australia");
  const [league, setLeague] = useState("");
  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>
        <Plus size={15} />
        {first ? "Add your first club" : "Add club"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a club</DialogTitle>
            <DialogDescription>
              Save a real club you want to contact. It contributes to the
              dashboard Clubs count once you save an associated contact.
            </DialogDescription>
          </DialogHeader>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                db.clubs.some(
                  (c) =>
                    c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
                    c.country === country,
                )
              ) {
                toast.info("That club is already saved.");
                return;
              }
              if (
                await mutate("Club added by user", (d) => {
                  d.clubs.push({
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    country,
                    league: league.trim(),
                    level: "Not specified",
                    teams: [],
                    site: "",
                    notes: "",
                  });
                })
              ) {
                setOpen(false);
                setName("");
                toast.success(
                  "Club saved. Add a contact to start building its history.",
                );
              }
            }}
          >
            <label>
              Club name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Country
              <Choice
                label="New club country"
                value={country}
                options={countries}
                onChange={setCountry}
              />
            </label>
            <label>
              League, if known
              <input
                value={league}
                onChange={(e) => setLeague(e.target.value)}
              />
            </label>
            <button className="btn primary" disabled={!name.trim()}>
              Save club
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function GettingStarted({ navigate }: { navigate: Navigate }) {
  return (
    <section className="panel">
      <div className="eyebrow">YOUR WORKSPACE STARTS WITH YOUR DATA</div>
      <h3>No outreach history yet</h3>
      <p className="muted">
        Your counts are zero because no contributing records have been saved.
        Nothing is prefilled as your activity.
      </p>
      <div className="button-row">
        <AddClubButton first />
        <button className="btn" onClick={() => navigate("Contacts", "add")}>
          Add your first contact
        </button>
        <button className="btn" onClick={() => navigate("Import Outreach")}>
          Import your outreach history
        </button>
        <button className="btn" onClick={() => navigate("Discover")}>
          Start researching contacts
        </button>
        <button className="btn" onClick={() => navigate("Settings", "gmail")}>
          Connect Gmail <ArrowUpRight size={14} />
        </button>
        <button className="btn" onClick={() => navigate("Import Outreach")}>
          Add a conversation manually
        </button>
      </div>
      <p className="panel-sub">
        Gmail and live web research are not connected. You can add real records
        manually, paste conversations or import a CSV.
      </p>
    </section>
  );
}
