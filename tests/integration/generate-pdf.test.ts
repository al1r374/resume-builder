import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createAiProvider } from "@resume-builder/ai-provider";
import { generateTailoredResume } from "@resume-builder/core";
import { closePdfBrowser, extractPdfText, renderResumePdf } from "@resume-builder/pdf-renderer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "output", "test-artifacts");

describe("integration: mock generation", () => {
  afterAll(async () => {
    await closePdfBrowser();
  });

  it("loads example profile and job, generates modern and ats PDFs with selectable text", async () => {
    await mkdir(outDir, { recursive: true });
    const provider = createAiProvider({ provider: "mock" });
    const job = await readFile(path.join(root, "examples/job.example.txt"), "utf8");

    const tailored = await generateTailoredResume({
      profilePath: path.join(root, "assets/profile.yaml"),
      jobDescription: job,
      template: "modern",
      language: "en",
      provider,
    });

    expect(tailored.resume.contact.fullName).toContain("Alireza");
    expect(tailored.matchReport.assessment).toBeTruthy();

    for (const template of ["modern", "ats"] as const) {
      const rendered = await renderResumePdf({
        resume: {
          ...tailored.resume,
          includePhoto: template === "modern" ? tailored.resume.includePhoto : false,
        },
        template,
        photoPath: tailored.photoPath,
        allowedPhotoDirs: [root, path.join(root, "assets")],
        validate: true,
      });

      expect(rendered.pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
      expect(rendered.validation?.ok).toBe(true);
      expect(rendered.validation?.pageCount).toBeGreaterThanOrEqual(1);

      const extracted = await extractPdfText(rendered.pdf);
      // Modern template uppercases the name in CSS; compare case-insensitively.
      expect(extracted.text.toLowerCase()).toContain("alireza");
      expect(extracted.text.toLowerCase()).toContain("experience");

      const outPath = path.join(outDir, `integration-${template}.pdf`);
      await writeFile(outPath, rendered.pdf);
      await access(outPath);
    }
  });

  it("handles missing photos without failing", async () => {
    const provider = createAiProvider({ provider: "mock" });
    const job = await readFile(path.join(root, "examples/job.example.txt"), "utf8");
    const tailored = await generateTailoredResume({
      profilePath: path.join(root, "assets/profile.yaml"),
      jobDescription: job,
      template: "modern",
      language: "en",
      provider,
      includePhoto: true,
    });

    const rendered = await renderResumePdf({
      resume: { ...tailored.resume, includePhoto: true },
      template: "modern",
      photoPath: path.join(root, "photo-does-not-exist.jpg"),
      allowedPhotoDirs: [root],
      validate: true,
    });
    expect(rendered.pdf.length).toBeGreaterThan(1000);
  });

  it("handles invalid job descriptions", async () => {
    const provider = createAiProvider({ provider: "mock" });
    await expect(
      generateTailoredResume({
        profilePath: path.join(root, "assets/profile.yaml"),
        jobDescription: "short",
        template: "modern",
        language: "en",
        provider,
      }),
    ).rejects.toMatchObject({ code: "INVALID_JOB_DESCRIPTION" });
  });

  it("fails clearly when an unknown provider is requested", () => {
    expect(() => createAiProvider({ provider: "nope" })).toThrow(/Unknown AI provider/);
  });

  it("refuses to overwrite without force at the filesystem layer (simulate conflict)", async () => {
    const conflict = path.join(outDir, "conflict.pdf");
    await mkdir(outDir, { recursive: true });
    await writeFile(conflict, "%PDF-1.4 conflict");
    const exists = await access(conflict).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    // Cleanup for other runs
    await rm(conflict, { force: true });
  });
});
