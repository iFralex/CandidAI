export const metadata = {
    title: "Unsubscribed · CandidAI",
    robots: { index: false, follow: false },
};

interface UnsubscribedPageProps {
    searchParams: Promise<{ error?: string }>;
}

export default async function UnsubscribedPage({ searchParams }: UnsubscribedPageProps) {
    const { error } = await searchParams;
    const failed = !!error;

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-8 space-y-4">
                {failed ? (
                    <>
                        <div className="text-4xl">⚠️</div>
                        <h1 className="text-xl font-semibold">Unsubscribe link is invalid or expired</h1>
                        <p className="text-sm text-white/60">
                            The link may be malformed, or our security token may have changed.
                            If you keep receiving emails you don&apos;t want, just reply to one with
                            &ldquo;stop&rdquo; and we&apos;ll handle it manually.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="text-4xl">👋</div>
                        <h1 className="text-xl font-semibold">You&apos;ve been unsubscribed</h1>
                        <p className="text-sm text-white/70">
                            We won&apos;t send you any more marketing or onboarding emails. You&apos;ll still
                            receive essential service emails (payment receipts, password resets,
                            and notifications about your CandidAI account activity).
                        </p>
                        <p className="text-sm text-white/60">
                            Changed your mind? Reply to any past email and we&apos;ll re-enable.
                        </p>
                    </>
                )}
                <div className="pt-4 border-t border-white/10">
                    <a href="/" className="text-sm text-violet-300 hover:text-violet-200">← Back to CandidAI</a>
                </div>
            </div>
        </div>
    );
}
