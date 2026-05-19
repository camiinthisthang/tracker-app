import Link from "next/link";

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

// The viewtrackr wordmark. Lowercase, period-terminated, Geist Bold.
// Mirrors the "Poncho." / "viewtrackr / brand concept" pattern from the deck.
export function BrandMark({ href = "/apply", tone = "dark", size = "md" }: Props) {
  const color = tone === "light" ? "text-white" : "text-foreground";
  const cls = `${SIZE_CLASS[size]} font-bold tracking-tight lowercase ${color}`;
  return (
    <Link href={href} className={cls}>
      viewtrackr<span className="text-[var(--brand-chartreuse)]">.</span>
    </Link>
  );
}
