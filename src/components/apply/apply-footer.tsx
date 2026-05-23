import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export function ApplyFooter() {
  return (
    <footer className="border-t border-slate-100 bg-white py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-sm">
            <Link
              href="/legal/terms-of-service"
              className="text-slate-500 hover:text-slate-900"
            >
              Terms
            </Link>
            <Link
              href="/legal/privacy-policy"
              className="text-slate-500 hover:text-slate-900"
            >
              Privacy
            </Link>
            <Link
              href="/login"
              className="text-slate-500 hover:text-slate-900"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
