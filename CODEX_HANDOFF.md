# Voice Finance — Codex Handoff

## Objective

Continue the existing **Voice Finance** project as a real, working, mobile-first finance PWA, with **zero additional paid services**.

Repository:
- `dimasdont-lab/voice-finance-free`
- Intended production hosting: GitHub Pages
- Primary device for testing: iPhone Safari
- Primary currency: PLN

This folder contains the latest free prototype source. Treat it as the source of truth for the next iteration.

---

## Non-negotiable product constraint

**Do not introduce any paid runtime dependency.**

Do NOT use:
- Lovable credits
- OpenAI API billing
- ElevenLabs
- paid STT APIs
- paid databases
- paid hosting
- paid serverless APIs

Allowed:
- GitHub Pages
- browser APIs
- open-source JS/WASM/WebGPU libraries
- Hugging Face model downloads
- localStorage / IndexedDB
- free CDN-hosted static assets/libraries

The user already pays for ChatGPT/Codex and does not want any additional recurring usage cost for this prototype.

---

## Current product behavior

### Main screens

Bottom tabs:
- Home
- Insights
- Goals
- Profile

Home:
- total balance
- total income
- total expense
- top categories
- recent transactions
- history
- manual add
- voice add
- scan placeholder

Transaction model:
- id
- type: `expense | income`
- amount
- currency
- category
- optional client
- note
- date/source where relevant

Default categories:
- Продукти
- Транспорт
- Їжа
- Техніка
- Дім
- Підписки
- Бізнес
- Подорожі
- Інше

Data persists locally.

---

## Approved design

Do not redesign from scratch.

Visual direction:
- mobile-first
- almost-black background (`#050505`)
- Apple-like / iOS-like
- large rounded radii
- subtle low-contrast borders
- restrained glass/blur only where useful
- no blue primary accent
- pastel red/pink accent around `#FF7D83`
- microphone: red circular control with clean white ring
- frequent controls low on screen for thumb reachability

Bottom nav:
- Home / Insights / Goals / Profile
- selected tab = small darker oval/pill + pastel-red icon/text
- unselected = gray

Do not add greetings, motivational copy, or decorative clutter.

---

## Voice problem we are fixing

The previous online prototype used Safari/browser `SpeechRecognition`.

That approach was rejected because:
- recognition often worked only once, then errored
- code-switching was poor
- Ukrainian mixed with Polish/English brands was unreliable
- e.g. `Biedronka` was not recognized reliably
- hard language selection is undesirable

The user wants to speak naturally, for example:

- `200 злотих Biedronka`
- `Бєдронка, продукти, двісті злотих`
- `мінус 45 злотих Uber`
- `плюс 3000 злотих від Johnny за зйомку`
- `Johnny заплатив мені 2000 за монтаж`
- `50 євро hotel Booking`
- Polish + Ukrainian + English in one utterance

The UI should preserve brand/client names in Latin spelling where practical:
- Biedronka
- Żabka
- Lidl
- Uber
- Bolt
- Booking
- Johnny
- Adobe
- OpenAI
- DaVinci Resolve

---

## Current free voice architecture

The latest prototype intentionally removed browser `SpeechRecognition` as the main recognizer.

Current intended flow:

1. `getUserMedia`
2. `MediaRecorder`
3. stop recording
4. fully stop/release every microphone track
5. decode audio in browser
6. resample to mono 16 kHz
7. send Float32 audio to a Web Worker
8. run multilingual Whisper locally with Transformers.js
9. parse transcript locally
10. show confirmation before saving

Files:
- `index.html`
- `whisper-worker.js`
- `manifest.webmanifest`
- `sw.js`

Current worker imports Transformers.js from jsDelivr and attempts models in decreasing order:
- Whisper small q4 / WebGPU
- Whisper base q4 / WebGPU
- Whisper base q8 / WASM
- Whisper tiny q8 / WASM fallback where applicable

The first model load may be large. Cache should be used on later runs.

No audio should be uploaded to an AI API.

---

## Known risks / work that Codex must validate

The current free build has NOT yet been fully validated on the user's actual iPhone Safari.

Priority questions:

1. Does Transformers.js + Whisper run reliably on current iPhone Safari?
2. Does WebGPU work in the target Safari build? If not, does WASM fallback work?
3. Is the model too large / memory-heavy for iPhone?
4. Does CDN loading work under GitHub Pages CSP/origin rules?
5. Does `MediaRecorder` produce a format Safari can decode reliably?
6. Does repeated record → stop → transcribe → record work at least 5 times without reload?
7. Are all microphone tracks released after every stop/error?
8. Does service worker caching accidentally cache stale model/app code?
9. Is loading feedback clear enough during first model download?
10. Is voice latency acceptable?

