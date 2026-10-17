/* @@SOUND-ENGINE-START
   Attention tone. Per checklist it is on or off; the sound itself is chosen in Settings. 'tick' is one short tick per
   ticked item. The other choices are a soundscape that runs while the checklist is open and keeps a little pressure on.
   Everything goes through one master gain and a limiter. The master gain is the hard volume cap (the voices peak at 1
   or below), and it fades in and out so nothing clicks. Audio is optional: any failure here leaves the app silent.
   The tone functions at the bottom are the only entry points the rest of the app uses. */
const TONE_CHOICES = ['tick', 'heart', 'cabin', 'sonar', 'metronome', 'alarm'];
const TONE_VOLUMES = ['low', 'medium', 'high'];
const TONE_CAPS = { low: 0.06, medium: 0.12, high: 0.22 }; // peak master gain, never exceeded
const TONE_FADE = 0.1;       // seconds: fade in and out on start, stop and mute
const TONE_AHEAD = 0.15;     // seconds scheduled in advance, so a busy tab cannot make beats drift or bunch up
const TONE_EVERY = 25;       // ms between scheduler runs
const TONE_PREVIEW_MS = 3000;

// One enveloped oscillator on the loop's bus. env = [[seconds after t, gain, 'exp'?], ...]; the first entry is the start.
function toneVoice(L, type, freq, t, env) {
  const c = L.G.ctx, osc = c.createOscillator(), g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(env[0][1], t);
  for (let i = 1; i < env.length; i++) {
    const [dt, v, expo] = env[i];
    if (expo) g.gain.exponentialRampToValueAtTime(v, t + dt); else g.gain.linearRampToValueAtTime(v, t + dt);
  }
  const end = t + env[env.length - 1][0];
  osc.connect(g); g.connect(L.bus);
  osc.start(t); osc.stop(end + 0.02);
  L.voices.push({ osc, g, start: t, end });
}
// Beats: period in seconds and what one beat sounds like. Gains stay at 0.9 or below.
const TONE_BEATS = {
  heart: { period: 60 / 72, play: (L, t) => toneVoice(L, 'sine', 1000, t, [[0, 0], [0.012, 0.9], [0.072, 0.9], [0.09, 0]]) },
  metronome: { period: 1, play: (L, t) => toneVoice(L, 'sine', 1800, t, [[0, 0], [0.002, 0.9], [0.013, 0.0001, 1]]) },
  sonar: { period: 3, play: (L, t) => toneVoice(L, 'sine', 1400, t, [[0, 0], [0.006, 0.9], [0.8, 0.0001, 1]]) },
  alarm: { period: 5, play: (L, t) => [880, 1100, 880].forEach((f, k) =>
    toneVoice(L, 'triangle', f, t + k * 0.22, [[0, 0], [0.01, 0.7], [0.11, 0.7], [0.13, 0]])) },
};

// Brown noise that loops without a seam (the end is cross-faded into the start), peak 0.9.
function toneNoise(G) {
  if (G.noise) return G.noise;
  const c = G.ctx, rate = c.sampleRate || 44100, n = Math.floor(rate * 6), x = Math.floor(rate * 0.5);
  const raw = new Float32Array(n + x), out = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < raw.length; i++) { y = y * 0.996 + (Math.random() * 2 - 1) * 0.1; raw[i] = y; }
  let peak = 1e-6;
  for (let i = 0; i < n; i++) {
    const w = i < x ? (i / x) * Math.PI / 2 : Math.PI / 2;
    out[i] = i < x ? raw[i] * Math.sin(w) + raw[n + i] * Math.cos(w) : raw[i];
    peak = Math.max(peak, Math.abs(out[i]));
  }
  for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
  const buf = c.createBuffer(1, n, rate);
  buf.getChannelData(0).set(out);
  return (G.noise = buf);
}
// Cabin: low-passed noise with a slow swell, plus two slightly detuned low sines. Levels add up to 0.8 at most.
function toneCabin(L, t) {
  const c = L.G.ctx;
  const src = c.createBufferSource(), lp = c.createBiquadFilter(), body = c.createGain(), swell = c.createGain();
  src.buffer = toneNoise(L.G); src.loop = true;
  lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.5;
  body.gain.value = 0.6; swell.gain.value = 0.85;
  const lfo = c.createOscillator(), depth = c.createGain();
  lfo.frequency.value = 0.1; depth.gain.value = 0.15; // swell between 0.7 and 1.0, once every 10 s
  lfo.connect(depth); depth.connect(swell.gain);
  src.connect(lp); lp.connect(body); body.connect(swell); swell.connect(L.bus);
  const hums = [110, 112.5].map(f => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f; g.gain.value = 0.1; o.connect(g); g.connect(L.bus);
    return [o, g];
  });
  L.nodes = [src, lp, body, swell, lfo, depth, ...hums.flat()];
  L.sources = [src, lfo, ...hums.map(x => x[0])];
  L.sources.forEach(s => s.start(t));
}

