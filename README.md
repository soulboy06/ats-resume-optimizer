# CheckATS

Free ATS resume checker + AI HR review for tech job seekers.
Live: https://checkats.online

## Repo layout

- `pages-deploy/` — the static site (what Cloudflare Pages serves). `index.html` is the
  tool; `guide/` holds the SEO articles; `sitemap.xml`, `robots.txt`, `llms.txt` included.
- `cloudflare/hr-review-worker.js` — the Cloudflare Worker behind the site:
  `/api/hr-review` (4-dimension AI review), `/api/rewrite` (DeepSeek rewrite),
  `/api/send-email` (Resend), `/api/feedback`. Secrets (`DEEPSEEK_API_KEY`,
  `RESEND_API_KEY`, `ADMIN_PASS`) live as Worker secrets, never in this repo.
- `cloudflare/ai-proxy-worker.js` — older standalone proxy (kept for reference).
- `guide-topics.md` — SEO article topic queue for the guide section.

## Deploy

Static site → Cloudflare Pages project `ats-resume-optimizer`
(custom domains `checkats.online`, `www.checkats.online`):

```bash
echo '{"project":"ats-resume-optimizer","dir":"<repo>/pages-deploy"}' \
  | python3 ~/workspace/skills/cloudflare/bin/pages_deploy.py
```

Worker → `wrangler deploy` (or the Cloudflare dashboard); set secrets with
`wrangler secret put DEEPSEEK_API_KEY / RESEND_API_KEY / ADMIN_PASS`.

## Sync workflow (Muse + local agent)

This repo is the source of truth. Two agents work on it:

1. **Muse** (cloud) pushes site/content changes here, then deploys.
2. **Local agent** (user's computer) pulls, works (e.g. UI redesign), pushes.

Rules: always `git pull` before starting work; never force-push; one concern per
commit; never commit secrets (`.gitignore` covers the usual suspects).

## Product notes

- Scoring is a simulation, labeled as such in the UI: ATS pass rate =
  JD keyword coverage 60% + plain-text parsability 40%.
- No login / paywall by decision (2026-10-11). Do not reintroduce paid UI
  without the owner's go-ahead.
- The UI uses the owner-approved Craft-inspired editorial design: warm cream
  graph paper, terracotta accents, serif headings, and frosted glass components
  (2026-10-12). Keep decorative imagery and colored background blobs out of the UI.
  Visual changes go through the owner first — no unprompted redesigns on main.

## Local preview

Serve `pages-deploy/` with any static HTTP server, for example:

```bash
python -m http.server 4174 --bind 127.0.0.1 --directory pages-deploy
```

The real scoring and PDF import run in the browser. AI review, rewrite, email,
and feedback continue to use the existing Cloudflare Worker.

## PDF Resume Studio

After AI Rewrite, **Save as PDF** transfers the current rewritten text to
`/studio/` using same-tab `sessionStorage`. Resume content is never put in a URL.
The homepage extracts uploaded PDF text without showing a PDF preview or asking
AI to fit the uploaded layout. The studio creates a new resume from a template;
it does not preserve the source PDF layout.

The separate workbench uses the existing cream, graph-paper and terracotta UI.
It provides three single-column templates (Classic, Modern and Minimal), editable
bilingual section fields, optional center-cropped JPEG/PNG/WebP photo upload,
A4/US Letter, text-size controls, and English/Chinese section headings. Classic
adapts the MIT-licensed sb2nov/resume layout conventions; its license is retained
in `pages-deploy/studio/licenses/`, with source attribution on `/studio/credits.html`.
Modern and Minimal are original CheckATS layouts; no upstream personal resume
content or stock photos are bundled.

Preview and download use the **same PDF bytes**, with native selectable text,
embedded fonts for Chinese, automatic pagination (up to 15 pages), and no watermark
or green annotations. Each generated PDF must pass a PDF.js text round-trip before
download. Edits immediately disable stale downloads until the new preview is ready.
Unrecognized sections are kept under Additional information for manual review;
heuristic import is not a guarantee of correct section classification. Text PDFs
up to 10 MB / 10 pages can be imported on the homepage; scans require OCR elsewhere.

Drafts (including the cropped photo) stay in this browser tab's session storage.
Storage failures are shown instead of silently losing handoff data. An older
`checkats_ai_rewrite` localStorage handoff is consumed and removed for compatibility.
Text/photos are not sent to AI from the studio. Users should review every field
and page before sending a resume; native PDF editing further depends on the PDF
editor. Export supports the bundled font's characters, not every Unicode symbol.

### Development and verification

```bash
npm ci --ignore-scripts
npm run vendor
npm test
npm run test:scoring
python scripts/verify-pdf-render.py
node scripts/preview-pdf.cjs
```

The localhost-only QA server on port 4178 mocks AI; it makes no real model calls
and adds no template-loading buttons. Upload a resume using the normal control.
For production-like AI calls, serve `pages-deploy/` using the static server above.
There is no frontend build step. Deploy `pages-deploy/` to publish the studio.
The previous mapped-layout Worker API remains backwards-compatible, but this new
studio flow uses the ordinary rewrite response and does not require mapped blocks.

PDF dependencies/licenses are self-hosted under `pages-deploy/vendor/`. The Noto
Sans SC font loads only when needed and embeds intact to avoid missing CJK outlines.
To refresh it, run `node scripts/fetch-pdf-font.cjs` with Python fonttools installed.
Tests cover all three templates in both languages, complete text retention,
unknown/repeated headings, multipage output, photo embedding, and font failures.
PDF render checks use Python PyMuPDF; inspect generated pages after font/layout changes.

## SEO and GEO checks

Public pages use the CheckATS name, self-canonical URLs, crawlable guide links, and factual structured data. `/methodology/` documents the actual local score and external data processing. `llms.txt` is an optional summary, not a search inclusion requirement.

Run `python3 scripts/verify-seo.py` and `node scripts/verify-scoring.cjs` before publishing. After deployment, submit the sitemap and inspect public URLs in Search Console and Bing Webmaster Tools. Confirm CDN crawler access and track tool usage from organic and AI referrals.
