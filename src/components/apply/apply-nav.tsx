import Link from "next/link";
import { BarChart3 } from "lucide-react";

export function ApplyNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold text-slate-900">
            Viewtrackr
          </span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <a
            href="#how-it-works"
            className="hidden text-slate-600 hover:text-slate-900 sm:inline"
          >
            How it works
          </a>
          <a
            href="#pay"
            className="hidden text-slate-600 hover:text-slate-900 sm:inline"
          >
            Pay
          </a>
          <a
            href="#faq"
            className="hidden text-slate-600 hover:text-slate-900 sm:inline"
          >
            FAQ
          </a>
          <a
            href="#apply"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Apply now
          </a>
        </div>
      </div>
    </nav>
  );
}
