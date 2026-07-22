export type OnboardingStage =
  | "profile_source"
  | "profile_review"
  | "target_company"
  | "recruiter_search"
  | "recruiter_found"
  | "email_generation"
  | "profile_generating"
  | "preview_ready"
  | "checkout"
  | "post_purchase"
  | "post_purchase_profile"
  | "post_purchase_companies"
  | "post_purchase_filters"
  | "post_purchase_instructions"
  | "post_purchase_review"
  | "completed";

export type OnboardingPreviewStatus =
  | "idle"
  | "queued"
  | "running"
  | "waiting_confirmation"
  | "completed"
  | "failed";

export interface OnboardingPreviewState {
  jobId?: string;
  status: OnboardingPreviewStatus;
  stage: OnboardingStage;
  resultId?: string;
  company?: { name: string; domain?: string; linkedin_url?: string };
  searchContext?: { targetRole?: string; queryCount?: number; narrative?: string; strengths?: string[] };
  searchProgress?: { attempt: number; total: number; strategy?: string; found?: boolean };
  recruiter?: { name: string; jobTitle: string; linkedinUrl?: string };
  recruiterProfile?: {
    avatarUrl?: string;
    location?: string;
    country?: string;
    summary?: string;
    skills: string[];
    experience: { title?: string; company?: string; startDate?: string; endDate?: string }[];
    education: { school?: string; degree?: string }[];
  };
  matchedQuery?: { id?: string | number; name?: string; criteria?: unknown[] };
  replayStrategies?: string[];
  strategyDetails?: Record<string, { label: string; values: string[] }[]>;
  email?: { subject: string; body: string; keyPoints: string[] };
  recruiterInsight?: { reason?: string; points: string[] };
  profileStatus?: string;
  profileProgress?: string;
  profileJobId?: string;
  updatedAt?: unknown;
  error?: { code: string; message?: string; recoverable: boolean };
}

/**
 * How long a `queued`/`running` profile job can go without a fresh `updatedAt`
 * write before we treat it as dead (e.g. the worker was killed mid-job, which
 * happens on every deploy). The worker writes progress at each phase, so the
 * largest healthy gap is a single AI call — 2 minutes is comfortably above it
 * while still recovering a stuck user reasonably fast.
 */
export const PROFILE_JOB_STALE_MS = 120_000;

/**
 * Parse whatever shape a Firestore timestamp arrives in — a live Admin
 * `Timestamp` (`toMillis`), the `{ _seconds, _nanoseconds }` / `{ seconds }`
 * JSON form the polling route serializes, an ISO string, or raw millis — into
 * epoch millis. Returns `NaN` when it can't (missing field, unknown shape), so
 * callers stay conservative and never flag a job stale without proof.
 */
export function previewTimestampMs(value: unknown): number {
  if (value == null) return NaN;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.toMillis === "function") return (v as { toMillis: () => number }).toMillis();
    const seconds = typeof v._seconds === "number" ? v._seconds : typeof v.seconds === "number" ? v.seconds : undefined;
    if (typeof seconds === "number") {
      const nanos = typeof v._nanoseconds === "number" ? v._nanoseconds : typeof v.nanoseconds === "number" ? v.nanoseconds : 0;
      return seconds * 1000 + nanos / 1e6;
    }
  }
  return NaN;
}

/** True only when we can PROVE the job hasn't advanced past the stale window. */
export function isProfileJobStale(profileStatus: string | undefined, updatedAt: unknown, now: number = Date.now()): boolean {
  if (!["queued", "running"].includes(profileStatus || "")) return false;
  const ms = previewTimestampMs(updatedAt);
  return Number.isFinite(ms) && now - ms > PROFILE_JOB_STALE_MS;
}
