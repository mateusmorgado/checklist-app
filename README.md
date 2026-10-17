# ChecklistPro

A minimal checklist prompt app. Define checklists in advance, run one on demand and tick items off from the bottom up. Not a todo list or a habit tracker.

Plain React from a CDN in a single `index.html`. No build step.

```
python3 -m http.server 8000   # then open http://localhost:8000
```

Checklists are saved in the browser's `localStorage`.

## What it does

- **Run:** items stack from the bottom up, checkmarks on the right. A ticked item stays where it is, dimmed with a tick, so nothing moves under the finger. Everything sits within reach of the right thumb.
- **Create:** name first, then the feedback settings (an Attention tone when you tick an item, and/or a Confirmation cue that repeats the item out loud, with the research behind them on a References page), then the points, one at a time. Tap an item for details, a quantity formula and a "required" flag. Hold and drag to reorder.
- **Questions:** asked before a run, as sentences: "If I go to the sauna, then add a towel" (yes/no) or "How many nights, then add shirts" (number). Yes counts as 1 and no as 0, so linked items appear only when they should. Quantities can use formulas such as `nights + 1`.
- **Required items:** a run can be finished once the required items are ticked.

- **Three designs** (Settings): *Classic* (paper, Newsreader serif), *Airplane* (always-dark glass cockpit, B612 fonts) and *Modern* (neobrutalism with grain, Bricolage Grotesque + Space Grotesk). Each has its own typeface and logo treatment. Mode (system/light/dark) and Effects (full/reduced) are also in Settings.
- **Attention tone options** (Settings > Attention tone): Tick, Heart monitor, Cabin hum, Sonar, Metronome and Alarm, with a 3 s preview and a low/medium/high volume that is a hard cap. The soundscapes play while a checklist with Attention tone on is open; the run has a Sound off button, and everything stops when you leave or the tab is hidden.
- **Parked:** the AI Quick list is switched off (`QUICK_LIST_ENABLED = false`; draft in `wip/quick/`), as are the other drafts in `wip/`.

## Reference

The conversation this project was built in, to go back to when picking the work up again:
https://claude.ai/share/97cbc056-6bb6-4524-96e8-3218395231b4

## Ideas for issues

- **Voice repetition:** read each item aloud (text to speech) and let the user answer by voice or tap, like a challenge-and-response checklist. Useful when hands are busy.
- **Advanced checklists and logging:** a checklist item could ask for a value when it is ticked: a yes/no, a number or a short text, and that value is logged. Examples: checking your mood (a number from 1 to 5 plus a note), or a "clean socks" count that goes down each trip, so the next packing list brings fewer.
