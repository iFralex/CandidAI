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
import {
    getActiveExperimentContext,
    getExperimentEventParams,
    getVisitorId,
    isExperimentQaSession,
} from "@/lib/experiments-client";

// ---------------------------------------------------------------------------
// Event catalogue — every event name + its required params
// ---------------------------------------------------------------------------

export type TrackingEvent =
    // ── Experiments ──────────────────────────────────────────────────────────
    | { name: "experiment_exposure"; params: { experiment_id: string; experiment_variant: string; experiment_source: "server" } }
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
    | { name: "referral_cta_click"; params: { button_label: string; section: string } }
    | { name: "referral_simulator_section_view"; params: Record<string, never> }
    | { name: "referral_simulator_plan_select"; params: { plan_id: string; plan_name: string; plan_price: number } }
    | { name: "referral_simulator_preset_select"; params: { count: number } }
    | { name: "referral_playbook_select"; params: { title: string } }
    | { name: "referral_faq_open"; params: { question: string } }

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
    | { name: "onboarding_started"; params: { method: "email" | "google"; to_stage: string; flow: string } }
    | { name: "onboarding_step_view"; params: { step: number } }
    | { name: "onboarding_step_complete"; params: { step: number } }
    | { name: "onboarding_step_back"; params: { from_step: number } }
    | { name: "onboarding_complete"; params: { plan: string } }
    | { name: "onboarding_plan_select"; params: { plan_id: string; plan_price: number } }
    | { name: "onboarding_file_upload"; params: { file_type: string; file_size_kb: number } }
    | { name: "onboarding_company_add"; params: { method: string; total_count: number } }
    | { name: "onboarding_custom_instructions_set"; params: { has_instructions: boolean } }
    | { name: "onboarding_scene_summary"; params: { stage: string; visible_time_ms: number; left_page: boolean } }
    | { name: "profile_generation_timing"; params: { pdl_ms: number; ai_ms: number; logo_ms: number; persist_ms: number; total_ms: number; pdl_ok: boolean; had_cv: boolean; had_linkedin: boolean; flow: string; success: boolean; error?: string } }
    | { name: "search_experience_engaged"; params: { visible_time_ms: number } }
    | { name: "search_experience_left"; params: { visible_time_ms: number } }
    | { name: "search_result_revealed"; params: { total_search_time_ms: number } }
    | { name: "preview_email_copied"; params: { company_name: string } }
    | { name: "preview_email_client_opened"; params: { company_name: string } }
    | { name: "preview_checkout_opened"; params: { plan_id: string } }
    | { name: "post_purchase_section_edited"; params: { section: string } }
    | { name: "campaign_launch_clicked"; params: { plan: string; company_count: number } }

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
    | { name: "app_error"; params: { error_type: string; error_message: string; page_path: string } }

    // ── In-app feedback (post-action micro-survey) ───────────────────────────
    | { name: "nps_prompt_shown"; params: { source: string } }
    | { name: "nps_prompt_dismissed"; params: { source: string } }
    | { name: "nps_response"; params: { source: string; score: 1 | 2 | 3 | 4 | 5; has_comment: boolean } };

// ---------------------------------------------------------------------------
// Events that should ALSO be persisted to Firestore for real-time dashboards
// ---------------------------------------------------------------------------

const PERSIST_EVENTS = new Set<TrackingEvent["name"]>([
    "experiment_exposure",
    "page_view",
    "page_engagement",
    "web_vital",
    "nps_response",
    "checkout_success",
    "checkout_free_success",
    "onboarding_complete",
    "onboarding_started",
    "onboarding_scene_summary",
    "profile_generation_timing",
    "search_experience_engaged",
    "search_experience_left",
    "search_result_revealed",
    "preview_checkout_opened",
    "campaign_launch_clicked",
    "signup_success",
    "email_send",
    "email_send_all",
    "app_error",
]);

const CLARITY_EVENTS = new Set<TrackingEvent["name"]>([
    "landing_cta_click",
    "landing_video_play",
    "landing_plan_click",
    "signup_attempt",
    "signup_success",
    "onboarding_complete",
    "checkout_open",
    "checkout_success",
    "checkout_error",
    "email_send",
    "app_error",
]);

// ---------------------------------------------------------------------------
// Track options
// ---------------------------------------------------------------------------

