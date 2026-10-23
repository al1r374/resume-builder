import type { JobAnalysis, MatchReport, Profile, TailoredResume } from "@resume-builder/shared";

export interface AnalyzeJobInput {
  jobDescription: string;
}

export interface TailorResumeInput {
  profile: Profile;
  jobAnalysis: JobAnalysis;
  jobDescription: string;
  language: "en";
}

export interface MatchReportInput {
  profile: Profile;
  jobAnalysis: JobAnalysis;
  tailoredResume: TailoredResume;
}

export interface AiProvider {
  readonly name: string;
  analyzeJobDescription(input: AnalyzeJobInput): Promise<JobAnalysis>;
  tailorResume(input: TailorResumeInput): Promise<TailoredResume>;
  generateMatchReport(input: MatchReportInput): Promise<MatchReport>;
}
