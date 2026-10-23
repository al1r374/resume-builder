const SERVICE_URL = "http://127.0.0.1:8787";

interface GenerateResponse {
  ok: boolean;
  fileName: string;
  pdfBase64: string;
  pageCount: number | null;
  matchReport: {
    assessment: string;
    summary: string;
    missingRequirements: string[];
    requiredSkillsFound: string[];
  };
}

interface ErrorResponse {
  code?: string;
  message?: string;
}

const jobEl = document.getElementById("job") as HTMLTextAreaElement;
const templateEl = document.getElementById("template") as HTMLSelectElement;
const languageEl = document.getElementById("language") as HTMLSelectElement;
const generateBtn = document.getElementById("generate") as HTMLButtonElement;
const downloadBtn = document.getElementById("download") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const matchEl = document.getElementById("match") as HTMLDivElement;

let lastPdf: { base64: string; fileName: string } | null = null;

function setStatus(message: string, kind: "ok" | "error" | "info" = "info"): void {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.remove("ok", "error");
  if (kind === "ok") statusEl.classList.add("ok");
  if (kind === "error") statusEl.classList.add("error");
}

function clearResult(): void {
  lastPdf = null;
  downloadBtn.hidden = true;
  matchEl.hidden = true;
  matchEl.textContent = "";
}

generateBtn.addEventListener("click", async () => {
  clearResult();
  const jobDescription = jobEl.value.trim();
  if (jobDescription.length < 20) {
    setStatus("Please paste a job description (at least 20 characters).", "error");
    return;
  }

  generateBtn.disabled = true;
  setStatus("Checking local service…");

  try {
    const health = await fetch(`${SERVICE_URL}/health`, { method: "GET" });
    if (!health.ok) {
      throw new Error("Local service health check failed.");
    }
  } catch {
    setStatus(
      "Local service is not running.\n\nIn the project folder, run:\npnpm dev:server\n\nThen try again.",
      "error",
    );
    generateBtn.disabled = false;
    return;
  }

  setStatus("Generating resume… this may take a minute.");

  try {
    const response = await fetch(`${SERVICE_URL}/v1/generate-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobDescription,
        template: templateEl.value,
        language: languageEl.value,
      }),
    });

    const data = (await response.json()) as GenerateResponse & ErrorResponse;
    if (!response.ok || !data.ok || !data.pdfBase64) {
      setStatus(data.message ?? `Request failed (${response.status}).`, "error");
      return;
    }

    lastPdf = { base64: data.pdfBase64, fileName: data.fileName };
    downloadBtn.hidden = false;

    const missing = data.matchReport.missingRequirements?.slice(0, 5) ?? [];
    matchEl.hidden = false;
    matchEl.innerHTML = `<strong>Match: ${escapeHtml(data.matchReport.assessment)}</strong>${escapeHtml(
      data.matchReport.summary,
    )}${
      missing.length
        ? `<br><br>Gaps (not claimed on resume): ${escapeHtml(missing.join(", "))}`
        : ""
    }${data.pageCount != null ? `<br>Pages: ${data.pageCount}` : ""}`;

    setStatus("Resume ready. Click Download PDF.", "ok");
  } catch {
    setStatus(
      "Could not reach the local service. Ensure it is running on 127.0.0.1:8787.",
      "error",
    );
  } finally {
    generateBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!lastPdf) return;
  try {
    // Chrome frequently fails large data: URLs with ERR_FILE_NOT_FOUND.
    // Blob object URLs are reliable for extension downloads.
    const binary = atob(lastPdf.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    try {
      await chrome.downloads.download({
        url,
        filename: lastPdf.fileName,
        saveAs: true,
      });
    } finally {
      // Keep the blob alive briefly so Chrome can start the download.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed.";
    setStatus(`Could not download PDF: ${message}`, "error");
  }
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
