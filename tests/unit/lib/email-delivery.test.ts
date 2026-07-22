import { describe, expect, it } from "vitest";
import { shouldSuppressEmail } from "@/lib/email-delivery";

describe("email delivery suppression", () => {
  it("always suppresses complaints and provider suppressions", () => {
    expect(shouldSuppressEmail("complained")).toBe(true);
    expect(shouldSuppressEmail("suppressed")).toBe(true);
  });

  it("suppresses permanent and unknown bounces conservatively", () => {
    expect(shouldSuppressEmail("bounced", { type: "Permanent" })).toBe(true);
    expect(shouldSuppressEmail("bounced")).toBe(true);
  });

  it("does not permanently suppress transient delivery failures", () => {
    expect(shouldSuppressEmail("bounced", { type: "Transient", subType: "MailboxFull" })).toBe(false);
    expect(shouldSuppressEmail("bounced", { message: "Temporary timeout, try again" })).toBe(false);
  });
});
