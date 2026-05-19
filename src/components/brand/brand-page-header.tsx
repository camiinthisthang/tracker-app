// The terminal-log style page header used on every page of the Poncho deck:
//   <section name> ........... <page index>
// Rendered in Geist Mono, lowercase, with a subtle dim color.
//
// Usage:
//   <BrandPageHeader section="apply" index="01 / 04" />

interface Props {
  section: string;
  index?: string;
  tone?: "light" | "dark";
}

export function BrandPageHeader({ section, index, tone = "dark" }: Props) {
  const color =
    tone === "light" ? "text-white/85" : "text-foreground/55";
  return (
    <div
      className={`flex w-full items-center justify-between font-mono text-xs uppercase tracking-wider ${color}`}
    >
      <span>{section}</span>
      {index ? <span>{index}</span> : null}
    </div>
  );
}
