import { chromium, type Browser } from "playwright";
import { renderResumeHtml } from "@resume-builder/resume-templates";
import { AppError, type TailoredResume, type TemplateId } from "@resume-builder/shared";
import { loadPhotoDataUrl } from "./photo.js";
import { assertValidPdf, type PdfValidationResult } from "./validate-pdf.js";

export interface RenderPdfInput {
  resume: TailoredResume;
  template: TemplateId;
  photoPath?: string | null;
  /** Directories the photo path must remain inside. */
  allowedPhotoDirs: string[];
  validate?: boolean;
}

export interface RenderPdfResult {
  pdf: Buffer;
  html: string;
  validation?: PdfValidationResult;
}

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }
  // Prefer Playwright's bundled Chromium. If unavailable (e.g. CDN geo-block),
  // fall back to an installed Chrome channel or CHROME_PATH.
  const executablePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
  try {
    sharedBrowser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
  } catch (bundledError) {
    try {
      sharedBrowser = await chromium.launch({
        headless: true,
        channel: "chrome",
      });
    } catch {
      throw new AppError(
        "PDF_BROWSER_UNAVAILABLE",
        "Could not launch Chromium/Chrome for PDF rendering. Run `pnpm playwright:install` or set CHROME_PATH to a local Chrome binary.",
        { statusCode: 500, cause: bundledError },
      );
    }
  }
  return sharedBrowser;
}

export async function closePdfBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export async function renderResumePdf(input: RenderPdfInput): Promise<RenderPdfResult> {
  let photoDataUrl: string | null = null;
  try {
    photoDataUrl = await loadPhotoDataUrl(input.photoPath, input.allowedPhotoDirs);
  } catch (error) {
    if (error instanceof AppError && error.code === "PHOTO_PATH_DENIED") {
      throw error;
    }
    photoDataUrl = null;
  }

  // If photo missing, disable includePhoto for rendering.
  const resume: TailoredResume = {
    ...input.resume,
    includePhoto: Boolean(input.resume.includePhoto && photoDataUrl),
  };

  const html = renderResumeHtml(input.template, resume, { photoDataUrl });

  let pdf: Buffer;
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      pdf = Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  } catch (cause) {
    throw new AppError("PDF_RENDER_FAILED", "Failed to render resume PDF with Playwright.", {
      statusCode: 500,
      cause,
    });
  }

  let validation: PdfValidationResult | undefined;
  if (input.validate !== false) {
    validation = await assertValidPdf(pdf, resume);
  }

  return { pdf, html, validation };
}
