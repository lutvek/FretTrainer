// Ritar en del av greppbrädan som SVG och rapporterar tryck som (sträng, band).

const INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const NS = 'http://www.w3.org/2000/svg';

export class Fretboard {
  /**
   * @param {HTMLElement} container
   * @param {object} opts fretStart, fretEnd, activeStrings samt återanrop:
   *   play(pos, {slide, prev}) – spela/visa tonen, returnerar rösten (skickas tillbaka som prev vid slide)
   *   canJudge() – tar övningen emot svar just nu?
   *   isHit(pos) – är detta en rätt ton?
   *   judge(pos) – bedöm tonen
   */
  constructor(container, { fretStart, fretEnd, activeStrings = [0, 1, 2, 3, 4, 5], ...handlers }) {
    this.container = container;
    this.fretStart = fretStart;
    this.fretEnd = fretEnd;
    this.activeStrings = activeStrings;
    this.h = handlers;
    this.markers = new Map();
    this.timers = new Map();

    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('fretboard');
    container.replaceChildren(this.svg);

    // Varje finger följs för sig: tryck spelar tonen, och dras fingret till en ny
    // ruta spelas den tonen också ("slide"). Bedömningen sker direkt om första tonen
    // är rätt, annars på tonen där fingret lyfts.
    this.pointers = new Map();
    const down = (e) => {
      e.preventDefault();
      const pos = this.hitTest(e.clientX, e.clientY);
      const st = { pos, pending: false, voice: null };
      this.pointers.set(e.pointerId, st);
      try { this.svg.setPointerCapture(e.pointerId); } catch { /* ok */ }
      const judgeNow = this.h.canJudge() && this.h.isHit(pos);
      st.pending = !judgeNow && this.h.canJudge();
      st.voice = this.h.play(pos, { slide: false, prev: null });
      if (judgeNow) this.h.judge(pos);
    };
    const move = (e) => {
      const st = this.pointers.get(e.pointerId);
      if (!st) return;
      const pos = this.hitTest(e.clientX, e.clientY, st.pos.string);
      if (pos.string === st.pos.string && pos.fret === st.pos.fret) return;
      st.pos = pos;
      st.voice = this.h.play(pos, { slide: true, prev: st.voice });
    };
    const up = (e) => {
      const st = this.pointers.get(e.pointerId);
      if (!st) return;
      this.pointers.delete(e.pointerId);
      if (st.pending && this.h.canJudge()) this.h.judge(st.pos);
    };
    this.svg.addEventListener('pointerdown', down);
    this.svg.addEventListener('pointermove', move);
    this.svg.addEventListener('pointerup', up);
    this.svg.addEventListener('pointercancel', up);
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(container);
    this.render();
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.timers.forEach(clearTimeout);
    this.svg.remove();
  }

  layout() {
    const W = this.container.clientWidth || 360;
    const H = this.container.clientHeight || 240;
    const padL = 4;
    const padR = 6;
    const padT = 6;
    const padB = 22;
    const hasOpen = this.fretStart === 0;
    const frets = this.fretEnd - this.fretStart + 1;
    // Öppen sträng får en egen, lite smalare kolumn till vänster om sadeln.
    const units = hasOpen ? frets - 1 + 0.8 : frets;
    const unit = (W - padL - padR) / units;
    const colX = (fret) => {
      const i = fret - this.fretStart;
      if (!hasOpen) return padL + i * unit;
      return i === 0 ? padL : padL + (i - 1 + 0.8) * unit;
    };
    const colW = (fret) => (hasOpen && fret === 0 ? 0.8 * unit : unit);
    const rowH = (H - padT - padB) / 6;
    const stringY = (s) => padT + (s + 0.5) * rowH;
    return { W, H, padL, padR, padT, padB, hasOpen, unit, colX, colW, rowH, stringY };
  }

  hitTest(clientX, clientY, stickString = null) {
    const r = this.svg.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    const L = this.L;
    let fret = null;
    for (let f = this.fretStart; f <= this.fretEnd; f++) {
      if (x >= L.colX(f) && x < L.colX(f) + L.colW(f)) fret = f;
    }
    if (fret === null) fret = x < L.padL ? this.fretStart : this.fretEnd;
    // Snäpp till närmaste aktiva sträng – ger stora tryckytor när få strängar används.
    let string = this.activeStrings[0];
    for (const s of this.activeStrings) {
      if (Math.abs(L.stringY(s) - y) < Math.abs(L.stringY(string) - y)) string = s;
    }
    // Under en slide: stanna på samma sträng tills fingret tydligt lämnat den.
    if (stickString !== null && Math.abs(L.stringY(stickString) - y) < L.rowH * 0.75) string = stickString;
    return { string, fret };
  }

