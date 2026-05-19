import { cn } from "@/lib/utils";

interface Props {
  // The first portion of the headline (rendered plain).
  children: React.ReactNode;
  // The portion to wrap in the chartreuse highlight block.
  highlight: React.ReactNode;
  // Optional className for additional sizing/spacing tweaks.
  className?: string;
  // Use a smaller scale (for in-card titles, etc).
  size?: "sm" | "md" | "lg" | "xl";
  // Tone of the non-highlighted text. Defaults to inherit.
  tone?: "light" | "dark" | "inherit";
}

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-2xl sm:text-3xl",
  md: "text-3xl sm:text-4xl",
  lg: "text-4xl sm:text-5xl md:text-6xl",
  xl: "text-5xl sm:text-6xl md:text-7xl",
};

// The signature viewtrackr / Poncho headline: bold lowercase Geist with the
// last word wrapped in a chartreuse highlight block, period-terminated.
//
// Usage:
//   <BrandHeadline highlight="works.">how it</BrandHeadline>
//   <BrandHeadline highlight="creators.">built for</BrandHeadline>
export function BrandHeadline({
  children,
  highlight,
  className,
  size = "lg",
  tone = "inherit",
}: Props) {
  const toneClass =
    tone === "light"
      ? "text-white"
      : tone === "dark"
      ? "text-foreground"
      : "";
  return (
    <h1
      className={cn(
        SIZE_CLASS[size],
        "font-bold tracking-tight lowercase leading-[1.05]",
        toneClass,
        className
      )}
    >
      {children}{" "}
      <span className="bg-[var(--brand-chartreuse)] text-[#0a0a0a] px-[0.15em] rounded-[0.1em]">
        {highlight}
      </span>
    </h1>
  );
}
