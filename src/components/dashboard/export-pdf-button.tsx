"use client";

import { FileDown } from "lucide-react";

/** Browser print-to-PDF: print CSS hides the sidebar/filters so the client
 * gets a clean one-page summary. */
export function ExportPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 print:hidden"
    >
      <FileDown className="h-4 w-4" />
      Export PDF
    </button>
  );
}
