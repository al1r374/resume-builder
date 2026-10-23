import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MockAiProvider } from "@resume-builder/ai-provider";
import { parseProfileYaml, validateFactualIntegrity } from "@resume-builder/core";
import type { TailoredResume } from "@resume-builder/shared";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("mock AI provider and integrity", () => {
  it("analyzes a job description deterministically", async () => {
    const provider = new MockAiProvider();
    const job = await readFile(path.join(root, "examples/job.example.txt"), "utf8");
    const analysis = await provider.analyzeJobDescription({ jobDescription: job });
    expect(analysis.requiredSkills.length).toBeGreaterThan(0);
    expect(analysis.technologies).toContain("Python");
  });

  it("rejects short job descriptions", async () => {
    const provider = new MockAiProvider();
    await expect(
      provider.analyzeJobDescription({ jobDescription: "too short" }),
    ).rejects.toMatchObject({ code: "INVALID_JOB_DESCRIPTION" });
  });

  it("tailors a resume without inventing skills", async () => {
    const provider = new MockAiProvider();
    const profile = parseProfileYaml(await readFile(path.join(root, "assets/profile.yaml"), "utf8"));
    const job = await readFile(path.join(root, "examples/job.example.txt"), "utf8");
    const analysis = await provider.analyzeJobDescription({ jobDescription: job });
    const resume = await provider.tailorResume({
      profile,
      jobAnalysis: analysis,
      jobDescription: job,
      language: "en",
    });
    const integrity = validateFactualIntegrity(profile, resume);
    expect(integrity.ok).toBe(true);
    expect(resume.contact.fullName).toContain("Alireza");
    expect(resume.summary.toLowerCase()).not.toContain("salary");
  });

  it("flags invented employers", () => {
    const profile = parseProfileYaml(`
personal:
  first_name: A
  last_name: B
experience:
  - company: Real Co
    title: Engineer
    start_date: 1400/01
education:
  - school: Uni
`);
    const bad: TailoredResume = {
      headline: "Engineer",
      summary: "Test",
      skills: [],
      experience: [
        {
          company: "Fake Corp",
          title: "Engineer",
          startDate: "1400/01",
          endDate: null,
          current: false,
          bullets: [{ text: "Did things", sourceFields: [] }],
          technologies: [],
          sourceIndex: 0,
        },
      ],
      education: [{ school: "Uni", degree: null, fieldOfStudy: null, graduationYear: null, sourceIndex: 0 }],
      projects: [],
      certifications: [],
      languages: [],
      contact: {
        fullName: "A B",
        email: null,
        phone: null,
        location: null,
        linkedin: null,
        github: null,
        website: null,
      },
      includePhoto: false,
    };
    const result = validateFactualIntegrity(profile, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "INVENTED_EMPLOYER")).toBe(true);
  });

  it("generates a qualitative match report", async () => {
    const provider = new MockAiProvider();
    const profile = parseProfileYaml(await readFile(path.join(root, "assets/profile.yaml"), "utf8"));
    const job = await readFile(path.join(root, "examples/job.example.txt"), "utf8");
    const analysis = await provider.analyzeJobDescription({ jobDescription: job });
    const resume = await provider.tailorResume({
      profile,
      jobAnalysis: analysis,
      jobDescription: job,
      language: "en",
    });
    const report = await provider.generateMatchReport({
      profile,
      jobAnalysis: analysis,
      tailoredResume: resume,
    });
    expect(report.assessment).toBeTruthy();
    expect(Array.isArray(report.missingRequirements)).toBe(true);
  });
});
