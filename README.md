# AI Resume Builder

Production-minded TypeScript monorepo that turns a local `profile.yaml` plus a user-supplied job description into a tailored, ATS-conscious PDF resume.

Interfaces:

- **CLI** — generate and validate from the terminal
- **Local HTTP service** — loopback-only API used by the extension (and curl)
- **Chrome Extension (MV3)** — paste a job description in a popup; never scrapes tabs

All interfaces share the same core: profile validation, AI provider abstraction, factual-integrity checks, HTML templates, and Playwright PDF rendering.

## Architecture

```
apps/
  cli/                 Commander.js CLI
  local-server/        Fastify service on 127.0.0.1
  chrome-extension/    Manifest V3 popup UI
packages/
  shared/              Zod schemas, dates, skills helpers
  ai-provider/         Provider interface + mock / openai / cursor
  core/                Profile load, pipeline, integrity
  resume-templates/    Modern (teal) + ATS-friendly HTML
  pdf-renderer/        Playwright Chromium + pdf-parse validation
```

## Prerequisites

- Node.js 20.16+ (LTS recommended; Node 22+ also fine)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- A Chrome/Chromium binary for PDF rendering:
  - Prefer `pnpm playwright:install` (downloads Playwright Chromium)
  - If that CDN is blocked in your region, set `CHROME_PATH` to a local Chrome binary (for example `/usr/bin/google-chrome-stable`)

## Installation

```bash
pnpm install
pnpm playwright:install
pnpm build
```

## Environment configuration

```bash
cp .env.example .env
```

Important variables:

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `mock` (default), `openai`, or `cursor` |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | OpenAI-compatible chat completions |
| `CURSOR_API_KEY` / `CURSOR_MODEL` | Official Cursor Agent SDK |
| `HOST` / `PORT` | Local service bind address (default `127.0.0.1:8787`) |
| `PROFILE_PATH` | Profile used by the local service |
| `ALLOWED_EXTENSION_IDS` | Optional comma-separated Chrome extension IDs |
| `MAX_JOB_DESCRIPTION_LENGTH` | Request size guard |

`.env` is gitignored. Never put API keys in the Chrome extension.

## AI provider configuration

### Verified: Cursor API key behavior

