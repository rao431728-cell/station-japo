import type { Database, Contact, Message, Club } from "@/types";
import { day, analyzeReply, roles } from "@/lib/intelligence";
export function createSeed(): Database {
  const names = [
    "Melbourne Harbour FC",
    "Sydney Coast FC",
    "Dubai City FC",
    "Abu Dhabi Athletic",
    "Brisbane Valley FC",
    "Perth United Academy",
    "Rotterdam West",
    "Berlin Athletic",
    "Lisbon Riverside",
    "Zagreb United",
    "Antwerp City Academy",
    "Valencia Coast",
    "Manchester Borough",
    "Lahore Athletic",
    "Austin Development FC",
    "Islamabad United Academy",
  ];
  const regions = [
    "Australia",
    "Australia",
    "UAE",
    "UAE",
    "Australia",
    "Australia",
    "Netherlands",
    "Germany",
    "Portugal",
    "Croatia",
    "Belgium",
    "Spain",
    "England",
    "Pakistan",
    "USA",
    "Pakistan",
  ];
  const leagues = [
    "NPL Victoria",
    "NPL NSW",
    "UAE First Division",
    "UAE Pro League",
    "NPL Queensland",
    "NPL Western Australia",
    "Youth Development",
    "Regional League",
    "Youth Development",
    "Second Division",
    "Youth Development",
    "Regional League",
    "National League System",
    "Regional League",
    "Development League",
    "Youth Development",
  ];
  const clubs: Club[] = names.map((name, i) => ({
    id: "club-" + i,
    name,
    country: regions[i],
    league: leagues[i],
    level: i === 3 ? "Professional" : "Semi-professional",
    teams: ["Senior", i % 2 ? "U21" : "U20", "Academy"],
    site: "",
    notes:
      "Demo club for exploring the outreach workflow. Verify eligibility and recruitment routes before real outreach.",
  }));
  const first = [
    "Oliver Bennett",
    "James Mitchell",
    "Omar Al Mansoori",
    "Hassan Nasser",
    "Liam Wallace",
    "Ethan Clarke",
    "Lars de Vries",
    "Felix Weber",
    "Miguel Santos",
    "Ivan Kovac",
    "Lucas Peeters",
    "Alejandro Ruiz",
    "Daniel Brooks",
    "Hamza Farooq",
    "Evan Parker",
    "Bilal Khan",
  ];
  const others = [
    "Noah Turner",
    "Rayan Ahmed",
    "Thomas Reed",
    "Adam Williams",
    "Oscar Wilson",
    "Zain Malik",
    "Finn Jacobs",
    "Leon Fischer",
    "Tiago Costa",
    "Luka Maric",
    "Milan Janssens",
    "Diego Marin",
    "Ryan Collins",
    "Usman Shah",
    "Owen Hayes",
    "Saad Ali",
    "Leo Martin",
    "Amir Saeed",
    "Ben Walker",
    "Yusuf Rahman",
    "Mason Harris",
    "Ali Raza",
    "Daan Visser",
    "Jonas Klein",
    "Rafael Silva",
    "Marko Petric",
    "Louis Dubois",
    "Pablo Vidal",
    "Sam Taylor",
    "Ahmed Iqbal",
    "Jack Foster",
    "Haris Aslam",
  ];
  const contacts: Contact[] = [...first, ...others].map((name, i) => {
    const club = clubs[i % 16];
    return {
      id: "c" + i,
      name,
      clubId: club.id,
      role: roles[i % roles.length],
      country: club.country,
      league: club.league,
      email: "",
      instagram: "",
      linkedin: "",
      sources: [],
      sourceLabel: "Unknown — demo record",
      confidence: "Unverified",
      emailStatus: "Unverified",
      status:
        i === 1
          ? "Trial"
          : i === 0 || i === 2
            ? "Opportunity"
            : i < 8
              ? "Replied"
              : i < 13
                ? "Follow-up"
                : i < 18
                  ? "Contacted"
                  : i < 33
                    ? "Ready"
                    : "Found",
      discoveredAt: day(-14),
      verifiedAt: null,
      lastContacted: i < 18 ? day(-7) : null,
      nextFollowUp: i >= 8 && i < 13 ? day(i % 2 ? -1 : 0) : null,
      notes: "",
      archived: false,
      demo: true,
    };
  });
  const replies = [
    "Thanks for reaching out. Please send your CV and two full matches and let me know when you will be in Sydney.",
    "Can you come for a trial? Please share your availability and we can discuss dates.",
    "Thanks for your profile. Can you send your CV for our academy staff to review?",
    "We do not have any current opportunities available. Thanks for your interest.",
    "Thanks. I will pass this to our recruitment department.",
    "Contact me again in January when we review the squad.",
    "Could you send recent highlights? Our coaches would like to discuss your profile.",
    "Thanks for the message. We are reviewing the squad at the moment.",
  ];
  const messages: Message[] = contacts
    .slice(0, 18)
    .map((c, i) => ({
      id: "m" + i,
      contactId: c.id,
      platform: i % 3 === 0 ? "Instagram DM" : "Email",
      direction: "out",
      body: `Hi ${c.name.split(" ")[0]}, I'm a 17-year-old left winger from Pakistan. Would there be a chance to have my profile evaluated by your football staff? Happy to send my CV and footage.`,
      date: new Date(day(-7) + "T10:00:00").toISOString(),
      status: "Sent",
      followUp: false,
    }));
  replies.forEach((body, i) =>
    messages.push({
      id: "reply" + i,
      contactId: "c" + i,
      platform: i % 3 === 0 ? "Instagram DM" : "Email",
      direction: "in",
      body,
      date: new Date(day(-1) + "T12:00:00").toISOString(),
      status: "Received",
      followUp: false,
    }),
  );
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
    clubs,
    contacts,
    messages,
    conversations: replies.map((body, i) => ({
      id: "conv" + i,
      contactId: "c" + i,
      analysis: analyzeReply(body),
      read: i > 2,
    })),
    followUps: contacts
      .slice(8, 13)
      .map((c) => ({
        id: "f" + c.id,
        contactId: c.id,
        date: c.nextFollowUp!,
        status: "Scheduled",
        sequence: 1,
      })),
    opportunities: [
      {
        id: "o0",
        contactId: "c0",
        type: "Recruitment Review",
        stage: "Footage Review",
        nextStep: "Send CV, two full matches and travel availability",
        createdAt: day(-1),
      },
      {
        id: "o1",
        contactId: "c1",
        type: "Trial",
        stage: "Trial Discussion",
        nextStep: "Confirm availability and ask for trial requirements",
        createdAt: day(-1),
      },
      {
        id: "o2",
        contactId: "c2",
        type: "Academy Discussion",
        stage: "Profile Review",
        nextStep: "Send football CV to academy staff",
        createdAt: day(-1),
      },
    ],
    research: [],
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
    notifications: [
      {
        id: "n1",
        text: "New reply from Melbourne Harbour FC",
        read: false,
        route: "Inbox",
      },
      {
        id: "n2",
        text: "5 follow-ups are ready for review",
        read: false,
        route: "Follow-ups",
      },
      {
        id: "n3",
        text: "Trial discussion with Sydney Coast FC",
        read: false,
        route: "Opportunities",
      },
    ],
    audit: [
      {
        id: "init",
        action:
          "Demo workspace created · all clubs, people and conversations are fictional",
        date: new Date().toISOString(),
      },
    ],
  };
}
