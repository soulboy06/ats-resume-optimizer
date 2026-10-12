# ATS Resume Optimizer

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
- The UI theme is the light-blue "fresh" design the owner picked (2026-10-11).
  Visual changes go through the owner first — no unprompted redesigns on main.
