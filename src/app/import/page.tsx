import ImportReport from "@/components/ImportReport";
import Link from "next/link";

export default function ImportPage({
  searchParams,
}: {
  searchParams: { d?: string };
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-teal-700 text-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
            aria-label="Back to dashboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white leading-tight">Import Report</h1>
            <p className="text-[11px] text-teal-200 leading-tight">
              Shared from another device via QR code.
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <ImportReport encoded={searchParams.d ?? null} />
      </div>
    </div>
  );
}
