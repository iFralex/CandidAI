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
    batch.update(userRef, { onboardingStep: 3, maxOnboardingStep: 3 });

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
                if (currentStep === 5 && plan !== 'pro' && plan !== 'ultra') prevStep = 3;
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
    if (currentStep === 5 && plan !== 'pro' && plan !== 'ultra') prevStep = 3;
    if (prevStep < 1) return;

    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const existingMax = userSnap.data()?.maxOnboardingStep || currentStep;
    const maxOnboardingStep = Math.max(currentStep, existingMax);

    await userRef.update({ onboardingStep: prevStep, maxOnboardingStep });
    revalidatePath('/dashboard');
}

export async function startServer(userId = null) {
    if (!userId)
        userId = await checkAuth()

    const res = await fetch(process.env.SERVER_RUNNER_URL || "", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ user_id: userId })
    })
    if (!res.ok) {
        console.error(`Server runner failed: ${res.status}`)
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

    const userId = await checkAuth()

    const userRef = adminDb.collection("users").doc(userId)
    const userSnap = await userRef.get()
    const existingPlan = userSnap.data()?.plan
    const existingMax = userSnap.data()?.maxOnboardingStep || 2
    const planChanged = existingPlan && existingPlan !== planId

    const batch = adminDb.batch()

    batch.update(userRef, {
        onboardingStep: 2,
        maxOnboardingStep: planChanged ? 2 : Math.max(2, existingMax),
        plan: planId,
        credits: plansData[planId].credits || 0,
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

const ALLOWED_CV_TYPES = ["application/pdf"];
const MAX_CV_SIZE = 5 * 1024 * 1024; // 5 MB

export async function submitProfile(
    plan: string,
    profileData: any,
    cv?: File | null,
    skipOnboardingStep?: boolean
) {
    // Test bypass for non-production environments
    if (process.env.NODE_ENV !== 'production') {
        const cookieStore = await cookies();
        const testCookie = cookieStore.get('__playwright_user__')?.value;
        if (testCookie) {
            if (!skipOnboardingStep) {
                try {
                    const userData = JSON.parse(Buffer.from(testCookie, 'base64').toString('utf-8'));
                    // For pro/ultra: advance to step 4 (Advanced Filters UI).
                    // For base/free_trial: skip step 4 (auto-executes server-side) and advance to step 5.
                    userData.onboardingStep = (plan === 'pro' || plan === 'ultra') ? 4 : 5;
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
        if (!cv && !profileData?.cvUrl) {
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

    if (!skipOnboardingStep) {
        const [userSnap, accountSnap] = await Promise.all([userRef.get(), accountRef.get()]);
        const existingMax: number = userSnap.data()?.maxOnboardingStep || 4;
        const existingProfile = accountSnap.data()?.profileSummary;
        const profileChanged = !!cv || JSON.stringify(profileData?.profileSummary) !== JSON.stringify(existingProfile);
        const nextStepBase = (plan === 'pro' || plan === 'ultra') ? 4 : 5;

        const accountData: Record<string, any> = { ...updatedProfile };
        if (profileChanged) {
            accountData.queries = FieldValue.delete();
            accountData.customizations = FieldValue.delete();
        }
        batch.set(accountRef, accountData, { merge: true });
        batch.update(userRef, {
            onboardingStep: nextStepBase,
            maxOnboardingStep: Math.max(nextStepBase, existingMax),
        });
    } else {
        batch.update(accountRef, updatedProfile);
    }

    await batch.commit();

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
                userData.onboardingStep = (planConfig?.price === 0) ? 50 : 6;
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
    const nextStepBase = (planConfig?.price === 0) ? 50 : 6;

    const batch = adminDb.batch();

    batch.update(accountRef, { customizations });
    batch.update(userRef, {
        onboardingStep: nextStepBase,
        maxOnboardingStep: Math.max(nextStepBase, existingMax),
    });

    await batch.commit();

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

    // --- Batch: tutte le operazioni Firestore in un'unica commit ---
    const batch = adminDb.batch();

    // setDoc(..., { merge: true })
    batch.set(customizationsRef, { queries: strategy }, { merge: true });

    // updateDoc results
    batch.update(resultsRef, {
        [`${companyId}.recruiter`]: FieldValue.delete(),
        [`${companyId}.email_sent`]: FieldValue.delete()
    });

    // updateDoc details
    batch.update(detailsRef, {
        recruiter_summary: FieldValue.delete(),
        query: FieldValue.delete(),
        email: FieldValue.delete(),
    });

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

    const rowSnap = await rowRef.get();
    if (!rowSnap.exists || !rowSnap.data()?.blog_articles) {
        throw new Error("A blog article search is already in progress for this company.");
    }

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
    batch.update(detailsRef, {
        email: FieldValue.delete(),
    });

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

    // --- Batch Firestore: 5 operazioni in una sola commit ---
    const batch = adminDb.batch();

    // Equivalente di setDoc(..., { merge: true })
    batch.set(customizationsRef, { instructions }, { merge: true });

    // results: cancelliamo email_sent
    batch.update(resultsRef, {
        [`${companyId}.email_sent`]: FieldValue.delete()
    });

    // details: cancelliamo email
    batch.update(detailsRef, {
        email: FieldValue.delete()
    });

    // row: cancelliamo email
    batch.update(rowRef, {
        email: FieldValue.delete()
    });

    // emails: cancelliamo companyId
    batch.update(emailsRef, {
        [companyId]: FieldValue.delete()
    });

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
        // 1️⃣ Estrai il percorso interno del file dal public URL
        // Esempio URL:
        // https://firebasestorage.googleapis.com/v0/b/tuo-bucket/o/offerte%2Fcliente123%2Fofferta.pdf?alt=media
        const match = publicUrl.match(/\/o\/([^?]+)/);
        if (!match) throw new Error("URL Firebase non valido");

        const encodedPath = match[1];
        const filePath = decodeURIComponent(encodedPath); // "offerte/cliente123/offerta.pdf"

        // 2️⃣ Recupera il file tramite Firebase Admin SDK
        const bucket = adminStorage.bucket();
        const file = bucket.file(filePath);

        // Download del contenuto
        const [data] = await file.download();

        // 3️⃣ Recupera i metadati del file
        const [metadata] = await file.getMetadata();

        // 4️⃣ Restituisci il contenuto codificato in Base64 e il MIME type
        return {
            base64: data.toString("base64"),
            mimeType: metadata.contentType || "application/octet-stream",
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

    // --- Batch Firestore Admin ---
    const batch = adminDb.batch();

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
    const companiesLimit: number = (plansData as any)[plan]?.maxCompanies ?? 1;

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
}) {
    const userId = await checkAuth();

    const settingsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("settings");

    await settingsRef.set({ preferences: data }, { merge: true });

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
        return { marketingEmails: true, reminderFrequency: "weekly", emailNotificationThreshold: 10 };
    }
    const prefs = snap.data()?.preferences ?? {};
    return {
        marketingEmails: prefs.marketingEmails ?? true,
        reminderFrequency: prefs.reminderFrequency ?? "weekly",
        emailNotificationThreshold: prefs.emailNotificationThreshold ?? 10,
    };
}

export const resendEmailVerification = async () => {
    const userId = await checkAuth(false)
    const res = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId,
            type: "welcome"
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
    await adminDb.collection("users").doc(userId).update({ email: newEmail });

    // Email is now updated in Auth. Attempt to send verification link.
    // If this fails, the email change is still applied — user can resend verification.
    try {
        const verificationLink = await adminAuth.generateEmailVerificationLink(newEmail);
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
            from: "CandidAI <no-reply@candidai.tech>",
            to: newEmail,
            subject: "Verify your new CandidAI email address",
            html: `<p>You updated your CandidAI email address. Please verify it by clicking: <a href="${verificationLink}">Verify Email</a></p>`,
        });
    } catch (err) {
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