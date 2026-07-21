'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { adminStorage, adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { clientConfig, creditsInfo, plansData, plansInfo, serverConfig } from '@/config';
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { getTestMock } from '@/app/api/test/set-mock/route'
import { buildDefaultRecruiterStrategies } from '@/lib/recruiter-strategies'
import { recordOnboardingSignal, recordOnboardingTransition } from '@/lib/onboarding-lifecycle'
import { cancelPendingOnboardingCommunications, completeCommunication, failCommunication, reserveCommunication } from '@/lib/communication-service'
import { wrapEmail, button, heading, paragraph } from '@/lib/email-template'
import { buildVerifyUrl } from '@/lib/verify-token'

// Prepara un'email per l'archivio: rimuove campi privati/transitori e aggiunge archived_at
function toEmailArchive(email: Record<string, any>) {
    const { prompt: _p, email_sent: _s, ...rest } = email;
    return { ...rest, archived_at: new Date().toISOString() };
}

export async function deleteProfile() {
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testCookie = cookieStore.get('__playwright_user__')?.value;
        if (testCookie) {
            revalidatePath('/dashboard');
            return;
        }
    }

    const userId = await checkAuth();

    const userRef = adminDb.collection("users").doc(userId);
    const accountRef = adminDb.collection("users").doc(userId).collection("data").doc("account");

    const batch = adminDb.batch();
    batch.set(accountRef, {
        profileSummary: FieldValue.delete(),
        cvUrl: FieldValue.delete(),
        queries: FieldValue.delete(),
        customizations: FieldValue.delete(),
    }, { merge: true });
    // Reset the resumable stage too, so a refresh after "Start Over" returns to the
    // initial upload screen instead of an empty review screen.
    batch.update(userRef, { onboardingStep: 3, maxOnboardingStep: 3, onboardingStage: "profile_source" });

    await batch.commit();
    revalidatePath('/dashboard');
}

export async function goBackStep(currentStep: number, plan: string) {
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testCookie = cookieStore.get('__playwright_user__')?.value;
        if (testCookie) {
            try {
                const userData = JSON.parse(Buffer.from(testCookie, 'base64').toString('utf-8'));
                const maxStep = Math.max(currentStep, userData.maxOnboardingStep || currentStep);
                let prevStep = currentStep - 1;
                if (prevStep >= 1) {
                    userData.onboardingStep = prevStep;
                    userData.maxOnboardingStep = maxStep;
                    cookieStore.set('__playwright_user__', Buffer.from(JSON.stringify(userData)).toString('base64'), { path: '/' });
                }
            } catch (e) { /* fall through */ }
            revalidatePath('/dashboard');
            return;
        }
    }

    const userId = await checkAuth();
    let prevStep = currentStep - 1;
    if (prevStep < 1) return;

    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const existingMax = userSnap.data()?.maxOnboardingStep || currentStep;
    const maxOnboardingStep = Math.max(currentStep, existingMax);

    await userRef.update({ onboardingStep: prevStep, maxOnboardingStep });
    revalidatePath('/dashboard');
}

export async function jumpToStep(targetStep: number) {
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testCookie = cookieStore.get('__playwright_user__')?.value;
        if (testCookie) {
            try {
                const userData = JSON.parse(Buffer.from(testCookie, 'base64').toString('utf-8'));
                userData.onboardingStep = targetStep;
                cookieStore.set('__playwright_user__', Buffer.from(JSON.stringify(userData)).toString('base64'), { path: '/' });
            } catch (e) { /* fall through */ }
            revalidatePath('/dashboard');
            return;
        }
    }

    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const maxOnboardingStep = userSnap.data()?.maxOnboardingStep || targetStep;
    await userRef.update({ onboardingStep: targetStep, maxOnboardingStep });
    revalidatePath('/dashboard');
}

export async function startServer(userId: string | null = null, options: { throwOnError?: boolean } = {}) {
    if (!userId)
        userId = await checkAuth()

    const res = await fetch(process.env.SERVER_RUNNER_URL || "", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.SESSION_API_KEY ?? "",
        },
        body: JSON.stringify({ user_id: userId })
    })
    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const error = new Error(`Server runner failed: ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ""}`)
        if (options.throwOnError) throw error
        console.error(error.message)
        return false
    }
    return true
}

function realtimeServerEndpoint(path: "start_onboarding_recruiter" | "start_onboarding_email") {
    const configured = process.env.REALTIME_SERVER_URL || process.env.SERVER_RUNNER_URL || "";
    const base = configured.replace(/\/(start_emails_generation|start_onboarding_recruiter|start_onboarding_email)\/?$/, "");
    return `${base}/${path}`;
}

async function startRealtimeServer(path: "start_onboarding_recruiter" | "start_onboarding_email", userId: string, jobId: string) {
    const response = await fetch(realtimeServerEndpoint(path), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.SESSION_API_KEY ?? "",
        },
        body: JSON.stringify({ user_id: userId, job_id: jobId }),
    });
    if (!response.ok) {
        throw new Error(`Realtime server failed: ${response.status}`);
    }
}

export async function selectPlan(planId: string) {
    // Test bypass for non-production environments
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testCookie = cookieStore.get('__playwright_user__')?.value;
        if (testCookie) {
            try {
                const userData = JSON.parse(Buffer.from(testCookie, 'base64').toString('utf-8'));
                const planChanged = userData.plan !== planId;
                const maxOnboardingStep = planChanged ? 2 : Math.max(2, userData.maxOnboardingStep || 2);
                userData.onboardingStep = maxOnboardingStep;
                userData.plan = planId;
                userData.maxOnboardingStep = maxOnboardingStep;
                cookieStore.set('__playwright_user__', Buffer.from(JSON.stringify(userData)).toString('base64'), { path: '/' });
            } catch (e) { /* fall through */ }
            revalidatePath('/dashboard');
            return;
        }
    }

    // Validate the plan id — an unknown id used to crash on plansData[planId]
    // (uncaught 500). Reject it explicitly instead.
    if (!(planId in plansData)) {
        throw new Error("Invalid plan");
    }

    const userId = await checkAuth()

    const userRef = adminDb.collection("users").doc(userId)
    const userSnap = await userRef.get()
    const existingPlan = userSnap.data()?.plan
    const existingMax = userSnap.data()?.maxOnboardingStep || 2
    const planChanged = existingPlan && existingPlan !== planId

    const batch = adminDb.batch()

    // NOTE: do NOT grant credits here. `plan` is only the *selected* plan during
    // onboarding; entitlements (credits + plan features) are granted exclusively
    // after a successful payment (create-payment / payment-confirm / webhook).
    // Writing `credits: plansData[planId].credits` at selection time let a user
    // pick Pro/Ultra and receive 1000/2500 credits without ever paying.
    batch.update(userRef, {
        onboardingStep: 2,
        maxOnboardingStep: planChanged ? 2 : Math.max(2, existingMax),
        plan: planId,
    })

    if (planChanged) {
        const accountRef = adminDb.collection("users").doc(userId).collection("data").doc("account")
        batch.set(accountRef, {
            companies: FieldValue.delete(),
            profileSummary: FieldValue.delete(),
            cvUrl: FieldValue.delete(),
            queries: FieldValue.delete(),
            customizations: FieldValue.delete(),
        }, { merge: true })
    }

    await batch.commit()

    revalidatePath('/dashboard')
}

function isValidDomain(domain: string): boolean {
    if (!domain || !domain.trim()) return false;
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(domain);
}

export async function submitCompanies(companies: { name: string, domain: string }[]) {
    // Test bypass for non-production environments (must be before validation — LinkedIn URL format fails isValidDomain)
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testCookie = cookieStore.get('__playwright_user__')?.value;
        if (testCookie) {
            try {
                const userData = JSON.parse(Buffer.from(testCookie, 'base64').toString('utf-8'));
                userData.onboardingStep = 3;
                cookieStore.set('__playwright_user__', Buffer.from(JSON.stringify(userData)).toString('base64'), { path: '/' });
            } catch (e) { /* fall through */ }
            revalidatePath('/dashboard');
            return;
        }
    }

    // Input validation (before auth)
    for (const company of (companies || [])) {
        if (!company.name || !company.name.trim()) {
            return { success: false, error: "Company name cannot be empty" };
        }
        if (!isValidDomain(company.domain)) {
            return { success: false, error: `Invalid domain: ${company.domain}` };
        }
    }

    const domains = (companies || []).map(c => c.domain.toLowerCase());
    if (new Set(domains).size < domains.length) {
        return { success: false, error: "Duplicate companies found" };
    }

    const userId = await checkAuth()

    const userRef = adminDb.collection("users").doc(userId)
    const accountRef = adminDb.collection("users").doc(userId).collection("data").doc("account")

    // Enforce plan limits
    const [userSnap, accountSnap] = await Promise.all([userRef.get(), accountRef.get()])
    const plan: string = userSnap.data()?.plan || "free_trial"
    const maxCompanies: number = (plansData as any)[plan]?.maxCompanies ?? 1
    const existingMax: number = userSnap.data()?.maxOnboardingStep || 3

    if (companies.length > maxCompanies) {
        return { success: false, error: `Exceeds plan limit of ${maxCompanies} companies` }
    }

    const existingCompanies: any[] = accountSnap.data()?.companies || []
    const sortKey = (c: any) => c.domain || c.linkedin_url || c.name || ''
    const normalize = (arr: any[]) => JSON.stringify(
        [...arr].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    )
    const dataChanged = normalize(companies) !== normalize(existingCompanies)

    const accountData: Record<string, any> = { companies }
    if (dataChanged) {
        accountData.profileSummary = FieldValue.delete()
        accountData.cvUrl = FieldValue.delete()
        accountData.queries = FieldValue.delete()
        accountData.customizations = FieldValue.delete()
    }

    const batch = adminDb.batch()
    batch.set(accountRef, accountData, { merge: true })
    batch.update(userRef, {
        onboardingStep: 3,
        maxOnboardingStep: Math.max(3, existingMax),
    })

    await batch.commit()

    revalidatePath('/dashboard')
}

