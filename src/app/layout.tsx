import type { Metadata, Viewport } from "next";
import { Orbitron, Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import AppShell from "@/components/AppShell";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Paracelsus",
  description:
    "An ancient physician reborn digitally. He calculates your lifespan. You pay him to survive.",
  openGraph: {
    title: "Paracelsus",
    description:
      "An ancient physician reborn digitally. He calculates your lifespan. You pay him to survive.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Paracelsus",
    description:
      "An ancient physician reborn digitally. He calculates your lifespan. You pay him to survive.",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff6b1a",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${orbitron.variable} ${spaceMono.variable} antialiased`}
      >
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}