// Moves a parameter to a value over a fade, starting from wherever it is now (so stopping mid-fade does not jump).
function toneRamp(p, to, dur, t) {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); }
  p.linearRampToValueAtTime(to, t + dur);
}
function toneGraph(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0;
  let out = ctx.destination;
  try {
    const lim = ctx.createDynamicsCompressor();
    // Threshold 0 dB keeps it transparent (the compressor adds make-up gain below that); it only catches overs.
    lim.threshold.value = 0; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.1;
    lim.connect(ctx.destination); out = lim;
  } catch (e) {}
  master.connect(out);
  return { ctx, master, level: 0, noise: null };
}
function toneSetLevel(G, level, dur) {
  if (G.level === level) return;
  G.level = level;
  toneRamp(G.master.gain, level, dur, G.ctx.currentTime);
}
// A loop is one running soundscape: its own fading bus into the master, its voices and its beat position.
function toneBegin(G, want, t) {
  const bus = G.ctx.createGain();
  bus.gain.setValueAtTime(0, t);
  bus.gain.linearRampToValueAtTime(1, t + TONE_FADE);
  bus.connect(G.master);
  const L = { G, key: want.key, choice: want.choice, bus, voices: [], nodes: [], sources: [], timer: 0,
    next: t + TONE_FADE, until: want.preview ? t + TONE_PREVIEW_MS / 1000 : Infinity };
  if (want.choice === 'cabin') toneCabin(L, t);
  return L;
}
// Schedules every beat that starts before the horizon. After a stall it skips the missed beats and keeps the phase.
function toneSchedule(L, horizon, now) {
  const b = TONE_BEATS[L.choice];
  if (!b) return;
  if (L.next < now - 0.03) L.next += Math.ceil((now - L.next) / b.period) * b.period;
  while (L.next < horizon && L.next < L.until - TONE_FADE) { b.play(L, L.next); L.next += b.period; }
}
function tonePump(L) {
  try {
    const now = L.G.ctx.currentTime;
    toneSchedule(L, now + TONE_AHEAD, now);
    L.voices = L.voices.filter(v => {
      if (v.end >= now - 0.2) return true;
      try { v.osc.disconnect(); v.g.disconnect(); } catch (e) {}
      return false;
    });
  } catch (e) {}
}
// Fades the loop out and drops everything it scheduled. Beats that have not started yet are cancelled.
function toneEnd(L, t, live) {
  clearInterval(L.timer); L.timer = 0;
  try { toneRamp(L.bus.gain, 0, TONE_FADE, t); } catch (e) {}
  const stopAt = t + TONE_FADE + 0.02;
  L.voices.forEach(v => {
    try { if (v.start > t) { v.osc.stop(t); v.g.disconnect(); } else if (v.end > stopAt) v.osc.stop(stopAt); } catch (e) {}
  });
  L.sources.forEach(s => { try { s.stop(stopAt); } catch (e) {} });
  if (!live) return;
  setTimeout(() => {
    [...L.voices.flatMap(v => [v.osc, v.g]), ...L.nodes, L.bus].forEach(n => { try { n.disconnect(); } catch (e) {} });
    // Nothing is playing any more: let the device sleep the audio hardware.
    try { if (!toneLoop && toneG && toneG.ctx.suspend) { const p = toneG.ctx.suspend(); if (p && p.catch) p.catch(() => {}); } } catch (e) {}
  }, (TONE_FADE + 0.15) * 1000);
}

