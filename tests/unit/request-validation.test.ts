import { describe, expect, it } from "vitest";
import { GenerateResumeRequestSchema, TemplateIdSchema } from "@resume-builder/shared";
import {
  assertAllowedOrigin,
  assertSafeHostHeader,
  parseAllowedExtensionIds,
} from "../../apps/local-server/src/security.js";

function fakeRequest(headers: Record<string, string>) {
  return { headers } as never;
}

describe("CLI/HTTP validation helpers", () => {
  it("validates generate request payloads", () => {
    const ok = GenerateResumeRequestSchema.safeParse({
      jobDescription: "x".repeat(30),
      template: "modern",
      language: "en",
    });
    expect(ok.success).toBe(true);

    const bad = GenerateResumeRequestSchema.safeParse({
      jobDescription: "short",
      template: "modern",
      language: "en",
    });
    expect(bad.success).toBe(false);
  });

  it("accepts only known templates", () => {
    expect(TemplateIdSchema.parse("ats")).toBe("ats");
    expect(() => TemplateIdSchema.parse("fancy")).toThrow();
  });

  it("parses allowed extension IDs", () => {
    expect(parseAllowedExtensionIds("abc, def")).toEqual(["abc", "def"]);
  });

  it("rejects unexpected Host headers", () => {
    expect(() =>
      assertSafeHostHeader(fakeRequest({ host: "evil.example:8787" }), "127.0.0.1", 8787),
    ).toThrow(/Host/);
  });

  it("allows chrome-extension origins in open allowlist mode", () => {
    expect(() =>
      assertAllowedOrigin(
        // Chrome extension IDs are 32 characters from the a–p alphabet.
        fakeRequest({ origin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop" }),
        { host: "127.0.0.1", allowedExtensionIds: [], allowNullOrigin: false },
      ),
    ).not.toThrow();
  });

  it("denies non-extension browser origins", () => {
    expect(() =>
      assertAllowedOrigin(fakeRequest({ origin: "https://example.com" }), {
        host: "127.0.0.1",
        allowedExtensionIds: [],
        allowNullOrigin: false,
      }),
    ).toThrow(/origin/i);
  });
});