export interface TrackOptions {
    /** Write this event to Firestore `analytics_events` for real-time queries. */
    persist?: boolean;
    /**
     * Explicit user id to attach to the persisted event. Use when the caller
     * already knows the uid but `auth.currentUser` may not yet be populated
     * client-side (e.g. just after signup/login via cookie auth).
     */
    userId?: string;
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

    const experimentParams = event.name === "experiment_exposure"
        ? {
            experiment_qa: isExperimentQaSession() ? "true" : "false",
            visitor_id: getVisitorId() ?? "unknown",
        }
        : getExperimentEventParams();
    const enrichedEvent = {
        ...event,
        params: { ...event.params, ...experimentParams },
    } as TrackingEvent;

    // Explicit `persist: false` lets a caller opt OUT even for events that
    // are persisted by default (e.g. when the server already wrote the event).
    const shouldPersist = options?.persist !== undefined
        ? options.persist
        : PERSIST_EVENTS.has(event.name);

    // Send to GA4
    import("@/lib/firebase").then(({ analytics }) => {
        if (!analytics) return;
        try {
            const sendEvent = logEvent as unknown as (
                instance: Analytics,
                name: string,
                params?: Record<string, unknown>,
            ) => void;
            sendEvent(analytics, enrichedEvent.name, enrichedEvent.params as Record<string, unknown>);
        } catch { /* never throw from analytics */ }
    }).catch(() => { /* ignore */ });

    if (CLARITY_EVENTS.has(event.name)) {
        try { window.clarity?.("event", event.name); } catch { /* ignore */ }
    }

    // Write to Firestore for critical events
    if (shouldPersist) {
        persistToFirestore(enrichedEvent, options?.userId).catch(() => { /* ignore — analytics must never break UX */ });
    }
}

// ---------------------------------------------------------------------------
// Firestore persistence for real-time operational dashboards
// ---------------------------------------------------------------------------

async function persistToFirestore(event: TrackingEvent, explicitUserId?: string): Promise<void> {
    try {
        if (typeof window === "undefined") return;

        const userId = explicitUserId ?? getCachedUserId() ?? null;

        const body = JSON.stringify({
            event: event.name,
            params: event.params,
            user_id: userId,
            session_id: getSessionId(),
            page_path: window.location.pathname,
            user_agent: navigator.userAgent.slice(0, 200),
            experiments: getActiveExperimentContext(),
            visitor_id: getVisitorId(),
            experiment_qa: isExperimentQaSession(),
            attribution: getLastTouchAttribution() ?? getFirstTouchAttribution(),
            locale: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
            authenticated: Boolean(userId),
            user_properties: getCachedUserProperties(),
        });

        // Write server-side (admin SDK) through the public /api/track sink, so the
        // Firestore rules can deny direct client writes to analytics_events.
        // sendBeacon survives page unload (best for telemetry); fall back to a
        // keepalive fetch when it's unavailable.
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
            navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        } else {
            void fetch("/api/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
                keepalive: true,
            }).catch(() => { /* ignore */ });
        }
    } catch { /* ignore — analytics must never break UX */ }
}

/**
 * Cached uid set by `identifyUser`. Survives across navigations within the tab.
 * Needed because email/password auth here uses cookie-only sessions and never
 * populates `firebase.auth().currentUser` client-side.
 */
