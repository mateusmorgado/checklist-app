# Work in progress (paused to save tokens)

This folder is **not part of the app**. It holds unfinished work from an agent round that was stopped on purpose.
The app itself (`../index.html`) is committed, tested and working. Delete this folder when the work is merged.

## What is already in the app (committed)
- Settings screen (Home > Settings) with a Design switch (Classic, Airplane, Modern), Mode and Effects.
  Airplane and Modern only have colours and fonts so far, no component styling.
- Token-based CSS (`:root[data-design=...]`), design applied before first paint, saved in `localStorage`.
- Marked slots for each feature (`@@SOUND-ENGINE`, `@@QUICKLIST`, `@@UX-RUN-CSS`, ...), currently stubs.
- 11 older test suites and a Settings suite (`tests/`, 40 checks), all passing.

## What is here, unfinished and unreviewed
Four engineers were each building in a private copy of `base.html`. They were stopped mid-work, so none finished,
none reported back, and none is verified. Treat the code as a draft.

| Folder | Draft of | State when stopped |
|---|---|---|
| `sound/` (**merged into the app**) | Attention tone sounds (heart monitor, cabin noise, sonar, metronome, alarm), Settings tone screen, mute button | engine written, tests partly written, not run to completion |
| `quick/` | AI Quick list (screen, Settings, API call, hardening) plus `mock-anthropic.cjs` test server | code and tests partly written |
| `uxrun/` | Progress line, next-item emphasis, Done guard, Ask screen improvements | partial |
| `uxedit/` | Move up/down, Undo toast, inner scroll, input limits | partial |

Not started: the honest References copy (waits for research), the Airplane and Modern designs, the bug-hunt round.
Research results for the designs and UX are in `specs/` (`airplane.json`, `modern.json`, `classic.json`, `ux.json`,
`a11y.json`, `research-raw.json`). Their caveat: primary sources could not be read, many figures come from search summaries.

## Tools
- `tools/harness.cjs`: Playwright helper (local React, local fonts). `tools/audit.cjs`: contrast, tap target and overflow audits.
- `tools/merge.sh`: three-way merge of agent copies onto the real file. `tools/run-regression.sh`: runs `tests/`.
- `tools/CONTRACT.md`: markup and theming rules the agents worked from.
- These scripts contain absolute paths to a temporary folder from the old session. Edit the `D=` / `SP` paths and
  install `playwright-core`, `react@18.3.1`, `react-dom@18.3.1` and the `@fontsource/*` packages used by the harness
  (`b612`, `b612-mono`, `bricolage-grotesque`, `space-grotesk`) in a `pw/` folder first.

## Cheapest way to resume
1. Do one feature at a time in the real file, no parallel agents. Start with **sound** (`sound/engine.js` is the core).
2. Read the draft, run its tests, fix, copy the region into `../index.html`, run `tests/`, commit.
3. Then Quick list (`quick/`), then run-screen UX, then editor UX.
4. Style Airplane and Modern last, once the markup is final (specs in `specs/`).
5. Bug-hunt with a few targeted scripts instead of a large fan-out.
