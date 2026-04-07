/**
 * analytics.ts
 * Central Firebase Analytics utility for CandidAI.
 *
 * Usage:
 *   track({ name: "login_success", params: { method: "email" } })
 *   track({ name: "checkout_success", params: { ... } }, { persist: true })
 *   identifyUser(uid, { plan: "pro", credits: 500 })
 *
 * The `persist: true` option writes critical events to Firestore
 * (analytics_events collection) in addition to GA4, enabling real-time
 * operational dashboards without the 24-48h GA4 latency.
 */

import {
    logEvent,
    setUserProperties,
    setUserId,
    Analytics,
} from "firebase/analytics";

// ---------------------------------------------------------------------------
// Event catalogue — every event name + its required params
// ---------------------------------------------------------------------------

export type TrackingEvent =
    // ── Page ────────────────────────────────────────────────────────────────
    | { name: "page_view"; params: { page_path: string; page_title: string; page_referrer?: string } }
    | { name: "scroll_depth"; params: { percent: 25 | 50 | 75 | 100; page_path: string } }
    | { name: "page_engagement"; params: { page_path: string; engagement_time_ms: number } }

    // ── Web Vitals ───────────────────────────────────────────────────────────
    | { name: "web_vital"; params: { metric_name: "LCP" | "CLS" | "INP" | "FCP" | "TTFB"; value: number; rating: "good" | "needs-improvement" | "poor"; page_path: string } }

    // ── UTM / Referral ───────────────────────────────────────────────────────
    | { name: "utm_session"; params: { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string } }
    | { name: "referral_code_use"; params: { code: string } }
    | { name: "discount_code_detected"; params: { code: string } }

    // ── Landing page ────────────────────────────────────────────────────────
    | { name: "landing_cta_click"; params: { button_label: string; section: string } }
    | { name: "landing_video_play"; params: { video_id: string } }
    | { name: "landing_video_pause"; params: { video_id: string; watch_time_s: number } }
    | { name: "landing_video_end"; params: { video_id: string } }
    | { name: "landing_video_switch"; params: { video_id: string } }
    | { name: "landing_pricing_section_view"; params: Record<string, never> }
    | { name: "landing_plan_click"; params: { plan_id: string; plan_name: string; plan_price: number } }
    | { name: "landing_nav_click"; params: { label: string; destination: string } }
    | { name: "landing_download_click"; params: { platform: string } }
    | { name: "landing_faq_open"; params: { question: string } }
    | { name: "landing_review_view"; params: { author: string } }
    | { name: "landing_social_link_click"; params: { platform: string } }

    // ── Auth ─────────────────────────────────────────────────────────────────
    | { name: "login_attempt"; params: { method: "email" | "google" } }
    | { name: "login_success"; params: { method: "email" | "google" } }
    | { name: "login_error"; params: { method: "email" | "google"; error_code: string } }
    | { name: "signup_attempt"; params: { method: "email" | "google" } }
    | { name: "signup_success"; params: { method: "email" | "google" } }
    | { name: "signup_error"; params: { method: "email" | "google"; error_code: string } }
    | { name: "forgot_password_request"; params: { success: boolean } }
    | { name: "google_auth_redirect"; params: { mode: "login" | "register" } }

    // ── Onboarding ───────────────────────────────────────────────────────────
    | { name: "onboarding_step_view"; params: { step: number } }
    | { name: "onboarding_step_complete"; params: { step: number } }
    | { name: "onboarding_step_back"; params: { from_step: number } }
    | { name: "onboarding_complete"; params: { plan: string } }
    | { name: "onboarding_plan_select"; params: { plan_id: string; plan_price: number } }
    | { name: "onboarding_file_upload"; params: { file_type: string; file_size_kb: number } }
    | { name: "onboarding_company_add"; params: { method: string; total_count: number } }
    | { name: "onboarding_custom_instructions_set"; params: { has_instructions: boolean } }

    // ── Dashboard ────────────────────────────────────────────────────────────
    | { name: "dashboard_view"; params: { campaign_count: number; plan: string } }
    | { name: "campaign_view"; params: { result_id: string; status: string } }
    | { name: "company_confirm"; params: { company_name: string } }
    | { name: "company_reject"; params: { company_name: string } }
    | { name: "email_send"; params: { company_name: string } }
    | { name: "email_send_all"; params: { count: number } }
    | { name: "email_copy"; params: { company_name: string } }
    | { name: "email_view"; params: { company_name: string } }
    | { name: "recruiter_find"; params: { company_name: string; cost: number } }
    | { name: "credits_used"; params: { action: string; cost: number; remaining: number } }
    | { name: "add_companies_dialog_open"; params: Record<string, never> }
    | { name: "add_companies_submit"; params: { count: number } }
    | { name: "email_verification_send"; params: Record<string, never> }
    | { name: "blog_articles_research"; params: { company_name: string; cost: number } }
    | { name: "prompt_unlock"; params: { company_name: string; cost: number } }
    | { name: "generate_email_custom"; params: { company_name: string; cost: number } }
    | { name: "change_company"; params: { cost: number } }
    | { name: "sent_emails_view"; params: { total_count: number; preset: string } }
    | { name: "billing_page_view"; params: Record<string, never> }

    // ── Plan & Credits ───────────────────────────────────────────────────────
    | { name: "plan_credits_page_view"; params: Record<string, never> }
    | { name: "plan_select"; params: { plan_id: string; plan_name: string; plan_price: number } }
    | { name: "credits_package_select"; params: { package_id: string; credits: number; price_cents: number } }
    | { name: "checkout_open"; params: { type: "plan" | "credits"; item_id: string; amount_cents: number } }
    | { name: "checkout_submit"; params: { type: "plan" | "credits"; item_id: string; amount_cents: number } }
    | { name: "checkout_success"; params: { type: "plan" | "credits"; item_id: string; amount_cents: number } }
    | { name: "checkout_error"; params: { error_message: string; item_id: string } }
    | { name: "checkout_free_success"; params: { item_id: string } }
    | { name: "discount_code_apply"; params: { code: string; discount_type: string; discount_value: number } }

    // ── Profile / Settings ───────────────────────────────────────────────────
    | { name: "profile_update"; params: { fields: string[] } }
    | { name: "password_change"; params: { success: boolean } }
    | { name: "account_delete_request"; params: Record<string, never> }

    // ── Download ─────────────────────────────────────────────────────────────
    | { name: "app_download_click"; params: { platform: "win" | "mac" } }
    | { name: "download_page_view"; params: { detected_platform: string } }

    // ── Errors ───────────────────────────────────────────────────────────────
    | { name: "app_error"; params: { error_type: string; error_message: string; page_path: string } };

