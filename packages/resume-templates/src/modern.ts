import type { TailoredResume } from "@resume-builder/shared";
import { escapeHtml, nl2br } from "./escape.js";

export interface RenderOptions {
  photoDataUrl?: string | null;
}

export function renderModernTemplate(resume: TailoredResume, options: RenderOptions = {}): string {
  const nameParts = resume.contact.fullName.trim().split(/\s+/);
  const first = nameParts[0] ?? "";
  const rest = nameParts.slice(1).join(" ");
  const photo =
    resume.includePhoto && options.photoDataUrl
      ? `<img class="portrait" src="${options.photoDataUrl}" alt="Portrait of ${escapeHtml(resume.contact.fullName)}">`
      : `<div class="portrait-placeholder" role="img" aria-label="Profile photo unavailable">Photo</div>`;

  const contactItems = [
    resume.contact.email ? contactLi("@", resume.contact.email) : "",
    resume.contact.phone ? contactLi("☎", resume.contact.phone) : "",
    resume.contact.linkedin ? contactLi("in", stripUrl(resume.contact.linkedin)) : "",
    resume.contact.github ? contactLi("⌘", stripUrl(resume.contact.github)) : "",
    resume.contact.website ? contactLi("↗", stripUrl(resume.contact.website)) : "",
    resume.contact.location ? contactLi("⌖", resume.contact.location) : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Compact comma-separated skills keep the sidebar on one page with Contact/Languages.
  const skillsHtml = resume.skills
    .map((group) => {
      const title = group.category
        ? `<p class="skill-category">${escapeHtml(group.category)}</p>`
        : "";
      return `${title}<p class="skill-line">${escapeHtml(group.items.join(", "))}</p>`;
    })
    .join("");

  const languagesHtml = resume.languages
    .map((l) => {
      const level = l.level ? ` — ${escapeHtml(l.level)}` : "";
      return `<p><strong>${escapeHtml(l.name)}</strong>${level}</p>`;
    })
    .join("");

  const experienceHtml = resume.experience
    .map((exp) => {
      const date = `${escapeHtml(exp.startDate)}<br>— ${escapeHtml(exp.endDate ?? "Present")}`;
      const bullets = exp.bullets.map((b) => `<li>${escapeHtml(b.text)}</li>`).join("");
      const techs =
        exp.technologies.length > 0
          ? `<p class="tag-list"><strong>Technologies:</strong> ${escapeHtml(exp.technologies.join(", "))}</p>`
          : "";
      const location = exp.location ? ` · ${escapeHtml(exp.location)}` : "";
      return `<article class="experience-item">
        <div class="date">${date}</div>
        <div class="item-content">
          <h3 class="item-title">${escapeHtml(exp.title)}</h3>
          <p class="item-subtitle">${escapeHtml(exp.company)}${location}</p>
          <ul>${bullets}</ul>
          ${techs}
        </div>
      </article>`;
    })
    .join("\n");

  const educationHtml = resume.education
    .map((edu) => {
      const year = edu.graduationYear ? escapeHtml(edu.graduationYear) : "";
      const degree = [edu.degree, edu.fieldOfStudy].filter(Boolean).map((x) => escapeHtml(x!)).join(", ");
      return `<article class="education-item">
        <div class="date">${year}</div>
        <div class="item-content">
          <h3 class="item-title">${degree || "Education"}</h3>
          <p class="item-subtitle">${escapeHtml(edu.school)}</p>
        </div>
      </article>`;
    })
    .join("\n");

  const projectsHtml =
    resume.projects.length === 0
      ? ""
      : `<section class="section" aria-labelledby="projects-heading">
          <h2 class="section-title" id="projects-heading"><span class="icon" aria-hidden="true">⌘</span> Selected Projects</h2>
          ${resume.projects
            .map((p) => {
              const techs =
                p.technologies.length > 0
                  ? `<p class="tag-list"><strong>Technologies:</strong> ${escapeHtml(p.technologies.join(", "))}</p>`
                  : "";
              return `<article class="project-item">
                <div class="date">Project</div>
                <div class="item-content">
                  <h3 class="item-title">${escapeHtml(p.name)}</h3>
                  ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
                  ${techs}
                </div>
              </article>`;
            })
            .join("\n")}
        </section>`;

  const certHtml =
    resume.certifications.length === 0
      ? ""
      : `<section class="section" aria-labelledby="cert-heading">
          <h2 class="section-title" id="cert-heading"><span class="icon" aria-hidden="true">＋</span> Certifications</h2>
          ${resume.certifications
            .map((c) => {
              const meta = [c.issuer, c.date].filter(Boolean).map((x) => escapeHtml(x!)).join(" · ");
              return `<p><strong>${escapeHtml(c.name)}</strong>${meta ? ` — ${meta}` : ""}</p>`;
            })
            .join("")}
        </section>`;

  const dateNote = resume.dateCalendarNote
    ? `<p class="date-note muted">${escapeHtml(resume.dateCalendarNote)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(resume.contact.fullName)} — Resume</title>
  <style>${MODERN_CSS}</style>
</head>
<body>
  <article class="resume" aria-label="Resume">
    <div class="layout">
      <aside class="sidebar" aria-label="Contact and skills">
        <div class="portrait-panel">${photo}</div>
        <section class="section" aria-labelledby="contact-heading">
          <h2 class="section-title" id="contact-heading"><span class="icon" aria-hidden="true">✉</span> Contact</h2>
          <ul class="contact-list">${contactItems}</ul>
        </section>
        <section class="section" aria-labelledby="skills-heading">
          <h2 class="section-title" id="skills-heading"><span class="icon" aria-hidden="true">⚙</span> Technical Skills</h2>
          ${skillsHtml}
        </section>
        ${
          languagesHtml
            ? `<section class="section" aria-labelledby="languages-heading">
                <h2 class="section-title" id="languages-heading"><span class="icon" aria-hidden="true">文</span> Languages</h2>
                ${languagesHtml}
              </section>`
            : ""
        }
        ${certHtml}
      </aside>
      <main class="main">
        <header class="section">
          <h1>${escapeHtml(first)}${rest ? ` <span class="accent">${escapeHtml(rest)}</span>` : ""}</h1>
          <p class="headline">${escapeHtml(resume.headline)}</p>
        </header>
        <section class="section" aria-labelledby="summary-heading">
          <h2 class="section-title" id="summary-heading"><span class="icon" aria-hidden="true">▤</span> Professional Summary</h2>
          <p>${nl2br(resume.summary)}</p>
          ${dateNote}
        </section>
        <section class="section" aria-labelledby="experience-heading">
          <h2 class="section-title" id="experience-heading"><span class="icon" aria-hidden="true">▣</span> Professional Experience</h2>
          ${experienceHtml}
        </section>
        ${projectsHtml}
        <section class="section" aria-labelledby="education-heading">
          <h2 class="section-title" id="education-heading"><span class="icon" aria-hidden="true">▤</span> Education</h2>
          ${educationHtml}
        </section>
      </main>
    </div>
  </article>
</body>
</html>`;
}

function contactLi(mark: string, value: string): string {
  return `<li><span class="contact-mark" aria-hidden="true">${escapeHtml(mark)}</span><span>${escapeHtml(value)}</span></li>`;
}

function stripUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

const MODERN_CSS = `
:root {
  --teal: #8bc9c8;
  --teal-dark: #4caaa9;
  --ink: #292d31;
  --muted: #626a70;
  --line: #353a3e;
  --paper: #fff;
  --panel: #f0f1f2;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  color: var(--ink);
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
  font-size: 10px;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.resume {
  width: 210mm;
  padding: 8mm;
  background: var(--paper);
  position: relative;
  isolation: isolate;
}
.resume::before {
  content: "";
  position: absolute;
  z-index: -1;
  top: 0; right: 0;
  width: 26%; height: 7mm;
  background: var(--teal);
}
.resume::after {
  content: "";
  position: absolute;
  z-index: -1;
  top: 0; right: 0;
  width: 7mm; height: 38mm;
  background: var(--teal);
}
.layout {
  display: flow-root; /* contain floated sidebar */
}
.sidebar {
  float: left;
  width: 34%;
  background: var(--panel);
  padding: 0 4mm 5mm;
  margin: 0 6mm 4mm 0;
  min-width: 0;
  /* Keep Contact + Skills + Languages together on the first page column. */
  break-inside: avoid;
  page-break-inside: avoid;
}
.portrait-panel {
  margin: 0 -4mm 6mm;
  min-height: 58mm;
  padding: 7mm 3mm;
  background: var(--teal);
  display: flex;
  align-items: center;
  justify-content: center;
}
.portrait, .portrait-placeholder {
  width: 44mm; height: 44mm;
  border: 3px solid #fff;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}
.portrait-placeholder {
  background: #d8e4e4;
  display: grid;
  place-items: center;
  color: #526365;
  font-size: 8px;
  text-align: center;
}
.main {
  min-width: 0;
  padding: 8mm 2mm 4mm 0;
  overflow: hidden; /* sit beside floated sidebar */
}
h1 {
  margin: 0;
  font-size: 25px;
  line-height: 1.08;
  letter-spacing: .2px;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}
h1 .accent { color: var(--teal-dark); }
.headline {
  margin: 4px 0 16px;
  color: #454c50;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .35px;
  text-transform: uppercase;
}
.section { margin: 0 0 14px; }
.main > .section { break-inside: avoid-page; page-break-inside: avoid; }
.section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 9px;
  padding: 0 0 5px;
  border-bottom: 1.5px solid var(--line);
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .2px;
  break-after: avoid;
  page-break-after: avoid;
}
.section-title .icon {
  flex: 0 0 17px;
  width: 17px; height: 17px;
  display: inline-grid;
  place-items: center;
  background: var(--ink);
  color: white;
  font-size: 10px;
}
.sidebar .section {
  margin-bottom: 12px;
  break-inside: auto;
  page-break-inside: auto;
}
.sidebar .section-title { font-size: 11px; margin-bottom: 6px; }
p { margin: 0 0 6px; }
.muted, .date-note { color: var(--muted); font-size: 8.5px; }
.contact-list { list-style: none; padding: 0; margin: 0; }
.contact-list li {
  display: flex; gap: 7px; margin: 0 0 5px;
  overflow-wrap: anywhere;
  font-size: 9px;
}
.contact-mark {
  width: 13px; flex: 0 0 13px; height: 13px;
  border-radius: 50%;
  background: var(--ink); color: #fff;
  font-size: 7px; font-weight: bold;
  display: inline-grid; place-items: center; margin-top: 1px;
}
.skill-category { margin: 6px 0 2px; font-weight: 700; font-size: 8.5px; }
.skill-line {
  margin: 0 0 4px;
  font-size: 8.5px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.experience-item, .education-item, .project-item {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  margin: 0 0 15px;
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.date {
  color: #3f4549;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.4;
  white-space: pre-line;
}
.item-content {
  border-left: 1px solid #c6cbcd;
  padding-left: 10px;
  min-width: 0;
}
.item-title {
  margin: 0 0 3px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}
.item-subtitle {
  margin: 0 0 5px;
  font-size: 9px;
  font-weight: 700;
  color: #555d62;
}
.item-content ul { margin: 4px 0 0; padding-left: 14px; }
.item-content li { margin-bottom: 3px; }
.tag-list { margin-top: 5px; color: #4b5659; font-size: 9px; }
@page { size: A4; margin: 10mm 8mm; }
@media print {
  .resume { width: auto; padding: 0; }
  .resume::before, .resume::after { display: none; }
}
`;
