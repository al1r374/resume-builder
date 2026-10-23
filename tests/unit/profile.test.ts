import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseProfileYaml, validateProfileData } from "@resume-builder/core";
import { detectLikelyCalendar } from "@resume-builder/shared";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("profile YAML", () => {
  it("parses and validates assets/profile.yaml", async () => {
    const raw = await readFile(path.join(root, "assets/profile.yaml"), "utf8");
    const profile = parseProfileYaml(raw);
    expect(profile.personal.first_name).toBe("Alireza");
    expect(profile.experience.length).toBeGreaterThan(0);
    expect(profile.personal.salary_expectation).toBeTruthy();
  });

  it("reports missing required fields without echoing secrets", () => {
    const result = validateProfileData({
      personal: { first_name: "", last_name: "" },
      experience: [],
      education: [],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("first_name"))).toBe(true);
    const serialized = JSON.stringify(result.issues);
    expect(serialized).not.toMatch(/salary/i);
  });

  it("preserves unknown personal fields via passthrough", () => {
    const profile = parseProfileYaml(`
personal:
  first_name: Test
  last_name: User
  custom_field: keep-me
experience:
  - company: Acme
    title: Engineer
    start_date: 2020/01
education:
  - school: Uni
`);
    expect((profile.personal as Record<string, unknown>).custom_field).toBe("keep-me");
  });

  it("detects Jalali-looking dates without converting them", () => {
    expect(detectLikelyCalendar("1404/12")).toBe("jalali");
    expect(detectLikelyCalendar("2020/01")).toBe("gregorian");
    expect(detectLikelyCalendar("Present")).toBe("gregorian");
  });
});
