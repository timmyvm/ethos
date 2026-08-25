# Secrets audit — full git history

Run 2026-08-25 over all 79 commits on all branches (`git log --all -p`),
plus a path check for every `.env*` file ever committed. Method: two
passes — secret-shaped values (OpenAI `sk-…`, Anthropic `sk-ant-…`,
JWTs `eyJ…`, Resend `re_…`, assigned `*_KEY=value` lines, quoted
passwords/tokens, 40+ char base64 literals) and the raw keyword sweep
(`sk-`, key, secret, token, password, SUPABASE_SERVICE, RESEND,
ANTHROPIC, OPENAI, `.env`), every hit attributed to commit + file.

## Verdict

**No API key, service-role key, JWT, or password value has ever been
committed.** Every keyword hit is an environment-variable *reference*,
documentation, or an empty placeholder. Nothing needs a history rewrite.

One rotation item exists, and it did not come through git — see (a).

## Findings

### (a) Real secret exposure — rotate (came through chat, not git)

- `BUILT.md` (public, in-tree since commit `9f71325`) records:
  *"The Supabase secret key needs rotating. It transited chat during the
  10 Aug session."* The key value itself is NOT in the repo or its
  history; the note says it passed through a chat transcript. **If it
  has not been rolled since 10 Aug, roll it now** (Supabase dashboard →
  Settings → API → rotate service role key, then update Vercel env +
  `.env.local`). Consider also editing the note once rotated — a public
  repo advertising a possibly-live unrotated key is an invitation.

### (b) Placeholders / examples — fine

- `.env.example` — the only `.env*` path ever committed (added
  `0c263b8`, updated `fcb368a`). All values empty at every revision:
  `OPENAI_API_KEY=`, `ANTHROPIC_API_KEY=`, `NEXT_PUBLIC_SUPABASE_URL=`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=`,
  `NEXT_PUBLIC_SITE_URL=https://speakethos.com`.

### (c) False positives — no action

- `process.env.OPENAI_API_KEY` / `ANTHROPIC_API_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` reads in `lib/transcribe.ts`,
  `lib/coach.ts`, `lib/accuracy.ts`, `lib/db.ts`,
  `scripts/push-brand-assets.mjs` — references only, values from env.
- ~300 hits on "key", ~110 on "password", ~93 on "token": React `key`
  props, password form fields, Supabase access-token plumbing. The
  entropy pass over the same lines found zero literal values.
- `https://dthjdyitvieyufufkkly.supabase.co/storage/…/public/brand` in
  `scripts/vercel-fetch-assets.mjs` (`f2308fc`): the project URL, which
  ships to every browser in `NEXT_PUBLIC_SUPABASE_URL` anyway, pointing
  at a public storage bucket. Not a secret.
- "RESEND" hits are `docs/growth/06-cro-audit.md` talking about a
  *resend-email button*. There is no Resend integration in this
  codebase; all email is Supabase Auth's own sender.
- "sk-" hits are the word "task-level" line-wrapped. Genuinely nothing.

## .gitignore

Covers `.env` and `.env*.local` (which matches `.env.local`). Gap:
non-local variants (`.env.production`, `.env.development`) would NOT be
ignored. Hardened in this commit to `.env*` + `!.env.example` so no
future env file can be committed by accident.