Do not assume the current worker is production-correct. Test and repair it.

---

## Parser requirements

The parser is local and must be good enough for common finance phrases without a paid LLM.

It should support:
- Ukrainian
- Polish
- English
- mixed-language phrases

Required examples:

`200 злотих Biedronka`
→ expense / 200 PLN / Продукти / merchant Biedronka

`мінус 45 злотих Uber`
→ expense / 45 PLN / Транспорт / Uber

`плюс 3000 злотих від Johnny за зйомку`
→ income / 3000 PLN / Бізнес / client Johnny

`Johnny заплатив мені 2000 за монтаж`
→ income / 2000 PLN / Бізнес / client Johnny

`50 євро hotel Booking`
→ expense / 50 EUR / Подорожі / Booking

`dwieście złotych Biedronka`
→ expense / 200 PLN / Продукти

Include fuzzy/normalization mappings for common phonetic variants, including:
- бєдронка
- бедронка
- bjedronka
→ `Biedronka`

Prefer deterministic local logic:
- aliases / dictionaries
- fuzzy matching
- phrase templates
- number-word parsers for UA/PL/EN
- merchant→category mapping
- client extraction

Do not silently save uncertain voice results. Always show a confirmation/edit card first.

---

## Manual input must remain fully functional

Even if local Whisper fails:
- manual transaction add must work
- typed voice-phrase parser fallback must work
- edit/delete must work
- navigation must work
- data must persist

Never make the app depend on voice initialization to boot.

---

## Storage

For current prototype:
- `localStorage` is acceptable

Potential improvement:
- move model-related/app state or larger metadata to IndexedDB if useful

Do not add cloud database/auth for now.

---

## Hosting

Target is GitHub Pages, free.

Repository:
`https://github.com/dimasdont-lab/voice-finance-free`

Preferred deployment:
- static app
- no server backend
- GitHub Pages from `main` or a Pages GitHub Actions workflow

If a workflow is added, keep it minimal and free.

---

## First Codex task

Do this before adding new product features:

1. Inspect every file in this folder.
2. Run a local static server.
3. Verify no JS startup exceptions.
4. Verify all navigation and manual transaction controls.
5. Review the local Whisper implementation for Safari compatibility.
6. Make the microphone state machine robust:
   - idle
   - requesting permission
   - recording
   - stopping
   - decoding
   - model loading
   - transcribing
   - confirmation
   - error/retry
7. Ensure stream tracks are stopped on all exit paths.
8. Add a reliable timeout/reset path.
9. Make repeated recordings safe.
10. Add/keep text phrase fallback.
11. Test the local parser against the required phrases.
12. Optimize the model strategy for an iPhone first, not desktop first.
13. Keep everything free/local.
14. Commit the improved version.
15. Push to GitHub.
16. Configure GitHub Pages.
17. Return the live HTTPS URL.
18. Report what is still limited specifically because recognition is fully local.

---

## Testing expectations

At minimum test:
- Add expense manually
- Add income manually
- Edit transaction
- Delete transaction
- Reload and verify persistence
- Navigate all four tabs
- Category list
- History
- Goals
- Insights
- Export JSON
- Typed parser fallback

Voice lifecycle:
- 5 sequential recording cycles without refresh
- permission denial recovery
- empty/no-speech retry
- model load error recovery
- decode error recovery
- offline-after-model-cache behavior if practical

Parser fixtures:
- all phrases listed above
- common variants of Biedronka/Żabka/Uber/Bolt
- `3000 PLN Johnny montaż`
- `Lidl sto pięćdziesiąt złotych`
- `двісті злотих лідл`
- `two hundred PLN Uber`

---

## User preference / collaboration notes

- User communicates mainly in Ukrainian.
- Be direct and practical.
- Avoid repeatedly asking permission for normal development steps.
- Do not propose paid services unless explicitly requested.
- Do not replace the approved UI direction without a concrete reason.
- The key product requirement is extremely fast voice-first finance entry.

---

## Definition of done for the next milestone

The milestone is done when:

- repo contains the working app
- GitHub Pages provides a public HTTPS URL
- manual flows work
- local voice can be started/stopped repeatedly without getting stuck
- app survives voice errors without reload
- mixed-language typed parser examples work
- no paid runtime service is involved
- limitations of local Whisper on iPhone are measured rather than guessed
