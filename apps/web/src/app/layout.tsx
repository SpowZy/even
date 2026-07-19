import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://even.dev"),
  title: "Even | Every agent action, accounted for",
  description:
    "Even is the receipt layer for AI agents: signed, hash-chained receipts for every tool call and LLM call, with per-action cost attribution, policy guardrails, and tamper-evident verification.",
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
  openGraph: {
    title: "Even | Every agent action, accounted for",
    description:
      "Signed, hash-chained receipts for AI agents. Cost, policy and proof, per action.",
    images: [{ url: "/og.svg", width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-text font-sans antialiased">
        {/* Font loading (React 19 hoists these <link>s into <head>):
            General Sans via Fontshare, JetBrains Mono via Google Fonts. */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        {children}
      </body>
    </html>
  );
}
