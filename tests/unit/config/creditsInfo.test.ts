import { describe, it, expect } from "vitest";
import { creditsInfo } from "@/config";

describe("creditsInfo Constants Structure", () => {
  it('creditsInfo["prompt"].cost === 100', () => {
    expect(creditsInfo["prompt"].cost).toBe(100);
  });

  it('creditsInfo["generate-email"].cost === 50', () => {
    expect(creditsInfo["generate-email"].cost).toBe(50);
  });

  it('creditsInfo["find-recruiter"].cost === 100', () => {
    expect(creditsInfo["find-recruiter"].cost).toBe(100);
  });

  it('creditsInfo["change-company"].cost === 70', () => {
    expect(creditsInfo["change-company"].cost).toBe(70);
  });
});
