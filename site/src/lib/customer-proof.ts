import "server-only";

/** Single source of truth for customer evidence used in lifecycle emails. */
export const CUSTOMER_PROOF = {
  traditionalReplyRate: "~2%",
  candidaiReplyRate: "~40%",
  replyLift: "~20×",
  firstReplyTime: "under 48 hours",
  traditionalReplyTime: "1–2 weeks",
  juniorCallRate: "roughly 1 in 2",
  sanne: {
    portalApplications: 40,
    targetedEmails: 8,
    humanReplies: 5,
    calls: 3,
    interviewProcesses: 2,
    offers: 1,
    reportingImprovement: "60%",
    period: "roughly four weeks",
  },
} as const;

export const CUSTOMER_RESULTS_DISCLAIMER = "Individual results vary by profile, market, target companies, message quality, and follow-through.";
