import Link from "next/link";
import { BRAND_WORDMARK } from "@/lib/brand";

interface Props {
  // Where the wordmark links to. Defaults to /apply (the marketing surface).
  href?: string;
  // "light" on a dark/blue surface, "dark" on a white surface.
  tone?: "light" | "dark";
  // Optional sizing override; defaults to mid-size.
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

// The product wordmark. Lowercase, period-terminated, Geist Bold.
// Sourced from BRAND_WORDMARK in @/lib/brand so a rebrand is a one-file change.
export function BrandMark({ href = "/apply", tone = "dark", size = "md" }: Props) {
  const color = tone === "light" ? "text-white" : "text-foreground";
  const cls = `${SIZE_CLASS[size]} font-bold tracking-tight lowercase ${color}`;
  return (
    <Link href={href} className={cls}>
      {BRAND_WORDMARK}<span className="text-[var(--brand-chartreuse)]">.</span>
    </Link>
  );
}