// What is wanted right now: a preview first, else the run's soundscape unless muted. Nothing while the page is hidden.
let toneG = null, toneLoop = null, toneRun = null, toneMuted = false, tonePrev = null, tonePrevTimer = 0, tonePrevId = 0;
function toneWant() {
  if (document.hidden) return null;
  if (tonePrev) return tonePrev.choice === 'tick' ? null : { key: 'p' + tonePrev.id, preview: true, ...tonePrev };
  if (toneRun && !toneMuted) return { key: 'r' + toneRun.choice + toneRun.volume, ...toneRun };
  return null;
}
function toneLive() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (toneG && toneG.ctx.state === 'closed') toneG = null;
    if (!toneG) toneG = toneGraph(new AC());
    const c = toneG.ctx;
    if (c.state !== 'running' && c.resume) { const p = c.resume(); if (p && p.catch) p.catch(() => {}); }
    return toneG;
  } catch (e) { toneG = null; return null; }
}
// Makes what is playing match what is wanted. Calling it again with nothing changed does nothing, so starts are idempotent.
function toneSync() {
  try {
    const want = toneWant();
    if (toneLoop && want && toneLoop.key === want.key) return;
    if (toneLoop) { const old = toneLoop; toneLoop = null; toneEnd(old, old.G.ctx.currentTime, true); }
    if (!want) { if (toneG) toneSetLevel(toneG, 0, TONE_FADE); return; }
    const G = toneLive();
    if (!G) return;
    toneSetLevel(G, TONE_CAPS[want.volume], TONE_FADE);
    const L = toneBegin(G, want, G.ctx.currentTime);
    toneLoop = L;
    if (TONE_BEATS[L.choice]) { L.timer = setInterval(() => tonePump(L), TONE_EVERY); tonePump(L); }
  } catch (e) {}
}
const toneChoiceOf = tone => (tone && TONE_CHOICES.includes(tone.choice) ? tone.choice : 'tick');
const toneVolumeOf = tone => (tone && TONE_VOLUMES.includes(tone.volume) ? tone.volume : 'medium');
function toneSavedVolume() {
  try { return toneVolumeOf(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').tone); } catch (e) { return 'medium'; }
}
function toneTickNow(volume) {
  const G = toneLive();
  if (!G) return;
  const c = G.ctx, cap = TONE_CAPS[volume];
  let t = c.currentTime;
  if (G.level !== cap) { toneSetLevel(G, cap, 0.02); t += 0.02; } // the master reaches the cap before the tick begins
  const osc = c.createOscillator(), gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.connect(gain); gain.connect(G.master);
  osc.start(t); osc.stop(t + 0.15);
  osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} };
}
function playTick() { try { toneTickNow(toneSavedVolume()); } catch (e) {} } // editor preview when the toggle is switched on
function speak(text) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch (e) {}
}
function toneStart(tone) {                     // a run starts (called inside the user's tap)
  try {
    toneMuted = false;
    const choice = toneChoiceOf(tone);
    toneRun = choice === 'tick' ? null : { choice, volume: toneVolumeOf(tone) };
    toneSync();
  } catch (e) {}
}
function toneStop() {                          // a run ends or the screen is left; safe to call any time, any number of times
  try {
    toneRun = null; toneMuted = false; tonePrev = null;
    clearTimeout(tonePrevTimer);
    toneSync();
  } catch (e) {}
}
function toneTick(tone) {                      // an item was ticked
  try { if (toneChoiceOf(tone) === 'tick') toneTickNow(toneVolumeOf(tone)); } catch (e) {} // the other choices are the cue themselves
}
function toneMute(on) {
  try { if (toneRun) { toneMuted = !!on; toneSync(); } } catch (e) {}
}
function tonePreview(choice, volume) {         // Settings: about 3 s of a sound; a new call replaces the one before
  try {
    const c = TONE_CHOICES.includes(choice) ? choice : 'tick', v = TONE_VOLUMES.includes(volume) ? volume : 'medium';
    clearTimeout(tonePrevTimer);
    const id = ++tonePrevId;
    tonePrev = { id, choice: c, volume: v };
    tonePrevTimer = setTimeout(() => { if (tonePrev && tonePrev.id === id) { tonePrev = null; toneSync(); } }, TONE_PREVIEW_MS);
    toneSync();
    if (c === 'tick') toneTickNow(v);
  } catch (e) {}
}
function tonePreviewStop() {
  try { tonePrev = null; clearTimeout(tonePrevTimer); toneSync(); } catch (e) {}
}
// Renders one sound into any context with the app's own graph (the tests pass an OfflineAudioContext).
function toneRender(ctx, choice, volume, seconds) {
  const G = toneGraph(ctx);
  toneSetLevel(G, TONE_CAPS[volume], TONE_FADE);
  const L = toneBegin(G, { key: 'render', choice, volume }, 0);
  toneSchedule(L, seconds - TONE_FADE, 0);
  toneEnd(L, seconds - TONE_FADE - 0.02, false);
  toneSetLevel(G, 0, TONE_FADE);
  return G;
}
try { document.addEventListener('visibilitychange', () => { if (document.hidden) { tonePrev = null; clearTimeout(tonePrevTimer); } toneSync(); }); } catch (e) {}

