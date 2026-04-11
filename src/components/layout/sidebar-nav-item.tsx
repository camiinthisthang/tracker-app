"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export function SidebarNavItem({ href, label, icon: Icon, badge }: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (href !== "/dashboard" && href !== "/home" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-blue-50 text-blue-500"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
      {badge && (
        <span className="ml-auto rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-600">
          {badge}
        </span>
      )}
    </Link>
  );
}
