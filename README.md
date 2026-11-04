# ContextBridge web

React 19/Vite interface and NestJS 12 API. Requires Node 24.

Live site: https://contextbridge-newpoluton.vercel.app

Chrome extension: https://contextbridge-newpoluton.vercel.app/downloads/contextbridge-extension.zip

Vercel production secrets are configured. Local secrets remain in ignored `.env`; no API key is bundled into the extension or website.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The API is on port 3000. The supplied private `.env` starts real Neon account sign-in. `npm run dev:demo` opens a separate local workspace with three checked examples. The database and Neon Auth service have been provisioned for this workspace; both connection settings are already saved privately.

`npm run setup:key` opens a one-use local password field that writes the OpenAI key into `.env`. Never place the key in the browser-extension environment or any public-prefixed variable. Your supplied OpenAI key is saved privately for this workspace; it is excluded from Git and browser builds.

## Commands

- `npm run build`: typecheck and build client/server.
- `npm test`: API, learning-flow, access-isolation, persistence and concurrency tests.
- `npm run test:ai`: optional live OpenAI check (consumes a small number of API tokens).
- `npm run test:db`: real Neon integration checks using temporary test-owned records, cleaned up afterwards.
- `npm run db:migrate`: install the idempotent schema with pgvector and indexes.
- `npm run dev:demo`: run the local fixture workspace.
- `npm run dev:cloud`: use live Neon accounts/data.
- `npm run deploy:production`: transfer configured values and secret keys to the linked Vercel project, then publish. Production requires APP_URL, EXTENSION_IDS, Neon settings and an API key. Demo mode is forced off remotely. The Vercel CLI may need its own login even though the Codex Vercel plugin is connected.

## Architecture

`src/client` contains the browser interface. `src/server` contains the API, JWT validation, per-user storage, AI prompt/schema validation, retrieval and review scheduling. `api/index.ts` adapts the same Nest app for Vercel Functions. `sql/001_init.sql` creates the schema. No database or provider secret enters the Vite bundle.

Only explicit saves create vocabulary encounters. AI response caching is private to each user and includes exact context, languages, instructions and model (guided/direct modes share one result). Cache entries expire after 30 days. Saving creates 1536-dimensional embeddings; failures to embed never prevent saving. Follow-up chat uses its selected encounter directly. General chat uses small matching-language libraries or lexical matches first, then vector retrieval only when needed. Deleting an encounter also clears that user's explanation cache. Chat messages are retained separately until the conversation is deleted.

Server limits bound input size, output tokens, retries, history length and daily AI requests. The daily allowance is persistent and atomic in Neon; the short burst limit is per running API process. Anonymous Neon JWTs and forged tokens are rejected. Extension tokens expire after 30 days and are revocable; pairing codes are random, single-use and expire after five minutes.

Neon Auth uses verification codes through its shared email service. The production origin is registered. Both the website and API require verified email before data/AI access; blocked or deleted accounts lose extension access too. Real inbox delivery still needs an account-owner test, and a custom email provider is recommended before a wider launch. Live AI has been exercised against the configured OpenAI account.

See [PLAN_AUDIT.md](PLAN_AUDIT.md) for the complete PDF requirements audit. The extension source is maintained separately at https://github.com/newpoluton-alt/contextbridge-extension.

## Token efficiency

The web app and extension share these controls on the server:

- Full explanations: maximum 900 output tokens; feedback: 250; chat: 500. Actual responses usually use less.
- Same expression/context/languages/instructions reuse a validated response across guided and direct modes. Matching feedback and chat retries also reuse cached results.
- Hints, reveal, mode changes, flashcards and review scheduling do not trigger new AI calls. Saving a new encounter may create one embedding; repeated saves do not.
- Only six recent chat messages, with 4,000 characters total, enter the prompt. Retrieval contributes at most three compact examples. No whole pages, PDFs or complete chat archives are sent.
- A selected encounter skips query embeddings entirely. Small libraries and lexical matches avoid semantic query calls.
- No automatic provider retries; simultaneous identical requests share one in-flight call within a server process.
- Actual input/output/cached-input tokens are counted in Neon. Both interfaces show daily usage. AI_DAILY_TOKEN_LIMIT defaults to 25,000 and AI_DAILY_REQUEST_LIMIT to 60 per account; UTC resets. Conservative reservations enforce limits during concurrent calls; uncertain failed-call usage is charged conservatively.

A live integration check on 4 November 2026 exercised explanation generation, cross-mode cache reuse, one saved embedding, contextual chat, cached chat retry and interpretation feedback: four paid requests used 933 input tokens and 296 output tokens in total. This is one test, not a fixed per-user cost.

## Account and extension connection

Create an account and enter the emailed verification code. Both browser and API require verified email. In Settings, install the extension download and choose **Connect extension**. Chrome may require one server-access approval in extension Settings; no password or API key is copied to the extension. Manual code pairing remains available. Each extension token is revocable and expires after 30 days.

## Verified release

Production release `bd02f13` was built successfully and verified on 4 November 2026: final client asset, API health/cloud configuration, unauthenticated data rejection, approved extension origin, and ZIP checksum all passed. Verification also includes 34 backend tests, nine extension tests, real Neon/AI checks and browser regressions. Actual email inbox delivery, all three desktop operating systems, and the course’s peer/instructor evaluation are recorded as unverified external work in the audit.