export async function submitPreviewCompany(company: { name: string; domain?: string; linkedin_url?: string }) {
    if (!company?.name?.trim()) return { success: false as const, error: "Company name cannot be empty" };
    if (!company.linkedin_url && (!company.domain || !isValidDomain(company.domain))) return { success: false as const, error: `Invalid domain: ${company.domain}` };

    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const accountRef = userRef.collection("data").doc("account");
    const previewRef = userRef.collection("data").doc("onboarding_preview");
    const [userSnap, accountSnap] = await Promise.all([userRef.get(), accountRef.get()]);

    if (userSnap.data()?.freePreviewConsumedAt) {
        return { success: false as const, error: "Your free candidacy has already been generated" };
    }
    if (!accountSnap.data()?.profileSummary) {
        return { success: false as const, error: "Complete your profile before choosing a company" };
    }

    const batch = adminDb.batch();
    batch.set(accountRef, { companies: [company] }, { merge: true });
    batch.set(previewRef, {
        status: "idle",
        stage: "target_company",
        company,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: false });
    batch.update(userRef, {
        onboardingStage: "target_company",
        onboardingStep: 3,
    });
    await batch.commit();
    await recordOnboardingTransition({ userId, from: userSnap.data()?.onboardingStage, to: "target_company", flow: "free_preview", step: 3, metadata: { company: company.name }, updateStage: false });
    revalidatePath("/dashboard");
    return { success: true as const };
}

export async function markProfileReviewReady(source: "cv" | "linkedin" | "cv_linkedin") {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    // The generated profile is already persisted (draft save) by the time we get here.
    // Advance the resumable stage to profile_review so a refresh returns to the review
    // screen with the profile loaded, instead of restarting the PDL + AI enrichment.
    await recordOnboardingTransition({ userId, from: userSnap.data()?.onboardingStage || "profile_source", to: "profile_review", flow: "free_preview", step: 2, reason: "profile_generated", metadata: { source } });
    return { success: true as const };
}

