import { describe, expect, it } from "vitest";
import { PROFILE_JOB_STALE_MS, previewTimestampMs, isProfileJobStale } from "@/types/onboarding";

const NOW = 1_700_000_000_000; // fixed reference epoch (ms)

describe("previewTimestampMs", () => {
  it("passes raw millis through", () => {
    expect(previewTimestampMs(NOW)).toBe(NOW);
  });

  it("parses ISO strings", () => {
    const iso = new Date(NOW).toISOString();
    expect(previewTimestampMs(iso)).toBe(NOW);
  });

  it("reads the { _seconds, _nanoseconds } JSON shape the poll serializes", () => {
    expect(previewTimestampMs({ _seconds: NOW / 1000, _nanoseconds: 0 })).toBe(NOW);
  });

  it("reads the { seconds, nanoseconds } shape", () => {
    expect(previewTimestampMs({ seconds: NOW / 1000, nanoseconds: 5_000_000 })).toBe(NOW + 5);
  });

  it("calls toMillis() on a live Admin Timestamp", () => {
    expect(previewTimestampMs({ toMillis: () => NOW })).toBe(NOW);
  });

  it("returns NaN for missing/unknown shapes", () => {
    expect(previewTimestampMs(undefined)).toBeNaN();
    expect(previewTimestampMs(null)).toBeNaN();
    expect(previewTimestampMs({})).toBeNaN();
  });
});

describe("isProfileJobStale", () => {
  it("is false for terminal / non-running statuses regardless of age", () => {
    const old = { _seconds: (NOW - 10 * 60_000) / 1000, _nanoseconds: 0 };
    expect(isProfileJobStale("completed", old, NOW)).toBe(false);
    expect(isProfileJobStale("failed", old, NOW)).toBe(false);
    expect(isProfileJobStale(undefined, old, NOW)).toBe(false);
  });

  it("is false for a running job with a fresh updatedAt", () => {
    const fresh = { _seconds: (NOW - 5_000) / 1000, _nanoseconds: 0 };
    expect(isProfileJobStale("running", fresh, NOW)).toBe(false);
    expect(isProfileJobStale("queued", fresh, NOW)).toBe(false);
  });

  it("is true for a running/queued job past the stale window", () => {
    const dead = { _seconds: (NOW - (PROFILE_JOB_STALE_MS + 60_000)) / 1000, _nanoseconds: 0 };
    expect(isProfileJobStale("running", dead, NOW)).toBe(true);
    expect(isProfileJobStale("queued", dead, NOW)).toBe(true);
  });

  it("is false when updatedAt is missing (never flag without proof)", () => {
    expect(isProfileJobStale("running", undefined, NOW)).toBe(false);
    expect(isProfileJobStale("running", {}, NOW)).toBe(false);
  });
});
