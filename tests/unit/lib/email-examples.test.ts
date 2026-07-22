import { describe, it, expect } from "vitest";
import { emailExamples } from "@/lib/email-examples";

describe("emailExamples", () => {
    it("has exactly 5 curated examples", () => {
        expect(emailExamples).toHaveLength(5);
    });

    it("gives every example a company, recruiter, subject and preview body", () => {
        for (const example of emailExamples) {
            expect(example.company.length).toBeGreaterThan(0);
            expect(example.recruiter.length).toBeGreaterThan(0);
            expect(example.subject.length).toBeGreaterThan(0);
            expect(example.preview.length).toBeGreaterThan(0);
        }
    });

    it("keeps match scores as percentage strings", () => {
        for (const example of emailExamples) {
            expect(example.matchScore).toMatch(/^\d{1,3}%$/);
        }
    });
});
