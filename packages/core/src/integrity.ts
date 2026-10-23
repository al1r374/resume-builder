import {
  AppError,
  flattenSkills,
  skillMatches,
  type Profile,
  type TailoredResume,
} from "@resume-builder/shared";

export interface IntegrityIssue {
  code: string;
  message: string;
  path?: string;
}

export interface IntegrityResult {
  ok: boolean;
  issues: IntegrityIssue[];
  resume: TailoredResume;
}

/**
 * Validate that a tailored resume does not invent facts beyond the profile.
 * Soft issues (ungrounded wording, unknown skill tokens) are scrubbed when possible.
 * Hard issues (invented employers, titles, schools) fail the pipeline.
 */
export function validateFactualIntegrity(
  profile: Profile,
  resume: TailoredResume,
): IntegrityResult {
  const issues: IntegrityIssue[] = [];
  const skills = flattenSkills(profile.skills);
  const companies = new Set(profile.experience.map((e) => normalize(e.company)));
  const titles = new Set(profile.experience.map((e) => normalize(e.title)));
  const schools = new Set(profile.education.map((e) => normalize(e.school)));
  const projectNames = new Set((profile.projects ?? []).map((p) => normalize(p.name)));
  const certNames = new Set((profile.certifications ?? []).map((c) => normalize(c.name)));

  const expectedName = normalize(`${profile.personal.first_name} ${profile.personal.last_name}`);
  if (normalize(resume.contact.fullName) !== expectedName) {
    issues.push({
      code: "NAME_MISMATCH",
      message: "Resume name does not match the profile.",
      path: "contact.fullName",
    });
  }

  for (const [index, exp] of resume.experience.entries()) {
    const source = profile.experience[exp.sourceIndex];
    if (!source) {
      issues.push({
        code: "UNKNOWN_EXPERIENCE_SOURCE",
        message: "Experience entry references an unknown profile index.",
        path: `experience[${index}]`,
      });
      continue;
    }
    if (normalize(exp.company) !== normalize(source.company) && !companies.has(normalize(exp.company))) {
      issues.push({
        code: "INVENTED_EMPLOYER",
        message: "Experience employer is not present in the profile.",
        path: `experience[${index}].company`,
      });
    }
    if (normalize(exp.title) !== normalize(source.title) && !titles.has(normalize(exp.title))) {
      issues.push({
        code: "INVENTED_TITLE",
        message: "Job title is not present in the profile.",
        path: `experience[${index}].title`,
      });
    }
    if (!datePreserved(source.start_date, exp.startDate)) {
      issues.push({
        code: "DATE_ALTERED",
        message: "Start date was altered beyond formatting.",
        path: `experience[${index}].startDate`,
      });
    }
    for (const tech of exp.technologies) {
      const knownInProfile =
        skills.some((s) => skillMatches(s, tech)) ||
        (source.technologies ?? []).some((s) => skillMatches(s, tech));
      if (!knownInProfile) {
        issues.push({
          code: "INVENTED_TECHNOLOGY",
          message: `Technology "${tech}" is not evidenced in the profile.`,
          path: `experience[${index}].technologies`,
        });
      }
    }
    for (const [bIndex, bullet] of exp.bullets.entries()) {
      if (!bulletIsGrounded(bullet.text, source)) {
        issues.push({
          code: "UNGROUNDED_BULLET",
          message: "Experience bullet could not be grounded in the source profile entry.",
          path: `experience[${index}].bullets[${bIndex}]`,
        });
      }
    }
  }

  for (const [index, edu] of resume.education.entries()) {
    const source = profile.education[edu.sourceIndex];
    if (!source) {
      issues.push({
        code: "UNKNOWN_EDUCATION_SOURCE",
        message: "Education entry references an unknown profile index.",
        path: `education[${index}]`,
      });
      continue;
    }
    if (!schools.has(normalize(edu.school))) {
      issues.push({
        code: "INVENTED_SCHOOL",
        message: "School is not present in the profile.",
        path: `education[${index}].school`,
      });
    }
  }

  if ((profile.projects ?? []).length === 0 && resume.projects.length > 0) {
    for (const [index] of resume.projects.entries()) {
      issues.push({
        code: "INVENTED_PROJECT",
        message: "Projects were generated but the profile has none.",
        path: `projects[${index}]`,
      });
    }
  } else {
    for (const [index, project] of resume.projects.entries()) {
      if (!projectNames.has(normalize(project.name))) {
        issues.push({
          code: "INVENTED_PROJECT",
          message: "Project name is not present in the profile.",
          path: `projects[${index}].name`,
        });
      }
    }
  }

  if ((profile.certifications ?? []).length === 0 && resume.certifications.length > 0) {
    for (const [index] of resume.certifications.entries()) {
      issues.push({
        code: "INVENTED_CERTIFICATION",
        message: "Certification is not present in the profile.",
        path: `certifications[${index}]`,
      });
    }
  } else {
    for (const [index, cert] of resume.certifications.entries()) {
      if (!certNames.has(normalize(cert.name))) {
        issues.push({
          code: "INVENTED_CERTIFICATION",
          message: "Certification is not present in the profile.",
          path: `certifications[${index}]`,
        });
      }
    }
  }

  for (const group of resume.skills) {
    for (const item of group.items) {
      if (!skills.some((s) => skillMatches(s, item))) {
        issues.push({
          code: "INVENTED_SKILL",
          message: `Skill "${item}" is not present in the profile.`,
          path: "skills",
        });
      }
    }
  }

  const cleaned = scrubSoftInventions(resume, profile, skills);

  const hardCodes = new Set([
    "NAME_MISMATCH",
    "INVENTED_EMPLOYER",
    "INVENTED_TITLE",
    "INVENTED_SCHOOL",
    "INVENTED_PROJECT",
    "INVENTED_CERTIFICATION",
    "UNKNOWN_EXPERIENCE_SOURCE",
    "UNKNOWN_EDUCATION_SOURCE",
    "DATE_ALTERED",
  ]);
  const hardIssues = issues.filter((i) => hardCodes.has(i.code));

  return {
    ok: hardIssues.length === 0,
    issues,
    resume: cleaned,
  };
}

