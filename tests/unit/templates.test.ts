import { describe, expect, it } from "vitest";
import { listTemplates, renderResumeHtml } from "@resume-builder/resume-templates";
import type { TailoredResume } from "@resume-builder/shared";

const sample: TailoredResume = {
  headline: "Backend Engineer",
  summary: "Builds APIs.",
  skills: [{ category: "Languages", items: ["Go", "Python"] }],
  experience: [
    {
      company: "Acme",
      title: "Engineer",
      startDate: "2020",
      endDate: "Present",
      current: true,
      bullets: [{ text: "Built services", sourceFields: ["experience[0].description"] }],
      technologies: ["Go"],
      sourceIndex: 0,
    },
  ],
  education: [
    {
      school: "Example University",
      degree: "BSc",
      fieldOfStudy: "CS",
      graduationYear: "2019",
      sourceIndex: 0,
    },
  ],
  projects: [],
  certifications: [],
  languages: [{ name: "English", level: "B2" }],
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: null,
    location: "Remote",
    linkedin: null,
    github: null,
    website: null,
  },
  includePhoto: false,
};

describe("templates", () => {
  it("lists modern and ats templates", () => {
    const ids = listTemplates().map((t) => t.id);
    expect(ids).toEqual(["modern", "ats"]);
  });

  it("renders modern HTML with candidate name and sections", () => {
    const html = renderResumeHtml("modern", sample);
    expect(html).toContain("Ada");
    expect(html).toContain("Professional Experience");
    expect(html).toContain("Acme");
  });

  it("renders ats single-column HTML without skill bars", () => {
    const html = renderResumeHtml("ats", sample);
    expect(html).toContain("Ada Lovelace");
    expect(html).not.toContain("skill-fill");
    expect(html).toContain("Skills");
  });
});
