import { BrandMark } from "@/components/brand/brand-mark";
import { BrandPageHeader } from "@/components/brand/brand-page-header";
import { BRAND_WORDMARK } from "@/lib/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="brand-surface relative flex min-h-screen flex-col overflow-hidden">
      {/* Decorative brand marks — purely visual, never intercept clicks. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
        <img
          src="/site/assets/star-white.svg"
          alt=""
          className="absolute -left-20 -top-12 w-72 rotate-12 opacity-[0.08]"
        />
        <img
          src="/site/assets/symbol-white.svg"
          alt=""
          className="absolute -bottom-28 -right-20 w-[30rem] -rotate-6 opacity-[0.07]"
        />
        <img
          src="/site/assets/sparkle-white.svg"
          alt=""
          className="absolute left-[10%] top-[26%] hidden w-10 opacity-40 md:block"
        />
        <img
          src="/site/assets/sparkle-white.svg"
          alt=""
          className="absolute right-[14%] top-[18%] hidden w-7 opacity-30 md:block"
        />
        <img
          src="/site/assets/star-white.svg"
          alt=""
          className="absolute bottom-[16%] left-[18%] hidden w-12 rotate-6 opacity-25 md:block"
        />
        <img
          src="/site/assets/star-white.svg"
          alt=""
          className="absolute bottom-[22%] right-[22%] hidden w-9 -rotate-12 opacity-25 lg:block"
        />
      </div>
      <header className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-6">
        <BrandPageHeader section={`${BRAND_WORDMARK} / account`} tone="light" />
        <div className="mt-6">
          <BrandMark href="/apply" tone="light" size="sm" />
        </div>
      </header>
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-6 font-mono text-xs text-white/60">
        {BRAND_WORDMARK}. ugc campaign management.
      </footer>
    </div>
  );
}
