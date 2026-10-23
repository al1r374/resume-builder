import type { TailoredResume, TemplateId } from "@resume-builder/shared";
import { AppError } from "@resume-builder/shared";
import { renderAtsTemplate } from "./ats.js";
import { renderModernTemplate, type RenderOptions } from "./modern.js";

export { renderModernTemplate } from "./modern.js";
export { renderAtsTemplate } from "./ats.js";
export type { RenderOptions } from "./modern.js";

export function renderResumeHtml(
  template: TemplateId,
  resume: TailoredResume,
  options: RenderOptions = {},
): string {
  switch (template) {
    case "modern":
      return renderModernTemplate(resume, options);
    case "ats":
      return renderAtsTemplate(resume, {
        ...options,
        // ATS template disables photo unless explicitly requested via resume.includePhoto
        photoDataUrl: resume.includePhoto ? options.photoDataUrl : null,
      });
    default:
      throw new AppError("UNKNOWN_TEMPLATE", `Unknown template: ${template as string}`, {
        statusCode: 400,
      });
  }
}

export function listTemplates(): Array<{ id: TemplateId; label: string; photoDefault: boolean }> {
  return [
    { id: "modern", label: "Modern", photoDefault: true },
    { id: "ats", label: "ATS-Friendly", photoDefault: false },
  ];
}