const USER_ID_KEY = "_ca_uid";
const USER_PROPERTIES_KEY = "_ca_user_props";
function getCachedUserId(): string | null {
    try { return sessionStorage.getItem(USER_ID_KEY); } catch { return null; }
}
function setCachedUserId(uid: string): void {
    try { sessionStorage.setItem(USER_ID_KEY, uid); } catch { /* ignore */ }
}
function clearCachedUserId(): void {
    try { sessionStorage.removeItem(USER_ID_KEY); } catch { /* ignore */ }
}
function getCachedUserProperties(): Record<string, string> {
    try { return JSON.parse(sessionStorage.getItem(USER_PROPERTIES_KEY) ?? "{}"); } catch { return {}; }
}
function cacheUserProperties(properties: Record<string, unknown>): void {
    try {
        const current = getCachedUserProperties();
        for (const [key, value] of Object.entries(properties)) {
            if (value !== undefined && value !== null) current[key] = String(value);
        }
        sessionStorage.setItem(USER_PROPERTIES_KEY, JSON.stringify(current));
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

    // Cache uid for persistToFirestore — survives navigation within the tab.
    setCachedUserId(userId);
    if (properties) cacheUserProperties(properties);

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

/** Clear identified user — call on logout so subsequent events are anonymous. */
export function clearIdentifiedUser(): void {
    if (typeof window === "undefined") return;
    clearCachedUserId();
    try { sessionStorage.removeItem(USER_PROPERTIES_KEY); } catch { /* ignore */ }
}

export interface FirstTouchAttribution {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    referrer?: string | null;
    landing_page?: string;
    captured_at?: string;
}

/**
 * Read the 90-day first-touch attribution cookie set by AnalyticsProvider.
 * Returns null if the user hit the site without any UTM and from an internal
 * referrer (i.e. no attribution data was captured).
 */
export function getFirstTouchAttribution(): FirstTouchAttribution | null {
    return readAttributionCookie("_ca_first_touch");
}

/**
 * Save the current last-touch cookie to users/{uid}.last_touch. Call after
 * any conversion event (payment success, free checkout success, etc.) so the
 * stored value reflects the campaign that actually closed THIS conversion.
 * Safe to call without an explicit uid — falls back to the cached uid.
 */
export async function saveLastTouchToUserDoc(uid?: string): Promise<void> {
    if (typeof window === "undefined") return;
    const userId = uid ?? getCachedUserId();
    if (!userId) return;
    const lt = getLastTouchAttribution();
    if (!lt) return;
    try {
        const [{ db }, { doc, updateDoc }] = await Promise.all([
            import("@/lib/firebase"),
            import("firebase/firestore"),
        ]);
        if (!db) return;
        await updateDoc(doc(db, "users", userId), { last_touch: lt });
    } catch { /* ignore — analytics must never break UX */ }
}

/**
 * Read the last-touch attribution cookie (overwritten on every attributable
 * page view). Read at checkout-time to credit the conversion to the campaign
 * that actually closed it, not the one that originally brought the user.
 */
export function getLastTouchAttribution(): FirstTouchAttribution | null {
    return readAttributionCookie("_ca_last_touch");
}

/** Persist the browser's stable experiment assignment on the user document.
 * Server-side conversions (for example Stripe webhooks) can then retain the
 * original variant even though they do not receive browser cookies. */
export async function saveExperimentAssignmentsToUserDoc(uid?: string): Promise<void> {
    if (typeof window === "undefined") return;
    const userId = uid ?? getCachedUserId();
    if (!userId) return;
    const experiments = getActiveExperimentContext();
    if (experiments.length === 0) return;
    try {
        const [{ db }, { doc, updateDoc }] = await Promise.all([
            import("@/lib/firebase"),
            import("firebase/firestore"),
        ]);
        await updateDoc(doc(db, "users", userId), {
            experiment_visitor_id: getVisitorId(),
            experiments: Object.fromEntries(experiments.map(({ id, variant, source }) => [
                id,
                { variant, source, assigned_at: new Date().toISOString() },
            ])),
        });
    } catch { /* ignore — analytics must never break signup */ }
}

function readAttributionCookie(name: string): FirstTouchAttribution | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    if (!match) return null;
    try {
        return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")));
    } catch {
        return null;
    }
}

/**
 * Read the current user doc from Firestore and push fresh `plan`, `credits`,
 * `onboarding_step`, `is_paid` to GA4 as user properties. Call after every
 * action that mutates user state (checkout, onboarding step, credits spent)
 * so GA4 segmentation reports stay accurate over time.
 *
 * Silently no-ops if uid is unknown or Firestore read fails.
 */
export async function refreshUserPropertiesFromFirestore(uid?: string): Promise<void> {
    if (typeof window === "undefined") return;
    const userId = uid ?? getCachedUserId();
    if (!userId) return;

    try {
        const [{ db }, { doc, getDoc }] = await Promise.all([
            import("@/lib/firebase"),
            import("firebase/firestore"),
        ]);
        if (!db) return;
        const snap = await getDoc(doc(db, "users", userId));
        if (!snap.exists()) return;
        const data = snap.data();
        const plan = String(data.plan ?? "unknown");
        updateUserProperties({
            plan,
            credits: Number(data.credits ?? 0),
            onboarding_step: Number(data.onboardingStep ?? 0),
            is_paid: plan !== "free_trial" && plan !== "unknown" ? "true" : "false",
        });
    } catch { /* ignore — analytics must never break UX */ }
}

/**
 * Update user properties without resetting the user ID.
 * Call when the user upgrades their plan, uses credits, etc.
 */
export function updateUserProperties(
    properties: Record<string, string | number | null>
): void {
    if (typeof window === "undefined") return;
    cacheUserProperties(properties);

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