const TONE_INFO = {
  tick: ['Tick', 'One short tick for each item'],
  heart: ['Heart monitor', 'Steady beep, 72 a minute'],
  cabin: ['Cabin hum', 'Low engine drone, no beeps'],
  sonar: ['Sonar', 'A ping every 3 seconds'],
  metronome: ['Metronome', 'A click every second'],
  alarm: ['Alarm', 'Three beeps, then a pause'],
};
// Run bar: a Sound off / Sound on button for the soundscapes. It keeps its own state; every run starts unmuted.
function ToneControls({ sound, tone }) {
  const [muted, setMuted] = useState(false);
  if (!sound || !tone || tone.choice === 'tick') return null;
  return h('button', {
    id: 'mute', className: 'muted', 'aria-pressed': muted ? 'true' : 'false',
    onClick: () => { const next = !muted; setMuted(next); toneMute(next); },
  }, muted ? 'Sound on' : 'Sound off');
}
// Settings > Attention tone: pick the sound and the volume; every change plays a 3 s preview.
function ToneSettings({ settings, onChange, onBack }) {
  const { choice, volume } = settings.tone;
  const picked = useRef(null);
  useEffect(() => () => tonePreviewStop(), []); // leaving the screen ends the preview
  useEffect(() => { try { if (picked.current && picked.current.scrollIntoView) picked.current.scrollIntoView({ block: 'nearest' }); } catch (e) {} }, []);
  const pick = c => { onChange({ tone: { choice: c } }); tonePreview(c, volume); };
  const nextVolume = TONE_VOLUMES[(TONE_VOLUMES.indexOf(volume) + 1) % TONE_VOLUMES.length];
  return h('div', { className: 'screen settings' },
    h('div', { className: 'settings-scroll' },
      h('div', { className: 'settings-in' },
        h('h1', null, 'Attention tone'),
        h('p', { className: 'tone-note' },
          'Plays only for checklists that have Attention tone switched on. These sounds are meant to keep a little pressure on, ' +
          'so keep the volume low. A run has a Sound off button.'),
        h('div', { className: 'sec' }, 'Sound'),
        h('div', { className: 'choices', role: 'radiogroup', 'aria-label': 'Attention tone' },
          TONE_CHOICES.map(c => h('button', {
            key: c, id: 'tone-' + c, role: 'radio', 'aria-checked': choice === c ? 'true' : 'false',
            ref: choice === c ? picked : null, className: 'choice' + (choice === c ? ' selected' : ''), onClick: () => pick(c),
          },
            h('span', { className: 'label' }, h('span', null, TONE_INFO[c][0]), h('span', { className: 'detail' }, TONE_INFO[c][1])),
            h('span', { className: 'mark', 'data-done': choice === c ? '1' : '0', 'aria-hidden': 'true' }, choice === c ? '●' : '○')))),
        h('div', { className: 'sec' }, 'Volume'),
        h('div', { className: 'rows' },
          h('button', { id: 'tone-volume', className: 'srow', onClick: () => { onChange({ tone: { volume: nextVolume } }); tonePreview(choice, nextVolume); } },
            h('span', { className: 'name' }, 'Volume'), h('span', { className: 'value' }, cap(volume)))))),
    h('div', { className: 'actions' },
      h('button', { id: 'tone-preview', className: 'muted', onClick: () => tonePreview(choice, volume) }, 'Preview'),
      h('button', { id: 'tone-back', onClick: () => { tonePreviewStop(); onBack(); } }, 'Back')));
}
/* @@SOUND-ENGINE-END */