  render() {
    const L = (this.L = this.layout());
    const { W, H, padT, padB } = L;
    const boardTop = padT;
    const boardH = H - padT - padB;
    const x0 = L.hasOpen ? L.colX(1) : L.colX(this.fretStart);
    const x1 = L.colX(this.fretEnd) + L.colW(this.fretEnd);
    let s = '';

    s += `<rect class="fb-wood" x="${x0}" y="${boardTop}" width="${x1 - x0}" height="${boardH}" rx="4"/>`;

    for (let f = Math.max(1, this.fretStart); f <= this.fretEnd; f++) {
      const cx = L.colX(f) + L.colW(f) / 2;
      const r = Math.min(L.unit, L.rowH) * 0.16;
      if (INLAYS.has(f)) {
        s += `<circle class="fb-inlay" cx="${cx}" cy="${boardTop + boardH / 2}" r="${r}"/>`;
      } else if (f % 12 === 0) {
        s += `<circle class="fb-inlay" cx="${cx}" cy="${boardTop + L.rowH * 2}" r="${r}"/>`;
        s += `<circle class="fb-inlay" cx="${cx}" cy="${boardTop + L.rowH * 4}" r="${r}"/>`;
      }
      const xr = L.colX(f) + L.colW(f);
      s += `<line class="fb-fret" x1="${xr}" y1="${boardTop}" x2="${xr}" y2="${boardTop + boardH}"/>`;
      const marked = INLAYS.has(f) || f % 12 === 0;
      s += `<text class="fb-num${marked ? ' marked' : ''}" x="${cx}" y="${H - 6}">${f}</text>`;
    }
    if (L.hasOpen) {
      s += `<rect class="fb-nut" x="${x0 - 5}" y="${boardTop}" width="6" height="${boardH}" rx="2"/>`;
      s += `<text class="fb-num" x="${L.colX(0) + L.colW(0) / 2}" y="${H - 6}">0</text>`;
    } else {
      s += `<line class="fb-fret" x1="${x0}" y1="${boardTop}" x2="${x0}" y2="${boardTop + boardH}"/>`;
    }

    for (let i = 0; i < 6; i++) {
      const y = L.stringY(i);
      const active = this.activeStrings.includes(i);
      s += `<line class="fb-string${active ? '' : ' inactive'}" x1="${L.padL}" y1="${y}" x2="${x1}" y2="${y}" stroke-width="${1.2 + i * 0.5}"/>`;
    }
    s += '<g class="fb-markers"></g>';

    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.svg.setAttribute('width', W);
    this.svg.setAttribute('height', H);
    this.svg.innerHTML = s;
    this.renderMarkers();
  }

  renderMarkers() {
    const g = this.svg.querySelector('.fb-markers');
    if (!g) return;
    const L = this.L;
    const r = Math.max(10, Math.min(L.unit * 0.46, L.rowH * 0.44, 22));
    let s = '';
    for (const m of this.markers.values()) {
      const cx = L.colX(m.fret) + L.colW(m.fret) / 2;
      const cy = L.stringY(m.string);
      const fs = m.label.length > 1 ? r * 0.95 : r * 1.1;
      s += `<g class="fb-marker ${m.kind}"><circle cx="${cx}" cy="${cy}" r="${r}"/>`;
      s += `<text x="${cx}" y="${cy}" font-size="${fs}">${m.label}</text></g>`;
    }
    g.innerHTML = s;
  }

  /**
   * Visa en markör. kind: good | near | bad | hint | anchor | neutral.
   * ttl (ms) gör att markören försvinner av sig själv.
   */
  setMarker(key, { string, fret, label, kind, ttl }) {
    clearTimeout(this.timers.get(key));
    this.markers.set(key, { string, fret, label, kind });
    if (ttl) this.timers.set(key, setTimeout(() => this.removeMarker(key), ttl));
    this.renderMarkers();
  }

  removeMarker(key) {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
    if (this.markers.delete(key)) this.renderMarkers();
  }

  clearMarkers() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.markers.clear();
    this.renderMarkers();
  }
}
