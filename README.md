# IEU Election — Vote Counter (Vercel + Upstash Redis edition)

Vercel's free plan has no persistent disk and can't hold the SSE
connection the original app used, so this version was rewritten to:
- store the counts in a free **Upstash Redis** database instead of
  `state.json`/`votes.log` (Redis *is* the persistence now — nothing
  is lost when a serverless function cold-starts or Vercel redeploys)
- have the dashboard **poll** `/api/state` once a second instead of
  using Server-Sent Events (the app already had this as its fallback
  path, so it was a one-line change)

Everything else — the counting UI, the candidate list, the tap/undo
logic — is untouched.

## ⚠️ Still no login on this app
Exactly as before: anyone with the URL can vote or reset a ballot.
Don't share the link outside the counting team. Ask me if you want a
simple shared-passcode check added.

## 1. Create a free Redis database (2 minutes, no credit card)
1. Go to https://console.upstash.com and sign up.
2. Create a Redis database (any region close to you). The free tier
   gives 500,000 commands/month and 256 MB — plenty for counting an
   election.
3. On the database's page, copy the **REST URL** and **REST TOKEN**
   (not the plain Redis connection string — you want the two REST
   values).

## 2. Deploy to Vercel
1. Push this folder to a new GitHub repo.
2. Go to https://vercel.com/new, import that repo. Framework preset:
   "Other" (it'll auto-detect the `/api` functions).
3. Before the first deploy (or right after, in Project → Settings →
   Environment Variables), add:
   - `UPSTASH_REDIS_REST_URL` = the REST URL you copied
   - `UPSTASH_REDIS_REST_TOKEN` = the REST token you copied
4. Deploy. Vercel gives you a URL like
   `https://ieu-election-vote-counter.vercel.app`.
   - Counting page: that URL
   - Projector dashboard: `<that URL>/dash`
5. Redeploy once after adding the env vars if you added them after the
   first deploy, so the functions pick them up.

Alternatively, from this folder with the Vercel CLI:
```
npm i -g vercel
vercel link
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel --prod
```

## Other genuinely free platforms this same idea works on

The trick that makes this free-tier-friendly is keeping the *data* in
Upstash (which is free and persistent on its own) instead of on the
host's disk. That means the same `/api` functions — with minor
adaptation — also run on:

- **Netlify** (Functions) — free tier, similarly generous. Move the
  files from `/api` to `/netlify/functions`, and change each handler's
  signature from `(req, res) => {...}` to Netlify's
  `(event, context) => {...}` / return-an-object style. The Redis logic
  in `lib/redis.js` doesn't change at all.
- **Cloudflare Pages Functions** — free tier, very generous request
  limits. Files go in `/functions/api/*.js` using
  `export function onRequestPost({ request, env }) {...}`. Again,
  `lib/redis.js` is reusable as-is (Upstash's REST API works from any
  runtime, including Cloudflare's Workers runtime).

Both are solid alternatives if you outgrow Vercel's free limits or
just prefer them — but for this app's traffic (a handful of tablets on
one counting day) Vercel's free plan is comfortably enough, and it's
the least fiddly of the three to set up.

## What did NOT change
`vote-counter.html` and `dashboard.html` are byte-for-byte the same
except one line in `dashboard.html` that skips straight to polling
instead of trying SSE first. `ballots.json` (candidate lists) is
unchanged.

## Local testing
You'd need the Vercel CLI to run the `/api` functions locally:
```
npm install
vercel dev
```
(Set the two `UPSTASH_REDIS_REST_*` env vars in a local `.env` file
first, or `vercel env pull`.)
