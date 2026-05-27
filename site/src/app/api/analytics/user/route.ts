/**
 * /api/analytics/user — fetch a single user's full journey for the
 * /analytics/user search widget. Returns:
 *  - Auth profile (signup, last login)
 *  - Firestore user doc (plan, credits, onboardingStep, first_touch,
 *    last_touch, activated_at, drip_stalled_sent)
 *  - account sub-doc (CV, profileSummary, companies, customizations)
 *  - results + emails sub-docs (whatever pipeline data exists)
 *  - chronological timeline of every analytics_event with user_id == uid
 *
 * Gated by middleware (Basic Auth, same as /analytics).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });

    let user;
    try {
        user = await adminAuth.getUserByEmail(email);
    } catch {
        return NextResponse.json({ found: false }, { status: 200 });
    }

    const uid = user.uid;
    const [userDoc, accountDoc, resultsDoc, emailsDoc, eventsSnap] = await Promise.all([
        adminDb.collection("users").doc(uid).get(),
        adminDb.collection("users").doc(uid).collection("data").doc("account").get(),
        adminDb.collection("users").doc(uid).collection("data").doc("results").get(),
        adminDb.collection("users").doc(uid).collection("data").doc("emails").get(),
        adminDb
            .collection("analytics_events")
            // No composite index → scan recent, filter in memory. Volume is small per user.
            .orderBy("timestamp", "desc")
            .limit(2000)
            .get(),
    ]);

    const userData = userDoc.data() ?? {};
    const account = accountDoc.exists ? accountDoc.data() ?? {} : null;
    const results = resultsDoc.exists ? resultsDoc.data() ?? {} : null;
    const emails = emailsDoc.exists ? emailsDoc.data() ?? {} : null;

    const events = eventsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        .filter((e) => e.user_id === uid)
        .slice(0, 200)
        .map((e) => ({
            id: e.id,
            event: String(e.event ?? "?"),
            params: e.params ?? {},
            source: e.source ?? "client",
            page_path: e.page_path ?? null,
            timestamp: (e.timestamp as Timestamp | undefined)?.toDate?.()?.toISOString?.() ?? null,
        }));

    // Compact results: just the high-signal fields per result
    const resultsSummary = results
        ? Object.entries(results).map(([rid, val]: [string, any]) => ({
            id: rid,
            company: val?.company?.name ?? "?",
            recruiter: val?.recruiter?.full_name ?? val?.recruiter?.name ?? null,
            recruiter_title: val?.recruiter?.job_title ?? null,
            blog_articles: Array.isArray(val?.blog_articles) ? val.blog_articles.length : 0,
            email_sent_at: (val?.email_sent as Timestamp | undefined)?.toDate?.()?.toISOString?.() ?? null,
        }))
        : [];

    const emailsSummary = emails
        ? Object.entries(emails).map(([rid, val]: [string, any]) => ({
            id: rid,
            subject: val?.subject ?? null,
            body_preview: typeof val?.body === "string" ? val.body.slice(0, 200) : null,
            email_address: val?.email_address ?? null,
        }))
        : [];

    return NextResponse.json({
        found: true,
        auth: {
            uid,
            email: user.email,
            emailVerified: user.emailVerified,
            createdAt: user.metadata?.creationTime ?? null,
            lastSignInTime: user.metadata?.lastSignInTime ?? null,
            providers: user.providerData.map((p) => p.providerId),
        },
        user: {
            plan: userData.plan ?? null,
            credits: userData.credits ?? 0,
            onboardingStep: userData.onboardingStep ?? null,
            maxOnboardingStep: userData.maxOnboardingStep ?? null,
            activated_at: (userData.activated_at as Timestamp | undefined)?.toDate?.()?.toISOString?.() ?? null,
            first_touch: userData.first_touch ?? null,
            last_touch: userData.last_touch ?? null,
            drip_stalled_sent: userData.drip_stalled_sent ?? false,
            name: userData.name ?? null,
        },
        account: account ? {
            hasCv: !!account.cvUrl,
            hasProfileSummary: !!account.profileSummary,
            hasCustomizations: !!account.customizations,
            companies: (account.companies ?? []).map((c: any) => ({ name: c.name, domain: c.domain })),
            profileTitle: account.profileSummary?.title ?? null,
            profileLocation: account.profileSummary?.location?.country ?? null,
        } : null,
        results: resultsSummary,
        emails: emailsSummary,
        events,
        eventCount: events.length,
    });
}
