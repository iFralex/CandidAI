"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { checkAuth } from "@/actions/onboarding-actions";
import { creditsInfo, plansData } from "@/config";
import { adminDb } from "@/lib/firebase-admin";

const FOLLOW_UP_COST = creditsInfo["follow-up"].cost;

function followUpEndpoint() {
    const configured = process.env.REALTIME_SERVER_URL || process.env.SERVER_RUNNER_URL || "";
    const base = configured.replace(
        /\/(start_emails_generation|start_onboarding_recruiter|start_onboarding_email|start_onboarding_profile)\/?$/,
        "",
    );
    return `${base}/generate_follow_up`;
}

function refs(userId: string, companyId: string) {
    const userRef = adminDb.collection("users").doc(userId);
    const dataRef = userRef.collection("data");
    const resultRef = dataRef.doc("results");
    const campaignRef = resultRef.collection(companyId);

    return {
        userRef,
        accountRef: dataRef.doc("account"),
        resultRef,
        detailsRef: campaignRef.doc("details"),
        followUpRef: campaignRef.doc("follow_up"),
    };
}

function isSent(timestamp: any) {
    if (!timestamp) return false;
    if (typeof timestamp.toMillis === "function") return timestamp.toMillis() > 0;
    return Number(timestamp._seconds ?? timestamp.seconds ?? 0) > 0;
}

function revalidateFollowUps(companyId: string) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/follow-ups");
    revalidatePath("/dashboard/sent-emails");
    revalidatePath(`/dashboard/${companyId}`);
}

export async function generateFollowUp(companyId: string, instructions = "") {
    const userId = await checkAuth();
    const requestId = randomUUID();
    const { userRef, accountRef, resultRef, detailsRef, followUpRef } = refs(userId, companyId);
    let chargedCredits = 0;

    try {
        const context = await adminDb.runTransaction(async (transaction) => {
            const [userSnap, accountSnap, resultSnap, detailsSnap, followUpSnap] = await Promise.all([
                transaction.get(userRef),
                transaction.get(accountRef),
                transaction.get(resultRef),
                transaction.get(detailsRef),
                transaction.get(followUpRef),
            ]);

            if (!userSnap.exists || !detailsSnap.exists) {
                throw new Error("Application not found");
            }

            const user = userSnap.data() || {};
            const plan = user.plan as keyof typeof plansData;
            if (!plansData[plan]?.followUpAutomation) {
                throw new Error("Follow-ups are available on Pro and Ultra plans");
            }

            const result = resultSnap.data()?.[companyId] || {};
            const details = detailsSnap.data() || {};
            const followUp = followUpSnap.data() || {};

            if (!isSent(result.email_sent ?? details.email?.email_sent)) {
                throw new Error("Send the original email before creating a follow-up");
            }
            if (isSent(followUp.current?.sent_at)) {
                throw new Error("This follow-up has already been sent");
            }
            if (followUp.status === "generating") {
                throw new Error("A follow-up is already being generated");
            }

            const isRegeneration = Boolean(followUp.current || Number(followUp.generation_count || 0) > 0);
            chargedCredits = isRegeneration ? FOLLOW_UP_COST : 0;
            const currentCredits = Number(user.credits || 0);
            if (currentCredits < chargedCredits) {
                throw new Error("Insufficient credits");
            }

            if (chargedCredits > 0) {
                transaction.update(userRef, { credits: currentCredits - chargedCredits });
            }
            transaction.set(
                followUpRef,
                {
                    status: "generating",
                    request_id: requestId,
                    generation_started_at: FieldValue.serverTimestamp(),
                    last_error: FieldValue.delete(),
                },
                { merge: true },
            );

            return {
                company: details.company || result.company || {},
                recruiter: details.recruiter_summary || result.recruiter || {},
                original_email: details.email || {},
                candidate: {
                    profile: accountSnap.data()?.profileSummary || {},
                    target_position: accountSnap.data()?.target_position_description || "",
                },
            };
        });

        const response = await fetch(followUpEndpoint(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": process.env.SESSION_API_KEY ?? "",
            },
            body: JSON.stringify({ context, instructions: instructions.trim() || null }),
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error(`Follow-up generator failed (${response.status})`);
        }
        const payload = await response.json();
        if (!payload.success || !payload.follow_up?.subject || !payload.follow_up?.body) {
            throw new Error("The follow-up generator returned an incomplete response");
        }

        const generated = payload.follow_up;
        await adminDb.runTransaction(async (transaction) => {
            const followUpSnap = await transaction.get(followUpRef);
            const existing = followUpSnap.data() || {};
            if (existing.request_id !== requestId) {
                throw new Error("This generation was superseded by another request");
            }

            const previous = existing.current
                ? {
                    ...existing.current,
                    archived_at: new Date().toISOString(),
                }
                : null;
            const versions = Array.isArray(existing.versions) ? [...existing.versions] : [];
            if (previous) versions.unshift(previous);

            const current = {
                subject: String(generated.subject),
                body: String(generated.body),
                strategy: String(generated.strategy || ""),
                key_points: Array.isArray(generated.key_points) ? generated.key_points.slice(0, 3) : [],
                instructions: instructions.trim() || null,
                generated_at: Timestamp.now(),
                sent_at: null,
                version: Number(existing.generation_count || 0) + 1,
            };

            transaction.set(
                followUpRef,
                {
                    status: "draft",
                    current,
                    versions,
                    generation_count: current.version,
                    request_id: FieldValue.delete(),
                    generation_started_at: FieldValue.delete(),
                    last_error: FieldValue.delete(),
                    updated_at: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            transaction.update(resultRef, {
                [`${companyId}.follow_up`]: {
                    status: "draft",
                    subject: current.subject,
                    generated_at: current.generated_at,
                    sent_at: null,
                },
            });
        });

        revalidateFollowUps(companyId);
        return { success: true };
    } catch (error: any) {
        const message = error instanceof Error ? error.message : "Follow-up generation failed";

        // Refund only the request that actually reserved the credits.
        try {
            await adminDb.runTransaction(async (transaction) => {
                const followUpSnap = await transaction.get(followUpRef);
                if (followUpSnap.data()?.request_id !== requestId) return;
                if (chargedCredits > 0) {
                    transaction.update(userRef, { credits: FieldValue.increment(chargedCredits) });
                }
                transaction.set(
                    followUpRef,
                    {
                        status: "failed",
                        request_id: FieldValue.delete(),
                        generation_started_at: FieldValue.delete(),
                        last_error: message,
                        updated_at: FieldValue.serverTimestamp(),
                    },
                    { merge: true },
                );
            });
        } catch (refundError) {
            console.error("Could not finalize failed follow-up generation:", refundError);
        }

        return { success: false, error: message };
    }
}

export async function saveFollowUpDraft(companyId: string, subject: string, body: string) {
    const userId = await checkAuth();
    const { resultRef, followUpRef } = refs(userId, companyId);
    const cleanSubject = subject.trim();
    const cleanBody = body.trim();
    if (!cleanSubject || !cleanBody) return { success: false, error: "Subject and message are required" };

    await adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(followUpRef);
        const followUp = snap.data() || {};
        if (!followUp.current) throw new Error("Follow-up not found");
        if (isSent(followUp.current.sent_at)) throw new Error("A sent follow-up cannot be edited");

        transaction.update(followUpRef, {
            "current.subject": cleanSubject,
            "current.body": cleanBody,
            updated_at: FieldValue.serverTimestamp(),
        });
        transaction.update(resultRef, { [`${companyId}.follow_up.subject`]: cleanSubject });
    });

    revalidateFollowUps(companyId);
    return { success: true };
}

