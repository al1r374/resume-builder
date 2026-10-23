import type { AiProvider } from "@resume-builder/ai-provider";
import {
  AppError,
  type JobAnalysis,
  type MatchReport,
  type Profile,
  type ResumeLanguage,
  type TailoredResume,
  type TemplateId,
} from "@resume-builder/shared";
import { assertFactualIntegrity } from "./integrity.js";
import { loadProfileFromFile, resolvePhotoPath } from "./profile.js";

export interface GenerateResumeInput {
  profilePath: string;
  jobDescription: string;
  template: TemplateId;
  language: ResumeLanguage;
  provider: AiProvider;
  includePhoto?: boolean;
}

export interface GenerateResumeResult {
  profile: Profile;
  jobAnalysis: JobAnalysis;
  resume: TailoredResume;
  matchReport: MatchReport;
  photoPath: string | null;
  template: TemplateId;
  language: ResumeLanguage;
}

export async function generateTailoredResume(
  input: GenerateResumeInput,
): Promise<GenerateResumeResult> {
  if (!input.jobDescription?.trim() || input.jobDescription.trim().length < 20) {
    throw new AppError("INVALID_JOB_DESCRIPTION", "Job description must be at least 20 characters.", {
      statusCode: 400,
    });
  }

  const profile = await loadProfileFromFile(input.profilePath);
  const photoPath = resolvePhotoPath(profile, input.profilePath);

  const jobAnalysis = await input.provider.analyzeJobDescription({
    jobDescription: input.jobDescription,
  });

  let resume = await input.provider.tailorResume({
    profile,
    jobAnalysis,
    jobDescription: input.jobDescription,
    language: input.language,
  });

  const wantPhoto =
    input.includePhoto ?? (input.template === "modern" && Boolean(photoPath));
  resume = {
    ...resume,
    includePhoto: Boolean(wantPhoto && photoPath),
  };

  resume = assertFactualIntegrity(profile, resume);

  const matchReport = await input.provider.generateMatchReport({
    profile,
    jobAnalysis,
    tailoredResume: resume,
  });

  return {
    profile,
    jobAnalysis,
    resume,
    matchReport,
    photoPath: resume.includePhoto ? photoPath : null,
    template: input.template,
    language: input.language,
  };
}
