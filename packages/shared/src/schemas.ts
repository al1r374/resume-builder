import { z } from "zod";

export const TemplateIdSchema = z.enum(["modern", "ats"]);
export type TemplateId = z.infer<typeof TemplateIdSchema>;

export const ResumeLanguageSchema = z.enum(["en"]);
export type ResumeLanguage = z.infer<typeof ResumeLanguageSchema>;

export const AiProviderNameSchema = z.enum(["mock", "openai", "cursor"]);
export type AiProviderName = z.infer<typeof AiProviderNameSchema>;

export const DateCalendarSchema = z.enum(["jalali", "gregorian", "unknown"]);
export type DateCalendar = z.infer<typeof DateCalendarSchema>;

/** Profile dates are stored as opaque strings; calendar is never inferred silently. */
export const ProfileDateSchema = z.object({
  raw: z.string().min(1),
  calendar: DateCalendarSchema.default("unknown"),
  displayHint: z.string().optional(),
});
export type ProfileDate = z.infer<typeof ProfileDateSchema>;

export const PersonalSchema = z
  .object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    linkedin: z.string().optional().nullable(),
    github: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    current_job_title: z.string().optional().nullable(),
    current_company: z.string().optional().nullable(),
    years_experience: z.union([z.number(), z.string()]).optional().nullable(),
    profile_photo_path: z.string().optional().nullable(),
    // Private fields — validated so they are not silently dropped from YAML,
    // but never rendered on resumes unless explicitly configured later.
    date_of_birth: z.string().optional().nullable(),
    gender: z.string().optional().nullable(),
    military_service_status: z.string().optional().nullable(),
    marital_status: z.string().optional().nullable(),
    employment_type_preference: z.string().optional().nullable(),
    work_authorization: z.string().optional().nullable(),
    sponsorship_required: z.boolean().optional().nullable(),
    willing_to_relocate: z.boolean().optional().nullable(),
    salary_expectation: z.union([z.string(), z.number()]).optional().nullable(),
  })
  .passthrough();

export const ExperienceItemSchema = z
  .object({
    company: z.string().min(1),
    title: z.string().min(1),
    start_date: z.string().min(1),
    end_date: z.string().optional().nullable(),
    current: z.boolean().optional().default(false),
    description: z.string().optional().nullable(),
    responsibilities: z.array(z.string()).optional().default([]),
    achievements: z.array(z.string()).optional().default([]),
    technologies: z.array(z.string()).optional().default([]),
    location: z.string().optional().nullable(),
  })
  .passthrough();

export const EducationItemSchema = z
  .object({
    school: z.string().min(1),
    degree: z.string().optional().nullable(),
    field_of_study: z.string().optional().nullable(),
    graduation_year: z.union([z.string(), z.number()]).optional().nullable(),
    start_year: z.union([z.string(), z.number()]).optional().nullable(),
    description: z.string().optional().nullable(),
  })
  .passthrough();

export const ProjectItemSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    technologies: z.array(z.string()).optional().default([]),
    url: z.string().optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
  })
  .passthrough();

export const CertificationItemSchema = z
  .object({
    name: z.string().min(1),
    issuer: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
  })
  .passthrough();

export const LanguageItemSchema = z
  .object({
    name: z.string().min(1),
    level: z.string().optional().nullable(),
  })
  .passthrough();

export const SkillsSchema = z.record(z.array(z.string())).or(z.array(z.string()));

export const PreferencesSchema = z
  .object({
    employment_type: z.string().optional().nullable(),
    resume_path: z.string().optional().nullable(),
    cover_letter_path: z.string().optional().nullable(),
    date_calendar: DateCalendarSchema.optional(),
    include_private_fields_on_resume: z.boolean().optional().default(false),
  })
  .passthrough()
  .optional();

export const ProfileSchema = z
  .object({
    personal: PersonalSchema,
    summary: z.string().optional().nullable(),
    skills: SkillsSchema.optional().default({}),
    experience: z.array(ExperienceItemSchema).default([]),
    education: z.array(EducationItemSchema).default([]),
    projects: z.array(ProjectItemSchema).optional().default([]),
    certifications: z.array(CertificationItemSchema).optional().default([]),
    languages: z.array(LanguageItemSchema).optional().default([]),
    preferences: PreferencesSchema,
  })
  .passthrough();

export type Profile = z.infer<typeof ProfileSchema>;
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;
export type EducationItem = z.infer<typeof EducationItemSchema>;

export const JobAnalysisSchema = z.object({
  jobTitle: z.string(),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  technologies: z.array(z.string()),
  responsibilities: z.array(z.string()),
  seniority: z.string().nullable(),
  domainKnowledge: z.array(z.string()),
  atsKeywords: z.array(z.string()),
  explicitRequirements: z.array(z.string()),
  inferredPreferences: z.array(z.string()),
  notes: z.array(z.string()).optional().default([]),
});
export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export const ResumeBulletSchema = z.object({
  text: z.string().min(1),
  sourceFields: z.array(z.string()).default([]),
});

export const TailoredExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  current: z.boolean().default(false),
  location: z.string().nullable().optional(),
  bullets: z.array(ResumeBulletSchema),
  technologies: z.array(z.string()).default([]),
  sourceIndex: z.number().int().nonnegative(),
});

export const TailoredResumeSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  skills: z.array(
    z.object({
      category: z.string().optional(),
      items: z.array(z.string()),
    }),
  ),
  experience: z.array(TailoredExperienceSchema),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string().nullable(),
      fieldOfStudy: z.string().nullable(),
      graduationYear: z.string().nullable(),
      sourceIndex: z.number().int().nonnegative(),
    }),
  ),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().nullable(),
        technologies: z.array(z.string()).default([]),
        sourceIndex: z.number().int().nonnegative().optional(),
      }),
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string().nullable().optional(),
        date: z.string().nullable().optional(),
      }),
    )
    .default([]),
  languages: z.array(
    z.object({
      name: z.string(),
      level: z.string().nullable().optional(),
    }),
  ),
  contact: z.object({
    fullName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    linkedin: z.string().nullable(),
    github: z.string().nullable(),
    website: z.string().nullable(),
  }),
  includePhoto: z.boolean().default(false),
  dateCalendarNote: z.string().nullable().optional(),
});
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export const MatchAssessmentSchema = z.enum([
  "strong",
  "good",
  "partial",
  "weak",
  "insufficient_data",
]);

export const MatchReportSchema = z.object({
  assessment: MatchAssessmentSchema,
  summary: z.string(),
  requiredSkillsFound: z.array(z.string()),
  preferredSkillsFound: z.array(z.string()),
  missingRequirements: z.array(z.string()),
  relevantExperience: z.array(z.string()),
  keywordsIncorporated: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type MatchReport = z.infer<typeof MatchReportSchema>;

export const GenerateResumeRequestSchema = z.object({
  jobDescription: z.string().min(20).max(100_000),
  template: TemplateIdSchema.default("modern"),
  language: ResumeLanguageSchema.default("en"),
});
export type GenerateResumeRequest = z.infer<typeof GenerateResumeRequestSchema>;

export const PRIVATE_PERSONAL_FIELDS = [
  "date_of_birth",
  "gender",
  "military_service_status",
  "marital_status",
  "employment_type_preference",
  "salary_expectation",
  "sponsorship_required",
  "willing_to_relocate",
  "work_authorization",
] as const;
