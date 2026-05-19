import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

// Geist + Geist Mono. Matches the viewtrackr / poncho brand deck typography
// — Geist is the bold lowercase sans for headlines + UI; Geist Mono is the
// terminal-log voice for page-header labels and microcopy.
const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "viewtrackr — ugc campaign management",
  description:
    "viewtrackr tracks, manages, and ships ugc creator campaigns. built by the team behind poncho.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <AuthSessionProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
