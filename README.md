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
It provides **30 real Typst templates** from the audited MIT-0
`davidculemann/typst-templates` snapshot, including single-column, sidebar,
photo-header, editorial, grid and timeline layouts. The template carousel uses
five full cards on a wide preview area and reduces the count on narrow screens.
The carousel's **All 30** link opens `/studio/templates/`, a responsive gallery
with single-column/sidebar/photo filters and bilingual name search. Selecting a
card returns to the studio with the draft, photo and page settings intact. The
selected template ID is consumed from the URL after restoration so a reload
does not overwrite subsequent carousel changes.
Editable bilingual sections, JPEG/PNG/WebP photo upload, A4/US Letter, text size
from 8–16 pt in 0.5 pt steps, and body line spacing (template default or
1/1.15/1.3/1.5/1.75/2×) are supported. Size and spacing persist with the draft
and apply to both preview and export. English/Chinese headings, zoom and
fullscreen preview are also supported. The original
source snapshot, adapted layout functions and license are retained under
`pages-deploy/studio/typst/` and `licenses/`. `/studio/credits.html` lists sources.
Template thumbnails are generated from our test PDFs; upstream sample resume
content and portraits are not inserted into user documents.

Compilation runs in a dedicated browser worker using a self-hosted Typst Wasm
compiler and local typefaces. First use downloads the engine and fonts; no resume
or photo is sent to a rendering service. The 28 MB Wasm is distributed as a 10.7 MB
gzip asset and decompressed in the worker, below the static host's 25 MiB per-file
limit. A failed/timed-out compiler can be retried by editing a field.

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
python scripts/render-studio-thumbnails.py
node scripts/preview-pdf.cjs
```

The localhost-only QA server on port 4178 mocks AI; it makes no real model calls
and adds no template-loading buttons. Upload a resume using the normal control.
For production-like AI calls, serve `pages-deploy/` using the static server above.
There is no frontend build step. Deploy `pages-deploy/` to publish the studio.
The previous mapped-layout Worker API remains backwards-compatible, but this new
studio flow uses the ordinary rewrite response and does not require mapped blocks.

`tests/typst-studio.test.cjs` compiles all 30 templates in English and Chinese,
checks text retention and page bounds, and exercises long resumes, sidebars,
photos and literal Typst-like user input. PDFs are written to `tmp/pdfs/typst/`.
The vendored assets are committed; no build is needed to deploy. To regenerate
the template registry/layouts or pinned compiler, use
`python scripts/vendor-studio-templates.py templates compiler`. The optional
`fonts` step requires Python fontTools and downloads the pinned OFL font sources.

PDF dependencies/licenses are self-hosted under `pages-deploy/vendor/`. The Noto
Sans SC font loads only when needed and embeds intact to avoid missing CJK outlines.
To refresh it, run `node scripts/fetch-pdf-font.cjs` with Python fonttools installed.
Tests cover all three templates in both languages, complete text retention,
unknown/repeated headings, multipage output, photo embedding, and font failures.
PDF render checks use Python PyMuPDF; inspect generated pages after font/layout changes.

## SEO and GEO checks

Public pages use the CheckATS name, self-canonical URLs, crawlable guide links, and factual structured data. `/methodology/` documents the actual local score and external data processing. `llms.txt` is an optional summary, not a search inclusion requirement.

The English and Chinese guide indexes, eight guide articles and two methodology
pages share the editorial document layout in `styles/guide.css`. The guide index
supports local search; article pages have a sticky table of contents and collapsible
mobile navigation. Language links open the corresponding article and Chinese home
links keep `?lang=zh`. Run `python scripts/build-guide-layout.py` to refresh the
shared shell while retaining article HTML, metadata and structured data. Original
article content is kept between the `docs-content` markers; edit it there.

Run `python3 scripts/verify-seo.py` and `node scripts/verify-scoring.cjs` before publishing. After deployment, submit the sitemap and inspect public URLs in Search Console and Bing Webmaster Tools. Confirm CDN crawler access and track tool usage from organic and AI referrals.
