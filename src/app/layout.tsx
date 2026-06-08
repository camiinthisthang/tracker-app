import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import "./globals.css";
import { BRAND_NAME } from "@/lib/brand";

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

// Inter (display) + JetBrains Mono (labels) — scoped to the dropdeck client
// report surface via #client-report in globals.css. The rest of the app keeps
// Geist / Geist Mono.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${BRAND_NAME} — ugc campaign management`,
  description:
    `${BRAND_NAME} tracks, manages, and ships ugc creator campaigns.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
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
