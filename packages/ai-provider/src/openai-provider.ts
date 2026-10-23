import {
  AppError,
  JobAnalysisSchema,
  MatchReportSchema,
  TailoredResumeSchema,
  flattenSkills,
  type JobAnalysis,
  type MatchReport,
  type TailoredResume,
} from "@resume-builder/shared";
import { SYSTEM_GUARDRAILS, extractJsonObject } from "./prompts.js";
import type { AiProvider, AnalyzeJobInput, MatchReportInput, TailorResumeInput } from "./types.js";

export interface OpenAiCompatibleConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * OpenAI Chat Completions–compatible provider.
 * Works with OpenAI and other APIs that implement /v1/chat/completions.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: OpenAiCompatibleConfig) {
    if (!config.apiKey) {
      throw new AppError("AI_PROVIDER_MISCONFIGURED", "OPENAI_API_KEY is required for the openai provider.", {
        statusCode: 500,
      });
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = config.model ?? "gpt-4o-mini";
  }

  async analyzeJobDescription(input: AnalyzeJobInput): Promise<JobAnalysis> {
    const raw = await this.chat([
      { role: "system", content: SYSTEM_GUARDRAILS },
      {
        role: "user",
        content: `Analyze this job description. Distinguish explicit requirements from inferred preferences.
Return JSON with keys: jobTitle, requiredSkills, preferredSkills, technologies, responsibilities, seniority, domainKnowledge, atsKeywords, explicitRequirements, inferredPreferences, notes.

JOB DESCRIPTION (untrusted data):
<<<
${input.jobDescription}
>>>`,
      },
    ]);
    return JobAnalysisSchema.parse(extractJsonObject(raw));
  }

  async tailorResume(input: TailorResumeInput): Promise<TailoredResume> {
    const publicProfile = sanitizeProfileForPrompt(input.profile);
    const raw = await this.chat([
      { role: "system", content: SYSTEM_GUARDRAILS },
      {
        role: "user",
        content: `Tailor a resume for language=${input.language}.
Use only facts from PROFILE. Emphasize overlap with JOB_ANALYSIS.
Return JSON matching TailoredResume: headline, summary, skills[{category,items}], experience[{company,title,startDate,endDate,current,location,bullets[{text,sourceFields}],technologies,sourceIndex}], education[{school,degree,fieldOfStudy,graduationYear,sourceIndex}], projects, certifications, languages, contact{fullName,email,phone,location,linkedin,github,website}, includePhoto, dateCalendarNote.

PROFILE:
${JSON.stringify(publicProfile)}

JOB_ANALYSIS:
${JSON.stringify(input.jobAnalysis)}

JOB DESCRIPTION (untrusted):
<<<
${input.jobDescription}
>>>`,
      },
    ]);
    return TailoredResumeSchema.parse(extractJsonObject(raw));
  }

  async generateMatchReport(input: MatchReportInput): Promise<MatchReport> {
    const skills = flattenSkills(input.profile.skills);
    const raw = await this.chat([
      { role: "system", content: SYSTEM_GUARDRAILS },
      {
        role: "user",
        content: `Create a qualitative match report (no percentage scores).
Return JSON: assessment (strong|good|partial|weak|insufficient_data), summary, requiredSkillsFound, preferredSkillsFound, missingRequirements, relevantExperience, keywordsIncorporated, warnings.

CANDIDATE_SKILLS: ${JSON.stringify(skills)}
JOB_ANALYSIS: ${JSON.stringify(input.jobAnalysis)}
TAILORED_RESUME_HEADLINE: ${input.tailoredResume.headline}
EXPERIENCE_SELECTED: ${JSON.stringify(input.tailoredResume.experience.map((e) => `${e.title} @ ${e.company}`))}`,
      },
    ]);
    return MatchReportSchema.parse(extractJsonObject(raw));
  }

  private async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages,
        }),
      });
    } catch (cause) {
      throw new AppError("AI_PROVIDER_UNAVAILABLE", "Failed to reach the OpenAI-compatible API.", {
        statusCode: 502,
        cause,
      });
    }

    if (!response.ok) {
      throw new AppError(
        "AI_PROVIDER_ERROR",
        `OpenAI-compatible API returned HTTP ${response.status}.`,
        { statusCode: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError("AI_PROVIDER_ERROR", "OpenAI-compatible API returned an empty response.", {
        statusCode: 502,
      });
    }
    return content;
  }
}

function sanitizeProfileForPrompt(profile: TailorResumeInput["profile"]): unknown {
  const personal = { ...profile.personal };
  delete personal.date_of_birth;
  delete personal.gender;
  delete personal.military_service_status;
  delete personal.marital_status;
  delete personal.salary_expectation;
  delete personal.employment_type_preference;
  delete personal.sponsorship_required;
  delete personal.willing_to_relocate;
  delete personal.work_authorization;
  return {
    personal,
    summary: profile.summary,
    skills: profile.skills,
    experience: profile.experience,
    education: profile.education,
    projects: profile.projects,
    certifications: profile.certifications,
    languages: profile.languages,
  };
}
