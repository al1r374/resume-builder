import type { TailoredResume } from "@resume-builder/shared";
import { escapeHtml, nl2br } from "./escape.js";
import type { RenderOptions } from "./modern.js";

/**
 * Single-column ATS-oriented layout.
 * No skill bars, icons-as-content, or multi-column reading order.
 * Photo disabled by default (caller should leave photoDataUrl unset).
 */
export function renderAtsTemplate(resume: TailoredResume, options: RenderOptions = {}): string {
  const photo =
    resume.includePhoto && options.photoDataUrl
      ? `<img class="photo" src="${options.photoDataUrl}" alt="Portrait of ${escapeHtml(resume.contact.fullName)}">`
      : "";

  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.contact.github,
    resume.contact.website,
  ]
    .filter(Boolean)
    .map((v) => escapeHtml(v!));

  const skills = resume.skills
    .map((g) => {
      const label = g.category ? `${escapeHtml(g.category)}: ` : "";
      return `<p>${label}${escapeHtml(g.items.join(", "))}</p>`;
    })
    .join("");

  const experience = resume.experience
    .map((exp) => {
      const dates = `${escapeHtml(exp.startDate)} – ${escapeHtml(exp.endDate ?? "Present")}`;
      const bullets = exp.bullets.map((b) => `<li>${escapeHtml(b.text)}</li>`).join("");
      const techs =
        exp.technologies.length > 0
          ? `<p>Technologies: ${escapeHtml(exp.technologies.join(", "))}</p>`
          : "";
      return `<section class="job">
        <h3>${escapeHtml(exp.title)}</h3>
        <p class="meta">${escapeHtml(exp.company)}${exp.location ? ` · ${escapeHtml(exp.location)}` : ""} · ${dates}</p>
        <ul>${bullets}</ul>
        ${techs}
      </section>`;
    })
    .join("\n");

  const education = resume.education
    .map((edu) => {
      const degree = [edu.degree, edu.fieldOfStudy].filter(Boolean).map((x) => escapeHtml(x!)).join(", ");
      const year = edu.graduationYear ? ` · ${escapeHtml(edu.graduationYear)}` : "";
      return `<p><strong>${degree || "Education"}</strong> — ${escapeHtml(edu.school)}${year}</p>`;
    })
    .join("");

  const languages = resume.languages
    .map((l) => `${escapeHtml(l.name)}${l.level ? ` (${escapeHtml(l.level)})` : ""}`)
    .join(", ");

  const projects =
    resume.projects.length === 0
      ? ""
      : `<section>
          <h2>Projects</h2>
          ${resume.projects
            .map((p) => {
              const techs =
                p.technologies.length > 0
                  ? `<p>Technologies: ${escapeHtml(p.technologies.join(", "))}</p>`
                  : "";
              return `<div class="job">
                <h3>${escapeHtml(p.name)}</h3>
                ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
                ${techs}
              </div>`;
            })
            .join("")}
        </section>`;

  const certs =
    resume.certifications.length === 0
      ? ""
      : `<section>
          <h2>Certifications</h2>
          ${resume.certifications
            .map((c) => {
              const meta = [c.issuer, c.date].filter(Boolean).map((x) => escapeHtml(x!)).join(", ");
              return `<p>${escapeHtml(c.name)}${meta ? ` — ${meta}` : ""}</p>`;
            })
            .join("")}
        </section>`;

  const dateNote = resume.dateCalendarNote
    ? `<p class="note">${escapeHtml(resume.dateCalendarNote)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(resume.contact.fullName)} — Resume</title>
  <style>${ATS_CSS}</style>
</head>
<body>
  <article class="resume">
    <header>
      ${photo}
      <h1>${escapeHtml(resume.contact.fullName)}</h1>
      <p class="headline">${escapeHtml(resume.headline)}</p>
      <p class="contact">${contactParts.join(" · ")}</p>
    </header>

    <section>
      <h2>Professional Summary</h2>
      <p>${nl2br(resume.summary)}</p>
      ${dateNote}
    </section>

    <section>
      <h2>Skills</h2>
      ${skills}
    </section>

    <section>
      <h2>Professional Experience</h2>
      ${experience}
    </section>

    ${projects}

    <section>
      <h2>Education</h2>
      ${education}
    </section>

    ${certs}

    ${
      languages
        ? `<section>
            <h2>Languages</h2>
            <p>${languages}</p>
          </section>`
        : ""
    }
  </article>
</body>
</html>`;
}

const ATS_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  color: #111;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11pt;
  line-height: 1.4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.resume {
  width: 210mm;
  padding: 16mm 16mm;
  background: #fff;
}
header { margin-bottom: 14px; }
h1 {
  margin: 0 0 4px;
  font-size: 20pt;
  font-weight: 700;
}
.headline {
  margin: 0 0 6px;
  font-size: 12pt;
  font-weight: 600;
}
.contact {
  margin: 0;
  font-size: 10pt;
  color: #222;
}
.photo {
  float: right;
  width: 28mm;
  height: 28mm;
  object-fit: cover;
  margin: 0 0 8px 12px;
}
h2 {
  margin: 16px 0 8px;
  padding-bottom: 3px;
  border-bottom: 1px solid #333;
  font-size: 12pt;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  break-after: avoid-page;
}
h3 {
  margin: 0 0 2px;
  font-size: 11pt;
}
.meta {
  margin: 0 0 6px;
  color: #333;
  font-size: 10pt;
}
.job {
  margin: 0 0 12px;
  break-inside: avoid-page;
}
ul {
  margin: 4px 0 0;
  padding-left: 18px;
}
li { margin-bottom: 3px; }
p { margin: 0 0 6px; }
.note { font-size: 9pt; color: #444; }
section { break-inside: avoid-page; }
@page { size: A4; margin: 12mm; }
@media print {
  .resume { width: auto; padding: 0; }
}
`;
