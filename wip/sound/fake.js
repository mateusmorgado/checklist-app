// Recording fake AudioContext (injected with addInitScript). window.__au holds everything the app asked for.
(() => {
  const au = window.__au = { ctxs: [], starts: [], nodes: [], intervals: { set: 0, cleared: 0, live: new Set() }, opts: window.__auOpts || {} };
  const t0 = performance.now();
  const wall = () => (performance.now() - t0) / 1000;
  class Param {
    constructor(node, v) { this.node = node; this.base = v; this.ev = []; this.cah = !!au.opts.hold; }
    valueAt(t) {
      let v = this.base, pt = -1e9, pv = this.base;
      const ev = this.ev.slice().sort((a, b) => a.t - b.t);
      for (const e of ev) {
        if (e.t > t) {
          if (e.type === 'lin') { const f = (t - Math.max(pt, -1e8)) / (e.t - pt); return pv + (e.v - pv) * Math.min(1, Math.max(0, f)); }
          if (e.type === 'exp') { const f = (t - pt) / (e.t - pt); return pv * Math.pow(e.v / pv, Math.min(1, Math.max(0, f))); }
          break;
        }
        pt = e.t; pv = e.v;
      }
      return pv;
    }
    get value() { return this.valueAt(this.node.ctx.currentTime); }
    set value(v) { this.base = v; this.ev = this.ev.filter(e => e.t > this.node.ctx.currentTime); this.ev.unshift({ type: 'set', t: -1e9, v }); }
    setValueAtTime(v, t) { this.ev.push({ type: 'set', t, v }); return this; }
    linearRampToValueAtTime(v, t) { this.ev.push({ type: 'lin', t, v }); return this; }
    exponentialRampToValueAtTime(v, t) { this.ev.push({ type: 'exp', t, v }); return this; }
    cancelScheduledValues(t) { this.ev = this.ev.filter(e => e.t < t); return this; }
    peak() { let p = 0; if (!this.ev.length) p = Math.abs(this.base); for (const e of this.ev) p = Math.max(p, Math.abs(e.v)); for (const n of au.nodes) if (n.paramOut.includes(this)) p += n.gain.peak(); return p; }
  }
  class Node {
    constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.out = []; this.paramOut = []; this.disc = false; au.nodes.push(this); }
    connect(t) { if (t instanceof Param) this.paramOut.push(t); else this.out.push(t); return t; }
    disconnect() { this.out = []; this.paramOut = []; this.disc = true; }
  }
  class Src extends Node {
    constructor(ctx, kind) { super(ctx, kind); this.frequency = new Param(this, 440); this.type = 'sine'; this.stops = []; this.started = null; }
    start(t) { this.started = t === undefined ? this.ctx.currentTime : t; au.starts.push({ node: this, kind: this.kind, t: this.started, wall: wall(), freq: this.frequency.valueAt(this.started), type: this.type }); }
    stop(t) { this.stops.push({ t, wall: wall() }); }
  }
  class Ctx {
    constructor() {
      if (au.opts.throwCtor) throw new Error('no audio');
      au.ctxs.push(this); this.state = 'suspended'; this.sampleRate = 44100; this._acc = 0; this._since = null;
      this.destination = new Node(this, 'destination');
      if (au.opts.autoRun) this._run();
    }
    _run() { if (this._since === null) this._since = wall(); this.state = 'running'; }
    get currentTime() { return this._acc + (this._since === null ? 0 : wall() - this._since); }
    resume() { if (au.opts.resumeThrows) throw new Error('nope'); au.resumeCalls = (au.resumeCalls || 0) + 1; this._run(); return Promise.resolve(); }
    suspend() { au.suspendCalls = (au.suspendCalls || 0) + 1; if (this._since !== null) { this._acc += wall() - this._since; this._since = null; } this.state = 'suspended'; return Promise.resolve(); }
    createGain() { const n = new Node(this, 'gain'); n.gain = new Param(n, 1); return n; }
    createOscillator() { if (au.opts.throwOsc) throw new Error('osc'); return new Src(this, 'osc'); }
    createBufferSource() { const n = new Src(this, 'buf'); return n; }
    createBiquadFilter() { const n = new Node(this, 'biquad'); n.frequency = new Param(n, 350); n.Q = new Param(n, 1); return n; }
    createDynamicsCompressor() {
      if (au.opts.noCompressor) throw new Error('nc');
      const n = new Node(this, 'comp'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(n, 0); return n;
    }
    createBuffer(ch, len, rate) { const d = new Float32Array(len); return { length: len, sampleRate: rate, getChannelData: () => d }; }
  }
  if (au.opts.hold) Param.prototype.cancelAndHoldAtTime = function (t) { const v = this.valueAt(t); this.ev = this.ev.filter(e => e.t < t); this.ev.push({ type: 'set', t, v }); return this; };
  if (!au.opts.noAC) { window.AudioContext = Ctx; window.webkitAudioContext = undefined; } else { window.AudioContext = undefined; window.webkitAudioContext = undefined; }
  // timers: count setInterval use so tests can see that stop clears them
  const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  window.setInterval = (f, ms, ...a) => { const id = si(f, ms, ...a); au.intervals.set++; au.intervals.live.add(id); return id; };
  window.clearInterval = id => { if (au.intervals.live.delete(id)) au.intervals.cleared++; return ci(id); };
  // analysis helpers (run in the page)
  au.paths = () => {
    const res = [];
    for (const s of au.nodes.filter(n => n instanceof Src && n.started !== null)) {
      const walk = (n, prod, seen) => {
        if (n.kind === 'destination') { res.push({ src: s, prod }); return; }
        if (seen.has(n)) return; seen.add(n);
        const g = n.kind === 'gain' ? n.gain.peak() : 1;
        n.out.forEach(m => walk(m, prod * g, new Set(seen)));
      };
      walk(s, 1, new Set());
    }
    return res;
  };
  au.beats = (pred) => au.starts.filter(pred).map(s => s.t);
  au.master = () => { const g = au.nodes.filter(n => n.kind === 'gain' && n.out.some(o => o.kind === 'comp' || o.kind === 'destination')); return g; };
  au.masterNode = () => au.master()[0];
})();
