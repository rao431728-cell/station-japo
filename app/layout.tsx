import type { Metadata } from "next";
import "./globals.css";
import "./station.css";
import "./workspace.css";
import "./map.css";
import "./provenance.css";
import "./personal-system.css";
import "./linkedin.css";
import "./research.css";

export const metadata: Metadata = {
  title: "Station Japo — Football Opportunity Command Center",
  description:
    "Discover the right people. Build relationships. Create your next football opportunity.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
