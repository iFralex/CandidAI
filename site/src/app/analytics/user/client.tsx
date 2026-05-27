"use client";

import { useState } from "react";

type UserJourney = {
    found: boolean;
    auth?: {
        uid: string;
        email: string;
        emailVerified: boolean;
        createdAt: string | null;
        lastSignInTime: string | null;
        providers: string[];
    };
    user?: {
        plan: string | null;
        credits: number;
        onboardingStep: number | null;
        maxOnboardingStep: number | null;
        activated_at: string | null;
        first_touch: Record<string, unknown> | null;
        last_touch: Record<string, unknown> | null;
        drip_stalled_sent: boolean;
        name: string | null;
    };
    account?: {
        hasCv: boolean;
        hasProfileSummary: boolean;
        hasCustomizations: boolean;
        companies: { name: string; domain: string }[];
        profileTitle: string | null;
        profileLocation: string | null;
    } | null;
    results?: { id: string; company: string; recruiter: string | null; recruiter_title: string | null; blog_articles: number; email_sent_at: string | null }[];
    emails?: { id: string; subject: string | null; body_preview: string | null; email_address: unknown }[];
    events?: { id: string; event: string; params: Record<string, unknown>; source: string; page_path: string | null; timestamp: string | null }[];
    eventCount?: number;
};

