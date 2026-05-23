"use client";

import { useSession, signOut } from "next-auth/react";
import {
  Home,
  User,
  BookOpen,
  Settings,
  ChevronDown,
  LogOut,
  Upload,
  ListTodo,
} from "lucide-react";
import { SidebarNavItem } from "./sidebar-nav-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { BRAND_WORDMARK } from "@/lib/brand";

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/creator-tasks", label: "Tasks", icon: ListTodo },
  // Uploads hidden until R2 is configured — see CLAUDE.md TODO and the audit doc.
  // { href: "/creator-uploads", label: "Uploads", icon: Upload },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/creator-resources", label: "Resources", icon: BookOpen },
  { href: "/creator-settings", label: "Settings", icon: Settings },
];

export function CreatorSidebar() {
  const { data: session } = useSession();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--brand-blue)]">
          <span className="text-base font-bold leading-none text-white">
            {BRAND_WORDMARK[0]}
          </span>
        </div>
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
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-200 px-3 py-3">
        {/* TODO(cami): orphan? Feedback link was a dead href="#". Removed
            until it has a real destination. */}
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