// ---------------------------------------------------------------------------
// Events that should ALSO be persisted to Firestore for real-time dashboards
// ---------------------------------------------------------------------------

const PERSIST_EVENTS = new Set<TrackingEvent["name"]>([
    "checkout_success",
    "checkout_free_success",
    "onboarding_complete",
    "signup_success",
    "email_send",
    "email_send_all",
    "app_error",
]);

// ---------------------------------------------------------------------------
// Track options
// ---------------------------------------------------------------------------

export interface TrackOptions {
    /** Write this event to Firestore `analytics_events` for real-time queries. */
    persist?: boolean;
}

// ---------------------------------------------------------------------------
// Core tracking function
// ---------------------------------------------------------------------------

/**
 * Send a typed analytics event to Firebase Analytics (GA4).
 * If `options.persist` is true, or the event is in the PERSIST_EVENTS set,
 * the event is also written to Firestore for operational dashboards.
 *
 * Safe to call anywhere — silently no-ops on the server.
 */
export function track(event: TrackingEvent, options?: TrackOptions): void {
    if (typeof window === "undefined") return;

    const shouldPersist = options?.persist || PERSIST_EVENTS.has(event.name);

    // Send to GA4
    import("@/lib/firebase").then(({ analytics }) => {
        if (!analytics) return;
        try {
            logEvent(analytics, event.name, event.params as Record<string, any>);
        } catch { /* never throw from analytics */ }
    }).catch(() => { /* ignore */ });

    // Write to Firestore for critical events
    if (shouldPersist) {
        persistToFirestore(event).catch(() => { /* ignore — analytics must never break UX */ });
    }
}

// ---------------------------------------------------------------------------
// Firestore persistence for real-time operational dashboards
// ---------------------------------------------------------------------------

async function persistToFirestore(event: TrackingEvent): Promise<void> {
    try {
        const [{ db, auth }, { collection, addDoc, serverTimestamp }] = await Promise.all([
            import("@/lib/firebase"),
            import("firebase/firestore"),
        ]);

        if (!db) return;

        await addDoc(collection(db, "analytics_events"), {
            event: event.name,
            params: event.params,
            user_id: auth?.currentUser?.uid ?? null,
            session_id: getSessionId(),
            page_path: window.location.pathname,
            timestamp: serverTimestamp(),
            user_agent: navigator.userAgent.slice(0, 200),
        });
    } catch { /* ignore */ }
}

/** Stable per-session ID (survives page navigations, reset on new tab). */
function getSessionId(): string {
    const key = "_ca_sid";
    try {
        let sid = sessionStorage.getItem(key);
        if (!sid) {
            sid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            sessionStorage.setItem(key, sid);
        }
        return sid;
    } catch {
        return "unknown";
    }
}

// ---------------------------------------------------------------------------
// User identification
// ---------------------------------------------------------------------------

/**
 * Identify the authenticated user for analytics.
 * Call once after a successful login or signup.
 */
export function identifyUser(
    userId: string,
    properties?: {
        plan?: string;
        credits?: number;
        onboarding_step?: number;
        signup_method?: string;
    }
): void {
    if (typeof window === "undefined") return;

    import("@/lib/firebase").then(({ analytics }) => {
        if (!analytics) return;
        try {
            setUserId(analytics, userId);
            if (properties) {
                // GA4 user properties must be strings
                const stringProps: Record<string, string> = {};
                for (const [k, v] of Object.entries(properties)) {
                    if (v !== undefined && v !== null) stringProps[k] = String(v);
                }
                setUserProperties(analytics, stringProps);
            }
        } catch { /* ignore */ }
    }).catch(() => { /* ignore */ });
}

/**
 * Update user properties without resetting the user ID.
 * Call when the user upgrades their plan, uses credits, etc.
 */
export function updateUserProperties(
    properties: Record<string, string | number | null>
): void {
    if (typeof window === "undefined") return;

    import("@/lib/firebase").then(({ analytics }) => {
        if (!analytics) return;
        try {
            const stringProps: Record<string, string | null> = {};
            for (const [k, v] of Object.entries(properties)) {
                stringProps[k] = v !== null ? String(v) : null;
            }
            setUserProperties(analytics, stringProps);
        } catch { /* ignore */ }
    }).catch(() => { /* ignore */ });
}
