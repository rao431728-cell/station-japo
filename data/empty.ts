import type { Database } from "@/types";
/** Defaults describe the player supplied in the brief, never invented CRM history. */
export function createEmpty(): Database {
  return {
    version: 1,
    player: {
      name: "",
      age: 17,
      nationality: "Pakistan",
      city: "Lahore, Pakistan",
      position: "Left Winger",
      foot: "Right",
      strengths: "Dribbling, playmaking, creativity, attacking movement",
      goals:
        "Earn high-level football opportunities and become a professional footballer.",
      achievements: "",
      availability: "",
      markets: ["Australia", "UAE", "Portugal", "Croatia"],
    },
    clubs: [],
    contacts: [],
    messages: [],
    conversations: [],
    followUps: [],
    opportunities: [],
    research: [],
    notifications: [],
    audit: [],
    assets: [
      "Football CV",
      "Highlights",
      "Full Match Footage",
      "Player Photos",
      "Certificates",
    ].map((kind, i) => ({
      id: "a" + i,
      kind,
      name: kind,
      url: "",
      fileName: "",
      updatedAt: "",
    })),
  };
}
