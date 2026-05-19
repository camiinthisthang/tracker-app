import { BrandMark } from "@/components/brand/brand-mark";

export function ApplyNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/15 bg-[var(--brand-blue)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <BrandMark href="/apply" tone="light" size="sm" />
        <div className="flex items-center gap-6 font-mono text-xs">
          <a
            href="#how-it-works"
            className="hidden text-white/70 hover:text-white sm:inline"
          >
            how it works
          </a>
          <a
            href="#pay"
            className="hidden text-white/70 hover:text-white sm:inline"
          >
            pay
          </a>
          <a
            href="#faq"
            className="hidden text-white/70 hover:text-white sm:inline"
          >
            faq
          </a>
          <a
            href="#apply"
            className="rounded-md bg-[var(--brand-chartreuse)] px-4 py-2 font-medium text-[#0a0a0a] hover:opacity-90"
          >
            apply now →
          </a>
        </div>
      </div>
    </nav>
  );
}
