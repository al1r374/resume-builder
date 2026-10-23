import { PDFParse } from "pdf-parse";
import { AppError, type TailoredResume } from "@resume-builder/shared";

export interface PdfValidationResult {
  ok: boolean;
  text: string;
  pageCount: number;
  issues: string[];
}

export async function extractPdfText(pdf: Buffer): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: pdf });
  try {
    const textResult = await parser.getText();
    const info = await parser.getInfo();
    return {
      text: textResult.text ?? "",
      pageCount: info.total ?? 0,
    };
  } finally {
    await parser.destroy();
  }
}

export async function validateGeneratedPdf(
  pdf: Buffer,
  resume: TailoredResume,
): Promise<PdfValidationResult> {
  const { text, pageCount } = await extractPdfText(pdf);
  const issues: string[] = [];

  if (!text.trim()) {
    issues.push("PDF text extraction returned empty content (may be image-only).");
  }
  if (pageCount < 1) {
    issues.push("PDF has no pages.");
  }

  const normalized = text.replace(/\s+/g, " ");
  const nameParts = resume.contact.fullName.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = normalized.toLowerCase();
  // Templates may uppercase the display name via CSS; match each name part.
  if (!nameParts.every((part) => haystack.includes(part))) {
    issues.push("Candidate name not found in PDF text.");
  }

  const expectedHeadings = ["Professional Summary", "Professional Experience", "Education", "Skills"];
  for (const heading of expectedHeadings) {
    if (!normalized.toLowerCase().includes(heading.toLowerCase())) {
      issues.push(`Expected section heading missing: ${heading}`);
    }
  }

  if (resume.experience[0] && !normalized.toLowerCase().includes(resume.experience[0].company.toLowerCase())) {
    issues.push("First experience company not found in PDF text.");
  }
  if (resume.education[0] && !normalized.toLowerCase().includes(resume.education[0].school.toLowerCase())) {
    issues.push("Education school not found in PDF text.");
  }

  // Detect crude truncation markers
  if (/\uFFFD{3,}/.test(text)) {
    issues.push("Possible text truncation or encoding issues detected.");
  }

  return {
    ok: issues.length === 0,
    text,
    pageCount,
    issues,
  };
}

export async function assertValidPdf(pdf: Buffer, resume: TailoredResume): Promise<PdfValidationResult> {
  const result = await validateGeneratedPdf(pdf, resume);
  if (!result.ok) {
    throw new AppError("PDF_VALIDATION_FAILED", "Generated PDF failed content validation.", {
      statusCode: 500,
      details: { issues: result.issues, pageCount: result.pageCount },
    });
  }
  return result;
}
