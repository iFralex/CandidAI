"use client";

/**
 * Micro-survey shown right after a high-intent positive action (currently:
 * email_send from the dashboard). 5-emoji rating + optional comment.
 *
 * Idempotency: per-user (localStorage flag). Shown at most ONCE per device.
 * The Firestore `feedback` collection accumulates responses for the
 * /analytics "Voice of customer" panel.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "_ca_feedback_shown";

const SCORES: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
    { value: 1, emoji: "😡", label: "Hated it" },
    { value: 2, emoji: "😐", label: "Meh" },
    { value: 3, emoji: "🙂", label: "OK" },
    { value: 4, emoji: "😊", label: "Good" },
    { value: 5, emoji: "🤩", label: "Loved it" },
];

interface FeedbackPromptProps {
    /** Toggle from parent (e.g. set true after a successful email_send). */
    show: boolean;
    /** Where the prompt was triggered from — recorded with the response. */
    source: string;
    /** Called after submit OR dismiss. Parent should set `show=false`. */
    onClose: () => void;
    /** Skip the idempotency check (debug only). */
    force?: boolean;
}

export function FeedbackPrompt({ show, source, onClose, force }: FeedbackPromptProps) {
    const [score, setScore] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [open, setOpen] = useState(false);

    // Gated open: only open if not yet shown to this user on this device
    useEffect(() => {
        if (!show) { setOpen(false); return; }
        if (!force && typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) {
            onClose();
            return;
        }
        // Tiny delay so we don't overlap with the celebratory state of email-sent
        const t = setTimeout(() => {
            setOpen(true);
            track({ name: "nps_prompt_shown", params: { source } });
        }, 1500);
        return () => clearTimeout(t);
    }, [show, source, onClose, force]);

    const handleSubmit = async () => {
        if (!score) return;
        setSubmitting(true);
        try {
            const [{ db, auth }, { collection, addDoc, serverTimestamp }] = await Promise.all([
                import("@/lib/firebase"),
                import("firebase/firestore"),
            ]);
            if (db) {
                await addDoc(collection(db, "feedback"), {
                    score,
                    comment: comment.trim() || null,
                    source,
                    user_id: auth?.currentUser?.uid ?? null,
                    user_agent: navigator.userAgent.slice(0, 200),
                    page_path: window.location.pathname,
                    timestamp: serverTimestamp(),
                });
            }
        } catch { /* Firestore write failed — still mark as shown so we don't nag */ }
        track({ name: "nps_response", params: { source, score, has_comment: comment.trim().length > 0 } });
        try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch { /* ignore */ }
        setSubmitted(true);
        setSubmitting(false);
        setTimeout(() => { setOpen(false); onClose(); }, 1500);
    };

    const handleDismiss = (openState: boolean) => {
        if (openState) return;
        if (!submitted) {
            track({ name: "nps_prompt_dismissed", params: { source } });
            try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch { /* ignore */ }
        }
        setOpen(false);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleDismiss}>
            <DialogContent className="sm:max-w-md">
                {submitted ? (
                    <div className="py-6 text-center">
                        <div className="text-4xl mb-2">🙏</div>
                        <DialogTitle>Thank you!</DialogTitle>
                        <DialogDescription className="mt-1">
                            Your feedback helps us improve CandidAI for everyone.
                        </DialogDescription>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>How was that?</DialogTitle>
                            <DialogDescription>
                                Help us improve — takes 5 seconds.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex justify-between gap-2 py-4">
                            {SCORES.map((s) => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setScore(s.value)}
                                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg transition ${
                                        score === s.value
                                            ? "bg-violet-500/20 ring-2 ring-violet-400"
                                            : "hover:bg-white/5"
                                    }`}
                                >
                                    <span className="text-2xl">{s.emoji}</span>
                                    <span className="text-[10px] text-white/60">{s.label}</span>
                                </button>
                            ))}
                        </div>

                        {score !== null && (
                            <Textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                                placeholder={
                                    score <= 2
                                        ? "What went wrong? (optional, but very helpful)"
                                        : "Anything else you want to share? (optional)"
                                }
                                rows={3}
                                className="resize-none"
                            />
                        )}

                        <div className="flex justify-end gap-2 mt-2">
                            <Button variant="ghost" onClick={() => handleDismiss(false)} disabled={submitting}>
                                Not now
                            </Button>
                            <Button onClick={handleSubmit} disabled={!score || submitting}>
                                {submitting ? "Sending..." : "Send feedback"}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