export function UserJourneyClient() {
    const [email, setEmail] = useState("");
    const [data, setData] = useState<UserJourney | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const search = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setLoading(true); setError(null); setData(null);
        try {
            const r = await fetch(`/api/analytics/user?email=${encodeURIComponent(email.trim())}`, { cache: "no-store" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setData(await r.json());
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-6">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">User journey</h1>
                        <p className="text-sm text-white/60 mt-1">Cerca per email per vedere il percorso completo di un utente.</p>
                    </div>
                    <a href="/analytics" className="text-xs text-white/50 hover:text-white">← Dashboard</a>
                </header>

                <form onSubmit={search} className="flex gap-2">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-violet-400/60"
                    />
                    <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-50">
                        {loading ? "..." : "Cerca"}
                    </button>
                </form>

                {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

                {data?.found === false && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                        Nessun utente trovato con questa email.
                    </div>
                )}

                {data?.found && (
                    <div className="space-y-6">
                        <ProfileCard auth={data.auth!} user={data.user!} />
                        <AccountCard account={data.account ?? null} />
                        <AttributionCard first={data.user!.first_touch} last={data.user!.last_touch} />
                        <ResultsCard results={data.results ?? []} emails={data.emails ?? []} />
                        <Timeline events={data.events ?? []} />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Cards ────────────────────────────────────────────────────────────────

function ProfileCard({ auth, user }: { auth: NonNullable<UserJourney["auth"]>; user: NonNullable<UserJourney["user"]> }) {
    const camebackHours = auth.createdAt && auth.lastSignInTime
        ? Math.round((new Date(auth.lastSignInTime).getTime() - new Date(auth.createdAt).getTime()) / 3600_000)
        : 0;
    return (
        <Card title="Profile">
            <div className="grid md:grid-cols-3 gap-4 text-sm">
                <Field label="Email" value={auth.email} />
                <Field label="Name" value={user.name ?? "—"} />
                <Field label="UID" value={<code className="text-xs">{auth.uid}</code>} />
                <Field label="Signup" value={formatDate(auth.createdAt)} />
                <Field label="Last login" value={formatDate(auth.lastSignInTime) + (camebackHours > 1 ? ` (+${camebackHours}h)` : "")} />
                <Field label="Email verified" value={auth.emailVerified ? "Yes" : "No"} />
                <Field label="Plan" value={user.plan ?? "—"} />
                <Field label="Credits" value={user.credits.toString()} />
                <Field label="Onboarding step" value={user.onboardingStep !== null ? `${user.onboardingStep}/${user.maxOnboardingStep ?? "?"}` : "—"} />
                <Field label="Activated" value={user.activated_at ? formatDate(user.activated_at) : "—"} />
                <Field label="Drip sent" value={user.drip_stalled_sent ? "Yes" : "No"} />
                <Field label="Providers" value={auth.providers.join(", ") || "—"} />
            </div>
        </Card>
    );
}

function AccountCard({ account }: { account: UserJourney["account"] }) {
    if (!account) return <Card title="Account data"><div className="text-sm text-white/50">No account doc.</div></Card>;
    return (
        <Card title="Account data">
            <div className="grid md:grid-cols-3 gap-4 text-sm">
                <Field label="CV uploaded" value={account.hasCv ? "Yes" : "No"} />
                <Field label="Profile parsed" value={account.hasProfileSummary ? "Yes" : "No"} />
                <Field label="Customizations" value={account.hasCustomizations ? "Yes" : "No"} />
                <Field label="Profile title" value={account.profileTitle ?? "—"} />
                <Field label="Location" value={account.profileLocation ?? "—"} />
                <Field label="Companies" value={account.companies.length > 0 ? account.companies.map(c => c.name).join(", ") : "—"} />
            </div>
        </Card>
    );
}

function AttributionCard({ first, last }: { first: Record<string, unknown> | null; last: Record<string, unknown> | null }) {
    if (!first && !last) return null;
    const renderTouch = (t: Record<string, unknown> | null) => t
        ? <pre className="text-[11px] text-white/70 whitespace-pre-wrap break-all font-mono">{JSON.stringify(t, null, 2)}</pre>
        : <div className="text-xs text-white/40">—</div>;
    return (
        <Card title="Attribution">
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <div className="text-xs text-white/50 mb-2">First touch (signup)</div>
                    {renderTouch(first)}
                </div>
                <div>
                    <div className="text-xs text-white/50 mb-2">Last touch (latest conversion)</div>
                    {renderTouch(last)}
                </div>
            </div>
        </Card>
    );
}

function ResultsCard({ results, emails }: { results: NonNullable<UserJourney["results"]>; emails: NonNullable<UserJourney["emails"]> }) {
    if (results.length === 0 && emails.length === 0) {
        return <Card title="Pipeline results"><div className="text-sm text-white/50">No pipeline runs yet.</div></Card>;
    }
    const emailById = new Map(emails.map((e) => [e.id, e]));
    return (
        <Card title={`Pipeline results (${results.length})`}>
            <ul className="space-y-3">
                {results.map((r) => {
                    const em = emailById.get(r.id);
                    return (
                        <li key={r.id} className="border border-white/10 rounded-lg p-3">
                            <div className="flex justify-between items-baseline">
                                <div className="font-medium">{r.company}</div>
                                <div className="text-xs text-white/40">{r.email_sent_at ? `sent ${formatDate(r.email_sent_at)}` : "not sent"}</div>
                            </div>
                            <div className="text-xs text-white/60 mt-1">
                                Recruiter: {r.recruiter ?? <span className="text-red-300/80">(none)</span>}
                                {r.recruiter_title && <span className="text-white/40"> · {r.recruiter_title}</span>}
                                <span className="text-white/40"> · {r.blog_articles} blog articles</span>
                            </div>
                            {em?.subject && (
                                <div className="text-xs mt-2">
                                    <span className="text-white/40">Subject: </span>
                                    <span className="text-white/80">{em.subject}</span>
                                </div>
                            )}
                            {em?.body_preview && (
                                <div className="text-[11px] text-white/50 mt-1 italic">&ldquo;{em.body_preview}&hellip;&rdquo;</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

function Timeline({ events }: { events: NonNullable<UserJourney["events"]> }) {
    return (
        <Card title={`Event timeline (${events.length})`}>
            {events.length === 0 ? (
                <div className="text-sm text-white/50">No events tracked for this user.</div>
            ) : (
                <ul className="space-y-1 max-h-[600px] overflow-y-auto">
                    {events.map((e) => (
                        <li key={e.id} className="flex items-baseline gap-3 text-xs border-b border-white/5 py-1.5">
                            <span className="w-32 shrink-0 text-white/40 tabular-nums">{e.timestamp ? e.timestamp.slice(5, 19).replace("T", " ") : "—"}</span>
                            <span className="w-44 shrink-0 font-mono text-white/90">{e.event}</span>
                            <span className="w-16 shrink-0 text-[10px] text-white/40">{e.source}</span>
                            <span className="flex-1 text-white/60 truncate">{Object.keys(e.params).length > 0 ? JSON.stringify(e.params) : "—"}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

// ─── Primitives ───────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-medium text-white/90 mb-4">{title}</h2>
            {children}
        </section>
    );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide">{label}</div>
            <div className="text-sm text-white/90 mt-0.5 break-words">{value}</div>
        </div>
    );
}

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return iso.slice(0, 19).replace("T", " ");
}
