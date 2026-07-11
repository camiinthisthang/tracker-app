"use client";

import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import {
  Home,
  Megaphone,
  Users,
  List,
  BookOpen,
  BookOpenCheck,
  Settings,
  ChevronDown,
  LogOut,
  Inbox,
  Lightbulb,
  Building2,
  Briefcase,
  UserCog,
} from "lucide-react";
import { SidebarNavItem } from "./sidebar-nav-item";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { BRAND_WORDMARK } from "@/lib/brand";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/posts", label: "Posts", icon: List },
  { href: "/hooks", label: "Hooks", icon: Lightbulb },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: BookOpenCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Agency-wide items — super admins + agency managers (DropDeck team) see these.
// Applications (review creator applicants), Clients (multi-tenant dashboard),
// and Agency team (DropDeck members) all require cross-client visibility.
const agencyNavItems = [
  { href: "/applications", label: "Applications", icon: Inbox },
  { href: "/inquiries", label: "Brands", icon: Briefcase },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/team", label: "Agency team", icon: UserCog },
];

// Agency-team marker. Keep in sync with AGENCY_TEAM_SLUG in src/lib/auth.ts.
// Client component can't import from server-only modules so we duplicate the
// literal here. `teamName` fallback is for sessions issued before the slug
// was added to the JWT. The legacy "tapmore" slug/name is accepted as a
// transitional fallback until the prod DB row is renamed.
const AGENCY_TEAM_SLUG = "dropdeck";
const AGENCY_TEAM_NAME = "DropDeck";
const LEGACY_AGENCY_TEAM_SLUG = "tapmore";
const LEGACY_AGENCY_TEAM_NAME = "Tapmore";

export function AdminSidebar() {
  const { data: session } = useSession();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      {/* Logo — always the product wordmark, never the client team name. */}
      <div className="flex h-14 items-center gap-2 px-4">
        <Image
          src="/symbol.svg"
          alt="DropDeck"
          width={32}
          height={32}
          className="h-8 w-8"
          priority
        />
        <span className="text-base font-bold tracking-tight lowercase text-foreground">
          {BRAND_WORDMARK}
          <span className="text-[var(--brand-blue)]">.</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => (
          <SidebarNavItem key={item.href} {...item} />
        ))}
        {(session?.user?.isSuperAdmin ||
          session?.user?.teamSlug === AGENCY_TEAM_SLUG ||
          session?.user?.teamSlug === LEGACY_AGENCY_TEAM_SLUG ||
          (!session?.user?.teamSlug &&
            (session?.user?.teamName === AGENCY_TEAM_NAME ||
              session?.user?.teamName === LEGACY_AGENCY_TEAM_NAME))) && (
          <>
            <div className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Agency
            </div>
            {agencyNavItems.map((item) => (
              <SidebarNavItem key={item.href} {...item} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-200 px-3 py-3">
        {/* TODO(cami): orphan? Feedback link has no destination. Hidden
            until we have somewhere for it to point (a shared email, a form,
            etc.). */}
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs text-slate-400">Theme</span>
          <ThemeToggle />
        </div>
        <Separator className="my-2" />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
              {session?.user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <span className="flex-1 truncate text-left text-sm">
              {session?.user?.email || "user@example.com"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
