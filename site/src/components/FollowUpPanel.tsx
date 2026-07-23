"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowUpRight,
    Bell,
    Check,
    Clock3,
    Copy,
    Loader2,
    Mail,
    MessageCircleReply,
    Pencil,
    Send,
    Sparkles,
    X,
} from "lucide-react";

import {
    generateFollowUp,
    markFollowUpSent,
    saveFollowUpDraft,
    setFollowUpDisposition,
} from "@/actions/follow-up-actions";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ActionResult = Promise<{ success: boolean; error?: string }>;

export interface FollowUpCampaign {
    id: string;
    company?: { name?: string; domain?: string; website?: string } | null;
    recruiter?: { name?: string; job_title?: string; email?: string } | null;
    email_sent?: any;
    follow_up?: any;
    follow_up_disposition?: string | null;
    follow_up_reminder_at?: any;
}

interface FollowUpPanelProps {
    campaign: FollowUpCampaign;
    enabled: boolean;
    email?: string;
    compact?: boolean;
    renderPaidAction?: (
        trigger: React.ReactNode,
        action: () => ActionResult,
        onSuccess: () => void | Promise<void>,
    ) => React.ReactNode;
}

function timestampDate(value: any): Date | null {
    const seconds = Number(value?._seconds ?? value?.seconds ?? 0);
    if (seconds > 0) return new Date(seconds * 1000);
    if (typeof value === "string") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function addWorkingDays(date: Date, days: number) {
    const result = new Date(date);
    let remaining = days;
    while (remaining > 0) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) remaining -= 1;
    }
    return result;
}

function timingFor(sentAt: Date | null) {
    if (!sentAt) return { ready: false, days: 0, recommendedAt: null as Date | null };
    const recommendedAt = addWorkingDays(sentAt, 5);
    const delta = recommendedAt.getTime() - Date.now();
    return {
        ready: delta <= 0,
        days: Math.max(1, Math.ceil(delta / (24 * 60 * 60 * 1000))),
        recommendedAt,
    };
}

