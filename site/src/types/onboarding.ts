export type OnboardingStage =
  | "profile_source"
  | "profile_review"
  | "target_company"
  | "recruiter_search"
  | "recruiter_found"
  | "email_generation"
  | "preview_ready"
  | "checkout"
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
    location?: string;
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
  error?: { code: string; message?: string; recoverable: boolean };
}
