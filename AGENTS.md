# AGENTS.md

## Project
Voice Finance Free — mobile-first finance PWA.

## Core rule
Do not add paid runtime services or APIs. The app must remain usable without per-request/per-minute charges.

## Priorities
1. Reliability on iPhone Safari.
2. Manual transaction flows must never depend on voice.
3. Voice processing should remain local/open-source.
4. Mixed Ukrainian/Polish/English input is expected.
5. Keep the approved near-black Apple-like UI and pastel-red accent.
6. Persist user finance data locally for this prototype.
7. Test before claiming a flow works.

## Git
Repository: `dimasdont-lab/voice-finance-free`

Make focused commits with descriptive messages.
Before pushing, verify the app locally.
Prefer a feature branch + PR if the environment makes that easier; otherwise push `main` only after validation.

## Read first
Read `CODEX_HANDOFF.md` and `TASK.md` before editing.
