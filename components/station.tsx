"use client";
import { useEffect, useState, useRef } from "react";
import {
  Bell,
  Search,
  Plus,
  LayoutDashboard,
  Compass,
  Shield,
  Users,
  Send,
  Inbox,
  Clock3,
  Trophy,
  Sparkles,
  UserRound,
  FolderOpen,
  Settings,
  Zap,
  Globe2,
  ArrowRight,
  Check,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { Progress } from "@/components/ui/progress";
import { StoreProvider, useStore } from "@/lib/store";
import { Dashboard } from "./dashboard";
import { ContactTable, ContactDrawer } from "./contacts";
import { Outreach } from "./outreach";
import { InboxView } from "./inbox";
import { Research } from "./research";
import { Clubs, FollowUps, Opportunities } from "./pipeline";
import { PlayerProfile, Documents, SettingsView } from "./profile";
import { initials } from "./shared";
import { ImportOutreach } from "./import-outreach";
import { QuickAdd } from "./quick-add";
import { LinkedInWorkspace } from "./linkedin-workspace";
import { setupProgress } from "@/lib/player-profile";
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Discover", Compass],
  ["Clubs", Shield],
  ["Contacts", Users],
  ["Outreach", Send],
  ["LinkedIn", Users],
  ["Inbox", Inbox],
  ["Import Outreach", FolderOpen],
  ["Follow-ups", Clock3],
  ["Opportunities", Trophy],
  ["Research", Sparkles],
  ["Player Profile", UserRound],
  ["Documents", FolderOpen],
  ["Settings", Settings],
] as const;
const descriptions: Record<string, string> = {
  Dashboard: "A clear view of your next move.",
  Discover: "Find the people who can open the right doors.",
  Clubs: "Build a complete picture of your target clubs.",
  Contacts: "Better contacts. More meaningful conversations.",
  Outreach: "Make every message relevant.",
  LinkedIn: "Research, personalize and track — you stay in control.",
  Inbox: "Every conversation, one place.",
  "Follow-ups": "Stay present. Respect their time.",
  Opportunities: "Turn a positive response into your next chapter.",
  "AI Research": "Build a shortlist with purpose.",
  Research: "Find the right decision-makers. Know every source.",
  "Player Profile": "The player behind every message.",
  Documents: "Your football story, ready to share.",
  Settings: "Your workspace, your rules.",
  "Import Outreach": "Bring your real conversations into your station.",
};
export default function Station() {
  return (
    <StoreProvider>
      <SidebarProvider
        style={{ "--sidebar-width": "232px" } as React.CSSProperties}
      >
        <Workspace />
        <Toaster theme="dark" richColors position="bottom-right" />
      </SidebarProvider>
    </StoreProvider>
  );
}
function Workspace() {
  const { db, ready, error, mutate, mode, changeMode, saving, refresh } = useStore();
  const { setOpenMobile } = useSidebar();
  const [route, setRoute] = useState("Dashboard");
  const [filter, setFilter] = useState("");
  const [platform, setPlatform] = useState("Email");
  const [drawer, setDrawer] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [revision, setRevision] = useState(0);
  const [commandSearch, setCommandSearch] = useState("");
  const count = db.conversations.filter((v) => !v.read).length;
  const completeness = setupProgress(db).percent;
  function navigate(name: string, f = "") {
    setRoute(name);
    setFilter(f);
    setRevision((v) => v + 1);
    setOpenMobile(false);
    setPalette(false);
    window.history.pushState(
      {},
      "",
      "#" +
        encodeURIComponent(name) +
        (f ? "?filter=" + encodeURIComponent(f) : ""),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function compose(id: string, p = "Email") {
    if (p === "LinkedIn" || (route === "Inbox" && db.messages.filter(m => m.contactId === id && m.direction === "in").at(-1)?.platform === "LinkedIn")) { navigate("LinkedIn", id); setDrawer(null); return; }
    setPlatform(p);
    navigate("Outreach", id);
    setDrawer(null);
  }
  useEffect(() => {
    const read = () => {
      const [r, f] = decodeURIComponent(window.location.hash.slice(1)).split(
        "?filter=",
      );
      if (nav.some(([n]) => n === r) || r === "AI Research") {
        setRoute(r === "AI Research" ? "Research" : r);
        setFilter(f || "");
      }
    };
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("hashchange", read);
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", k);
    setOnboarding(!localStorage.getItem("station-japo-onboarded"));
    return () => {
      window.removeEventListener("keydown", k);
      window.removeEventListener("popstate", read);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  const live = useRef({ db, navigate });
  live.current = { db, navigate };
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: { registerTool: (t: unknown, o: unknown) => unknown };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "search_station_contacts",
          description:
            "Read saved football contacts by name, club or country. Does not contact anyone.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute(input: unknown) {
            const q = (input as { query?: unknown })?.query;
            if (typeof q !== "string")
              throw new Error("query must be a string");
            return live.current.db.contacts
              .filter(
                (c) =>
                  !c.archived &&
                  `${c.name} ${c.country} ${live.current.db.clubs.find((x) => x.id === c.clubId)?.name}`
                    .toLowerCase()
                    .includes(q.toLowerCase()),
              )
              .map((c) => ({
                id: c.id,
                name: c.name,
                country: c.country,
                status: c.status,
                confidence: c.confidence,
              }));
          },
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
    return () => life.abort();
  }, []);
  function dismiss() {
    localStorage.setItem("station-japo-onboarded", "1");
    setOnboarding(false);
  }
  return (
    <>
      <Sidebar collapsible="icon" className="station-sidebar">
        <SidebarHeader>
          <button className="brand" onClick={() => navigate("Dashboard")}>
            <span className="brand-icon">
              <Zap size={22} fill="currentColor" />
            </span>
            <span className="brand-name">
              STATION JAPO<small>YOUR NEXT CHAPTER</small>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <span className="nav-label">WORKSPACE</span>
          <SidebarMenu>
            {nav.map(([name, Icon]) => (
              <SidebarMenuItem key={name}>
                <SidebarMenuButton
                  isActive={route === name}
                  tooltip={name}
                  onClick={() => navigate(name)}
                >
                  <Icon />
                  <span>{name}</span>
                  {name === "Inbox" && count > 0 && (
                    <b className="nav-count">{count}</b>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <button
            className="player-mini"
            onClick={() => navigate("Player Profile")}
          >
            <span className="avatar">
              {initials(db.player.name || "Japo Player")}
            </span>
            <div>
              <b>{db.player.name || "Your player profile"}</b>
              <small>{db.player.position} · {db.player.nationality}</small>
            </div>
          </button>
          <div
            className="completion"
            title="Five saved setup milestones. Inspect each on the dashboard."
          >
            <span>Station Setup</span>
            <b>{ready ? completeness + "%" : "—"}</b>
          </div>
          <Progress value={ready ? completeness : 0} className="h-1 my-2" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <SidebarTrigger />
          <button className="global-search" onClick={() => setPalette(true)}>
            <Search size={17} />
            <span>Search clubs, people, countries, conversations...</span>
            <kbd>⌘ K</kbd>
          </button>
          <span className="local-label">
            {mode === "demo" ? "DEMO DATA · Local only" : saving ? "Saving workspace…" : "Personal workspace"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="icon-button" aria-label="Notifications">
                <Bell size={19} />
                {db.notifications.some((n) => !n.read) && <i />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() =>
                  mutate("All notifications marked read", (d) =>
                    d.notifications.forEach((n) => (n.read = true)),
                  )
                }
              >
                Mark all read
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {db.notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onSelect={() => {
                    mutate("Notification read", (d) => {
                      d.notifications.find((x) => x.id === n.id)!.read = true;
                    });
                    navigate(n.route);
                  }}
                >
                  {!n.read && <span className="live-dot" />}
                  {n.text}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="avatar small"
            aria-label="Open player profile"
            onClick={() => navigate("Player Profile")}
          >
            {initials(db.player.name || "Japo Player")}
          </button>
        </header>
        <main className="workspace">
          {mode === "demo" && (
            <div className="notice amber" role="status">
              <b>DEMO DATA — fictional records, not your history.</b> This
              workspace is stored separately.{" "}
              <button
                className="btn"
                onClick={() => {
                  changeMode("personal");
                  setDrawer(null);
                  navigate("Dashboard");
                }}
              >
                Return to personal workspace
              </button>
            </div>
          )}
          {error && (
            <p className="notice amber" role="alert">
              {error} · Your open form is unchanged. <button className="btn" onClick={refresh}>Load latest saved data</button>
            </p>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR COMMAND CENTER</div>
              <h1>
                {route}
                {route === "Dashboard" && <span className="live-dot" />}
              </h1>
              <p>{descriptions[route]}</p>
            </div>
            {ready && <div className="button-row"><button className="btn" onClick={() => navigate("Import Outreach")}>Import Outreach</button><QuickAdd navigate={navigate}/></div>}
          </div>
          {!ready ? (
            <p className="notice">
              {error
                ? "Unable to load saved data. No counts are shown."
                : "Loading saved workspace…"}
            </p>
          ) : (
            <div className="route-content" key={mode + route + revision}>
              {route === "Dashboard" && (
                <Dashboard
                  navigate={navigate}
                  onOpen={setDrawer}
                  onCompose={compose}
                />
              )}{" "}
              {route === "Contacts" && (
                <ContactTable
                  filter={filter}
                  onOpen={setDrawer}
                  onCompose={compose}
                />
              )}{" "}
              {route === "Clubs" && <Clubs onOpen={setDrawer} initialAdd={filter === "add"} />}{" "}
              {route === "Import Outreach" && <ImportOutreach navigate={navigate} linkedInContact={filter.startsWith("linkedin:") ? filter.slice(9) : undefined}/>}
              {route === "LinkedIn" && <LinkedInWorkspace initialId={filter} navigate={navigate} onOpen={setDrawer}/>}
              {route === "Outreach" && (
                <Outreach
                  initialId={filter || undefined}
                  initialPlatform={platform}
                  onLinkedIn={id => navigate("LinkedIn", id)}
                />
              )}{" "}
              {route === "Inbox" && (
                <InboxView
                  initialId={filter || undefined}
                  onCompose={compose}
                />
              )}{" "}
              {route === "Follow-ups" && (
                <FollowUps onCompose={compose} onOpen={setDrawer} />
              )}{" "}
              {route === "Opportunities" && (
                <Opportunities onOpen={setDrawer} onCompose={compose} />
              )}{" "}
              {(route === "Discover" || route === "AI Research" || route === "Research") && (
                <Research
                  agent={route === "AI Research"}
                  initialCountry={filter}
                  onOpen={setDrawer}
                  onCompose={compose}
                />
              )}{" "}
              {route === "Player Profile" && <PlayerProfile />}{" "}
              {route === "Documents" && <Documents />}{" "}
              {route === "Settings" && <SettingsView />}
            </div>
          )}
          <div className="footer-note">
            <Globe2 size={14} />
            Built for the journey. Focused on your next opportunity.
            <span>
              {saving ? "Saving…" : error ? "Save needs attention" : ready ? mode === "demo" ? "Demo saved on this device" : "Saved to workspace database" : "Loading workspace…"}
            </span>
          </div>
        </main>
      </SidebarInset>
      <ContactDrawer
        key={drawer}
        id={drawer}
        close={() => setDrawer(null)}
        onCompose={compose}
      />
      <CommandDialog
        open={palette}
        onOpenChange={setPalette}
        title="Station Japo command center"
      >
        <CommandInput
          value={commandSearch}
          onValueChange={setCommandSearch}
          placeholder="Search people, clubs or commands…"
        />
        <CommandList>
          <CommandEmpty>No matching contacts or commands.</CommandEmpty>
          <CommandGroup heading="Quick actions">
            {[
              ["Find Australian clubs", "Discover", "Australia"],
              ["Search UAE clubs", "Discover", "UAE"],
              ["Generate outreach", "Outreach", ""],
              ["Show follow-ups", "Follow-ups", ""],
              ["Open player profile", "Player Profile", ""],
            ].map(([label, r, f]) => (
              <CommandItem key={label} onSelect={() => navigate(r, f)}>
                <Sparkles size={15} />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Pages">
            {nav.map(([n, Icon]) => (
              <CommandItem key={n} onSelect={() => navigate(n)}>
                <Icon size={15} />
                {n}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Contacts">
            {db.contacts
              .filter((c) => !c.archived)
              .map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.country} ${db.clubs.find((x) => x.id === c.clubId)?.name}`}
                  onSelect={() => {
                    setPalette(false);
                    setDrawer(c.id);
                  }}
                >
                  <UserRound size={15} />
                  {c.name}
                  <small>{c.country}</small>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <Dialog open={onboarding} onOpenChange={(v) => !v && dismiss()}>
        <DialogContent className="onboarding">
          <DialogHeader>
            <span className="brand-icon">
              <Zap size={24} />
            </span>
            <DialogTitle>Welcome to Station Japo</DialogTitle>
            <DialogDescription>
              Your football opportunity command center.
            </DialogDescription>
          </DialogHeader>
          <p className="muted">Discover. Connect. Progress.</p>
          {[
            "Complete your player profile",
            "Add your CV & highlights",
            "Choose your target countries",
            "Start discovering contacts",
          ].map((s, i) => (
            <div className="onboard-step" key={s}>
              <span>0{i + 1}</span>
              {s}
            </div>
          ))}
          <p className="notice">
            Your personal workspace starts empty. Counts come only from saved
            records. Optional demo data is isolated in Settings and never added
            to your personal history.
          </p>
          <button className="btn primary" onClick={dismiss}>
            Enter Station Japo <ArrowRight size={16} />
          </button>
          <button className="text-button" onClick={dismiss}>
            Skip for now
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
