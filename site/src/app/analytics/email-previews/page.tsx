import Link from "next/link";
import { getLifecycleEmailPreviews } from "@/app/api/cron/onboarding-sequence/route";

export const metadata = { title: "Email previews · Analytics" };
export const dynamic = "force-dynamic";

export default function EmailPreviewsPage() {
  const previews = getLifecycleEmailPreviews();
  return (
    <main className="min-h-screen bg-[#080808] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">Internal QA</p>
            <h1 className="mt-2 text-3xl font-bold">Lifecycle email previews</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Real template output with representative customer data. Review copy, personalization, mobile layout, and both subject-line variants without sending an email.</p>
          </div>
          <Link href="/analytics" className="text-sm font-medium text-violet-300 hover:text-violet-200">← Back to analytics</Link>
        </div>
        <div className="space-y-10">
          {previews.map(preview => (
            <section key={preview.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/10 px-5 py-4">
                <p className="text-sm font-semibold">{preview.label}</p>
                <p className="mt-1 text-sm text-white/50"><span className="text-white/30">Subject:</span> {preview.subject}</p>
              </div>
              <iframe title={preview.label} srcDoc={preview.html} className="h-[820px] w-full bg-[#0f0f0f]" sandbox="allow-popups" />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
