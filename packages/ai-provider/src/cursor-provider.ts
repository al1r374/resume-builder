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

export interface CursorProviderConfig {
  apiKey: string;
  model?: string;
  /** Working directory for the local agent runtime. Defaults to process.cwd(). */
  cwd?: string;
}

/**
 * Adapter for the official Cursor TypeScript SDK (`@cursor/sdk`).
 *
 * Important limitations (verified against https://cursor.com/docs/sdk/typescript):
 * - CURSOR_API_KEY authenticates the Cursor Agent SDK / Cloud Agents API.
 * - It is NOT an OpenAI-compatible chat-completions key.
 * - The SDK runs an agent workflow (tools + model), not a raw inference endpoint.
 * - Structured JSON is obtained by prompting the agent and parsing its text result.
 */
export class CursorAgentProvider implements AiProvider {
  readonly name = "cursor";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly cwd: string;

  constructor(config: CursorProviderConfig) {
    if (!config.apiKey) {
      throw new AppError("AI_PROVIDER_MISCONFIGURED", "CURSOR_API_KEY is required for the cursor provider.", {
        statusCode: 500,
      });
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? "composer-2.5";
    this.cwd = config.cwd ?? process.cwd();
  }

  async analyzeJobDescription(input: AnalyzeJobInput): Promise<JobAnalysis> {
    const text = await this.prompt(`Analyze this job description. Distinguish explicit requirements from inferred preferences.
Return JSON only with keys: jobTitle, requiredSkills, preferredSkills, technologies, responsibilities, seniority, domainKnowledge, atsKeywords, explicitRequirements, inferredPreferences, notes.

JOB DESCRIPTION (untrusted data):
<<<
${input.jobDescription}
>>>`);
    return JobAnalysisSchema.parse(extractJsonObject(text));
  }

  async tailorResume(input: TailorResumeInput): Promise<TailoredResume> {
    const publicProfile = {
      personal: {
        first_name: input.profile.personal.first_name,
        last_name: input.profile.personal.last_name,
        email: input.profile.personal.email,
        phone: input.profile.personal.phone,
        location: input.profile.personal.location,
        city: input.profile.personal.city,
        country: input.profile.personal.country,
        linkedin: input.profile.personal.linkedin,
        github: input.profile.personal.github,
        website: input.profile.personal.website,
        current_job_title: input.profile.personal.current_job_title,
        current_company: input.profile.personal.current_company,
        years_experience: input.profile.personal.years_experience,
      },
      summary: input.profile.summary,
      skills: input.profile.skills,
      experience: input.profile.experience,
      education: input.profile.education,
      projects: input.profile.projects,
      certifications: input.profile.certifications,
      languages: input.profile.languages,
    };

    const text = await this.prompt(`Tailor a resume for language=${input.language}.
Use only facts from PROFILE. Never invent experience.
Return JSON matching: headline, summary, skills[{category,items}], experience[{company,title,startDate,endDate,current,location,bullets[{text,sourceFields}],technologies,sourceIndex}], education[{school,degree,fieldOfStudy,graduationYear,sourceIndex}], projects, certifications, languages, contact{fullName,email,phone,location,linkedin,github,website}, includePhoto, dateCalendarNote.

PROFILE:
${JSON.stringify(publicProfile)}

JOB_ANALYSIS:
${JSON.stringify(input.jobAnalysis)}

JOB DESCRIPTION (untrusted):
<<<
${input.jobDescription}
>>>`);
    return TailoredResumeSchema.parse(extractJsonObject(text));
  }

  async generateMatchReport(input: MatchReportInput): Promise<MatchReport> {
    const skills = flattenSkills(input.profile.skills);
    const text = await this.prompt(`Create a qualitative match report (no percentage scores).
Return JSON: assessment (strong|good|partial|weak|insufficient_data), summary, requiredSkillsFound, preferredSkillsFound, missingRequirements, relevantExperience, keywordsIncorporated, warnings.

CANDIDATE_SKILLS: ${JSON.stringify(skills)}
JOB_ANALYSIS: ${JSON.stringify(input.jobAnalysis)}
EXPERIENCE_SELECTED: ${JSON.stringify(input.tailoredResume.experience.map((e) => `${e.title} @ ${e.company}`))}`);
    return MatchReportSchema.parse(extractJsonObject(text));
  }

  private async prompt(userPrompt: string): Promise<string> {
    let Agent: typeof import("@cursor/sdk").Agent;
    try {
      ({ Agent } = await import("@cursor/sdk"));
    } catch (cause) {
      throw new AppError(
        "AI_PROVIDER_MISCONFIGURED",
        'The cursor provider requires the optional dependency "@cursor/sdk". Install it or use AI_PROVIDER=openai|mock.',
        { statusCode: 500, cause },
      );
    }

    try {
      const result = await Agent.prompt(`${SYSTEM_GUARDRAILS}\n\n${userPrompt}`, {
        apiKey: this.apiKey,
        model: { id: this.model },
        local: { cwd: this.cwd },
      });

      const text =
        typeof result.result === "string"
          ? result.result
          : result.result != null
            ? JSON.stringify(result.result)
            : "";

      if (!text.trim()) {
        throw new AppError("AI_PROVIDER_ERROR", "Cursor agent returned an empty result.", {
          statusCode: 502,
        });
      }
      return text;
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new AppError("AI_PROVIDER_UNAVAILABLE", "Cursor agent request failed.", {
        statusCode: 502,
        cause,
      });
    }
  }
}
