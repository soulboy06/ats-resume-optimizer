# AI document trust boundaries

The active Worker, `cloudflare/hr-review-worker.js`, handles both `/api/hr-review`
and `/api/rewrite`. The rewrite path includes the legacy PDF block-map mode.
`cloudflare/ai-proxy-worker.js` is a historical reference, not the endpoint used
by the current frontend; it must not be used as an alternative hardened endpoint.

## Boundaries

- Resume text, job descriptions, missing-keyword hints and PDF paragraph text are
  untrusted documents. They cannot supply system messages, model selection,
  generation settings, scoring rules or executable actions.
- The server streams at most 256 KiB of request data before JSON parsing, validates
  types and document lengths, and checks all supplied text before applying the
  existing model-context truncation limits. Obvious English/Chinese role overrides,
  instruction disclosure and score-forcing commands return `400 UNSAFE_DOCUMENT`
  without contacting a model. NFKC, selected invisible characters and common
  Cyrillic homoglyphs are normalized for detection only; source text is unchanged.
- Fixed system instructions are sent separately from a JSON-serialized user data
  object. Both paths state the trust boundary. No tools are registered, no document
  URL is fetched, and no credentials or administrator headers enter model messages.
- Rewrite uses server-selected `deepseek-chat`, JSON mode and the exact
  `{rewritten: string}` or `{blocks: [{id, text}]}` response schema. Unsupported
  JD keyword hints are discarded. Facts and skills may not be invented to satisfy
  the JD; stronger wording must remain supported by the source resume.
- Review requires exactly four integer scores in `[0,100]`, bounded nonempty
  comments and overall text, and evidence that is a source-resume substring
  (whitespace differences are tolerated). Invalid scores are never rounded,
  clamped or replaced with invented placeholder scores. A valid 100 is allowed.
- Review retries invalid output once with unchanged trusted instructions. The
  rejected answer is never inserted into another prompt. JSON surrounded by
  explanatory prose is rejected; an otherwise complete JSON code fence is allowed.
- A per-request random policy marker, known secret echoes, obvious command output,
  executable HTML/Markdown images and newly introduced HTTP URLs/email addresses
  are rejected. Plain rewrites must retain source contact tokens. PDF mode also
  enforces original block IDs/order and unchanged protected paragraphs.
- Invalid output returns a generic `502` error without exposing model/provider
  response bodies, exception messages or source documents. Existing frontend
  escaping/text rendering remains in place.

## Validation and limits

Run `node --test tests/ai-security.test.cjs tests/pdf-worker.test.cjs` for the
deterministic API-boundary tests, or `npm test` for the full suite. The security
suite contains 13 groups covering both routes, bilingual and obfuscated attacks,
malformed requests, policy/data separation, malformed output, invented evidence,
contact redirection, canary/secret echoes, safe retries and PDF compatibility.
The full suite passed 98 tests after this change.

These tests stub model providers: they validate that server checks reject attack
fixtures and unsafe provider responses, not that a real model resists every
possible adversarial document. No live provider requests or production security
tests were performed. Heuristics can miss novel paraphrases/encodings or flag a
resume that quotes attack instructions. JSON quoting, schemas and markers also do
not prove semantic correctness: a schema-valid but biased review or inaccurate
rewrite is still possible. Resume owners must review generated claims.

This design follows the layered approach in the
[OWASP Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
and the provider's
[JSON mode documentation](https://api-docs.deepseek.com/guides/json_mode/).
Future model/config changes should be followed by live, synthetic-document
adversarial evaluation without sending real resumes or secrets.

## Rollout

The frontend API response fields (`dimensions`, `overall`, `rewritten`, `pdfBlocks`)
remain compatible. Deploy the updated **Worker**, retaining its AI, rate-limit KV,
D1 bindings and existing secrets, before claiming the live site is protected.
Pushing the static frontend alone does not activate these changes. No Worker
deployment was performed as part of this local implementation.