export function FollowUpPanel({
    campaign,
    enabled,
    compact = false,
    renderPaidAction,
}: FollowUpPanelProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const current = campaign.follow_up?.current;
    const sent = Boolean(timestampDate(current?.sent_at));
    const [subject, setSubject] = useState(current?.subject || "");
    const [body, setBody] = useState(current?.body || "");
    const [editing, setEditing] = useState(false);
    const [instructions, setInstructions] = useState("");
    const [regenerateOpen, setRegenerateOpen] = useState(false);
    const [error, setError] = useState<string | null>(campaign.follow_up?.last_error || null);
    const [copied, setCopied] = useState(false);
    const timing = useMemo(() => timingFor(timestampDate(campaign.email_sent)), [campaign.email_sent]);

    const companyName = campaign.company?.name || "this company";
    const recruiterName = campaign.recruiter?.name || "your recruiter";
    const recruiterEmail = campaign.recruiter?.email || "";
    const dismissed = campaign.follow_up_disposition === "dismissed";
    const replied = campaign.follow_up_disposition === "replied";

    useEffect(() => {
        setSubject(current?.subject || "");
        setBody(current?.body || "");
        setError(campaign.follow_up?.last_error || null);
    }, [current?.subject, current?.body, current?.version, campaign.follow_up?.last_error]);

    const refresh = async () => {
        setRegenerateOpen(false);
        setInstructions("");
        router.refresh();
    };

    const run = (action: () => ActionResult, after?: () => void) => {
        setError(null);
        startTransition(async () => {
            const result = await action();
            if (!result.success) {
                setError(result.error || "Something went wrong. Please try again.");
                return;
            }
            after?.();
            router.refresh();
        });
    };

    const copyMessage = async () => {
        await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    };

    const mailto = `mailto:${encodeURIComponent(recruiterEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    if (dismissed || replied) {
        return (
            <Card hover={false} className="flex flex-col gap-4 border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <CompanyLogo company={campaign.company?.domain || campaign.company?.website || companyName} />
                    <div>
                        <p className="font-semibold text-white">{companyName}</p>
                        <p className="text-sm text-gray-400">
                            {replied ? "Conversation marked as replied" : "No further follow-up planned"}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(() => setFollowUpDisposition(campaign.id, "remind_tomorrow"))}
                >
                    Reopen
                </Button>
            </Card>
        );
    }

    return (
        <Card
            hover={false}
            className={`relative overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/[0.08] via-white/[0.03] to-transparent ${compact ? "p-5" : "p-6 sm:p-8"}`}
        >
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="relative">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <CompanyLogo company={campaign.company?.domain || campaign.company?.website || companyName} />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xl font-semibold text-white">{companyName}</h3>
                                {sent && (
                                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                                        Follow-up sent
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-gray-400">
                                {recruiterName}
                                {campaign.recruiter?.job_title ? ` · ${campaign.recruiter.job_title}` : ""}
                            </p>
                        </div>
                    </div>

                    {!current && (
                        <div className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                            timing.ready
                                ? "border-violet-400/25 bg-violet-400/10 text-violet-200"
                                : "border-white/10 bg-white/5 text-gray-400"
                        }`}>
                            <Clock3 className="h-3.5 w-3.5" />
                            {timing.ready ? "Recommended now" : `Recommended in ${timing.days} day${timing.days === 1 ? "" : "s"}`}
                        </div>
                    )}
                </div>

                {!current ? (
                    <div className="mt-7">
                        <div className="max-w-2xl">
                            <p className="text-lg font-medium text-white">
                                {timing.ready
                                    ? "This conversation is worth continuing."
                                    : "We’re watching the timing for you."}
                            </p>
                            <p className="mt-2 leading-7 text-gray-400">
                                {timing.ready
                                    ? `Your first message to ${recruiterName} has had enough room to breathe, while your application is still recent.`
                                    : `Your first email is still recent. Waiting a little longer will make the follow-up feel considered rather than automatic.`}
                            </p>
                        </div>

                        {enabled ? (
                            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                <Button
                                    onClick={() => run(() => generateFollowUp(campaign.id))}
                                    disabled={pending || campaign.follow_up?.status === "generating"}
                                    icon={pending || campaign.follow_up?.status === "generating"
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Sparkles className="h-4 w-4" />}
                                >
                                    {pending || campaign.follow_up?.status === "generating"
                                        ? "Writing your follow-up…"
                                        : "Generate my follow-up"}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => run(() => setFollowUpDisposition(campaign.id, "remind_tomorrow"))}
                                    disabled={pending}
                                    icon={<Bell className="h-4 w-4" />}
                                >
                                    Remind me tomorrow
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => run(() => setFollowUpDisposition(campaign.id, "replied"))}
                                    disabled={pending}
                                >
                                    I received a reply
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => run(() => setFollowUpDisposition(campaign.id, "dismissed"))}
                                    disabled={pending}
                                >
                                    Don’t follow up
                                </Button>
                            </div>
                        ) : (
                            <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] p-5">
                                <p className="font-medium text-white">Personalized follow-ups are available with Pro and Ultra.</p>
                                <p className="mt-1 text-sm leading-6 text-gray-400">
                                    Upgrade to continue recruiter conversations with timing guidance and one included follow-up per application.
                                </p>
                                <Button asChild className="mt-4" size="sm">
                                    <a href="/dashboard/plan-and-credits#plans">Explore plans <ArrowUpRight className="ml-2 h-4 w-4" /></a>
                                </Button>
                            </div>
                        )}

                        {enabled && (
                            <p className="mt-4 text-xs text-gray-500">
                                One personalized follow-up is included. Nothing is generated until you request it.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-6">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-300">
                                        {sent ? "Sent follow-up" : "Your follow-up"}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">Version {current.version || 1}</p>
                                </div>
                                {!sent && (
                                    <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)} icon={<Pencil className="h-3.5 w-3.5" />}>
                                        {editing ? "Done editing" : "Edit"}
                                    </Button>
                                )}
                            </div>

                            <label className="text-xs text-gray-500">Subject</label>
                            {editing ? (
                                <Input className="mt-2" value={subject} onChange={(event) => setSubject(event.target.value)} />
                            ) : (
                                <p className="mt-2 font-medium text-white">{subject}</p>
                            )}

                            <div className="my-5 h-px bg-white/10" />
                            {editing ? (
                                <Textarea className="min-h-52 leading-7" value={body} onChange={(event) => setBody(event.target.value)} />
                            ) : (
                                <p className="whitespace-pre-wrap leading-7 text-gray-200">{body}</p>
                            )}

                            {editing && (
                                <div className="mt-4 flex justify-end">
                                    <Button
                                        size="sm"
                                        disabled={pending}
                                        onClick={() => run(() => saveFollowUpDraft(campaign.id, subject, body), () => setEditing(false))}
                                        icon={pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    >
                                        Save changes
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            {current.strategy && (
                                <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.06] p-4">
                                    <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
                                        <MessageCircleReply className="h-4 w-4" />
                                        Why this message
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-gray-400">{current.strategy}</p>
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Button variant="secondary" size="sm" onClick={copyMessage} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
                                    {copied ? "Copied" : "Copy message"}
                                </Button>
                                <Button asChild size="sm">
                                    <a href={mailto}>Open in email <Mail className="ml-2 h-4 w-4" /></a>
                                </Button>
                                {!sent && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={pending}
                                        onClick={() => run(() => markFollowUpSent(campaign.id, subject, body))}
                                        icon={<Send className="h-4 w-4" />}
                                    >
                                        Mark as sent
                                    </Button>
                                )}
                            </div>

                            {!sent && renderPaidAction && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setRegenerateOpen(true)}
                                        className="w-full rounded-xl px-3 py-2 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
                                    >
                                        Generate a different version · 50 credits
                                    </button>
                                    <p className="text-center text-xs text-gray-600">Your current version will remain available.</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
                        <X className="mt-0.5 h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}
            </div>

            {renderPaidAction && <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Shape the next version</DialogTitle>
                        <DialogDescription>
                            Tell CandidAI what to change or include. The current version remains available.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={instructions}
                        onChange={(event) => setInstructions(event.target.value)}
                        placeholder="For example: make it shorter and mention that I’ll be in Berlin next week."
                        className="min-h-32"
                    />
                    <div className="flex flex-wrap gap-2">
                        {["Make it shorter", "Sound more confident", "Add a clearer reason to reply"].map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => setInstructions(suggestion)}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition hover:border-violet-400/30 hover:text-white"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        {renderPaidAction(
                            <Button icon={<Sparkles className="h-4 w-4" />}>Continue · 50 credits</Button>,
                            () => generateFollowUp(campaign.id, instructions),
                            refresh,
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>}
        </Card>
    );
}
