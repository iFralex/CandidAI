export type BounceDetails = { message?: string; type?: string; subType?: string };

/** Provider complaints/suppressions and permanent bounces must stop all sends.
 * Transient bounces (mailbox full, throttling, timeouts) remain observable but
 * do not permanently disable an otherwise valid address. */
export function shouldSuppressEmail(status: string, bounce?: BounceDetails): boolean {
  if (status === "complained" || status === "suppressed") return true;
  if (status !== "bounced") return false;
  const detail = `${bounce?.type ?? ""} ${bounce?.subType ?? ""} ${bounce?.message ?? ""}`.toLowerCase();
  const transientSignals = ["transient", "temporary", "soft", "mailbox full", "quota", "throttl", "timeout", "try again"];
  return !transientSignals.some(signal => detail.includes(signal));
}
