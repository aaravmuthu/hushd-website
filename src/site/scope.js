// A page's lifetime. Pages swap in place now (the nav stays put), so everything a page starts must stop when it
// leaves: listeners on window and document, intervals, observers, animation loops and timers.
//
// Page scripts get a scope's `api` and shadow the globals with it, so their code reads as before:
//   export function mount(s) { const { setTimeout, setInterval, requestAnimationFrame, addEventListener } = s.api; … }

let current = null;
export const scope = () => current;

export class Scope {
  constructor() {
    this.alive = true;
    this.ctl = new AbortController();
    this.cleanups = [];
    const s = this;
    this.api = {
      // Timers and frames registered by a page that has left never run.
      setTimeout: (fn, ms, ...args) => window.setTimeout(() => { if (s.alive) fn(...args); }, ms),
      requestAnimationFrame: (fn) => (s.alive ? window.requestAnimationFrame(fn) : 0),
      setInterval: (fn, ms) => { const id = window.setInterval(fn, ms); s.add(() => clearInterval(id)); return id; },
      // Listeners on window (the bare `addEventListener` in page code) come off when the page leaves.
      addEventListener: (type, fn, opts) => s.on(window, type, fn, opts),
    };
  }
  get signal() { return this.ctl.signal; }
  on(target, type, fn, opts) {
    const o = typeof opts === "object" && opts ? { ...opts } : { capture: !!opts };
    target.addEventListener(type, fn, { ...o, signal: this.signal });
  }
  add(fn) { if (this.alive) this.cleanups.push(fn); else fn(); }
  track(observer) { this.add(() => observer.disconnect()); return observer; }
  enter() { current = this; return this; }
  dispose() {
    if (!this.alive) return;
    this.alive = false;
    this.ctl.abort();
    for (const fn of this.cleanups.splice(0)) { try { fn(); } catch {} }
    if (current === this) current = null;
  }
}
