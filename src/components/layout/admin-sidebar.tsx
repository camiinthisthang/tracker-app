"use client";

import { useSession, signOut } from "next-auth/react";
import {
  Home,
  Megaphone,
  Users,
  List,
  BookOpen,
  Settings,
  BarChart3,
  ChevronDown,
  LogOut,
  Sparkles,
  Inbox,
  Lightbulb,
  Building2,
} from "lucide-react";
import { SidebarNavItem } from "./sidebar-nav-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/posts", label: "Posts", icon: List },
  { href: "/hooks", label: "Hooks", icon: Lightbulb },
  { href: "/charts", label: "Charts", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: BookOpen },
  { href: "/notifications", label: "Notifications", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Agency-wide items — super admins + agency managers (Tapmore team) see these.
// Applications (review creator applicants) and Clients (multi-tenant dashboard)
// both require cross-client visibility.
const agencyNavItems = [
  { href: "/applications", label: "Applications", icon: Inbox },
  { href: "/clients", label: "Clients", icon: Building2 },
];

const AGENCY_TEAM_NAME = "Tapmore";

export function AdminSidebar() {
  const { data: session } = useSession();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-semibold text-slate-800">
          {session?.user?.isSuperAdmin
            ? "Tapmore"
            : session?.user?.teamName || "Tracker"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => (
          <SidebarNavItem key={item.href} {...item} />
        ))}
        {(session?.user?.isSuperAdmin ||
          session?.user?.teamName === AGENCY_TEAM_NAME) && (
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
