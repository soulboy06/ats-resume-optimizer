# AI review validation incident — 2026-10-23

Historical incident report: the deployment described below predates main commit `76a852a`. The branch now includes main’s SiliconFlow Qwen-first review path, Workers AI fallback, removed evidence quotations, and the free review bundled with rewriting. This report is not a description of the current implementation or a new production deployment.

Production Worker source/configuration were read via user-authorized Cloudflare OAuth. The initial failing deployment was 986524c2-0793-446a-9904-ce9ae1c964a5. No historical observability was configured and the validator swallowed individual rejection reasons.

The original report concerned the user’s Chinese resume in Chrome. An earlier success in a separate English sample tab did not reproduce that failure. Real-time diagnostics on the Chinese case confirmed both original models were rejected for EVIDENCE_NOT_IN_RESUME. Numbered evidence alone still produced INVALID_SCHEMA in the small models. These are observed rejection categories, not a network/authentication failure.

The final review path uses llama-3.3-70b-instruct-fp8-fast with a strict JSON schema, server-generated evidence IDs resolved back to exact original excerpts, and llama-3.2-3b as a validated fallback. Invalid source IDs, fabricated quotations, invalid scores and injected output still fail closed. There are at most two provider attempts. Fixed-code diagnostic logs include model and request ID, without provider bodies, prompts, resume text or secrets.

Final production version: 8f65bcc5-ebed-4f87-bfb1-dc26661b64b8. The same Chinese resume in the user’s actual Chrome tab returned POST /api/hr-review HTTP 200, no rejection logs, and scores 80/85/80/90. The page displayed genuine source excerpts and an overall assessment, and its error status was empty. Browser capture: output/playwright/billing/live-chinese-review-fixed.png.

The deployment artifact was patched from downloaded production modules, preserving the live rewrite and billing logic rather than replacing them with the older local branch. All eight existing binding names were checked after deployment. OAuth credentials were not copied into the repository.

Validation: 142 local tests passed; 19 AI security/response tests were also run against the isolated production patch before deploying. Bundle dry-run passed. One successful real Chinese case establishes that this failure is resolved for that input, not a guarantee that every future model response will pass. The stronger review model has a higher provider token cost; the user-facing review debit remains 10 points, with failed actions released by the existing billing flow.
