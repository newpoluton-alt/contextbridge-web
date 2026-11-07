# ContextBridge — audit of every section of the 16-page plan

Audit date: 4 November 2026. Final live site: [ContextBridge](https://contextbridge-newpoluton.vercel.app). Source: `language learning extension (1).pdf`, all 16 pages, checked through the complete page-separated extraction in .planning/source-plan.txt (local audit artifact retained in the workspace). The extracted text contains some typographical/OCR errors; the intended behavior is recorded below rather than treating those errors as requirements.

This is a requirements audit, not a claim that every planned learning outcome has been demonstrated. “Implemented” means the relevant code exists. It does not mean that live email delivery, production authentication, an installed Chrome extension on every operating system, or educational effectiveness has been independently verified. Deployment and external evaluation evidence are tracked separately.

The matrix contains **214 individually tracked requirements**. The audit led to fixes for the omitted page overlay/underlines, saved-state reuse, comparison/check visibility, draft recovery, contextual chat, review records, email-verification enforcement, token-efficient lexical reuse, one-click account connection and account-switch isolation. The independent web run passed **34 tests**; the final extension passed **nine tests**, packaging and credential-exclusion checks. The final web account-switch browser regression passed **eight groups with no JavaScript errors**. A focused live Neon/OpenAI check passed with **two calls, 867 input tokens and 331 output tokens**; subsequent cache and durable saved-context lookups consumed no new allowance. Operational deployment and human evaluation are recorded separately below.

## Scope decisions and conflicts resolved

1. The user's request is to implement the attached plan and subsequently examine each point, correct omissions, and deploy. The PDF supplies product requirements; it does not itself grant authority to contact instructors, submit evaluations, or invent testing results.
2. The main plan explicitly includes accounts, Neon, Vercel, chat, a personal dashboard, and Anki-style review. The later “first-prototype boundary” says to postpone these. For this requested product, the explicit main-plan requirements take precedence; the narrower boundary remains useful for the classroom demonstration and evaluation. These product features are not silently deferred.
3. “One word” is reconciled with the explicit requirement for idioms and separable verbs: a word **or a short expression**, limited to 12 words/160 characters. Whole-passage translation is prohibited by the server's tutor policy.
4. The default assistance intention belongs in settings, as requested by the main plan, while the intervention requires an explicit choice that can change for the current encounter. Both are supported: a synchronized default plus an encounter-level override.
5. Underlining/tapping must identify a candidate expression, not diagnose misunderstanding. No AI request should occur merely from highlighting or reading a page; the learner must ask for assistance.
6. The original text stays visible through a browser side panel. Chrome controls its resizing. Protected pages and the built-in PDF viewer require a bundled PDF reader/manual-context fallback, rather than claiming injection where Chrome forbids it.
7. Anki feasibility is met with in-app spaced review plus Anki-compatible TSV export. This is not an embedded copy of the Anki desktop application, and there is no claimed AnkiWeb synchronization.
8. Stable lexical facts may be reused only when valid in the new context. A previous meaning must never be substituted automatically for a different sentence. Exact-context reuse is a separate requirement.
9. The OpenAI key is a server secret. The extension has an ignored `.env` placeholder but does not consume or bundle that key. This resolves the request for two environment files without exposing a privileged credential to browsers.
10. Learner-selected saving concerns persistent encounter records. Response caching, stored chats, and temporary session drafts are distinct mechanisms and must be described honestly. Learning encounters are not silently saved just to start a chat.

## Status and evidence key

- **I — Implemented:** identifiable implementation exists; any important verification limit is noted.
- **P — Partial / correction underway:** the core exists but the listed acceptance detail is missing or being changed. This must not be reported as complete until rechecked.
- **E — External / operational:** requires a deployment result, real account/browser exercise, peer evaluation, instructor material, or user action that has not yet been evidenced here.
- **R — Resolved interpretation:** a conflicting or conditional instruction is explicitly reconciled above; it is not an unimplemented feature disguised as completion.

Evidence abbreviations link to actual source files. Function/component names identify the relevant implementation without relying on line numbers that change during fixes.

| Key | Source and relevant responsibility |
|---|---|
| API | [web/src/server/app.ts](src/server/app.ts): authenticated endpoints, settings, lookup, feedback, encounters, review, export, chats, pairing, CORS, errors |
| AUTH | [web/src/server/auth.ts](src/server/auth.ts), [config.ts](src/server/config.ts): Neon JWT verification, owner identity, production requirements |
| AI | [web/src/server/ai.ts](src/server/ai.ts), [ai-context.ts](src/server/ai-context.ts): constrained tutor, structured output, short prompts, cache, compact history/retrieval |
| SCHEMA | [web/src/server/schema.ts](src/server/schema.ts): validation, context identity, attempted/assisted labels, review schedule, Anki export |
| STORE | [web/src/server/store.ts](src/server/store.ts): owner-scoped records, exact contexts, vector/lexical retrieval, atomic counters and chat append |
| DB | [web/sql/001_init.sql](sql/001_init.sql), [002_ai_usage.sql](sql/002_ai_usage.sql): PostgreSQL JSON records, pgvector/HNSW, cache, usage, pairing |
| APP | [web/src/client/App.tsx](src/client/App.tsx): dashboard, library, encounter details, account session and navigation |
| LEARN | [web/src/client/features/Learn.tsx](src/client/features/Learn.tsx): web contextual learning loop |
| REVIEW | [web/src/client/features/Review.tsx](src/client/features/Review.tsx): sentence-first spaced review |
| CHAT | [web/src/client/features/Chats.tsx](src/client/features/Chats.tsx): shared conversations, Markdown, copy |
| PREFS | [web/src/client/features/Preferences.tsx](src/client/features/Preferences.tsx): profile, languages, intention, instructions, pairing, usage and export |
| LOGIN | [web/src/client/features/AuthScreen.tsx](src/client/features/AuthScreen.tsx), [auth.ts](src/client/auth.ts): signup/login/verification/reset |
| CONTENT | [browser-extension/src/content.ts](https://github.com/newpoluton-alt/contextbridge-extension/blob/b/initial-implementation/src/content.ts): on-page capture and candidate-selection interface |
| WORKER | [browser-extension/src/worker.ts](https://github.com/newpoluton-alt/contextbridge-extension/blob/b/initial-implementation/src/worker.ts): user-gesture activation, account connection, protected API transport |
| PANEL | [browser-extension/src/panel.ts](https://github.com/newpoluton-alt/contextbridge-extension/blob/b/initial-implementation/src/panel.ts), [sidepanel.html](https://github.com/newpoluton-alt/contextbridge-extension/blob/b/initial-implementation/public/sidepanel.html): extension learning, comparison, library, chats, settings, session draft |
| SELECT | [browser-extension/src/selection.ts](https://github.com/newpoluton-alt/contextbridge-extension/blob/b/initial-implementation/src/selection.ts): surrounding sentence, selection/origin validation |
| PDF | [browser-extension/src/reader.ts](https://github.com/newpoluton-alt/contextbridge-extension/blob/b/initial-implementation/src/reader.ts): local PDF.js page/text reader and selection |
| FIXTURES | [web/src/server/fixtures.ts](src/server/fixtures.ts): three explicit sample reference explanations; these are not independent human-evaluation results |
| DEPLOY | [web/scripts/deploy.mjs](scripts/deploy.mjs), [web/vercel.json](vercel.json), [web/api/index.ts](api/index.ts): production build/deployment and server entry point |
| KEYS | [web/scripts/setup-key.mjs](scripts/setup-key.mjs), per-project `.gitignore`/`.env.example`, deployment ignore/config: private local input and excluded environment files |
| TESTS | [web/tests](tests), [browser-extension/tests](https://github.com/newpoluton-alt/contextbridge-extension/blob/b/initial-implementation/tests): source validation, context, API/storage/account isolation, concurrency and packaging tests |

## A. Main plan — pages 1–5

Every separate main-plan behavior is included here, including nested requirements.

| ID / page | Requirement and intended meaning | Implementation evidence, gap, and resolution | Status |
|---|---|---|---|
| M01 / 1 | Translate the selected word, not the whole text. | AI policy explicitly forbids whole-sentence/passage translation; SCHEMA bounds selection. Prompt enforcement is not a mathematical guarantee of model compliance. | I |
| M02 / 1 | Explain grammar and the selected expression's role in its sentence. | AI lookup includes grammar/evidence; chat targets language/grammar; PANEL/LEARN reveal relevant fields. | I |
| M03 / 1 | Preserve learner work through partial translation, clues, and examples. | Guided question → clue → grammar → reveal; explicit attempts/revisions and optional checks. | I |
| M04 / 1 | Assist reading foreign-language websites. | CONTENT captures a selected occurrence from ordinary page text; WORKER activates on a gesture. Protected pages have a stated fallback. | I |
| M05 / 1 | Assist reading foreign-language PDFs. | PDF.js reader opens local text-bearing PDFs, page/zoom/text view; no OCR for scans and no direct injection into Chrome's protected PDF viewer. | I, bounded |
| M06 / 1 | AI should assist contextual cueing, alternative uses, and related grammar rather than replace reading. | AI policy, alternatives/example fields, focused chat and persistent original sentence. | I |
| M07 / 1 | Save vocabulary by language, including contextual meaning/clues. | Encounter schema stores language/translation language/context/explanation; library filters and retrieves owner data. | I |
| M08 / 1 | Personal cabinet with registration and saved-word review; explore Anki feasibility. | APP + LOGIN + REVIEW; Anki-compatible export. Actual AnkiWeb/desktop embedding is not claimed. | I / R |
| M09 / 1 | Registered Neon users only in the deployed extension and cabinet. | AUTH rejects missing/anonymous web identities; hashed owner-scoped extension tokens. Local demo explicitly restricted to loopback. Hosted Neon service configuration must be verified. | I + E |
| M10 / 1 | Neon provides the online database. | pg-backed STORE and DB schema. Live test-owned records persisted, were retrieved and cleaned up in Neon; token accounting and response caches exercised against the real database. | I |
| M11 / 1 | Website deployed to Vercel. | [Production website](https://contextbridge-newpoluton.vercel.app) is live. Root confirmed deployment READY, page/health/config success, protected API rejection, extension CORS and package download. The final handoff correction is a subsequent release, tracked below. | I |
| M12 / 1 | AI returns the same semi-structured JSON shape. | OpenAI Responses `zodTextFormat` + `responses.parse`; SCHEMA validates the returned object. Invalid/refused/truncated responses return safe errors. | I |
| M13 / 1 | OpenAI key supplied privately; avoid leaks. | Server-only SDK. KEYS uses a loopback password field; extension never reads the secret. No key should appear in audit, screenshots, bundles, or repositories. | I |
| M14 / 1 | Responsible token use. | Task-specific output budgets; shared mode-independent explanation cache; exact-result feedback/chat cache; bounded history/related records; lazy embeddings; no automatic retries; shared daily request/token reservations. | I |
| M15 / 1 | Do not upload `.env` files to Vercel. | Per-project ignore rules/build allowlists and deployment helper transfer selected environment values separately. Check the deployment package rather than treating `.gitignore` alone as proof. | I + E |
| M16 / 1–2 | Installation should lead a new user to registration on the connected website. | WORKER now opens account-connection settings on first installation, with a website sign-in/registration action. | I |
| M17 / 1–2 | Extension registration and cabinet login should share state when integration allows; fallback login permitted. | The extension’s Connect account button opens website sign-in/registration and finishes linking automatically after verified authentication. The connected account replaces the button; website logout and expired extension credentials restore it. The worker exchanges a short-lived code at its fixed backend with exact-origin/top-frame checks. Codes and server addresses are hidden from the normal connection experience. | I |
| M18 / 2 | Signup fields: email, name, password, repeated password. | LOGIN includes all four, mismatch validation, required inputs and minimum password length. | I |
| M19 / 2 | Confirm email before use. | LOGIN has OTP verification/resend; AUTH checks current Neon account emailVerified and banned status for every web/extension identity. Provider requireEmailVerification is false, so the API gate enforces workspace access. Shared sender supports codes/reset; real inbox delivery remains untested. | I + E |
| M20 / 2 | Returning users sign in with email/password and regain the shared cabinet/extension account. | LOGIN signIn and Neon session; one-click extension account connection and shared storage. Extension re-pair clears previous-account session/UI and rejects stale responses. Real inbox-backed production login remains separate from synthetic browser testing. | I + E |
| M21 / 2 | Add/edit personal data later. | PREFS edits display name, learning/explanation languages, daily goal, intention and custom instructions. Arbitrary profile fields are not specified; changing auth email is not promised. | I |
| M22 / 2 | Activating extension opens a side chat/learning panel while content remains visible. | Native Chrome side panel opens from toolbar/context-menu gesture; PANEL includes learning and chat tabs. | I |
| M23 / 2 | Resize left/right while keeping reading content available. | Chrome's native side-panel resize bounds provide this; extension does not cover the whole page. Verify in installed desktop Chrome; custom resize handles are unnecessary. | I + E |
| M24 / 2 | Every readable word is indicated with a semitransparent underline after activation. | CONTENT now uses Unicode word segmentation and CSS Highlight ranges over readable page content, updating near the viewport on scroll/mutation; editors, controls/navigation and protected content are excluded. This avoids destructive DOM rewriting and indiscriminate monitoring. | I |
| M25 / 2 | Default intention in settings: guided or direct. | Shared settings `mode` in PREFS/PANEL; current encounter can override it. | I |
| M26 / 2 | Tapping an indicated word opens a small contextual explanation overlay. | CONTENT now provides an anchored selection/word overlay with explicit uncertainty/mode choice and progressive contextual assistance. | I |
| M27 / 2 | Overlay content depends on current sentence and assistance intention. | Overlay captures the actual occurrence, displays editable context, uses shared mode preference, and progressively/directly presents the same structured explanation. | I |
| M28 / 2 | Same JSON structure regardless of intention. | `explanationSchema` shared by both modes; mode is intentionally excluded from the reusable explanation cache key. | I |
| M29 / 2–3 | Save icon at a top overlay corner saves the expression and all suggested content. | Overlay now has a top-corner save control with active state; scoped worker action stores complete explanation and learner progress through the authenticated API. | I |
| M30 / 3 | Save to Neon under the current user's cabinet. | Owner identity is server-derived; parameterized owner predicates. Live synthetic-owner persistence/retrieval/cleanup verified against Neon. | I |
| M31 / 3 | For the same expression in a new sentence, reuse only context-independent facts and generate current-context help. | Corrected AI reuse schema requests only contextual fields plus nullable lexicalUpdate. Existing lemma/POS are reused only if the model validates them for this sentence; changed facts are returned explicitly. Cache includes the lexical seed, preventing reuse against a different seed. | I |
| M32 / 3 | Malformed AI JSON cannot break the application. | SDK strict structured parsing plus Zod; client errors preserve recoverable state. Refusal/truncation cannot be treated as a valid explanation. | I |
| M33 / 3 | Exact saved context is recognized; save indicator is already active. | Web/panel/overlay normalize context consistently and retain saved state. Backend puts exact saved match first even after more than five newer occurrences. API regression verifies preserved old progress, deduplication and zero new usage. | I |
| M34 / 3 | Activated save icon uses black/white appropriately for system theme. | Overlay/system-dark styles and filled saved indicator implemented; Chromium dark-theme smoke reported by extension owner. | I |
| M35 / 3 | Reuse compatible saved suggestion instead of another AI call. | Corrected lookup checks STORE.exact before generation, validates its Explanation schema, and reuses it unless marked unresolved. Response caches still handle repeat unsaved requests. | I |
| M36 / 3 | New contextual occurrences remain distinct use cases, visible in later suggestions/comparison. | Context key includes expression/sentence/languages; separate records preserved; lookup returns previous same-expression encounters. | I |
| M37 / 3 | Dedicated chat for grammar, role, context, alternatives, direct help when explicitly requested. | AI policy and CHAT/PANEL. Ambiguous “without … explanation” wording is reconciled with the repeated explicit request for grammar explanation and direct selected-expression help. | I / R |
| M38 / 3 | Name conversations from the first request; AI generates name. | First chat response generates a six-word title in the same request; later turns keep it. Local keyless demo title is explicitly a demo. | I |
| M39 / 3 | Preserve all histories online and reopen/continue old conversations. | STORE has uncapped full chat listing and direct owner/id lookup; atomic append avoids overwriting concurrent turns; CHAT/PANEL load history. A single conversation is bounded to 200 messages with a clear new-conversation action. | I |
| M40 / 3 | Modern chat formatting: copy, headings, varied sizes, bold, tables. | Web ReactMarkdown+GFM and message/code copy; extension marked+DOMPurify and code copy. Arbitrary executable HTML is intentionally not allowed. | I |
| M41 / 4 | Address all intervention and proposed-flow details, even if intention/UI need changes. | All sections and subpoints are mapped below; identified code omissions were corrected. External evaluation, real email lifecycle and untested operating systems remain explicitly bounded rather than claimed complete. | I + E |
| M42 / 4 | Custom AI instructions shared between extension and website; editing either updates the other. | Single owner settings record; both clients refresh committed preferences on focus/view entry and preserve unsaved edits. Saves include only changed fields, avoiding lost unrelated edits. This is refresh synchronization, not instantaneous push. | I |
| M43 / 4 | Search/review all extension-saved records in cabinet. | APP library uses same encounters API; text/language filters and details. | I |
| M44 / 4 | Useful dashboard statistics, including verbs/nouns/adjectives. | APP computes saved count, due count, languages, practiced cards and actual part-of-speech counts. This is usage/self-report evidence, not proficiency. | I |
| M45 / 4 | Same historical AI chat accessible and continuable from website. | CHAT and PANEL share API/storage. | I |
| M46 / 4 | In-app Anki-format learning with context/translation/mode information. | REVIEW shows source sentence first, explanation after reveal, self-rated Again/Hard/Good/Easy schedule. Export includes sentence/meaning/translation/grammar. | I |
| M47 / 4 | Anki-like card UI and different learning/review statuses. | REVIEW card front/back and rating buttons; schedule due/repetitions/ease; attempt status stored separately. This is Anki-style, not identical Anki internals. | I |
| M48 / 4 | Connected Vercel/Neon/GitHub assumed usable. | Existing connections were usable: Neon live data test, Vercel project/domain/environment setup, and two GitHub remotes with pushed initial branches. Empty Vercel teams did not imply missing account access. | I |
| M49 / 4 | Implement compatible suggested features, not just headline items. | Full matrix covers optional checks, comparison, failure controls, privacy and evaluation deliverables. Compatible product behaviors implemented; genuinely external study/submission deliverables remain E. | I + E |
| M50 / 4 | Two separate project subfolders. | `web/` and `browser-extension/`, separate package/build/test configurations. | I |
| M51 / 4 | Vercel hosting with Neon auth/database. | Live Vercel config reports demo:false, storage:neon, aiConfigured:true and the correct application URL; production account screen renders. Real email lifecycle remains a separate test. | I |
| M52 / 4 | Website implemented in Nest.js with modern framework support. | Nest API on Express; React/Vite browser UI; TypeScript/Zod. Nest is the backend framework, not a React replacement. | I |
| M53 / 4 | Extension usable on Linux, Windows, macOS. | Standards-based Chrome MV3 extension with local bundled assets; no OS-specific code. Actual platform testing is separate and cannot be inferred from successful compilation. | I + E |
| M54 / 4 | Test Chrome first. | Extension targets desktop Chrome 121+; selection/package tests and recorded smoke checks. Real browser acceptance list remains below. | I + E |
| M55 / 4 | Separate GitHub repositories for extension and website. | [Web repository](https://github.com/newpoluton-alt/contextbridge-web) and [extension repository](https://github.com/newpoluton-alt/contextbridge-extension) both have pushed `b/initial-implementation` branches. Latest audit/test follow-up commits must also be pushed at close-out. | I |
| M56 / 5 | Modern effective RAG/vector storage over saved user data. | Neon pgvector vector(1536), HNSW cosine index, owner/language-filtered retrieval, lexical-first/lazy embeddings, at most three compact records in prompt. No separate vector vendor/plugin required. | I |

## B. Possible intervention features — pages 5–7

| ID / page | Requirement | Implementation evidence, gap, and resolution | Status |
|---|---|---|---|
| I1a / 5 | Select one word or short expression. | SELECT/SCHEMA support phrases up to 12 words, including idioms and multiword verbs. | I |
| I1b / 5 | Capture surrounding sentence and allow additional context. | Occurrence-aware sentence extraction; editable expression/context in PANEL and LEARN. Context limit is 2,400 characters. | I |
| I1c / 5 | Original text remains visible throughout. | Side-panel layout; PDF page stays open; web learning always shows source sentence. | I |
| I2a / 5 | Guided path begins with hints; direct path immediately explains/translates selection. | Shared result, staged visibility; legitimate direct route with no forced guessing. | I |
| I2b / 5 | Both paths legitimate; support quick return to reading. | No negative grade for direct/reveal/skip; return/close actions. | I |
| I3a / 5 | Hint draws attention to surrounding words. | Structured `clue` and `evidence`; fixture housing example points to “by funding new construction”. | I |
| I3b / 5 | Identify selected expression's sentence role. | `partOfSpeech` and contextual `grammar`; learner reveals relevant information. | I |
| I3c / 5 | Explain relevant verb pattern/grammatical relation. | Grammar field and follow-up chat. AI instructed to stay focused. | I |
| I3d / 5 | Provide a short parallel example. | `example` and optional same-sense `check`. | I |
| I3e / 5 | Do not overwhelm; first clue avoids answer. | AI brief-field prompt; initial UI question/clue excludes meaning/translation. Generated clues still need qualitative checks. | I + E |
| I4a / 6 | Learner states an interpretation after help. | Interpretation textarea and feedback endpoint; preferred explanation language accepted. | I |
| I4b / 6 | “I'm not sure”, another hint, reveal. | PANEL/LEARN explicit controls; no mandatory response. | I |
| I4c / 6 | Compare interpretation to explanation and sentence evidence. | Feedback prompt references meaning/evidence/grammar; reveal shows original interpretation. | I |
| I4d / 6 | Acknowledge plausible alternative interpretations. | Explanation alternatives array; provisional feedback prompt. | I |
| I5a / 6 | Small follow-up chat about selected text. | PANEL/CHAT; existing context supplied as saved encounter or first message text. | I |
| I5b / 6 | Support case, pronoun reference, another sense, similar example questions. | General language task supports these with source context, rather than separate hardcoded handlers. | I |
| I5c / 6 | Retain selected sentence and previous assistance in chat. | Corrected compact context includes mode, bounded initial/revised interpretation, recent assistance and unresolved status. Transient unsaved context is retained with the chat without silently creating a vocabulary encounter. | I |
| I5d / 6 | Guided priority but direct help on explicit request. | Tutor policy limits direct translations to selected expressions; question can request clearer help. | I |
| I6a / 6 | One optional activity after explanation. | Both learning interfaces offer a new-context interpretation check. “Such as” examples are alternatives, not four required mini-games. | I |
| I6b / 6 | Possible paraphrase, clue identification, new sentence, or grammar comparison. | Implemented new-sentence interpretation/question route meets the option list; other variants may be generated in questions but are not separately guaranteed. | I / R |
| I6c / 6 | Hide answers and previous explanations during check. | Corrected web check excludes earlier comparison and normal assistance sections; extension hides explanation, feedback, guided clues and comparison before opening the check. Browser regression remains to confirm visual behavior. | I + E |
| I6d / 6 | Help remains available and is recorded. | Both interfaces distinguish help and answer reveal, preserve ordered assistance events, and conceal earlier answers while the check is active. | I |
| I6e / 6 | Check optional and never blocks reading. | Skip/back/close present. | I |
| I7a / 6 | Save expression and original sentence. | Encounter schema and DB. | I |
| I7b / 6 | Save contextual meaning and relevant grammar. | Full Explanation stored. | I |
| I7c / 6 | Save interpretation when supplied. | Initial/revised fields. | I |
| I7d / 6 | Save assistance used. | Ordered assistance array; server derives attempted-with-help from actions before initial attempt. | I |
| I7e / 7 | Review shows sentence/question before meaning. | REVIEW and extension revisit initially conceal answer; general library detail modal may show it because it is a detail viewer, not the review route. | I |
| I7f / 7 | Saving without attempt means “Not attempted”, never incorrect. | Server `attemptStatus`; user-provided status is recomputed. Direct-only encounters remain not attempted. | I |
| I7g / 7 | Local list sufficient for prototype; account/cloud/Anki later. | Superseded for the requested full product by explicit main-plan account/cloud/Anki requirements, which are implemented rather than postponed. | R |

## C. Proposed user flow: purpose, trigger, scenario — pages 7–8

| ID / page | Requirement | Implementation evidence, gap, and resolution | Status |
|---|---|---|---|
| F1a / 7 | Support foreign-language reading in ChatGPT. | Standard webpage selection/content script works on readable ChatGPT response DOM after activation; actual platform demo must be exercised. | I + E |
| F1b / 7 | Target a locally uncertain expression in otherwise-understood text. | Candidate selection + editable sentence + explicit assistance request. The tool does not diagnose whole-language ability. | I |
| F1c / 7 | Learner forms, checks and revises an interpretation from evidence. | Guided question, interpretation, evidence feedback, revision, check. | I |
| F1d / 7 | Course focus is learning-oriented behavior, not translation throughput. | Progressive UI and assistance records retain learner reasoning. Dashboard counts are not proof of learning. | I |
| F1e / 7 | Intervene after AI response only when learner requests language assistance. | No automatic LLM call on text arrival or highlight; explicit Explore required. Underlining is a visual affordance, not an intervention diagnosis. | I |
| F1f / 7 | Prototype: intermediate English, ChatGPT, short selections, limited grammar scope. | English housing/idiom fixtures and bounded selections support that demonstration; product also accepts other languages/web/PDF by main-plan scope. | I / R |
| F2a / 7 | Highlighting identifies a candidate, not misunderstanding. | Explicit action gating; no proficiency inference from selections. | I |
| F2b / 7–8 | Select → confirm contextual uncertainty → choose help. | Corrected overlay and panel ask “Not sure what this means here?” before an explicit assistance request. Underlining alone does not invoke AI. | I |
| F2c / 7–8 | Offer guided, direct, close. | Overlay now offers both modes and an explicit Close, before lookup. | I |
| F2d / 8 | Already-understood exploration can remain in ordinary chat. | User retains original page; no forced intervention or automatic message submission. Dedicated tutor also supports exploratory questions. | I |
| F3a / 8 | Demonstrate the housing proposal “addresses” scenario. | FIXTURES exactly includes the passage, contextual sense and clue; web demo button selects it. | I |
| F3b / 8 | Distinguish location sense from “takes action about”. | Fixture contrasts location/speaking senses and explains not necessarily solving the shortage. | I |

## D. Complete flow steps 1–9 — pages 8–12

| ID / page | Requirement | Implementation evidence, gap, and resolution | Status |
|---|---|---|---|
| S1a / 8 | Select/activate and display expression plus sentence. | CONTENT/SELECT/PANEL and PDF selection route. | I |
| S1b / 8 | Adjust selection or include more surrounding text. | Editable expression/context fields; no forced word-by-word limitation for idioms. | I |
| S1c / 8 | Original conversation accessible. | Side panel leaves ChatGPT visible; source reference preserved when available. | I |
| S1d / 8 | Confirm correct passage; request more text if context insufficient. | Validation requires selection present and bounds context; user can edit. Updated shared AI policy explicitly requests missing context through the question field, states uncertainty and offers conditional alternatives. This remains model behavior to check qualitatively, not proof from minimum length. | I + E |
| S2a / 8–9 | Choose guided question or direct meaning/brief grammar. | Mode-specific visibility over one structured response. | I |
| S2b / 8–9 | Direct route offers return or save. | Save/return controls, no mandatory attempt/check. | I |
| S2c / 9 | Change choice anytime without marking direct help as failure. | Web, panel and overlay now switch mode against the existing result without regenerating or discarding interpretations; direct answer exposure is recorded as assistance, not failure. | I |
| S3a / 9 | Check saved encounter before deciding support. | Lookup returns same-expression history and checks exact saved context before generating. | I |
| S3b / 9 | No record → one current-context question. | Explanation `question` displayed in guided route. | I |
| S3c / 9 | Matching record → offer comparison, not automatic answer replacement. | Explicit Compare; earlier meanings now collapsed and web confirms each prior example before revealing. | I |
| S3d / 9 | Uncertain match → learner confirmation. | Matches identify surface expression, not proven sense. Web now requires explicit earlier-example confirmation; extension offers an explicit comparison choice and different-meaning warning before collapsed meanings. | I |
| S3e / 9 | Decline comparison → continue current support. | Extension Continue current context; web toggle/hide with guided section still available. | I |
| S3f / 9 | Repeat selection is not evidence of forgetting; occurrence can change meaning. | No forgetting classification; separate context records and explanatory warning. | I |
| S4Aa / 9 | Ask one focused question for first context. | Structured question, fixture housing prompt. | I |
| S4Ab / 9 | Rough interpretation / unsure / clue / reveal / exit all available. | PANEL/LEARN progressive controls and close/navigation. | I |
| S4Ac / 9 | Preferred-language answers accepted. | Text fields unrestricted by language; feedback requested in settings.translationLanguage. | I |
| S4Ba / 9–10 | After comparison acceptance, display earlier/current sentences together. | Updated panel/overlay shows a labeled current sentence beside labeled previous examples; web retains current source above comparison. | I |
| S4Bb / 9–10 | Saved meanings initially collapsed. | Extension uses nested `<details>`; corrected web requires explicit comparison confirmation then a separate reveal. | I |
| S4Bc / 9–10 | Ask whether earlier meaning fits and what evidence supports it. | Comparison wording explicitly asks this. Initial interpretation field is available for response. | I |
| S4Bd / 10 | Help or attempt allowed; old meaning need not apply. | Optional comparison and different-sense warning; AI instruction forbids assumed transfer. | I |
| S5a / 10 | Submitted interpretation → targeted evidence-based feedback. | Feedback API references attempt/sentence/context and returns brief provisional guidance. | I |
| S5b / 10 | Unsure → one concrete contextual clue. | First hint shows clue field. | I |
| S5c / 10 | More help → simpler expression, relevant grammar, or explicit explanation. | Second grammar hint and immediate reveal; selected-expression translation/examples. | I |
| S5d / 10 | Request answer → reveal immediately. | No extra model call after lookup; reveal already-held response. | I |
| S5e / 10 | Question feedback → clarification/context/unresolved status. | Unresolved checkbox, editable context, and contextual follow-up now work even for unsaved web encounters through transient chat context. | I |
| S5f / 10 | Housing clue and stronger synonym support. | Fixture gives contextual clue and “takes action to deal with”; synonym exposure treated as assistance. | I |
| S5g / 10 | Grammar only when relevant; no automatic full lesson. | Brief grammar field + bounded chat prompt; progressive display. | I |
| S6a / 10–11 | Show initial interpretation, contextual explanation, evidence, optional revision. | LEARN shows all fields; updated PANEL and overlay show the initial thought beside revealed explanation and optional revision. | I |
| S6b / 11 | Revise, follow-up, question explanation, continue. | Revision/unresolved/return controls; contextual chat available for saved or transient unsaved learning context. | I |
| S6c / 11 | AI feedback provisional; agreement not required to finish. | Unresolved flag and explicit provisional copy; save/exit never requires agreement. | I |
| S7a / 11 | Offer optional same-meaning new-sentence check after reveal. | AI lookup task explicitly requests same-sense new sentence; fixtures include one. Human quality verification still required. | I + E |
| S7b / 11 | Keep different-sense comparison separate from same-sense check. | Separate earlier comparison and optional check panels; prompt distinguishes meanings. | I |
| S7c / 11 | Paraphrase with prior assistance hidden. | Both interfaces now exclude previous comparison, normal explanation and hint/feedback areas while checking. | I |
| S7d / 11 | Submit / help / reveal / skip. | Web and corrected extension check each provide Submit, contextual help, separate answer Reveal, and Skip. | I |
| S7e / 11 | Record whether attempt was before additional help; avoid false independence claim. | Extension records explicit before/after labels considering either hint or reveal; web preserves ordered check_attempt/help/reveal events. Neither claims independent mastery. | I |
| S8a / 11 | Return to reading / explicit save / ask original conversation. | Panel now includes a separate editable prepared question, Copy question and Return to source, alongside save/return and tutor chat. Local PDF questions can be copied into any conversation. | I |
| S8b / 11 | Learner reviews and sends prepared follow-up. | Prepared source question is editable and copied only on request. The extension never sends it to ChatGPT automatically. | I |
| S8c / 12 | Factual activity summary, no mastery assertion. | Saved assistance/attempt labels and review counts; no mastery field. A richer session summary is optional (“might say”), not an assessment. | I |
| S9a / 12 | Manually reopen saved encounters. | Extension library revisit; web detail and review routes. | I |
| S9b / 12 | Review starts from sentence/question before reveal. | REVIEW/PANEL revisit. | I |
| S9c / 12 | Review attempt/help/reveal/uncertainty/delete. | Corrected Review adds unresolved and delete controls and sends attempt/help to backend. STORE retains up to 100 review-history records with time, self-rating, interpretation, assistance and unresolved status. | I |
| S9d / 12 | Future matching request reconnects encounters through comparison. | Lookup same-expression records and comparison route. | I |

## E. Feature-list acceptance — pages 12–13

The feature table repeats behavior above; each row is still explicitly accounted for here.

| ID | Feature / stated priority | Evidence and acceptance dependency | Status |
|---|---|---|---|
| FT01 | Contextual selection — Essential | I1a–c / S1a, CONTENT + SELECT. | I |
| FT02 | Context confirmation — Essential | S1b–d; editable context and explicit missing-context policy; semantic quality still requires human checks. | I + E |
| FT03 | Explicit assistance choice — Essential | F2b–c; uncertainty prompt and guided/direct/Close overlay. | I |
| FT04 | Contextual question — Essential | S4Aa, structured `question`. | I |
| FT05 | Progressive assistance — Essential | S5b–d, clue → grammar → reveal. | I |
| FT06 | Interpretation feedback — Essential | S5a, feedback endpoint. | I |
| FT07 | Revision comparison — Essential | S6a, initial/revised stored distinctly. | I |
| FT08 | Save/reopen/delete encounters — Essential | API/STORE/APP/PANEL, explicit owner-scoped operations. | I |
| FT09 | Encounter comparison — Core differentiator | S3c–e/S4B; explicit confirmation, collapsed meaning, current-versus-earlier sentences. | I |
| FT10 | New-context check — Supporting core | S7; optional check and corrected prior-answer concealment. | I |
| FT11 | Learner controls: reveal/skip/disagree/exit/stop saving/delete — Essential | Explicit save, unresolved/close, review uncertainty/delete; transient chat avoids mandatory vocabulary saving. | I |

## F. Intervention policy — pages 13–14

| ID | Observable condition → response → intended next action | Evidence and caveat | Status |
|---|---|---|---|
| IP01 | Confirmed contextual uncertainty → guided/direct support → choose | Explicit uncertainty prompt and assistance choice, F2b. | I |
| IP02 | Guided, no prior record → focused question → interpret | S3b/S4Aa. | I |
| IP03 | Guided, prior record → comparison offer → test earlier sense | S3c/S4B; confirmed/collapsed comparison. | I |
| IP04 | Uncertainty/hint request → increase help → attempt/revise | S5b–c. | I |
| IP05 | Interpretation submitted → targeted feedback → reconsider | S5a/S6a. | I |
| IP06 | Explanation complete → new-context check offer → apply | S7a; optional route. | I |
| IP07 | Dismissal → close without negative label → continue task | Close/navigation do not write a failure label. | I |
| IP08 | Insufficient context/dispute → clarification or uncertainty → avoid unsupported certainty | Unresolved + editable context/chat; updated shared policy requires uncertainty, missing-context question and conditional alternatives. | I + E |
| IP09 | Observe requests, choices, attempts, records only. Do not infer intention/proficiency from highlight/copy/silence/frequency. | No passive full-conversation analytics/proficiency fields; stored actions and self-rated reviews remain distinct from correctness. | I |

## G. Data stored — page 14

| ID | Learner-chosen record | Evidence and limits | Status |
|---|---|---|---|
| D01 | Expression + source sentence | Encounter schema; context key disambiguates occurrences. | I |
| D02 | Contextual explanation | Full validated explanation JSON. | I |
| D03 | Initial + revised interpretations | Separate fields, preserved in saved encounter. | I |
| D04 | Hints requested + answer reveals | Ordered assistance array; exact labels differ per interface but semantics must remain consistent. | I |
| D05 | Optional check response | `checkResponse`; help timing recorded separately. | I |
| D06 | Unresolved questions | `unresolved` boolean plus learner text/chat; there is no distinct rich unresolved-question object. Enough to preserve disagreement, not to invent its content. | I |
| D07 | Source conversation reference when available | `sourceUrl` for web/ChatGPT; local PDF file name/page stays local selection metadata, no public source URL invented. | I |
| D08 | Directly explained items marked Not attempted, not incorrect | Server recomputes status from initial attempt/help order. | I |
| D09 | Saved meaning never automatically replaces new-context reasoning | Separate context identity and explicit comparison; AI instructed not to assume matching sense. | I |
| D10 | Saving remains learner's choice | Explicit POST save; session draft/cached responses/chat persistence are disclosed separately. New same-context records update that encounter, not an unrelated word. | I |

## H. Failure and recovery paths — pages 14–15

| ID | Situation → required recovery | Evidence, missing detail, and acceptance test | Status |
| FR01 | Insufficient background → explicit help without compulsory guessing | Direct/reveal controls available immediately. Test empty interpretation then reveal. | I |
| FR02 | Several supported interpretations → explain ambiguity or ask for context | Shared policy now explicitly requests missing context and conditional alternatives rather than presenting an uncertain sense as settled. | I + E |
| FR03 | Selection splits an idiom → allow phrase expansion | Editable expression and sentence; up to 12 words; test “take into account”. | I |
| FR04 | Learner disputes feedback → clarification + unresolved | Checkbox and chat; disagreement does not block save/exit. | I |
| FR05 | AI/network/service error → retry/exit, draft preserved | Corrected extension re-explore clears prior work only after success. Web Learn/Chat use account-scoped session drafts; signout clears them. Account-switch remount and denied-account clearing prevent prior-account display or copying. Ordinary API failure preserves inputs and offers retry. | I |
| FR06 | Intervention interrupts reading → direct help or dismissal | Close/return/direct choice; no compulsory quiz or mandatory saving. | I |
| FR07 | Prior match uncertain → ask confirmation | Explicit comparison acceptance; web per-example confirmation and extension different-sense warning/collapsed meanings. | I |
| FR08 | Earlier answers can still be accessed; factual accuracy of original ChatGPT passage is not independently verified | UI concealment is temporary support, not a secure exam; no fact-checking claim. Include this in evaluation/prototype description. | I / R |
| FR09 | Protected page/PDF, scan, missing permission, expired auth, quota, malformed AI output | Additional compatible recovery: bundled PDF/manual input, permission prompt, reconnect, clear quota/error text, draft kept, strict JSON validation. Real hosted error scenarios require smoke tests. | I + E |

## I. Learning rationale — page 15

These are design intentions, not evidence of effectiveness.

| ID | Mechanism | Implemented support and evidence required | Status |
| LR01 | Noticing | Explicit candidate expression and local uncertainty prompt; test whether learner understands the trigger. | I + E |
| LR02 | Interpretation | Rough-meaning field before reveal; test actual learner use, not just control existence. | I + E |
| LR03 | Contextual reasoning | Focused question/clue/evidence and comparison; human reference review required. | I + E |
| LR04 | Monitoring/control | Mode choice, hints, reveal, skip, disagreement, exit. | I |
| LR05 | Reconsideration | Initial and revised fields preserved; evaluate changes without assuming improvement. | I + E |
| LR06 | Application | Optional same-sense new sentence with help hidden; evaluate against checked references. | I + E |
| LR07 | Retrieval/comparison | Sentence-first review and previous-context comparison; self-rated schedule not a mastery score. | I + E |
| LR08 | Investigate occurrence and usefulness of mechanisms | Code records observations; actual peer evaluation has not been supplied. No claims of lasting vocabulary gains. | E |

## J. Carrie/project-brief alignment — pages 15–16

| ID | Alignment point | Evidence, interpretation, and remaining deliverable | Status |
| A01 | Primary challenge: learning-oriented behavior | Guided loop retains interpretation/evidence/revision rather than only translation. | I |
| A02 | Highlight is candidate; uncertainty confirmed separately | Corrected F2b prompt; no AI call or proficiency inference from underline/highlight alone. | I |
| A03 | Use case: expression in AI-generated foreign-language text | ChatGPT housing scenario + ordinary website support. Real platform demonstration still required. | I + E |
| A04 | Useful timing: immediate difficulty with available context | User-triggered page selection; no background unsolicited LLM requests. | I |
| A05 | Optional contextual reasoning, progressively explicit help | Mode and progressive controls. | I |
| A06 | Retain interpretation, evidence, reconsideration, comparison | Sections B/D; corrected confirmation/collapsed comparison and retained learner text. | I |
| A07 | Recognize knowledge, ambiguity, feedback, interruption limits | FR01–08; explicit uncertainty/clarification policy and controls. Human evaluation still required. | I + E |
| A08 | May generalize to other language/expression, but no assumed effectiveness transfer | Product language options are implemented; no cross-language learning-effectiveness claim. | I / E |
| A09 | One complete interaction on a real AI platform | Complete flow code exists; record real ChatGPT browser demonstration, not only a fixture screenshot. | E |
| A10 | Presentation: problem, scenario, four guiding questions, demo, failure case, testing, revisions | Rehearsal checklist provided below. The PDF does not enumerate the four guiding questions; obtain instructor wording before claiming brief compliance. No slide deck requested explicitly in this implementation turn. | E |
| A11 | PromptMirror V2: interaction records → optional next action; observations distinct from self-reports | Observed assistance/attempt fields separate from review ratings; optional next action is check/revisit. No undocumented external PromptMirror API integration is claimed. | I / R |
| A12 | Complete instructor PromptMirror evaluation and share prototype files | Instructor form/material and authorized submission destination are absent. Built repos/extension package can be shared when available; evaluation cannot be fabricated or sent to others without instruction. | E |

## K. Evaluation plan — page 16

| ID | Required evaluation point | How to evaluate; current evidence boundary | Status |
| EV01 | Understand assistance choices | Ask peer to explain guided/direct/close before using them; record confusion and preferred route. UI existence is not a test result. | E |
| EV02 | Clues support contextual evidence use | Before/after explanation, ask which words informed meaning; compare to a checked reference. | E |
| EV03 | Interpretations change | Preserve first/revised text; human reviewer records what changed without automatic “better” labeling. | I instrumentation + E study |
| EV04 | Comparable new sentence without visible help | Corrected check hides earlier help; score real attempts against checked human reference and record additional help. | I instrumentation + E study |
| EV05 | Interruption, effort, reasons for direct choice | Ask brief post-task questions; record self-report separately from clicks/time. No synthetic feedback. | E |
| EV06 | Usefulness of saved-encounter comparison | Test two occurrences of “addresses” with different senses and ask whether comparison helps or misleads. | E |
| EV07 | Use checked reference interpretations, not model judgment alone | Fixtures are authored reference candidates; a competent human/instructor must check evaluation items. Automated tests do not satisfy this. | E |
| EV08 | If comparing guided/direct, account for prior knowledge, difficulty, order, time, additional practice | Use counterbalanced comparable items; record these factors. Small testing remains exploratory. | E |
| EV09 | Do not claim lasting vocabulary gains from small peer tests | Report usability/mechanism observations only; no effectiveness claim made. | I / R |

## L. First-prototype boundary and complete loop — page 16

| ID | Boundary statement | Resolution | Status |
|---|---|---|---|
| PB01 | One platform, one target language, small checked examples | Classroom/demo path can use Chrome + ChatGPT + English housing/idiom samples. Main product legitimately supports additional websites/languages/PDFs. | I / R |
| PB02 | Both pathways, responsive support, simple save/comparison | Both pathways and corrected comparison/check/review/draft controls are implemented. | I |
| PB03 | Postpone general-purpose chat | Product includes focused language chat, not a general task assistant; main plan explicitly requires chat. | R |
| PB04 | Postpone automatic proficiency assessment and full-conversation monitoring | Neither is implemented; no hidden inference or continuous conversation collection. | I |
| PB05 | Postpone accounts/Anki/large dashboards | Superseded by explicit main-plan product requirements and the user's full implementation request; accounts, review/export and modest dashboard included. | R |
| PB06 | Complete loop: select → uncertainty → support → interpret/compare → adjustable help → reconsider → optional check → return/save → revisit | All stages implemented after audit corrections. Browser regression reported by both UI owners; live production account/email and real learner evaluation remain separate acceptance evidence. | I + E |

## Acceptance and operational close-out ledger

This ledger separates verified code/tests from operational work and human evaluation. An assigned domain is not treated as a successful deployment, and a synthetic test is not treated as a peer study.

| Item | Required evidence | Current audit state |
|---|---|---|
| Exact-context reuse and saved state | Valid saved record reused without OpenAI call; normalized saved icon in both UIs | Implemented; live cache-deletion reuse check + API regression for exact context older than six new records passed |
| Context-independent lexical reuse | Correct changed facts; avoid repeating valid facts | Live `book` noun→verb corrected; next verb context returned lexicalUpdate:null. Two calls total; 867 input + 331 output tokens; 0 pending reservations |
| Selected chat context | Prior sentence + bounded learner assistance/attempt context survives follow-up | Implemented and regression-tested; unsaved transient context creates no vocabulary record |
| On-page word indication and overlay | Activated readable words underlined; explicit choice; compact help; top save state; theme contrast | Implemented; Chromium overlay smoke (local audit artifact retained in the workspace), dark overlay screenshot (local audit artifact retained in the workspace); extension owner reports pass |
| Install/sign-in handoff | Install opens onboarding; secure shared account connection | Version 0.1.1 replaces address/code forms with Connect account → website authentication → automatic account connection. Connected identity hides the button; scoped logout/expiry restores it. Account-bound exchanges reject stale completion and wrong-account cancellation. Browser regression source: `web/tests/extension-connect.browser.mjs` in this workspace, `tests/extension-connect.browser.mjs` in the web repository. |
| Comparison correctness | Explicit acceptance; old/new sentences visible; old meaning collapsed; decline available | Implemented; UI owners report browser regression pass |
| Check concealment | No earlier explanation, comparison answer, feedback, or clue remains visible while checking | Corrected; UI owners report browser regression pass |
| Draft recovery | Failed re-explore and navigation/reopening retain learner text; account isolation | Extension re-pair clears old session/UI/overlays and ignores old requests. Web keys workspace by account ID, clears selected/chat context on identity changes, snapshots one token per refresh batch, and clears prior workspace on 401/403. Eight Chromium account-isolation groups passed: no A→B draft copying, no old history/context/modal, correct A restoration, logout cleanup, denial handling; no JS errors |
| Review controls/records | Attempt/help/reveal/uncertainty/delete and correct self-rated next date | Implemented; API review-history assertions pass |
| Settings synchronization | Focus refresh sees committed changes without overwriting dirty edits | Both clients preserve dirty edits; partial-field saves avoid overwriting unrelated remote changes |
| Neon provision/migrations | Real database, applied schema, private data persistence | Live test-owned database persistence/cache/token-counter operations passed; synthetic rows cleaned afterward |
| Email verification | API requires verified account; real signup/OTP/login/reset smoke | DB-backed verified/non-banned gate and UI OTP path implemented. Shared auth@mail.myneon.app sender configured, no custom SMTP; codes/password reset supported. Actual inbox delivery/reset not exercised |
| Vercel production | Successful deployment + health/config + protected API/extension smoke | Live https://contextbridge-newpoluton.vercel.app: READY; `/` 200, `/api/health` 200, config demo:false/storage:neon/aiConfigured:true; anonymous encounters 401; ZIP 200; allowed extension preflight 204 and unknown origin 403; account screen rendered. Final handoff/account-isolation release `bd02f1313e7b1084a54f6c22206057333219b722` deployed READY as `dpl_B6rRD646ojHS7aYHEftqqkbf9hcz`; the final client asset and downloaded ZIP hash were verified against the tested local build |
| Two GitHub remotes | Separate pushed web/extension source | [Web source history](https://github.com/newpoluton-alt/contextbridge-web/commits/b/initial-implementation) and [extension source history](https://github.com/newpoluton-alt/contextbridge-extension/commits/b/initial-implementation). Final extension pushed at [92de9c9](https://github.com/newpoluton-alt/contextbridge-extension/commit/92de9c9); website history captures its final audit/deployment updates without a self-referencing report hash |
| Extension package | Production origin/stable ID, excluded secrets, Chrome smoke | Final ZIP rebuilt with handoff/account-isolation/check/sync fixes and copied into web download assets: 2,670,628 bytes; SHA-256 `bccfb72b7881d8b9d631c322bab5ed8f92976acf51380a569e1be4c27fe0b12d`. Stable ID `dfpafpdmlhafhpknaijeeelhdpbkiogk`; nine tests, typecheck, packaging, stable-ID and credential-exclusion checks passed |
| Automated checks | Final combined tests/build/typecheck | Independent web `npm test`: all 34 passed after old-context regression; successful build reported by root. Live lexical integration passed. Extension final nine tests and Chromium handoff/isolation/sync/check regression passed. Final web account-isolation regression passed all eight groups plus full typecheck; zero JS errors. Account test source: `web/.data/account-isolation-test.mjs` (local test artifact, not production code) |
| Cross-OS support | Chrome install exercise on macOS/Linux/Windows | Portable implementation; all three actual platform exercises not evidenced |
| Peer evaluation | Real participants, checked references and six evaluation observations | Not performed by an automated implementation audit |
| Instructor evaluation/share | Provided form, completed honest responses, authorized destination | Awaiting external material/explicit submission instruction |

## Reproducible peer-test and presentation worksheet

This is a ready-to-use protocol, not fabricated results.

1. Use Chrome on ChatGPT with the housing proposal sentence. Ask the peer to select “addresses”, confirm the exact sentence and describe each assistance choice before choosing one.
2. Guided task: record the initial interpretation verbatim, the clue requested, which surrounding words the peer uses as evidence, and the revised interpretation. Mark observed actions separately from what the peer says they felt or understood.
3. Hide previous assistance and use “The report addresses the problem but offers no solution.” Record the answer before/after additional help. Compare with an independently checked reference: dealing with/discussing the problem does not imply solving it.
4. Save and revisit; then compare “The mayor addressed the audience.” Confirm the peer does not automatically apply the earlier sense. Keep earlier explanations collapsed until requested.
5. Direct task with a different, comparable item: ask why direct help was chosen. Record prior familiarity, item difficulty, route order, elapsed time and additional practice. Counterbalance route/item order across peers if comparing routes.
6. Exercise a failure: ambiguous or incomplete context, a selected phrase fragment, an intentional disagreement, or a network failure. Observe whether clarification, expansion, unresolved status, retry and exit are understandable and preserve work.
7. Ask about interruption, effort, control and comparison usefulness. Report actual observations and design changes. Do not turn small usability findings into claims of long-term retention or language proficiency.

For the classroom presentation, prepare: the learning problem; housing scenario; the instructor's actual four guiding questions (not supplied in this PDF); one complete live platform demonstration; one honest failure/recovery case; peer-testing method/results if obtained; and the design changes prompted by that evidence. Attach the two source repositories and installable extension package when their final URLs/artifacts are available. Complete the instructor's PromptMirror form only from the real supplied form and actual observations.

## Known boundaries that remain legitimate, rather than hidden omissions

- The extension targets desktop Chrome. Firefox/mobile ports and Chrome Web Store publication were not requested by the current Chrome-first plan.
- Scanned PDF OCR, arbitrary protected-page injection, and bypassing browser restrictions are not implemented; local PDF text reader/manual entry are explicit fallbacks.
- The server constrains and validates model output but does not independently prove every generated language explanation or the factual claims of the original passage.
- A self-rated review schedule is not proficiency detection. No “mastered” status is inferred from clicks, repeated words or response counts.
- Anki-compatible export and Anki-style review are implemented; direct AnkiWeb account synchronization is not claimed.
- Actual peer study results, instructor evaluation, and third-party submissions require real material/participants and appropriate authorization; they cannot be manufactured to make the checklist look complete.

## Account connection update — 7 November 2026

Extension 0.1.1 uses one Connect account button, opens website sign-in or registration, and connects automatically after verified authentication. Connected account details replace the button. Signing out on the website disconnects that account in this browser; expired extension credentials and revoked website permission restore the button. Address and connection-code forms have been removed from the normal flow. Older installed extensions get explicit download/reload guidance.

Validation passed: 35 web tests, 19 extension tests, both production builds, package credential-exclusion checks, three existing sign-in browser cases, and nine new browser connection cases using the actual extension worker and external messaging with a local authentication/API fixture. The new cases cover automatic sign-in connection, account-scoped logout, website logout, registration/verification continuation, revoked credentials, logout during a delayed exchange, session expiry after reload, older-extension updates, and an absent extension. The panel was checked at 380 pixels with no horizontal overflow. The fixture pregrants localhost permission; the native Chrome approval dialog is outside this automated test. Connection checks make no AI requests.
