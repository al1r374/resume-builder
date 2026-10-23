import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { AppError, ProfileSchema, type Profile } from "@resume-builder/shared";

export interface ProfileValidationIssue {
  path: string;
  message: string;
}

export interface ProfileValidationResult {
  ok: boolean;
  issues: ProfileValidationIssue[];
  profile?: Profile;
}

export async function loadProfileFromFile(filePath: string): Promise<Profile> {
  const absolute = path.resolve(filePath);
  let raw: string;
  try {
    raw = await readFile(absolute, "utf8");
  } catch (cause) {
    throw new AppError("PROFILE_NOT_FOUND", `Profile file not found: ${absolute}`, {
      statusCode: 400,
      cause,
    });
  }

  return parseProfileYaml(raw, absolute);
}

export function parseProfileYaml(raw: string, sourceLabel = "profile.yaml"): Profile {
  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (cause) {
    throw new AppError("PROFILE_INVALID_YAML", `Failed to parse YAML in ${sourceLabel}.`, {
      statusCode: 400,
      cause,
    });
  }

  const result = validateProfileData(data);
  if (!result.ok || !result.profile) {
    throw new AppError("PROFILE_INVALID", `Profile validation failed for ${sourceLabel}.`, {
      statusCode: 400,
      details: { issueCount: result.issues.length, issues: sanitizeIssues(result.issues) },
    });
  }
  return result.profile;
}

export function validateProfileData(data: unknown): ProfileValidationResult {
  const parsed = ProfileSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }

  const issues: ProfileValidationIssue[] = [];
  const profile = parsed.data;

  if (!profile.personal.first_name?.trim()) {
    issues.push({ path: "personal.first_name", message: "Required" });
  }
  if (!profile.personal.last_name?.trim()) {
    issues.push({ path: "personal.last_name", message: "Required" });
  }
  if (!profile.experience.length) {
    issues.push({ path: "experience", message: "At least one experience entry is recommended" });
  }
  if (!profile.education.length) {
    issues.push({ path: "education", message: "At least one education entry is recommended" });
  }

  const hardErrors = issues.filter((i) => i.message === "Required");
  return {
    ok: hardErrors.length === 0,
    issues,
    profile,
  };
}

/** Avoid echoing sensitive field values in validation output. */
function sanitizeIssues(issues: ProfileValidationIssue[]): ProfileValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
}

export function resolvePhotoPath(profile: Profile, profileFilePath: string): string | null {
  const relative = profile.personal.profile_photo_path;
  if (!relative || typeof relative !== "string" || !relative.trim()) return null;
  const baseDir = path.dirname(path.resolve(profileFilePath));
  return path.resolve(baseDir, relative);
}