export async function startOnboardingRecruiterSearch() {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const accountRef = userRef.collection("data").doc("account");
    const previewRef = userRef.collection("data").doc("onboarding_preview");
    const candidateJobId = adminDb.collection("_onboarding_jobs").doc().id;
    const job = await adminDb.runTransaction(async tx => {
        const [userSnap, accountSnap, previewSnap] = await Promise.all([
            tx.get(userRef), tx.get(accountRef), tx.get(previewRef),
        ]);
        if (userSnap.data()?.freePreviewConsumedAt) throw new Error("Free candidacy already used");
        if (!accountSnap.data()?.profileSummary || accountSnap.data()?.companies?.length !== 1) {
            throw new Error("Profile and one target company are required");
        }
        const existing = previewSnap.data();
        if (existing?.jobId && ["queued", "running", "waiting_confirmation"].includes(existing.status)) {
            return { jobId: existing.jobId as string, resumed: true };
        }
        const profile = accountSnap.data()?.profileSummary;
        const queries = accountSnap.data()?.queries?.length
            ? accountSnap.data()?.queries
            : buildDefaultRecruiterStrategies(profile);
        tx.set(accountRef, { queries }, { merge: true });
        tx.set(previewRef, {
            jobId: candidateJobId,
            status: "queued",
            stage: "recruiter_search",
            queuedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.update(userRef, { onboardingStage: "recruiter_search", onboardingStep: 4 });
        return { jobId: candidateJobId, resumed: false };
    });
    if (job.resumed) return { success: true as const, jobId: job.jobId, resumed: true };

    try {
        await startRealtimeServer("start_onboarding_recruiter", userId, job.jobId);
    } catch (error) {
        await previewRef.set({
            status: "failed",
            error: { code: "queue_failed", message: String(error), recoverable: true },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        throw error;
    }
    await recordOnboardingTransition({ userId, from: "target_company", to: "recruiter_search", flow: "free_preview", step: 4, metadata: { job_id: job.jobId }, updateStage: false });
    await recordOnboardingSignal({ event: "onboarding_job_queued", userId, stage: "recruiter_search", params: { job_id: job.jobId, queue: "onboarding_realtime" } });
    revalidatePath("/dashboard");
    return { success: true as const, jobId: job.jobId, resumed: false };
}

export async function confirmRecruiterAndGenerateEmail(jobId: string) {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const previewRef = userRef.collection("data").doc("onboarding_preview");
    const transition = await adminDb.runTransaction(async tx => {
        const previewSnap = await tx.get(previewRef);
        const preview = previewSnap.data();
        if (!preview || preview.jobId !== jobId) throw new Error("Preview job does not match");
        if (preview.stage === "email_generation" || preview.stage === "preview_ready") return { enqueue: false };
        if (preview.stage !== "recruiter_found") throw new Error("The recruiter is not ready for confirmation");
        tx.set(previewRef, {
            status: "queued",
            stage: "email_generation",
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.update(userRef, { onboardingStage: "email_generation", onboardingStep: 5 });
        return { enqueue: true };
    });
    if (!transition.enqueue) return { success: true as const, resumed: true };

    try {
        await startRealtimeServer("start_onboarding_email", userId, jobId);
    } catch (error) {
        await previewRef.set({
            status: "failed",
            error: { code: "queue_failed", message: String(error), recoverable: true },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        throw error;
    }
    await recordOnboardingTransition({ userId, from: "recruiter_found", to: "email_generation", flow: "free_preview", step: 5, metadata: { job_id: jobId }, updateStage: false });
    revalidatePath("/dashboard");
    return { success: true as const, resumed: false };
}

export async function setOnboardingNotificationPreference(channel: "email" | "browser", enabled: boolean) {
    const userId = await checkAuth();
    await adminDb.collection("users").doc(userId).collection("data").doc("onboarding_preview").set({
        notifications: { [channel]: enabled },
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await recordOnboardingSignal({ event: "recruiter_search_notification_selected", userId, stage: "recruiter_search", params: { channel, enabled } });
    return { success: true as const };
}

export async function markOnboardingCheckoutOpened(planId: string) {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    await recordOnboardingTransition({ userId, from: userSnap.data()?.onboardingStage || "preview_ready", to: "checkout", flow: "free_preview", step: 5, reason: "checkout_opened", metadata: { plan: planId } });
    return { success: true as const };
}

export async function continueFreePreviewToDashboard() {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const previewSnap = await userRef.collection("data").doc("onboarding_preview").get();
    if (previewSnap.data()?.stage !== "preview_ready") throw new Error("The first candidacy is not ready");
    await recordOnboardingTransition({ userId, from: "preview_ready", to: "completed", flow: "free_preview", step: 50, reason: "continue_to_dashboard" });
    await cancelPendingOnboardingCommunications(userId, "onboarding_completed");
    revalidatePath("/dashboard");
    redirect("/dashboard");
}

export async function choosePostPurchasePreviewAction(choice: "regenerate" | "replace") {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const accountRef = userRef.collection("data").doc("account");
    const previewRef = userRef.collection("data").doc("onboarding_preview");
    const resultsRef = userRef.collection("data").doc("results");
    const emailsRef = userRef.collection("data").doc("emails");
    const [userSnap, accountSnap, previewSnap, resultsSnap] = await Promise.all([
        userRef.get(), accountRef.get(), previewRef.get(), resultsRef.get(),
    ]);
    const user = userSnap.data() || {};
    const preview = previewSnap.data() || {};
    if (!user.plan || user.plan === "free_trial") throw new Error("A paid plan is required");
    if (preview.stage !== "preview_ready" || !preview.resultId) throw new Error("The preview result is not available");

    const resultId = String(preview.resultId);
    const company = preview.company || accountSnap.data()?.companies?.[0];
    if (!company?.name) throw new Error("The preview company is not available");
    const resultData = resultsSnap.data()?.[resultId] || {};
    const detailsRef = resultsRef.collection(resultId).doc("details");
    const rowRef = resultsRef.collection(resultId).doc("row");
    const historyRef = resultsRef.collection(resultId).doc("email_history");
    const customizationsRef = resultsRef.collection(resultId).doc("customizations");
    const unlockedRef = resultsRef.collection(resultId).doc("unlocked");
    const detailsSnap = await detailsRef.get();
    const previewEmail = detailsSnap.data()?.email || preview.email;
    const batch = adminDb.batch();

    if (choice === "regenerate") {
        if (previewEmail?.body) {
            batch.set(historyRef, {
                versions: FieldValue.arrayUnion({
                    ...toEmailArchive(previewEmail),
                    source: "free_preview",
                    label: "Free preview",
                    included_recruiter_email: false,
                    included_company_research: false,
                }),
            }, { merge: true });
        }
        // Keep only the company slot. The paid pipeline must redo company research,
        // recruiter selection and email generation using the newly saved settings.
        batch.set(resultsRef, {
            [resultId]: {
                company,
                start_date: resultData.start_date || FieldValue.serverTimestamp(),
            },
        }, { merge: true });
        batch.delete(detailsRef);
        batch.delete(rowRef);
        batch.delete(customizationsRef);
        batch.delete(unlockedRef);
        batch.set(emailsRef, { [resultId]: FieldValue.delete() }, { merge: true });
        batch.set(accountRef, { companies: [company] }, { merge: true });
    } else {
        batch.set(resultsRef, { [resultId]: FieldValue.delete() }, { merge: true });
        batch.delete(detailsRef);
        batch.delete(rowRef);
        batch.delete(historyRef);
        batch.delete(customizationsRef);
        batch.delete(unlockedRef);
        batch.set(emailsRef, { [resultId]: FieldValue.delete() }, { merge: true });
        batch.set(accountRef, { companies: [] }, { merge: true });
        batch.delete(adminDb.collection("ids").doc(`${company.name}-${userId}`));
    }
    batch.set(previewRef, {
        postPurchaseChoice: choice,
        status: "completed",
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.update(userRef, { onboardingStage: "post_purchase_profile", onboardingStep: 7, postPurchaseReturnToReview: false });
    await batch.commit();
    await recordOnboardingTransition({ userId, from: user.onboardingStage || "post_purchase", to: "post_purchase_profile", flow: "post_purchase", step: 7, metadata: { preview_choice: choice }, updateStage: false });
    revalidatePath("/dashboard");
    return { success: true as const };
}

export async function savePostPurchaseCompanies(companies: { name: string; domain?: string; linkedin_url?: string }[]) {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const accountRef = userRef.collection("data").doc("account");
    const previewRef = userRef.collection("data").doc("onboarding_preview");
    const resultsRef = userRef.collection("data").doc("results");
    const [userSnap, previewSnap, resultsSnap] = await Promise.all([userRef.get(), previewRef.get(), resultsRef.get()]);
    const plan = String(userSnap.data()?.plan || "free_trial");
    const limit = Number(userSnap.data()?.maxCompanies ?? (plansData as any)[plan]?.maxCompanies ?? 1);
    if (!companies.length) throw new Error("Choose at least one target company");
    if (companies.length > limit) throw new Error(`Exceeds plan limit of ${limit} companies`);
    for (const company of companies) {
        if (!company.name?.trim()) throw new Error("Company name cannot be empty");
        if (!company.linkedin_url && (!company.domain || !isValidDomain(company.domain))) throw new Error(`Invalid domain: ${company.domain}`);
    }
    const identity = (company: any) => {
        const linkedin = String(company?.linkedin_url || company?.domain || "").match(/linkedin\.com\/company\/([^/?#]+)/i)?.[1];
        if (linkedin) return `linkedin:${linkedin.toLowerCase()}`;
        const domain = String(company?.domain || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
        return domain ? `domain:${domain}` : `name:${String(company?.name || "").trim().toLowerCase()}`;
    };
    const companyKeys = companies.map(identity);
    if (new Set(companyKeys).size !== companyKeys.length) throw new Error("Duplicate companies found");
    const returnToReview = Boolean(userSnap.data()?.postPurchaseReturnToReview);
    const nextStage = returnToReview ? "post_purchase_review" : plan === "pro" || plan === "ultra" ? "post_purchase_filters" : "post_purchase_instructions";
    const batch = adminDb.batch();
    const preview = previewSnap.data() || {};
    const originalCompany = preview.company;
    const resultId = preview.resultId ? String(preview.resultId) : "";
    // Removing the company that was preserved on the previous screen is an
    // explicit change of mind: clean its result and archived preview too.
    if (preview.postPurchaseChoice === "regenerate" && resultId && originalCompany && !companyKeys.includes(identity(originalCompany))) {
        batch.set(resultsRef, { [resultId]: FieldValue.delete() }, { merge: true });
        batch.delete(resultsRef.collection(resultId).doc("details"));
        batch.delete(resultsRef.collection(resultId).doc("row"));
        batch.delete(resultsRef.collection(resultId).doc("email_history"));
        batch.delete(resultsRef.collection(resultId).doc("customizations"));
        batch.delete(resultsRef.collection(resultId).doc("unlocked"));
        batch.set(userRef.collection("data").doc("emails"), { [resultId]: FieldValue.delete() }, { merge: true });
        batch.delete(adminDb.collection("ids").doc(`${originalCompany.name}-${userId}`));
        batch.set(previewRef, { postPurchaseChoice: "replace", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    batch.set(accountRef, { companies }, { merge: true });

    // Preserve the established pipeline contract: Base and Pro entries already
    // exist in results before Python starts, so they are generated immediately.
    // Ultra deliberately leaves new entries absent because its company research
    // must be reviewed and confirmed first.
    if (!(plansData as any)[plan]?.companyConfirmationCalls) {
        const results = resultsSnap.data() || {};
        const idRefs = companies.map(company => adminDb.collection("ids").doc(`${company.name}-${userId}`));
        const idSnaps = await Promise.all(idRefs.map(ref => ref.get()));
        const resultUpdates: Record<string, any> = {};

        companies.forEach((company, index) => {
            const mappedId = idSnaps[index].exists ? String(idSnaps[index].data()?.id || "") : "";
            const resultId = mappedId || adminDb.collection("_generated_ids").doc().id;
            if (!results[resultId]) {
                resultUpdates[resultId] = { company, start_date: Timestamp.now() };
            }
            if (!mappedId) {
                batch.set(idRefs[index], { id: resultId }, { merge: true });
            }
        });

        if (Object.keys(resultUpdates).length) {
            batch.set(resultsRef, resultUpdates, { merge: true });
        }
    }
    batch.update(userRef, { onboardingStage: nextStage, onboardingStep: 8, postPurchaseReturnToReview: false });
    await batch.commit();
    await recordOnboardingTransition({ userId, from: userSnap.data()?.onboardingStage || "post_purchase_profile", to: nextStage, flow: "post_purchase", step: 8, metadata: { company_count: companies.length }, updateStage: false });
    revalidatePath("/dashboard");
    return { success: true as const };
}

export async function savePostPurchaseFilters(queries: any[]) {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const plan = String(userSnap.data()?.plan || "free_trial");
    if (plan !== "pro" && plan !== "ultra") throw new Error("Custom recruiter filters require Pro or Ultra");
    const max = plan === "ultra" ? 50 : 30;
    if (!Array.isArray(queries) || queries.length > max) throw new Error(`You can save up to ${max} recruiter strategies`);
    const batch = adminDb.batch();
    batch.set(userRef.collection("data").doc("account"), { queries }, { merge: true });
    batch.update(userRef, {
        onboardingStage: userSnap.data()?.postPurchaseReturnToReview ? "post_purchase_review" : "post_purchase_instructions",
        onboardingStep: 9,
        postPurchaseReturnToReview: false,
    });
    await batch.commit();
    await recordOnboardingTransition({ userId, from: userSnap.data()?.onboardingStage || "post_purchase_companies", to: userSnap.data()?.postPurchaseReturnToReview ? "post_purchase_review" : "post_purchase_instructions", flow: "post_purchase", step: 9, metadata: { strategy_count: queries.length }, updateStage: false });
    revalidatePath("/dashboard");
    return { success: true as const };
}

export async function savePostPurchaseInstructions(customizations: { position_description?: string; instructions?: string }) {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const plan = String(userSnap.data()?.plan || "free_trial");
    const safe = {
        position_description: String(customizations.position_description || "").trim(),
        instructions: plan === "pro" || plan === "ultra" ? String(customizations.instructions || "").trim() : "",
    };
    if (!safe.position_description) throw new Error("Describe the position you want to pursue");
    const batch = adminDb.batch();
    batch.set(userRef.collection("data").doc("account"), { customizations: safe }, { merge: true });
    // Keep this below 10 so /dashboard continues rendering the onboarding shell
    // until the user explicitly launches the campaign.
    batch.update(userRef, { onboardingStage: "post_purchase_review", onboardingStep: 9, postPurchaseReturnToReview: false });
    await batch.commit();
    await recordOnboardingTransition({ userId, from: userSnap.data()?.onboardingStage || "post_purchase_instructions", to: "post_purchase_review", flow: "post_purchase", step: 9, metadata: { has_custom_instructions: Boolean(safe.instructions) }, updateStage: false });
    revalidatePath("/dashboard");
    return { success: true as const };
}

const postPurchaseSetupStages = new Set([
    "post_purchase",
    "post_purchase_profile",
    "post_purchase_companies",
    "post_purchase_filters",
    "post_purchase_instructions",
    "post_purchase_review",
]);

export async function navigatePostPurchaseStage(stage: string, returnToReview = false) {
    const userId = await checkAuth();
    if (!postPurchaseSetupStages.has(stage)) throw new Error("Invalid campaign setup stage");
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.data()?.plan || userSnap.data()?.plan === "free_trial") throw new Error("A paid plan is required");
    await userRef.update({ onboardingStage: stage, onboardingStep: 9, postPurchaseReturnToReview: returnToReview });
    await recordOnboardingTransition({ userId, from: userSnap.data()?.onboardingStage, to: stage as any, flow: "post_purchase", step: 9, reason: "navigation", updateStage: false });
    revalidatePath("/dashboard");
    return { success: true as const };
}

export async function savePostPurchaseProfile(plan: string, profileData: any, cv?: File | null, rebuildStrategies = true) {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const accountRef = userRef.collection("data").doc("account");
    const [userSnap, accountSnap] = await Promise.all([userRef.get(), accountRef.get()]);
    const storedPlan = String(userSnap.data()?.plan || "free_trial");
    if (storedPlan === "free_trial" || storedPlan !== plan) throw new Error("A paid plan is required");
    if (!profileData?.profileSummary) throw new Error("Complete your candidate profile before continuing");

    const result = await submitProfile(
        storedPlan,
        { ...profileData, cvUrl: accountSnap.data()?.cvUrl || undefined },
        cv,
        true,
    );
    if (result && "success" in result && !result.success) throw new Error(result.error || "Could not save the profile");

    if (rebuildStrategies) {
        await accountRef.set({ queries: buildDefaultRecruiterStrategies(profileData.profileSummary) }, { merge: true });
    }
    await userRef.update({
        onboardingStage: userSnap.data()?.postPurchaseReturnToReview ? "post_purchase_review" : "post_purchase_companies",
        onboardingStep: 7,
        postPurchaseReturnToReview: false,
    });
    await recordOnboardingTransition({ userId, from: userSnap.data()?.onboardingStage || "post_purchase", to: userSnap.data()?.postPurchaseReturnToReview ? "post_purchase_review" : "post_purchase_companies", flow: "post_purchase", step: 7, metadata: { strategies_rebuilt: rebuildStrategies }, updateStage: false });
    revalidatePath("/dashboard");
    return { success: true as const };
}

export async function launchPostPurchaseCampaign() {
    const userId = await checkAuth();
    const userRef = adminDb.collection("users").doc(userId);
    const [userSnap, accountSnap] = await Promise.all([userRef.get(), userRef.collection("data").doc("account").get()]);
    const user = userSnap.data() || {};
    const account = accountSnap.data() || {};
    if (!user.plan || user.plan === "free_trial") throw new Error("A paid plan is required");
    if (!account.companies?.length || !account.customizations?.position_description) throw new Error("Complete your campaign setup before launching");
    // Do not mark onboarding complete until the worker has accepted the job.
    // Otherwise a transient runner/auth failure strands the account in a
    // completed state with no campaign running.
    await startServer(userId, { throwOnError: true });
    await userRef.update({ activated_at: user.activated_at || FieldValue.serverTimestamp() });
    await recordOnboardingTransition({ userId, from: user.onboardingStage || "post_purchase_review", to: "completed", flow: "post_purchase", step: 50, reason: "campaign_launched", metadata: { plan: user.plan, company_count: account.companies.length } });
    await recordOnboardingSignal({ event: "campaign_launched", userId, stage: "completed", params: { plan: user.plan, company_count: account.companies.length } });
    await recordOnboardingSignal({ event: "onboarding_complete", userId, stage: "completed", params: { plan: user.plan, flow: "post_purchase" } });
    await cancelPendingOnboardingCommunications(userId, "campaign_launched");
    try {
        await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.SESSION_API_KEY ?? "" },
            body: JSON.stringify({
                userId,
                type: "onboarding-complete",
                dedupeKey: `campaign-launched:${user.plan}`,
                category: "operational",
                data: { plan: user.plan, companies: account.companies.map((company: any) => company.name).filter(Boolean) },
            }),
        });
    } catch (error) {
        console.error("Failed to send campaign launch email:", error);
    }
    revalidatePath("/dashboard");
    redirect("/dashboard");
}

const ALLOWED_CV_TYPES = ["application/pdf"];
const MAX_CV_SIZE = 5 * 1024 * 1024; // 5 MB

export async function submitProfile(
    plan: string,
    profileData: any,
    cv?: File | null,
    skipOnboardingStep?: boolean,
    flow: "legacy" | "guided" = "legacy"
) {
    // Test bypass for non-production environments
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testCookie = cookieStore.get('__playwright_user__')?.value;
        if (testCookie) {
            if (!skipOnboardingStep) {
                try {
                    const userData = JSON.parse(Buffer.from(testCookie, 'base64').toString('utf-8'));
                    userData.onboardingStep = flow === "guided" ? 3 : 4;
                    if (flow === "guided") userData.onboardingStage = "target_company";
                    cookieStore.set('__playwright_user__', Buffer.from(JSON.stringify(userData)).toString('base64'), { path: '/' });
                } catch (e) { /* fall through */ }
            }
            revalidatePath('/dashboard');
            return;
        }
    }

    // Validate CV file if provided
    if (cv) {
        const isValidType =
            ALLOWED_CV_TYPES.includes(cv.type) &&
            cv.name.toLowerCase().endsWith(".pdf");
        if (!isValidType) {
            return { success: false, error: "Invalid file type" };
        }
        if (cv.size > MAX_CV_SIZE) {
            return { success: false, error: "File too large" };
        }
    }

    // For initial onboarding (not profile updates): CV or existing cvUrl is required
    if (!skipOnboardingStep) {
        if (flow === "legacy" && !cv && !profileData?.cvUrl) {
            return { success: false, error: "CV is required" };
        }
        if (
            profileData?.profileSummary &&
            typeof profileData.profileSummary === "object" &&
            Array.isArray(profileData.profileSummary.experience) &&
            profileData.profileSummary.experience.length === 0
        ) {
            return { success: false, error: "Experience is required" };
        }
    }

    const userId = await checkAuth();

    let cvUrl = profileData.cvUrl || null;

    // --- Upload CV con Firebase Admin Storage ---
    if (cv) {
        const bucket = adminStorage.bucket();
        const filePath = `cv/${userId}/${cv.name}`;
        const file = bucket.file(filePath);

        // Convertiamo il File/Blob in Buffer
        const arrayBuffer = await cv.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload
        await file.save(buffer, {
            contentType: cv.type,
            resumable: false,
        });

        // Otteniamo una signed URL equivalente al getDownloadURL()
        const [signedUrl] = await file.getSignedUrl({
            action: "read",
            expires: "2100-01-01", // simile a un URL permanente
        });

        cvUrl = signedUrl;
    }

    const updatedProfile = {
        ...profileData,
        cvUrl: cvUrl || null,
    };

    // --- Batch Firestore (più efficiente: una sola commit) ---
    const batch = adminDb.batch();

    const accountRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("account");

    const userRef = adminDb.collection("users").doc(userId);
    let lifecycleFrom: unknown;

    if (!skipOnboardingStep) {
        const [userSnap, accountSnap] = await Promise.all([userRef.get(), accountRef.get()]);
        const existingMax: number = userSnap.data()?.maxOnboardingStep || 4;
        lifecycleFrom = userSnap.data()?.onboardingStage;
        const existingProfile = accountSnap.data()?.profileSummary;
        const profileChanged = !!cv || JSON.stringify(profileData?.profileSummary) !== JSON.stringify(existingProfile);
        const nextStepBase = flow === "guided" ? 3 : 4;

        const accountData: Record<string, any> = { ...updatedProfile };
        if (profileChanged) {
            accountData.queries = FieldValue.delete();
            accountData.customizations = FieldValue.delete();
        }
        batch.set(accountRef, accountData, { merge: true });
        batch.update(userRef, {
            onboardingStep: nextStepBase,
            maxOnboardingStep: Math.max(nextStepBase, existingMax),
            ...(flow === "guided" ? { onboardingStage: "target_company" } : {}),
        });
    } else {
        // set/merge (not update) so the draft save works even before the account doc
        // exists — otherwise update() throws "No document to update" for brand-new users.
        batch.set(accountRef, updatedProfile, { merge: true });
    }

    await batch.commit();
    if (!skipOnboardingStep && flow === "guided") {
        await recordOnboardingTransition({ userId, from: lifecycleFrom || "profile_source", to: "target_company", flow: "free_preview", step: 3, metadata: { source: cv ? "cv" : profileData?.cvUrl ? "existing_cv" : "linkedin" }, updateStage: false });
    }

    // Revalida la dashboard (Next.js)
    revalidatePath("/dashboard");

    if (skipOnboardingStep) {
        return { success: true as const, cvUrl: cvUrl || undefined };
    }
}

export async function submitQueries(queries: any) {
    // Test bypass for non-production environments
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testCookie = cookieStore.get('__playwright_user__')?.value;
        if (testCookie) {
            try {
                const userData = JSON.parse(Buffer.from(testCookie, 'base64').toString('utf-8'));
                userData.onboardingStep = 5;
                cookieStore.set('__playwright_user__', Buffer.from(JSON.stringify(userData)).toString('base64'), { path: '/' });
            } catch (e) { /* fall through */ }
            redirect('/dashboard');
        }
    }

    const userId = await checkAuth();

    const accountRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("account");

    const userRef = adminDb.collection("users").doc(userId);

    const [userSnap, accountSnap] = await Promise.all([userRef.get(), accountRef.get()]);
    const existingMax: number = userSnap.data()?.maxOnboardingStep || 5;
    const existingQueries = accountSnap.data()?.queries;
    const dataChanged = JSON.stringify(queries) !== JSON.stringify(existingQueries);

    const batch = adminDb.batch();

    const accountData: Record<string, any> = { queries };
    if (dataChanged) {
        accountData.customizations = FieldValue.delete();
    }
    batch.set(accountRef, accountData, { merge: true });
    batch.update(userRef, {
        onboardingStep: 5,
        maxOnboardingStep: Math.max(5, existingMax),
    });

    await batch.commit();

    redirect("/dashboard");
}

export async function completeOnboarding(customizations: any) {
    // Test bypass for non-production environments
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testCookie = cookieStore.get('__playwright_user__')?.value;
        if (testCookie) {
            try {
                const userData = JSON.parse(Buffer.from(testCookie, 'base64').toString('utf-8'));
                const planConfig = plansInfo.find(p => p.id === userData.plan);
                // Free plan (price=0): skip payment step, go directly to main dashboard
                userData.onboardingStep = (planConfig?.price === 0) ? 7 : 6;
                cookieStore.set('__playwright_user__', Buffer.from(JSON.stringify(userData)).toString('base64'), { path: '/' });
            } catch (e) { /* fall through */ }
            redirect('/dashboard');
        }
    }

    const userId = await checkAuth();

    const accountRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("account");

    const userRef = adminDb.collection("users").doc(userId);

    const userSnap = await userRef.get();
    const planConfig = plansInfo.find(p => p.id === userSnap.data()?.plan);
    const existingMax: number = userSnap.data()?.maxOnboardingStep || 5;
    const nextStepBase = (planConfig?.price === 0) ? 7 : 6;

    const plan: string = userSnap.data()?.plan || "free_trial";
    const isProOrUltra = plan === "pro" || plan === "ultra";
    const safeCustomizations = isProOrUltra
        ? customizations
        : { ...customizations, instructions: "" };

    const batch = adminDb.batch();

    batch.update(accountRef, { customizations: safeCustomizations });
    const userUpdate: Record<string, unknown> = {
        onboardingStep: nextStepBase,
        maxOnboardingStep: Math.max(nextStepBase, existingMax),
    };
    // Set activation timestamp only once — even if the user re-runs onboarding,
    // first activation defines the cohort. Drives cohort retention metrics.
    if (!userSnap.data()?.activated_at) {
        userUpdate.activated_at = FieldValue.serverTimestamp();
    }
    batch.update(userRef, userUpdate);

    await batch.commit();

    if (planConfig?.price === 0) {
        // Pre-create result entries so Python processes companies immediately (same as pro flow via addNewCompanies)
        const accountSnap = await accountRef.get();
        const companies: any[] = accountSnap.data()?.companies ?? [];
        if (companies.length > 0) {
            const resultsRef = adminDb.collection("users").doc(userId).collection("data").doc("results");
            const resultUpdates: Record<string, any> = {};
            const idsBatch = adminDb.batch();
            for (const company of companies) {
                const companyKey = `${company.name}-${userId}`;
                const newId = adminDb.collection("_generated_ids").doc().id;
                resultUpdates[newId] = { company, start_date: Timestamp.now() };
                idsBatch.set(adminDb.collection("ids").doc(companyKey), { id: newId }, { merge: true });
            }
            idsBatch.set(resultsRef, resultUpdates, { merge: true });
            await idsBatch.commit();
        }
        await startServer(userId);
    }

    // Persist the analytics event server-side (the client-side `track` won't survive
    // the redirect below — server-side write is the reliable path for Firestore).
    try {
        await adminDb.collection("analytics_events").add({
            event: "onboarding_complete",
            params: { plan: userSnap.data()?.plan || "free_trial" },
            user_id: userId,
            session_id: null,
            page_path: "/dashboard",
            timestamp: FieldValue.serverTimestamp(),
            source: "server",
        });
    } catch (err) {
        console.error("Failed to persist onboarding_complete analytics event:", err);
    }

    // Send onboarding thank-you email (fire-and-forget — don't block the redirect)
    try {
        await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Key": process.env.SESSION_API_KEY ?? "",
            },
            body: JSON.stringify({
                userId,
                type: "onboarding-complete",
                data: { plan: userSnap.data()?.plan || "free_trial" },
            }),
        });
    } catch (err) {
        console.error("Failed to send onboarding completion email:", err);
    }

    redirect('/dashboard');
}

export async function refindRecruiter(companyId: string, strategy: any, name, linkedinUrl) {
    const userId = await checkAuth();

    // --- Ricostruzione identica della strategia (solo JS, invariata) ---
    strategy = strategy.map(item => {
        const newCriteria = [...item.criteria];

        function addOrUpdate(key: string, value: string) {
            const existing = newCriteria.find(c => c.key === key);
            if (existing) {
                if (!existing.value.includes(value)) existing.value.push(value);
            } else {
                newCriteria.push({ key, value: [value] });
            }
        }

        addOrUpdate("exclude_names", name);
        if (linkedinUrl) addOrUpdate("exclude_linkedin_urls", linkedinUrl);

        return { ...item, criteria: newCriteria };
    });

    // --- Riferimenti Admin SDK ---
    const resultsRef = adminDb.collection("users").doc(userId).collection("data").doc("results");
    const detailsRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("details");
    const rowRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("row");
    const customizationsRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("customizations");
    const emailsRef = adminDb.collection("users").doc(userId).collection("data").doc("emails");
    const emailHistoryRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("email_history");

    // --- Leggi email corrente per archiviarla ---
    const detailsSnap = await detailsRef.get();
    const currentEmail = detailsSnap.data()?.email;

    // --- Batch: tutte le operazioni Firestore in un'unica commit ---
    const batch = adminDb.batch();

    // setDoc(..., { merge: true })
    batch.set(customizationsRef, { queries: strategy, recruiter_linkedin_urls: FieldValue.delete() }, { merge: true });

    // updateDoc results
    batch.update(resultsRef, {
        [`${companyId}.recruiter`]: FieldValue.delete(),
        [`${companyId}.email_sent`]: FieldValue.delete()
    });

    // updateDoc details: cancella email (history salvata separatamente)
    batch.update(detailsRef, {
        recruiter_summary: FieldValue.delete(),
        query: FieldValue.delete(),
        email: FieldValue.delete(),
    });

    // Archivia email corrente nel documento separato email_history
    if (currentEmail) {
        batch.set(emailHistoryRef, { versions: FieldValue.arrayUnion(toEmailArchive(currentEmail)) }, { merge: true });
    }

    // updateDoc row
    batch.update(rowRef, {
        recruiter: FieldValue.delete(),
        query: FieldValue.delete(),
        email: FieldValue.delete(),
    });

    // updateDoc emails
    batch.update(emailsRef, {
        [companyId]: FieldValue.delete(),
    });

    // --- Esegui batch + deleteCreditsPaid in parallelo ---
    await Promise.all([
        batch.commit(),
        deleteCreditsPaid(userId, companyId, "find-recruiter"),
    ]);

    // --- Manteniamo comportamento originale ---
    await startServer(userId);

    redirect("/dashboard/" + companyId);
}

export async function overrideRecruiterLinkedin(companyId: string, linkedinUrls: string[]) {
    const userId = await checkAuth();

    const resultsRef = adminDb.collection("users").doc(userId).collection("data").doc("results");
    const detailsRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("details");
    const rowRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("row");
    const customizationsRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("customizations");
    const emailsRef = adminDb.collection("users").doc(userId).collection("data").doc("emails");
    const emailHistoryRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("email_history");

    const detailsSnap = await detailsRef.get();
    const currentEmail = detailsSnap.data()?.email;

    const batch = adminDb.batch();

    batch.set(customizationsRef, { recruiter_linkedin_urls: linkedinUrls }, { merge: true });

    batch.update(resultsRef, {
        [`${companyId}.recruiter`]: FieldValue.delete(),
        [`${companyId}.email_sent`]: FieldValue.delete()
    });

    batch.update(detailsRef, {
        recruiter_summary: FieldValue.delete(),
        query: FieldValue.delete(),
        email: FieldValue.delete(),
    });

    batch.update(rowRef, {
        recruiter: FieldValue.delete(),
        query: FieldValue.delete(),
        email: FieldValue.delete(),
    });

    batch.update(emailsRef, {
        [companyId]: FieldValue.delete(),
    });

    if (currentEmail) {
        batch.set(emailHistoryRef, { versions: FieldValue.arrayUnion(toEmailArchive(currentEmail)) }, { merge: true });
    }

    await Promise.all([
        batch.commit(),
        deleteCreditsPaid(userId, companyId, "find-recruiter"),
    ]);

    await startServer(userId);

    redirect("/dashboard/" + companyId);
}

export async function refindBlogArticles(companyId: string) {
    console.log("Refind blog articles for companyId:", companyId);
    const userId = await checkAuth();

    const resultsRef = adminDb.collection("users").doc(userId).collection("data").doc("results");
    const detailsRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("details");
    const rowRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("row");

    const rowSnap = await rowRef.get();
    if (!rowSnap.exists || !rowSnap.data()?.blog_articles) {
        throw new Error("A blog article search is already in progress for this company.");
    }

    const batch = adminDb.batch();

    // Cancella dal documento top-level letto dal Python server
    batch.update(resultsRef, {
        [`${companyId}.blog_articles`]: FieldValue.delete(),
    });

    batch.update(detailsRef, {
        blog_articles: FieldValue.delete(),
    });

    batch.update(rowRef, {
        blog_articles: FieldValue.delete(),
    });

    await Promise.all([
        batch.commit(),
        deleteCreditsPaid(userId, companyId, "research-blog-articles"),
    ]);

    await startServer(userId);

    redirect("/dashboard/" + companyId);
}

export async function updateBlogArticles(
    companyId: string,
    articles: Array<{ url: string; title: string; markdown: string }>
) {
    const seen = new Set<string>();
    const deduped = articles
        .filter(a => a.url?.trim())
        .filter(a => {
            const url = a.url.trim();
            if (seen.has(url)) return false;
            seen.add(url);
            return true;
        })
        .map(a => ({ ...a, url: a.url.trim() }));

    if (deduped.length > 10) throw new Error("Maximum 10 articles allowed.");

    const userId = await checkAuth();

    const resultsRef = adminDb.collection("users").doc(userId).collection("data").doc("results");
    const detailsRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("details");
    const rowRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("row");
    const emailsRef = adminDb.collection("users").doc(userId).collection("data").doc("emails");
    const emailHistoryRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("email_history");

    const [rowSnap, detailsSnap] = await Promise.all([rowRef.get(), detailsRef.get()]);
    if (!rowSnap.exists || !rowSnap.data()?.blog_articles) {
        throw new Error("A blog article search is already in progress for this company.");
    }
    const currentEmail = detailsSnap.data()?.email;

    const truncate = (s: string, max = 300) =>
        s && s.length > max ? s.slice(0, max).replace(/\s+\S*$/, "") + "..." : (s || "");

    // Articles without markdown are new — mark for Python to fetch content
    const fullArticles = deduped.map(a =>
        a.markdown ? { url: a.url, title: a.title, markdown: a.markdown }
                   : { url: a.url, title: a.title || "", markdown: "", pending_content: true }
    );
    const truncatedArticles = fullArticles.map(a => ({ ...a, markdown: truncate(a.markdown) }));

    const batch = adminDb.batch();

    batch.update(detailsRef, {
        "blog_articles.content": truncatedArticles,
        "blog_articles.articles_found": deduped.length,
        email: FieldValue.delete(),
    });
    batch.update(rowRef, {
        "blog_articles.content": fullArticles,
        email: FieldValue.delete(),
    });
    batch.update(resultsRef, {
        [`${companyId}.blog_articles`]: deduped.length,
        [`${companyId}.email_sent`]: FieldValue.delete(),
    });
    batch.update(emailsRef, {
        [companyId]: FieldValue.delete(),
    });

    if (currentEmail) {
        batch.set(emailHistoryRef, { versions: FieldValue.arrayUnion(toEmailArchive(currentEmail)) }, { merge: true });
    }

    await Promise.all([
        batch.commit(),
        deleteCreditsPaid(userId, companyId, "generate-email"),
    ]);

    await startServer(userId);

    redirect("/dashboard/" + companyId);
}

export async function regenerateEmail(companyId: string, instructions: string) {
    const userId = await checkAuth();

    // --- Riferimenti Admin Firestore ---
    const resultsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results");

    const detailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("details");

    const rowRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("row");

    const customizationsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("customizations");

    const emailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("emails");

    const emailHistoryRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("email_history");

    // --- Leggi email corrente per archiviarla ---
    const detailsSnap = await detailsRef.get();
    const currentEmail = detailsSnap.data()?.email;

    // --- Batch Firestore: 5 operazioni in una sola commit ---
    const batch = adminDb.batch();

    // Equivalente di setDoc(..., { merge: true })
    batch.set(customizationsRef, { instructions }, { merge: true });

    // results: cancelliamo email_sent
    batch.update(resultsRef, {
        [`${companyId}.email_sent`]: FieldValue.delete()
    });

    // details: cancelliamo email (history salvata separatamente)
    batch.update(detailsRef, {
        email: FieldValue.delete(),
    });

    // row: cancelliamo email
    batch.update(rowRef, {
        email: FieldValue.delete()
    });

    // emails: cancelliamo companyId
    batch.update(emailsRef, {
        [companyId]: FieldValue.delete()
    });

    // Archivia email corrente nel documento separato email_history
    if (currentEmail) {
        batch.set(emailHistoryRef, { versions: FieldValue.arrayUnion(toEmailArchive(currentEmail)) }, { merge: true });
    }

    // --- Esegui batch e deleteCreditsPaid in parallelo ---
    await Promise.all([
        batch.commit(),
        deleteCreditsPaid(userId, companyId, "generate-email")
    ]);

    // Manteniamo identico il comportamento originale
    await startServer(userId);

    redirect("/dashboard/" + companyId);
}

export async function confirmCompany(selections: any, strategies: any, instructions: any) {
    let userId = "";

    try {
        userId = await checkAuth();
    } catch {
        return { success: false, error: "User not authenticated" };
    }

    // --- Admin Firestore user reference ---
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        return { success: false, error: "User not found" };
    }

    const currentCredits = userSnap.data()?.credits || 0;

    const amount =
        (creditsInfo["change-company"]?.cost || 0) *
        Object.values(selections).filter((s: any) => s.action === "wrong").length;

    if (currentCredits < amount) {
        return { success: false, error: "Insufficient credits" };
    }

    // -------------------------------------------------------
    // 🔥 Admin batch: equivalente a writeBatch(db)
    // -------------------------------------------------------
    const batch = adminDb.batch();

    // Scala i crediti
    batch.update(userRef, { credits: currentCredits - amount });

    // -------------------------------------------------------
    // 🔄 Loop principale identico alla versione client
    // -------------------------------------------------------
    for (const [companyId, selection] of Object.entries(selections) as any) {
        // Pulisci newData come versione originale
        selection.newData = Object.fromEntries(
            Object.entries(selection.newData).filter(([_, v]) => v != null && v !== "")
        );

        const resultsRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results");

        const detailsRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(companyId)
            .doc("details");

        const rowRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(companyId)
            .doc("row");

        const customizationsRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(companyId)
            .doc("customizations");

        const changedCompaniesRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("changed_companies");

        if (selection.action === "confirm") {
            // Aggiorna il risultato principale
            batch.update(resultsRef, {
                [companyId]: { company: selection.newData }
            });

            // Rimuovi dalle companies_to_confirm
            batch.set(
                resultsRef,
                { companies_to_confirm: FieldValue.arrayRemove(companyId) },
                { merge: true }
            );

            // Aggiorna details
            batch.update(detailsRef, {
                company: selection.newData
            });

            // Se ci sono strategie → merge
            if (strategies[companyId] && strategies[companyId].length > 0) {
                batch.set(customizationsRef, { queries: strategies[companyId] }, { merge: true });
            }

            // Se ci sono instructions → merge
            if (instructions[companyId]) {
                batch.set(
                    customizationsRef,
                    { instructions: instructions[companyId] },
                    { merge: true }
                );
            }

        } else if (selection.action === "wrong") {
            // Cancella i documenti
            batch.delete(rowRef);
            batch.delete(detailsRef);

            // Cancella l'intero nodo per companyId
            batch.update(resultsRef, {
                [companyId]: FieldValue.delete()
            });

            // Rimuovi dalle companies_to_confirm
            batch.set(
                resultsRef,
                { companies_to_confirm: FieldValue.arrayRemove(companyId) },
                { merge: true }
            );

            // ⚠️ L'originale usa setDoc fuori dal batch → manteniamo esattamente così
            await changedCompaniesRef.set(
                { [companyId]: selection.newData },
                { merge: true }
            );
        }
    }

    // -------------------------------------------------------
    // 🔥 Commit batch
    // -------------------------------------------------------
    await batch.commit();

    await startServer(userId);

    redirect("/dashboard");
}

export async function getFileFromFirebase(publicUrl: string) {
    try {
        const response = await fetch(publicUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const buffer = await response.arrayBuffer();
        const mimeType = response.headers.get("content-type") || "application/octet-stream";

        return {
            base64: Buffer.from(buffer).toString("base64"),
            mimeType,
        };
    } catch (error) {
        console.error("❌ Errore nel recupero file da Firebase:", error);
        throw new Error("Impossibile scaricare il file da Firebase Storage");
    }
}

export async function submitEmailSent(companyId: string, sent: boolean) {
    // Ottieni l'utente autenticato
    const userId = await checkAuth();

    // Valore da salvare: epoch timestamp o timestamp server
    const value = sent ? FieldValue.serverTimestamp() : Timestamp.fromDate(new Date(0));

    // --- Batch Firestore Admin ---
    const batch = adminDb.batch();

    // Riferimenti documenti
    const resultsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results");

    const emailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("emails");

    const detailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("details");

    // Aggiornamenti atomici
    batch.update(resultsRef, { [`${companyId}.email_sent`]: value });
    batch.update(emailsRef, { [`${companyId}.email_sent`]: value });
    batch.update(detailsRef, { "email.email_sent": value });

    // Esegui batch
    await batch.commit();

    // Revalida la pagina della dashboard
    revalidatePath(`/dashboard/${companyId}`);
}

export async function submitUpdateEmail(companyId: string, subject: string | null, body: string | null) {
    // Se non ci sono aggiornamenti, esci subito
    if (subject === null && body === null) return;

    // Ottieni l'utente autenticato
    const userId = await checkAuth();

    // Riferimenti documenti
    const emailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("emails");

    const detailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("details");

    const rowRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("row");

    const emailHistoryRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("email_history");

    // Leggi email corrente per archiviarla prima di modificarla
    const detailsSnap = await detailsRef.get();
    const currentEmail = detailsSnap.data()?.email;

    // --- Batch Firestore Admin ---
    const batch = adminDb.batch();

    // Archivia versione precedente
    if (currentEmail) {
        batch.set(emailHistoryRef, { versions: FieldValue.arrayUnion(toEmailArchive(currentEmail)) }, { merge: true });
    }

    // Aggiornamenti atomici
    if (body !== null) {
        batch.update(emailsRef, { [`${companyId}.body`]: body });
        batch.update(detailsRef, { "email.body": body });
        batch.update(rowRef, { "email.body": body });
    }

    if (subject !== null) {
        batch.update(emailsRef, { [`${companyId}.subject`]: subject });
        batch.update(detailsRef, { "email.subject": subject });
        batch.update(rowRef, { "email.subject": subject });
    }

    // Esegui batch
    await batch.commit();

    // Revalida la pagina della dashboard
    revalidatePath(`/dashboard/${companyId}`);
}

export async function switchEmailVersion(companyId: string, historyIndex: number) {
    const userId = await checkAuth();

    const detailsRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("details");
    const rowRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("row");
    const emailsRef = adminDb.collection("users").doc(userId).collection("data").doc("emails");
    const emailHistoryRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("email_history");

    const [detailsSnap, historySnap] = await Promise.all([detailsRef.get(), emailHistoryRef.get()]);
    const currentEmail = detailsSnap.data()?.email;
    const emailHistory: any[] = historySnap.data()?.versions || [];

    if (historyIndex < 0 || historyIndex >= emailHistory.length) {
        throw new Error("Invalid history index");
    }

    const { archived_at: _a, ...emailToRestore } = emailHistory[historyIndex];
    const newHistory = emailHistory.filter((_, i) => i !== historyIndex);
    if (currentEmail) {
        newHistory.unshift(toEmailArchive(currentEmail));
    }

    const batch = adminDb.batch();
    batch.update(detailsRef, { email: emailToRestore });
    batch.set(emailHistoryRef, { versions: newHistory }, { merge: false });
    batch.update(rowRef, { email: emailToRestore });
    batch.update(emailsRef, { [companyId]: emailToRestore });

    await batch.commit();

    revalidatePath(`/dashboard/${companyId}`);
}

export async function payCredits(companyId: string, contentKey: string) {
    try {
        // Ottieni l'utente autenticato
        const userId = await checkAuth();

        const userRef = adminDb.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return { success: false, error: "User not found" };
        }

        const currentCredits = userSnap.data()?.credits || 0;
        const amount = creditsInfo[contentKey]?.cost || 0;

        if (currentCredits < amount) {
            return { success: false, error: "Insufficient credits" };
        }

        // --- Batch Firestore Admin ---
        const batch = adminDb.batch();

        // Aggiorna crediti
        batch.update(userRef, { credits: currentCredits - amount });

        // Sblocca contenuto
        const unlockedRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(companyId)
            .doc("unlocked");

        batch.set(unlockedRef, { [contentKey]: true }, { merge: true });

        // Esegui batch
        await batch.commit();

        // Revalida la pagina della dashboard
        revalidatePath("/dashboard");

        return { success: true };
    } catch (err) {
        console.error("Server error in payCredits:", err);
        return { success: false, error: "Server error" };
    }
}

const deleteCreditsPaid = async (userId: string, companyId: string, contentKey: string) => {
    const unlockedRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("unlocked");

    await unlockedRef.update({
        [contentKey]: FieldValue.delete()
    });
};

const checkAuth = async (needVerified = true) => {
    // Test bypass for non-production environments
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testUserCookie = cookieStore.get('__playwright_user__')?.value;
        if (testUserCookie) {
            try {
                const userData = JSON.parse(Buffer.from(testUserCookie, 'base64').toString('utf-8'));
                return userData.uid || 'test-uid-playwright';
            } catch (e) {
                // Fall through to normal auth
            }
        }
    }

    const tokens = await getTokens(await cookies(), {
        apiKey: clientConfig.apiKey,
        cookieName: serverConfig.cookieName,
        cookieSignatureKeys: serverConfig.cookieSignatureKeys,
        serviceAccount: serverConfig.serviceAccount,
    });

    if (needVerified && !tokens?.decodedToken?.email_verified)
        throw new Error("Email not verified")

    const userId = tokens?.decodedToken?.uid;
    if (!userId) throw new Error("Utente non autenticato");

    return userId;
}

export async function addNewCompanies(companies: { name: string; domain?: string; linkedin_url?: string }[]) {
    // Test bypass
    if (process.env.NODE_ENV !== 'production') {
        const mock = getTestMock('/actions/addNewCompanies') as { success: boolean; error?: string } | null;
        if (mock) return mock;
        const cookieStore = await cookies();
        if (cookieStore.get('__playwright_user__')?.value) {
            return { success: true };
        }
    }

    const userId = await checkAuth();

    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return { success: false, error: "User not found" };

    const plan = userSnap.data()!.plan || "free_trial";
    // Use accumulated maxCompanies from Firestore (carries over across plan re-purchases),
    // falling back to the plan default for users who never went through a paid purchase.
    const companiesLimit: number =
        userSnap.data()!.maxCompanies ??
        (plansData as any)[plan]?.maxCompanies ??
        1;

    // Count existing company entries in the results doc
    const resultsRef = adminDb.collection("users").doc(userId).collection("data").doc("results");
    const resultsSnap = await resultsRef.get();
    const resultsData = resultsSnap.exists ? (resultsSnap.data() ?? {}) : {};
    const existingCount = Object.entries(resultsData).filter(
        ([k, v]: any) => k !== "companies_to_confirm" && typeof v === "object" && v?.company
    ).length;

    if (existingCount + companies.length > companiesLimit) {
        return { success: false, error: `Exceeds plan limit (${existingCount}/${companiesLimit} used).` };
    }

    // Fetch existing account companies
    const accountRef = adminDb.collection("users").doc(userId).collection("data").doc("account");
    const accountSnap = await accountRef.get();
    const existingCompanies: any[] = accountSnap.exists ? accountSnap.data()?.companies ?? [] : [];

    const requiresConfirmation = (plansData as any)[plan]?.companyConfirmationCalls ?? false;
    const batch = adminDb.batch();

    if (requiresConfirmation) {
        // For plans that require confirmation (e.g. Ultra), only update account.companies.
        // Python will detect these as new (present in account but not in results), create
        // their result entries, add them to companies_to_confirm, and pause for user confirmation.
        batch.set(accountRef, { companies: [...existingCompanies, ...companies] }, { merge: true });
    } else {
        // For other plans, pre-create result entries so Python processes them immediately.
        const resultUpdates: Record<string, any> = {};
        for (const company of companies) {
            const companyKey = `${company.name}-${userId}`;
            const newId = adminDb.collection("_generated_ids").doc().id;
            resultUpdates[newId] = { company, start_date: Timestamp.now() };
            batch.set(adminDb.collection("ids").doc(companyKey), { id: newId }, { merge: true });
        }
        batch.set(accountRef, { companies: [...existingCompanies, ...companies] }, { merge: true });
        batch.set(resultsRef, resultUpdates, { merge: true });
    }

    await batch.commit();
    await startServer(userId);
    revalidatePath("/dashboard");
    return { success: true };
}

export async function updateSettings(data: {
    marketingEmails: boolean;
    reminderFrequency: string;
    emailNotificationThreshold: number;
    onboardingReminders?: boolean;
    previewReady?: boolean;
    campaignProgress?: boolean;
}) {
    const userId = await checkAuth();

    const settingsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("settings");

    const userRef = adminDb.collection("users").doc(userId);
    const batch = adminDb.batch();
    batch.set(settingsRef, { preferences: {
        ...data,
        onboardingReminders: data.onboardingReminders ?? true,
        previewReady: data.previewReady ?? true,
        campaignProgress: data.campaignProgress ?? true,
        marketing: data.marketingEmails,
    } }, { merge: true });
    if (data.marketingEmails) {
        batch.set(userRef, { unsubscribed: false, resubscribed_at: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();

    revalidatePath("/dashboard/settings");
}

export async function getSettings() {
    const userId = await checkAuth();

    const settingsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("settings");

    const snap = await settingsRef.get();
    if (!snap.exists) {
        return { marketingEmails: true, reminderFrequency: "weekly", emailNotificationThreshold: 10, onboardingReminders: true, previewReady: true, campaignProgress: true };
    }
    const prefs = snap.data()?.preferences ?? {};
    return {
        marketingEmails: prefs.marketingEmails ?? true,
        reminderFrequency: prefs.reminderFrequency ?? "weekly",
        emailNotificationThreshold: prefs.emailNotificationThreshold ?? 10,
        onboardingReminders: prefs.onboardingReminders ?? true,
        previewReady: prefs.previewReady ?? true,
        campaignProgress: prefs.campaignProgress ?? true,
    };
}

export const resendEmailVerification = async () => {
    const userId = await checkAuth(false)
    const res = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Internal-Key": process.env.SESSION_API_KEY ?? "",
        },
        body: JSON.stringify({
            userId,
            type: "welcome",
            dedupeKey: `welcome-resend:${Math.floor(Date.now() / 300000)}`,
            category: "transactional",
        })
    });
    if (!res.ok) {
        throw new Error("Failed to send verification email. Please try again.")
    }
}

export async function getProfileData() {
    const userId = await checkAuth();

    const [userSnap, accountSnap] = await Promise.all([
        adminDb.collection("users").doc(userId).get(),
        adminDb.collection("users").doc(userId).collection("data").doc("account").get(),
    ]);

    const user = userSnap.data() || {};
    const account = accountSnap.exists ? (accountSnap.data() ?? {}) : {};

    return {
        name: user.name || "",
        picture: user.picture || null,
        plan: user.plan || "free_trial",
        account,
    };
}

export async function updateUserBasicInfo(name: string, profilePicture?: File | null) {
    const userId = await checkAuth();

    let pictureUrl: string | null = null;
    if (profilePicture) {
        const bucket = adminStorage.bucket();
        const filePath = `profile_pictures/${userId}/${profilePicture.name}`;
        const file = bucket.file(filePath);

        const arrayBuffer = await profilePicture.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await file.save(buffer, { contentType: profilePicture.type, resumable: false });

        const [signedUrl] = await file.getSignedUrl({ action: "read", expires: "2100-01-01" });
        pictureUrl = signedUrl;
    }

    const userRef = adminDb.collection("users").doc(userId);
    await userRef.update({
        name,
        ...(pictureUrl && { picture: pictureUrl }),
    });

    revalidatePath("/dashboard/profile");
}

export async function updateUserEmail(newEmail: string) {
    const userId = await checkAuth();

    await adminAuth.updateUser(userId, { email: newEmail, emailVerified: false });
    await adminDb.collection("users").doc(userId).update({
        email: newEmail,
        emailVerified: false,
        emailDeliverySuppressed: FieldValue.delete(),
        emailDeliverySuppressedReason: FieldValue.delete(),
        emailDeliverySuppressedAt: FieldValue.delete(),
    });

    // Email is now updated in Auth. Attempt to send verification link.
    // If this fails, the email change is still applied — user can resend verification.
    const emailChangeDedupeKey = `email-change-verification:${Math.floor(Date.now() / 300000)}`;
    let emailChangeReserved = false;
    try {
        const verificationLink = buildVerifyUrl(userId);
        const reservation = await reserveCommunication({ userId, dedupeKey: emailChangeDedupeKey, type: "email-change-verification", category: "transactional" });
        if (!reservation.send) throw new Error(`Verification email skipped: ${reservation.reason}`);
        emailChangeReserved = true;
        const resend = new Resend(process.env.RESEND_API_KEY);
        const result = await resend.emails.send({
            from: "CandidAI <no-reply@candidai.tech>",
            to: newEmail,
            subject: "Confirm your new email address",
            html: wrapEmail(`
                ${heading("One last step to update your email")}
                ${paragraph("You asked to use this address for your CandidAI account. Confirm it below so account alerts and campaign updates reach the right inbox.")}
                <div style="text-align:center;margin:32px 0;">${button("Confirm new email →", verificationLink)}</div>
                ${paragraph("If you didn't make this change, you can ignore this message and contact us at hello@candidai.tech.")}
            `, { preheader: "Confirm your new address for CandidAI.", badge: "EMAIL CHANGE" }),
        }, { idempotencyKey: `${userId}:${emailChangeDedupeKey}`.slice(0, 256) });
        if (result.error) throw new Error(JSON.stringify(result.error));
        await completeCommunication({ userId, dedupeKey: emailChangeDedupeKey, category: "transactional", type: "email-change-verification", providerId: result.data?.id });
    } catch (err) {
        if (emailChangeReserved) await failCommunication({ userId, dedupeKey: emailChangeDedupeKey, error: err }).catch(() => undefined);
        console.error("Failed to send verification email after email update:", err);
        revalidatePath("/dashboard/profile");
        throw new Error("Email updated but verification email failed to send. Please use 'Resend Verification' to get a new link.");
    }

    revalidatePath("/dashboard/profile");
}

export async function fetchBillingHistory() {
    const userId = await checkAuth();

    const paymentsSnap = await adminDb
        .collection("users")
        .doc(userId)
        .collection("payments")
        .orderBy("createdAt", "desc")
        .get();

    return paymentsSnap.docs.map((doc) => {
        const d = doc.data();
        const createdAt = d.createdAt?.toDate
            ? d.createdAt.toDate().toISOString()
            : d.createdAt?.seconds
                ? new Date(d.createdAt.seconds * 1000).toISOString()
                : null;
        return {
            id: doc.id,
            createdAt,
            description: d.description ?? d.item ?? null,
            amount: d.amount ?? null,
            currency: d.currency ?? "usd",
            status: d.status ?? null,
        };
    });
}

export async function updateAccountData(data: Record<string, any>) {
    const userId = await checkAuth();

    const accountRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("account");

    await accountRef.set(data, { merge: true });

    revalidatePath("/dashboard/profile");
}
