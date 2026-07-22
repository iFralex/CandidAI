import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (class merging utility)", () => {
  it("merges simple strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignores undefined values", () => {
    expect(cn("foo", undefined, "bar")).toBe("foo bar");
  });

  it("ignores null values", () => {
    expect(cn("foo", null)).toBe("foo");
  });

  it("ignores falsy conditionals", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("flattens arrays of classes", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("returns empty string for no input", () => {
    expect(cn()).toBe("");
  });
});
