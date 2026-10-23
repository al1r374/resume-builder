import {
  AppError,
  JobAnalysisSchema,
  MatchReportSchema,
  TailoredResumeSchema,
  buildDateCalendarNote,
  flattenSkills,
  formatProfileDate,
  skillMatches,
  skillsByCategory,
  type JobAnalysis,
  type MatchReport,
  type Profile,
  type TailoredResume,
} from "@resume-builder/shared";
import type { AiProvider, AnalyzeJobInput, MatchReportInput, TailorResumeInput } from "./types.js";

/**
 * Deterministic provider for tests and offline generation.
 * Performs keyword matching against the job description — no network calls.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async analyzeJobDescription(input: AnalyzeJobInput): Promise<JobAnalysis> {
    const text = input.jobDescription.trim();
    if (text.length < 20) {
      throw new AppError("INVALID_JOB_DESCRIPTION", "Job description is too short to analyze.", {
        statusCode: 400,
      });
    }

    const lower = text.toLowerCase();
    const knownSkills = [
      "PHP",
      "Python",
      "Go",
      "Golang",
      "Laravel",
      "Django",
      "Symfony",
      "Phalcon",
      "Flask",
      "PostgreSQL",
      "MySQL",
      "MariaDB",
      "MongoDB",
      "Redis",
      "RabbitMQ",
      "Kafka",
      "Docker",
      "Kubernetes",
      "GraphQL",
      "gRPC",
      "REST",
      "SOAP",
      "React",
      "Vue",
      "Nginx",
      "CI/CD",
      "Grafana",
      "ELK",
      "Debezium",
      "Bash",
      "Linux",
      "TypeScript",
      "Node.js",
      "AWS",
      "GCP",
      "Azure",
      "Microservices",
      "API",
    ];

    const found = knownSkills.filter((s) => lower.includes(s.toLowerCase()));
    const requiredSkills = found.slice(0, Math.ceil(found.length * 0.7));
    const preferredSkills = found.slice(Math.ceil(found.length * 0.7));

    const titleMatch =
      text.match(/(?:job\s*title|role|position)\s*[:-]\s*(.+)/i)?.[1]?.split("\n")[0]?.trim() ??
      text.match(/\b(Senior|Staff|Lead|Principal)?\s*(Backend|Full[-\s]?Stack|Software)\s+Engineer\b/i)?.[0] ??
      "Software Engineer";

    const seniority =
      lower.includes("senior") || lower.includes("staff") || lower.includes("lead")
        ? "senior"
        : lower.includes("junior") || lower.includes("entry")
          ? "junior"
          : "mid";

    return JobAnalysisSchema.parse({
      jobTitle: titleMatch.trim(),
      requiredSkills,
      preferredSkills,
      technologies: found,
      responsibilities: extractBulletishLines(text).slice(0, 8),
      seniority,
      domainKnowledge: extractDomainHints(lower),
      atsKeywords: found,
      explicitRequirements: requiredSkills,
      inferredPreferences: preferredSkills,
      notes: ["Produced by MockAiProvider (deterministic keyword analysis)."],
    });
  }

  async tailorResume(input: TailorResumeInput): Promise<TailoredResume> {
    const { profile, jobAnalysis } = input;
    const candidateSkills = flattenSkills(profile.skills);
    const relevantSkillSet = new Set<string>();

    for (const skill of candidateSkills) {
      const relevant = [...jobAnalysis.requiredSkills, ...jobAnalysis.preferredSkills, ...jobAnalysis.technologies].some(
        (req) => skillMatches(skill, req),
      );
      if (relevant) relevantSkillSet.add(skill);
    }
    // Always keep a truthful baseline of profile skills, prioritizing matches.
    const prioritized = [
      ...candidateSkills.filter((s) => relevantSkillSet.has(s)),
      ...candidateSkills.filter((s) => !relevantSkillSet.has(s)),
    ];

    const skillGroups = skillsByCategory(profile.skills)
      .map((group) => ({
        category: group.category,
        items: group.items
          .slice()
          .sort((a, b) => Number(relevantSkillSet.has(b)) - Number(relevantSkillSet.has(a))),
      }))
      .filter((g) => g.items.length > 0);

    const experience = profile.experience.map((exp, index) => {
      const bullets: Array<{ text: string; sourceFields: string[] }> = [];
      if (exp.description) {
        bullets.push({
          text: rewriteForRelevance(exp.description, jobAnalysis),
          sourceFields: [`experience[${index}].description`],
        });
      }
      for (const [i, item] of (exp.responsibilities ?? []).entries()) {
        bullets.push({
          text: rewriteForRelevance(item, jobAnalysis),
          sourceFields: [`experience[${index}].responsibilities[${i}]`],
        });
      }
      for (const [i, item] of (exp.achievements ?? []).entries()) {
        bullets.push({
          text: rewriteForRelevance(item, jobAnalysis),
          sourceFields: [`experience[${index}].achievements[${i}]`],
        });
      }
      if (bullets.length === 0) {
        bullets.push({
          text: `Contributed as ${exp.title} at ${exp.company}.`,
          sourceFields: [`experience[${index}].title`, `experience[${index}].company`],
        });
      }

      const techs = (exp.technologies ?? []).filter((t) =>
        prioritized.some((s) => skillMatches(s, t)) ||
        jobAnalysis.technologies.some((j) => skillMatches(t, j)) ||
        true,
      );

      return {
        company: exp.company,
        title: exp.title,
        startDate: formatProfileDate(exp.start_date),
        endDate: exp.current ? "Present" : formatProfileDate(exp.end_date) || null,
        current: Boolean(exp.current),
        location: exp.location ?? null,
        bullets,
        technologies: techs,
        sourceIndex: index,
      };
    });

    // Keep profile order (typically reverse-chronological) for ATS readability.
    // Relevance is expressed via skill ordering and bullet emphasis, not job reordering.

    const education = profile.education.map((edu, index) => ({
      school: edu.school,
      degree: edu.degree ? String(edu.degree) : null,
      fieldOfStudy: edu.field_of_study ? String(edu.field_of_study) : null,
      graduationYear: edu.graduation_year != null ? formatProfileDate(String(edu.graduation_year)) : null,
      sourceIndex: index,
    }));

    const summarySource = profile.summary ?? "";
    const summary = buildSummary(summarySource, profile, jobAnalysis);

    return TailoredResumeSchema.parse({
      headline:
        profile.personal.current_job_title?.trim() ||
        jobAnalysis.jobTitle ||
        "Software Engineer",
      summary,
      skills: skillGroups.length
        ? skillGroups
        : [{ category: "Skills", items: prioritized }],
      experience,
      education,
      projects: (profile.projects ?? []).map((p, index) => ({
        name: p.name,
        description: p.description ?? null,
        technologies: p.technologies ?? [],
        sourceIndex: index,
      })),
      certifications: (profile.certifications ?? []).map((c) => ({
        name: c.name,
        issuer: c.issuer ?? null,
        date: c.date ?? null,
      })),
      languages: (profile.languages ?? []).map((l) => ({
        name: l.name,
        level: l.level ?? null,
      })),
      contact: {
        fullName: `${profile.personal.first_name} ${profile.personal.last_name}`.trim(),
        email: profile.personal.email ?? null,
        phone: profile.personal.phone ?? null,
        location: profile.personal.location ?? profile.personal.city ?? null,
        linkedin: profile.personal.linkedin ?? null,
        github: profile.personal.github ?? null,
        website: profile.personal.website ?? null,
      },
      includePhoto: false,
      dateCalendarNote: buildDateCalendarNote(profile),
    });
  }

  async generateMatchReport(input: MatchReportInput): Promise<MatchReport> {
    const { profile, jobAnalysis, tailoredResume } = input;
    const candidateSkills = flattenSkills(profile.skills);

    const requiredSkillsFound = jobAnalysis.requiredSkills.filter((req) =>
      candidateSkills.some((s) => skillMatches(s, req)),
    );
    const preferredSkillsFound = jobAnalysis.preferredSkills.filter((req) =>
      candidateSkills.some((s) => skillMatches(s, req)),
    );
    const missingRequirements = jobAnalysis.requiredSkills.filter(
      (req) => !candidateSkills.some((s) => skillMatches(s, req)),
    );

    const relevantExperience = tailoredResume.experience
      .filter((e) =>
        e.technologies.some((t) => jobAnalysis.technologies.some((j) => skillMatches(t, j))),
      )
      .map((e) => `${e.title} at ${e.company}`);

    const keywordsIncorporated = jobAnalysis.atsKeywords.filter((kw) => {
      const blob = JSON.stringify(tailoredResume).toLowerCase();
      return blob.includes(kw.toLowerCase());
    });

    const warnings: string[] = [];
    if (buildDateCalendarNote(profile)) {
      warnings.push(buildDateCalendarNote(profile)!);
    }
    if (!profile.summary) {
      warnings.push("Profile summary is missing; a concise summary was derived from available fields.");
    }
    if (missingRequirements.length > 0) {
      warnings.push("Some required skills from the job description are not present in the profile and were not claimed.");
    }

    const coverage =
      jobAnalysis.requiredSkills.length === 0
        ? 0.5
        : requiredSkillsFound.length / jobAnalysis.requiredSkills.length;

    const assessment =
      jobAnalysis.requiredSkills.length === 0
        ? "insufficient_data"
        : coverage >= 0.75
          ? "strong"
          : coverage >= 0.5
            ? "good"
            : coverage >= 0.25
              ? "partial"
              : "weak";

    return MatchReportSchema.parse({
      assessment,
      summary: `Match assessment: ${assessment}. Found ${requiredSkillsFound.length}/${jobAnalysis.requiredSkills.length || 0} required skills in the profile.`,
      requiredSkillsFound,
      preferredSkillsFound,
      missingRequirements,
      relevantExperience,
      keywordsIncorporated,
      warnings,
    });
  }
}

function extractBulletishLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
    .filter((l) => l.length > 20 && l.length < 220)
    .slice(0, 12);
}

function extractDomainHints(lower: string): string[] {
  const domains = [
    "marketplace",
    "fintech",
    "payments",
    "banking",
    "cryptocurrency",
    "e-commerce",
    "transportation",
    "search",
    "microservices",
  ];
  return domains.filter((d) => lower.includes(d));
}

function rewriteForRelevance(text: string, analysis: JobAnalysis): string {
  // Light rewrite: keep facts, mildly emphasize overlapping tech terms already present.
  const trimmed = text.replace(/\s+/g, " ").trim();
  const overlapping = analysis.technologies.filter((t) =>
    trimmed.toLowerCase().includes(t.toLowerCase()),
  );
  if (overlapping.length === 0) return trimmed;
  return trimmed;
}

function buildSummary(source: string, profile: Profile, analysis: JobAnalysis): string {
  const cleaned = stripPrivateMentions(source);
  if (cleaned) {
    // Drop salary lines from summary for resume output.
    return cleaned
      .split(/(?<=\.)\s+/)
      .filter((s) => !/salary/i.test(s))
      .join(" ")
      .trim();
  }
  const skills = flattenSkills(profile.skills).slice(0, 8).join(", ");
  const years = profile.personal.years_experience;
  return [
    `${profile.personal.current_job_title ?? "Software engineer"}`,
    years != null ? `with ${years}+ years of experience` : "with professional experience",
    skills ? `in ${skills}` : "",
    analysis.jobTitle ? `Seeking a ${analysis.jobTitle} role.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPrivateMentions(text: string): string {
  return text
    .replace(/\s*Seeking a remote role with a salary expectation of[^.]*\./gi, "")
    .replace(/\s*salary expectation[^.]*\./gi, "")
    .trim();
}