export async function markFollowUpSent(companyId: string, subject: string, body: string) {
    const userId = await checkAuth();
    const { resultRef, followUpRef } = refs(userId, companyId);
    const cleanSubject = subject.trim();
    const cleanBody = body.trim();
    if (!cleanSubject || !cleanBody) return { success: false, error: "Subject and message are required" };

    await adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(followUpRef);
        const followUp = snap.data() || {};
        if (!followUp.current) throw new Error("Follow-up not found");
        if (isSent(followUp.current.sent_at)) return;

        const sentAt = Timestamp.now();
        transaction.update(followUpRef, {
            "current.subject": cleanSubject,
            "current.body": cleanBody,
            "current.sent_at": sentAt,
            status: "sent",
            updated_at: FieldValue.serverTimestamp(),
        });
        transaction.update(resultRef, {
            [`${companyId}.follow_up`]: {
                status: "sent",
                subject: cleanSubject,
                generated_at: followUp.current.generated_at || null,
                sent_at: sentAt,
            },
        });
    });

    revalidateFollowUps(companyId);
    return { success: true };
}

export async function setFollowUpDisposition(
    companyId: string,
    disposition: "remind_tomorrow" | "replied" | "dismissed",
) {
    const userId = await checkAuth();
    const { resultRef, followUpRef } = refs(userId, companyId);
    const reminderAt = disposition === "remind_tomorrow"
        ? Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000)
        : null;

    const state = {
        disposition,
        reminder_at: reminderAt,
        updated_at: FieldValue.serverTimestamp(),
    };
    const batch = adminDb.batch();
    batch.set(followUpRef, state, { merge: true });
    batch.update(resultRef, {
        [`${companyId}.follow_up_disposition`]: disposition,
        [`${companyId}.follow_up_reminder_at`]: reminderAt,
    });
    await batch.commit();

    revalidateFollowUps(companyId);
    return { success: true };
}