Per [Cursor APIs overview](https://cursor.com/docs/api) and the [TypeScript SDK docs](https://cursor.com/docs/sdk/typescript):

- `CURSOR_API_KEY` authenticates the **Cursor Agent SDK** / Cloud Agents API.
- It is **not** an OpenAI-compatible chat-completions key.
- There is **no** documented raw “completions” endpoint for this key.
- The SDK runs an agent workflow (`Agent.prompt` / `Agent.create`); inference still goes through Cursor-hosted models.

This project therefore:

1. Implements `AI_PROVIDER=cursor` via the official `@cursor/sdk` (`Agent.prompt`), prompting for JSON and validating with Zod.
2. Implements `AI_PROVIDER=openai` for any documented OpenAI-compatible `/v1/chat/completions` API.
3. Defaults tests and sample generation to `AI_PROVIDER=mock` (deterministic, offline, no paid calls).

Install the optional Cursor SDK when using that provider:

```bash
pnpm add @cursor/sdk --filter @resume-builder/ai-provider
```

Then:

```bash
# .env
AI_PROVIDER=cursor
CURSOR_API_KEY=your_key_here
CURSOR_MODEL=composer-2.5
```

Or OpenAI-compatible:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

If the provider is missing or misconfigured, the CLI/service fail with a clear error. They never silently invent a resume.

## Candidate profile

Keep your real data in `./assets/profile.yaml`. An anonymized example lives at `examples/profile.example.yaml`.

Personal documents live under **`assets/`**:

| Path | Purpose |
| --- | --- |
| `assets/profile.yaml` | Canonical candidate profile |
| `assets/photo.jpg` | Portrait for the Modern template |
| `assets/jobs/*.txt` | Optional saved job descriptions |

Supported photo formats: `.jpg`, `.jpeg`, `.png`, `.webp`. If the photo is missing, generation continues with a placeholder.

Private fields (`date_of_birth`, `gender`, `military_service_status`, `marital_status`, `salary_expectation`, etc.) are preserved in YAML validation but **not** rendered on resumes.

### Dates / calendars

Profile dates may be Jalali (e.g. `1404/12`). The tool:

- Does **not** silently convert them to Gregorian
- Labels Jalali-looking values when displaying
- Lets you set `preferences.date_calendar: jalali | gregorian | unknown`

### Validate profile

```bash
pnpm validate-profile
# or
pnpm cli validate-profile --profile ./assets/profile.yaml
```

## Generate a PDF (CLI)

```bash
# Offline sample with mock provider
pnpm generate:sample
pnpm generate:sample-ats

# Explicit CLI
pnpm cli generate \
  --profile ./assets/profile.yaml \
  --job ./assets/jobs/example.txt \
  --template modern \
  --language en \
  --output ./output/resume.pdf \
  --match-report ./output/match-report.json \
  --provider mock \
  --force
```

Templates: `modern` | `ats`  
Languages (initial): `en`

Output files are not overwritten unless `--force` is passed.

## Local HTTP service

```bash
pnpm dev:server
# listens on http://127.0.0.1:8787
```

Endpoints:

- `GET /health`
- `POST /v1/generate-resume` — body `{ jobDescription, template, language }`

Security defaults:

- Binds to `127.0.0.1`
- Validates `Host`
- Restricts browser `Origin` to `chrome-extension://…` (and optional allowlisted IDs)
- Does not expose filesystem APIs or accept output paths from clients
- Never returns API keys or stack traces to the extension
- Job descriptions are redacted from default logs

Trust boundary: anyone with local access to your machine can call the loopback service. Keep `AI_PROVIDER` credentials in `.env` only.

## Chrome Extension

### Build

```bash
pnpm build:extension
```

Load unpacked in Chrome:

1. Run `pnpm build:extension`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Remove any previous broken “AI Resume Builder” entry
5. **Load unpacked** → select either:
   - `apps/chrome-extension`  
   - or `apps/chrome-extension/dist`  
   Absolute path example: `~/Desktop/resume-builder-2/apps/chrome-extension`
6. Note the extension ID if you want to set `ALLOWED_EXTENSION_IDS`

After code changes, run `pnpm build:extension` again, then click **Reload** on the extension card.

### Use

1. Start the local service (`pnpm dev:server`)
2. Open the extension popup
3. Paste a job description (the extension does **not** read the active tab)
4. Choose template + language
5. Click **Generate Resume**
6. Review the match summary and **Download PDF**

Permissions requested: `downloads` + host access to `127.0.0.1:8787` / `localhost:8787` only.

## Templates

| ID | Description |
| --- | --- |
| `modern` | Two-column teal design adapted from `resume-template-modern-teal.html`; photo when available |
| `ats` | Single-column, standard headings, no skill bars; photo off by default |

Neither template claims universal ATS compatibility. Prefer `ats` when submitting through opaque parsers.

## Developer commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm playwright:install
pnpm validate-profile
pnpm generate:sample
pnpm dev:server
pnpm build:extension
```

## Testing

Vitest covers YAML/profile validation, mock job analysis, tailoring, factual integrity, match reports, templates, request/origin validation, and integration PDF generation with text extraction.

Automated tests **never** call paid APIs or require network access for AI.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Profile file not found` | Pass `--profile` or set `PROFILE_PATH` |
| `OPENAI_API_KEY is required` | Set key or use `--provider mock` |
| `CURSOR_API_KEY is required` / missing `@cursor/sdk` | Install SDK + set key, or switch provider |
| Extension: “Local service is not running” | `pnpm dev:server` |
| Playwright browser missing | `pnpm playwright:install` |
| Photo missing | Place `assets/photo.jpg` or clear `profile_photo_path` |
| Output exists | Add `--force` |

## Security and privacy

- API keys stay on the local service/CLI only
- Extension never receives provider credentials
- No tab scraping, history, cookies, or job-board integrations
- Private profile fields are not printed on resumes
- Avoid logging full profiles, job texts, or resume contents (`DEBUG=1` only for error details)

## Known limitations

- Cursor integration uses the **agent SDK**, which is heavier and less deterministic than chat completions for structured JSON.
- Jalali→Gregorian conversion is intentionally **not** automatic.
- Two-column modern layout may confuse some ATS parsers — use `ats` when unsure.
- PDF page count is content-driven; visual polish varies with length.
- Only English generation is implemented initially (`language: en`).
- Place personal files under `assets/` (`profile.yaml`, `photo.jpg`); they are gitignored by default.

## Design reference asset

`resume-template-modern-teal.html` is preserved as the visual reference and adapted into `packages/resume-templates`.
# resume-builder
# resume-builder
# resume-builder
# resume-builder
