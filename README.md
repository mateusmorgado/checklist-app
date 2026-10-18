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
- **Questions:** yes/no only for now, asked once before a run: "If [I go to the sauna], then add Towel". A Yes adds the linked items. Number questions and quantity formulas ("5 nights, 7 socks") are parked until the workflow is designed; saved ones still run.
- **List direction** (Settings): lists grow bottom to top by default so the first item and the buttons are close to the thumb, or top to bottom.
- **Style options:** with Airplane selected, Settings offers a cockpit style: Airbus (the original look), Boeing or Embraer. With Modern selected it offers four colour sets: Mint & coral, Electric blue, Cream & mint, Bold red. The cockpit styles are inspired by each maker's display conventions, not copies.
- **Quick list (bolt button on Home):** tap the big microphone and say a list out loud (up to 17 seconds, tap Stop when done). There is no name box: lists are called Quick list, Quick list 2, Quick list 3 and so on. If Google fails, the screen shows its status and message. The function tries `GEMINI_MODEL`, then `gemini-flash-latest`, then `gemini-2.5-flash`. The recording goes to `api/quick.js`, a Vercel function that asks Google Gemini to turn it into a checklist, and the text lands in an editable box. Good for groceries. Limit: 3 per IP per day.
  - **Setup in Vercel:** add the environment variable `GOOGLE_API_KEY` (a Google AI Studio key; optional `GEMINI_MODEL`, default `gemini-2.5-flash`). For a daily limit that holds across servers, connect an Upstash Redis store from the Vercel Marketplace (it adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`). Without a store the limit is kept in memory and is only approximate.
  - Opening `index.html` on its own (no `/api`) shows "Quick list is not available" and you can still type the items.
- **Plain-language points:** the Quick list box (typed or spoken) turns sentences into points: "I need to buy milk, eggs and bread. Also call mum" becomes Milk, Eggs, Bread, Call mum. It splits on lines, bullets, numbers, commas, semicolons, sentence ends and and/then/also (English, Portuguese, Spanish, French, German), drops phrases like "I need to" and "don't forget", removes duplicates and shows the result in the box before saving.
- **Click sound (Modern):** a soft click on every button press; Settings > Click sound turns it off. It is separate from the Attention tone.
- **Reset (Settings > Reset app):** *Reset settings* puts the look and sounds back to the standard (Modern, Bold red) and keeps your checklists; *Erase everything* also deletes the checklists, clears the offline copy and service worker and reloads with the four example lists. Both need a second tap to confirm.
- **Modern is always light; click and haptics (Modern and Airplane):** Modern has no dark mode (the Mode row is hidden there). The click, also in Airplane (a crisper cockpit-toggle version), is a quiet, three-part physical switch sound (snap, soft thock, faint release tick), and a short vibration goes with it where the phone supports it (Android; iPhone 17.4+ Safari through a hidden switch); both have their own toggles in Settings.
- **Design-matched icon:** the manifest, home-screen icon, tab icon and bar colour follow the design you install from: yellow check on red (Modern), cyan square check on near-black (Airplane), black square check on light grey (Minimalist). Files: `manifest*.webmanifest`, `icons/`. The installed app on Android shares the browser's saved settings; an iPhone copy starts with its own (default look).
- **Big screens:** the phone-shaped app sits centred with a faint outline (a slightly heavier, still faint ink line in Modern).
- **Report a bug (Settings > Report a bug):** a small form (what happened, optional reply email, a switch for technical details: design, screen size, browser; never the checklists). It posts to FormSubmit, which emails it to the developer; if that fails there is an Open my email app link with the same text. FormSubmit sends a one-time activation email to the receiving address on the very first submission, so the owner must click it once before reports are delivered.
- **Easter egg (Modern):** tap the sparkle or the check sticker on Home and it spins like a disk, then coasts to a stop; tap again while it spins to speed it up. Off under Effects: Reduced and the system's reduced-motion setting.
- **Link preview:** sharing the link in WhatsApp, Telegram, iMessage or Slack shows a Modern-style card (`og-image.png`, 1200 x 630, bold red with the yellow checkbox logo) through Open Graph tags in `index.html`. The tags use the absolute address `https://checklist-app-topaz-six.vercel.app`; change it there if the app gets another domain. WhatsApp caches previews, so an old link may keep showing nothing for a while.
- **Full screen:** once installed, the app opens full screen (`display: fullscreen` in the manifest, falling back to standalone). Reinstall it once to pick up the change on a phone that already has it. The app icon is a yellow check on red.
- **Phone-shaped on big screens:** the app never grows beyond an iPad mini (768 x 1024) and stays centred.
- **Install:** Settings has an Install app button at the top and Home shows a dismissible card under the logo (it comes back after 5 days). Both open an install pop-up that explains it is a web app (no app store, works offline, opens full screen, updates itself) and shows how to add it on Android, iPhone/iPad/Mac and Windows, with the visitor's own system first and marked "This device". Its Install app button runs the browser's install prompt when there is one (the browser offers it once; after it was used or dismissed, the button points to the steps instead); in Modern the button, the Settings row and the card button wiggle and pulse to catch the eye (still under Effects: Reduced and the system's reduced-motion setting). It is a PWA: `manifest.webmanifest`, `sw.js` and the icons make it installable and available offline once loaded.
- **Icons and fun:** buttons carry small icons in Airplane and Modern (Minimalist keeps plain words). Modern adds two floating stickers on Home (a sparkle and a chunky checkmark), a pop when you tick an item, moving stripes in the progress bar and confetti shot up from the bottom when a list is finished (random launch points, heights and spins, falling back under gravity); all of it stops under Effects: Reduced or the system's reduced-motion setting.
- **Progress bar:** a bar fills smoothly as items are ticked during a run (Settings > Progress bar to turn it off).
- **Manifesto:** the link under the logo explains where checklists come from (pilots, then doctors) and why they help.
- **Cues:** Attention tone and Confirmation cue can be toggled from Settings (default for new lists) and per checklist while editing (Cues button).
- **Required items:** a run can be finished once the required items are ticked.

- **Three designs** (Settings): *Minimalist* (plain white, system font, nothing extra), *Airplane* (always-dark glass cockpit, B612 fonts) and *Modern* (neobrutalism with grain, Bricolage Grotesque + Space Grotesk). Modern in Bold red is what a first-time visitor sees; switching to Modern from another design makes the Colours row wiggle once and keep a dashed outline until it is tapped. Each has its own typeface and logo treatment. Mode (system/light/dark) and Effects (full/reduced) are also in Settings.
- **Attention tone options** (Settings > Attention tone): Tick, Heart monitor, Cabin hum, Sonar, Metronome and Alarm, with a 3 s preview and a low/medium/high volume that is a hard cap. The soundscapes play while a checklist with Attention tone on is open; the run has a Sound off button, and everything stops when you leave or the tab is hidden.
- **Parked:** the AI Quick list is switched off (`QUICK_LIST_ENABLED = false`; draft in `wip/quick/`), as are the other drafts in `wip/`.

## Reference

The conversation this project was built in, to go back to when picking the work up again:
https://claude.ai/share/97cbc056-6bb6-4524-96e8-3218395231b4

## Ideas for issues

- **Voice repetition:** read each item aloud (text to speech) and let the user answer by voice or tap, like a challenge-and-response checklist. Useful when hands are busy.
- **Advanced checklists and logging:** a checklist item could ask for a value when it is ticked: a yes/no, a number or a short text, and that value is logged. Examples: checking your mood (a number from 1 to 5 plus a note), or a "clean socks" count that goes down each trip, so the next packing list brings fewer.