export function assertFactualIntegrity(profile: Profile, resume: TailoredResume): TailoredResume {
  const result = validateFactualIntegrity(profile, resume);
  if (!result.ok) {
    throw new AppError("FACTUAL_INTEGRITY_FAILED", "Tailored resume failed factual integrity checks.", {
      statusCode: 422,
      details: {
        issues: result.issues.filter((i) =>
          ![
            "UNGROUNDED_BULLET",
            "INVENTED_SKILL",
            "INVENTED_TECHNOLOGY",
          ].includes(i.code),
        ),
      },
    });
  }
  return result.resume;
}

function scrubSoftInventions(
  resume: TailoredResume,
  profile: Profile,
  profileSkills: string[],
): TailoredResume {
  const skillAllowed = (item: string) => profileSkills.some((s) => skillMatches(s, item));

  return {
    ...resume,
    skills: resume.skills
      .map((g) => ({ ...g, items: g.items.filter(skillAllowed) }))
      .filter((g) => g.items.length > 0),
    experience: resume.experience.map((exp) => {
      const source = profile.experience[exp.sourceIndex];
      const sourceTechs = source?.technologies ?? [];
      return {
        ...exp,
        technologies: exp.technologies.filter(
          (t) =>
            profileSkills.some((s) => skillMatches(s, t)) ||
            sourceTechs.some((s) => skillMatches(s, t)),
        ),
      };
    }),
    projects: (profile.projects ?? []).length === 0 ? [] : resume.projects,
    certifications: (profile.certifications ?? []).length === 0 ? [] : resume.certifications,
  };
}

function bulletIsGrounded(
  text: string,
  source: Profile["experience"][number],
): boolean {
  const blob = [
    source.description ?? "",
    ...(source.responsibilities ?? []),
    ...(source.achievements ?? []),
    source.title,
    source.company,
    ...(source.technologies ?? []),
  ]
    .join(" ")
    .toLowerCase();
  if (!blob.trim()) return true;
  const tokens = significantTokens(text);
  if (tokens.length === 0) return true;
  return tokens.filter((t) => blob.includes(t)).length >= Math.min(2, tokens.length);
}

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length >= 4);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function datePreserved(sourceRaw: string, displayed: string): boolean {
  const src = sourceRaw.trim().toLowerCase();
  const out = displayed.trim().toLowerCase();
  if (src === out) return true;
  if (/^present$/i.test(src) && /^present$/i.test(out)) return true;
  const srcCore = src.replace(/\s*\(jalali\)\s*/i, "");
  const outCore = out.replace(/\s*\(jalali\)\s*/i, "");
  return outCore.includes(srcCore) || srcCore.includes(outCore);
}
