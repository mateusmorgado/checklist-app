# Checklist app: markup and rules contract (read this first)

File: a single `index.html` (plain React 18 from a CDN as `h = React.createElement`, no JSX, no build). Never edit the real
`/home/user/checklist-app/index.html`. Work only in YOUR copy, as told in your task. Tests: use
`/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/harness.cjs` (`openApp(file, opts)`; see its header).
Screenshots: use page.screenshot then the Read tool to LOOK at them. Fonts (B612, B612 Mono, Bricolage Grotesque, Space Grotesk) render locally.

## Product rules (do not break)
- Phone, one-handed, RIGHT thumb. Everything is anchored bottom-right. Item stacks grow upward (first item at the bottom). Tick boxes on the right.
- The page never scrolls (html/body overflow hidden). Only named inner containers may scroll (`.settings-scroll`, `.refs`).
- A ticked item never moves; it is dimmed and shows a tick.
- No emoji anywhere in the UI. Plain, direct copy, no exclamation marks, no scolding.
- Everything optional is opt-in. Sound and speech are off unless the checklist enables them.
- Must work at 320, 360, 390, 430 px wide and 480+ px tall, light and dark where the design supports it, with prefers-reduced-motion.
- Hit areas at least 48x48 CSS px (visible controls may be smaller).

## Screens and their markup (screen = one root `div.screen`)
- Home: `.screen > .stack > div.item.home-item(.edit-link "edit", .open title)` + `.bar(#new "+ New", #quick "Quick list", #settings "Settings")`.
- Run: `.screen > h1 + .stack > button.item(.done)[role=checkbox][aria-checked] > .label(span, .detail required, .detail detail) + span.mark[data-done]` + `.bar(button Close/Done, ToneControls)`.
- Ask (before a run): `.screen.edit > .points>h1 (question) + .hint + .entry>input#answer (number) | actions: #no #yes` + `.actions`.
- Editor (all `.screen.edit`, a CSS grid with areas points/hint/entry/actions): name step (`.hint` + `.entry input#title` + `.actions`), feedback step (`.screen.edit.intro`: `.intro-text` at the top, `.points` with `h1` + `.stack > button.prop#fb-sound/#fb-voice`, `.actions` with #fb-refs #fb-next), points step (`.points > h1 + .stack > .row(.x remove, .label, .mark)` + `.hint` + `.entry input#draft` + `.actions` Delete/Cancel/Questions/Save), item step (`.prop` rows, `input#field`, Required toggle), questions step (list / type / cond / then stages), References page (`.screen.edit > .refs > .refs-in`).
- Settings: `.screen.settings > .settings-scroll > .settings-in(h1, .sec headings, .choices[role=radiogroup] > button.choice#design-*, .rows > button.srow#set-*)` + `.actions`. Sub-screens use `.screen.edit`.
- Button rows: `.actions` (editor/ask) and `.bar` (home/run). Primary = button WITHOUT class `muted`; quiet/secondary = `button.muted`.
- Shared classes: `.label`, `.detail`, `.hint`, `.muted`, `.err`, `.mark`, `.x`, `.row`, `.prop`, `.choice`, `.srow`, `.sec`, `.entry`, `.points`, `.stack`.

## Theming rules
- Designs are `:root[data-design="classic|airplane|modern"]`; mode `[data-mode=system|light|dark]`; effects `[data-effects=full|reduced]`; host may set `[data-theme=light|dark]`.
- ALL colors, fonts, radii, borders and shadows come from tokens: `--font --font-display --font-mono --bg --surface --fg --muted --line --line-strong --lift --accent --accent-fg --ok --warn --err --focus --placeholder --radius --border --shadow --hit-min --row-h`. Add new tokens only inside a design block (or the shared base block if a feature needs a neutral default).
- Each design block must be scoped by `:root[data-design="..."]` (specificity!). Classic is the base look. Airplane is always dark. Modern is light first with a dark variant under `[data-mode=dark]` / system dark.
- Under `[data-effects="reduced"]`, `prefers-reduced-motion: reduce` and `prefers-contrast: more` / `forced-colors: active`: no grain, no gradients, no transitions; state must still be visible without color or shadow.

## Merge protocol (important)
Your copy starts as `base.html`. Edit ONLY inside your marked region(s) (`@@NAME-START` ... `@@NAME-END` comments) plus the few extra places your task lists. Do not reformat, reorder or rename anything else. At the end, run `diff -u base.html index.html > patch.diff`, run the regression checks your task names, and report. A three-way `git merge-file` merges your file with others, so unrelated lines must stay byte-identical.

## Regression suites (all must still pass when run against YOUR copy; they open /home/user/checklist-app/index.html, so copy a suite and change the file path first)
Scratchpad `t8 t9 t11 t14 t15 t16 t18 t19 t21 t24 t25 .cjs` in `/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/` (see `run-regression.sh <html file>`).
