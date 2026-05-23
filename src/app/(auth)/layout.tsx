import { BrandMark } from "@/components/brand/brand-mark";
import { BrandPageHeader } from "@/components/brand/brand-page-header";
import { BRAND_WORDMARK } from "@/lib/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="brand-surface flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 pt-6">
        <BrandPageHeader section={`${BRAND_WORDMARK} / account`} tone="light" />
        <div className="mt-6">
          <BrandMark href="/apply" tone="light" size="sm" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <footer className="mx-auto w-full max-w-6xl px-6 pb-6 font-mono text-xs text-white/60">
        {BRAND_WORDMARK}. ugc campaign management.
      </footer>
    </div>
  );
}
