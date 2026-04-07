"use client";

/**
 * AnalyticsProvider.tsx
 *
 * Root-level client component that handles:
 * 1. page_view tracking on every route change (Next.js App Router)
 * 2. scroll_depth milestones (25 / 50 / 75 / 100 %)
 * 3. page_engagement time — reported on tab hide / navigation away
 * 4. Core Web Vitals (LCP, CLS, INP, FCP, TTFB) via web-vitals
 * 5. UTM parameter detection and session attribution
 * 6. Referral & discount code detection from cookies
 * 7. Unhandled JS error + unhandled promise rejection capture
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// UTM helpers
// ---------------------------------------------------------------------------

function getUTMParams(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const sp = new URLSearchParams(window.location.search);
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
    const result: Record<string, string> = {};
    for (const key of utmKeys) {
        const v = sp.get(key);
        if (v) result[key] = v;
    }
    return result;
}

function getCookieValue(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.split("; ").find(c => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

// Persist UTM params for the duration of the session so we can attribute
// conversions even if the user navigates away from the landing URL.
function persistUTMToSession(params: Record<string, string>): void {
    try {
        if (Object.keys(params).length > 0) {
            sessionStorage.setItem("_ca_utm", JSON.stringify(params));
        }
    } catch { /* ignore */ }
}

function getPersistedUTM(): Record<string, string> {
    try {
        const stored = sessionStorage.getItem("_ca_utm");
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

// ---------------------------------------------------------------------------
// Web Vitals
// ---------------------------------------------------------------------------

function initWebVitals(pathname: string): void {
    import("web-vitals").then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
        const report = (metric: { name: string; value: number; rating: string }) => {
            track({
                name: "web_vital",
                params: {
                    metric_name: metric.name as "LCP" | "CLS" | "INP" | "FCP" | "TTFB",
                    value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
                    rating: metric.rating as "good" | "needs-improvement" | "poor",
                    page_path: pathname,
                },
            });
        };
        onLCP(report, { reportAllChanges: false });
        onCLS(report, { reportAllChanges: false });
        onINP(report, { reportAllChanges: false });
        onFCP(report, { reportAllChanges: false });
        onTTFB(report, { reportAllChanges: false });
    }).catch(() => { /* web-vitals not available — graceful degradation */ });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const prevPath = useRef<string | null>(null);
    const pageEnterTime = useRef<number>(Date.now());
    const scrollMilestones = useRef<Set<number>>(new Set());
    const webVitalsInitialized = useRef(false);

    // ── One-time session setup ────────────────────────────────────────────────
    useEffect(() => {
        // Web Vitals — initialize once per page load (not per navigation)
        if (!webVitalsInitialized.current) {
            webVitalsInitialized.current = true;
            initWebVitals(pathname);
        }

        // UTM attribution
        const currentUTM = getUTMParams();
        if (Object.keys(currentUTM).length > 0) {
            persistUTMToSession(currentUTM);
            track({ name: "utm_session", params: currentUTM });
        }

        // Referral code from cookie (set by middleware)
        const refCode = getCookieValue("referral");
        if (refCode) {
            track({ name: "referral_code_use", params: { code: refCode } });
        }

        // Discount code from cookie (set by middleware)
        const discountCode = getCookieValue("discount");
        if (discountCode) {
            track({ name: "discount_code_detected", params: { code: discountCode } });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally run once

    // ── Page view tracking on route change ────────────────────────────────────
    useEffect(() => {
        if (pathname === prevPath.current) return;

        // Report engagement time for the previous page before resetting
        if (prevPath.current !== null) {
            const engagementMs = Date.now() - pageEnterTime.current;
            if (engagementMs > 500) { // ignore instant bounces (SSR flashes)
                track({
                    name: "page_engagement",
                    params: { page_path: prevPath.current, engagement_time_ms: engagementMs },
                });
            }
        }

        // Reset per-page state
        scrollMilestones.current = new Set();
        pageEnterTime.current = Date.now();
        prevPath.current = pathname;

        track({
            name: "page_view",
            params: {
                page_path: pathname,
                page_title: document.title,
                page_referrer: document.referrer || undefined,
            },
        });
    }, [pathname]);

    // ── Page engagement time via visibilitychange ─────────────────────────────
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "hidden") {
                const engagementMs = Date.now() - pageEnterTime.current;
                if (engagementMs > 500) {
                    track({
                        name: "page_engagement",
                        params: { page_path: pathname, engagement_time_ms: engagementMs },
                    });
                    // Reset so we don't double-count if the user returns to the tab
                    pageEnterTime.current = Date.now();
                }
            } else if (document.visibilityState === "visible") {
                // User returned to tab — restart engagement timer
                pageEnterTime.current = Date.now();
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [pathname]);

    // ── Scroll depth ─────────────────────────────────────────────────────────
    useEffect(() => {
        const handleScroll = () => {
            const el = document.documentElement;
            const scrolled = el.scrollTop + el.clientHeight;
            const total = el.scrollHeight;
            if (total <= el.clientHeight) return;

            const percent = Math.round((scrolled / total) * 100);
            const milestones = [25, 50, 75, 100] as const;

            for (const m of milestones) {
                if (percent >= m && !scrollMilestones.current.has(m)) {
                    scrollMilestones.current.add(m);
                    track({ name: "scroll_depth", params: { percent: m, page_path: pathname } });
                }
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [pathname]);

    // ── Unhandled error capture ───────────────────────────────────────────────
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            // Filter out browser extension errors and cross-origin script errors
            if (!event.filename || event.message === "Script error.") return;
            track({
                name: "app_error",
                params: {
                    error_type: "unhandled_error",
                    error_message: event.message?.slice(0, 200) ?? "unknown",
                    page_path: pathname,
                },
            });
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const msg = String(event.reason)?.slice(0, 200) ?? "unknown";
            // Filter noise from cancelled fetch requests
            if (msg.includes("AbortError") || msg.includes("cancelled")) return;
            track({
                name: "app_error",
                params: {
                    error_type: "unhandled_promise_rejection",
                    error_message: msg,
                    page_path: pathname,
                },
            });
        };

        window.addEventListener("error", handleError);
        window.addEventListener("unhandledrejection", handleUnhandledRejection);

        return () => {
            window.removeEventListener("error", handleError);
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
        };
    }, [pathname]);

    return <>{children}</>;
}
