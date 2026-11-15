// Ritar en del av greppbrädan som SVG och rapporterar tryck som (sträng, band).

const INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const NS = 'http://www.w3.org/2000/svg';
const MAX_FRET = 22;
const STUB = 0.55; // bredd (i band) på de tonade "fortsättningarna" utanför fönstret
let uid = 0;

/**
 * Liten översiktsbild av hela halsen (band 0–15) där fönstret fretStart–fretEnd är markerat,
 * så att man ser var på halsen man befinner sig.
 */
export function neckMap(fretStart, fretEnd, last = Math.max(15, fretEnd + 2)) {
  const w = 132;
  const h = 18;
  const x = (f) => 3 + (f / (last + 1)) * (w - 4);
  let s = `<svg class="neck-map" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`;
  s += `<rect class="nm-wood" x="${x(1)}" y="2" width="${x(last + 1) - x(1)}" height="${h - 4}" rx="2"/>`;
  s += `<rect class="nm-win" x="${x(fretStart)}" y="0.75" width="${x(fretEnd + 1) - x(fretStart)}" height="${h - 1.5}" rx="3"/>`;
  for (let f = 1; f <= last; f++) {
    s += `<line class="nm-fret" x1="${x(f + 1)}" y1="2" x2="${x(f + 1)}" y2="${h - 2}"/>`;
    const cx = (x(f) + x(f + 1)) / 2;
    if (INLAYS.has(f)) s += `<circle class="nm-dot" cx="${cx}" cy="${h / 2}" r="1.4"/>`;
    if (f % 12 === 0) {
      s += `<circle class="nm-dot" cx="${cx}" cy="${h / 2 - 3.5}" r="1.4"/>`;
      s += `<circle class="nm-dot" cx="${cx}" cy="${h / 2 + 3.5}" r="1.4"/>`;
    }
  }
  s += `<rect class="nm-nut" x="${x(1) - 1.5}" y="2" width="3" height="${h - 4}"/>`;
  return s + '</svg>';
}

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
    this.uid = ++uid;
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
    const padL = this.fretStart === 1 ? 2 : 4;
    const padR = 6;
    const padT = 6;
    const padB = 22;
    const hasOpen = this.fretStart === 0;
    const frets = this.fretEnd - this.fretStart + 1;
    // Ett fönster mitt på halsen får tonade stumpar av banden utanför, så att det
    // syns att brädan fortsätter åt båda håll (och vänsterkanten inte ser ut som sadeln).
    // Börjar fönstret på band 1 är vänsterkanten den riktiga sadeln – då ingen stump.
    const startsAtNut = this.fretStart === 1;
    const stubL = hasOpen || startsAtNut ? 0 : STUB;
    const stubR = this.fretEnd < MAX_FRET ? STUB : 0;
    // Öppen sträng får en egen, lite smalare kolumn till vänster om sadeln.
    const units = (hasOpen ? frets - 1 + 0.8 : frets) + stubL + stubR;
    const unit = (W - padL - padR) / units;
    const colX = (fret) => {
      const i = fret - this.fretStart;
      if (!hasOpen) return padL + (stubL + i) * unit;
      return i === 0 ? padL : padL + (i - 1 + 0.8) * unit;
    };
    const colW = (fret) => (hasOpen && fret === 0 ? 0.8 * unit : unit);
    const rowH = (H - padT - padB) / 6;
    const stringY = (s) => padT + (s + 0.5) * rowH;
    return { W, H, padL, padR, padT, padB, hasOpen, startsAtNut, stubL, stubR, unit, colX, colW, rowH, stringY };
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
    if (fret === null) fret = x < L.colX(this.fretStart) ? this.fretStart : this.fretEnd;
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
    const sx0 = x0 - L.stubL * L.unit; // yttre kanter inklusive tonade stumpar
    const sx1 = x1 + L.stubR * L.unit;
    const numY = H - 6;
    const r = Math.min(L.unit, L.rowH) * 0.16;
    const inlay = (f, cx) => {
      let d = '';
      if (INLAYS.has(f)) d += `<circle class="fb-inlay" cx="${cx}" cy="${boardTop + boardH / 2}" r="${r}"/>`;
      else if (f % 12 === 0) {
        d += `<circle class="fb-inlay" cx="${cx}" cy="${boardTop + L.rowH * 2}" r="${r}"/>`;
        d += `<circle class="fb-inlay" cx="${cx}" cy="${boardTop + L.rowH * 4}" r="${r}"/>`;
      }
      return d;
    };
    const mask = `fb-fade-${this.uid}`;
    let s = '';

    // Mask som tonar ut brädan i stumparna utanför fönstret.
    const fadeL = ((x0 - sx0) / (sx1 - sx0)) * 100;
    const fadeR = ((x1 - sx0) / (sx1 - sx0)) * 100;
    s += `<defs><linearGradient id="${mask}-g" x1="${sx0}" x2="${sx1}" y1="0" y2="0" gradientUnits="userSpaceOnUse">`;
    s += `<stop offset="0" stop-color="#fff" stop-opacity="${L.stubL ? 0 : 1}"/>`;
    s += `<stop offset="${fadeL}%" stop-color="#fff" stop-opacity="1"/>`;
    s += `<stop offset="${fadeR}%" stop-color="#fff" stop-opacity="1"/>`;
    s += `<stop offset="1" stop-color="#fff" stop-opacity="${L.stubR ? 0 : 1}"/>`;
    s += `</linearGradient><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">`;
    s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${mask}-g)"/></mask></defs>`;

    s += `<g mask="url(#${mask})">`;
    s += `<rect class="fb-wood" x="${sx0}" y="${boardTop}" width="${sx1 - sx0}" height="${boardH}" rx="${L.stubL && L.stubR ? 0 : 4}"/>`;
    // Stumparnas inlägg (halvt synliga) – samma prickmönster som på en riktig hals.
    if (L.stubL && this.fretStart > 1) s += inlay(this.fretStart - 1, x0 - L.unit / 2);
    if (L.stubR) s += inlay(this.fretEnd + 1, x1 + L.unit / 2);

    for (let f = Math.max(1, this.fretStart); f <= this.fretEnd; f++) {
      const cx = L.colX(f) + L.colW(f) / 2;
      s += inlay(f, cx);
      const xr = L.colX(f) + L.colW(f);
      s += `<line class="fb-fret" x1="${xr}" y1="${boardTop}" x2="${xr}" y2="${boardTop + boardH}"/>`;
    }
    if (L.hasOpen || L.startsAtNut) {
      s += `<rect class="fb-nut" x="${L.hasOpen ? x0 - 5 : x0}" y="${boardTop}" width="6" height="${boardH}" rx="2"/>`;
    } else {
      s += `<line class="fb-fret" x1="${x0}" y1="${boardTop}" x2="${x0}" y2="${boardTop + boardH}"/>`;
    }

    for (let i = 0; i < 6; i++) {
      const y = L.stringY(i);
      const active = this.activeStrings.includes(i);
      const xs = L.hasOpen ? L.padL : sx0;
      s += `<line class="fb-string${active ? '' : ' inactive'}" x1="${xs}" y1="${y}" x2="${sx1}" y2="${y}" stroke-width="${1.2 + i * 0.5}"/>`;
    }
    s += '</g>';

    // Bandnummer; banden utanför fönstret visas svagt.
    for (let f = Math.max(1, this.fretStart); f <= this.fretEnd; f++) {
      const marked = INLAYS.has(f) || f % 12 === 0;
      s += `<text class="fb-num${marked ? ' marked' : ''}" x="${L.colX(f) + L.colW(f) / 2}" y="${numY}">${f}</text>`;
    }
    if (L.hasOpen) s += `<text class="fb-num" x="${L.colX(0) + L.colW(0) / 2}" y="${numY}">0</text>`;
    if (L.stubL) s += `<text class="fb-num outside" x="${x0 - (L.stubL * L.unit) / 2}" y="${numY}">${this.fretStart - 1}</text>`;
    if (L.stubR) s += `<text class="fb-num outside" x="${x1 + (L.stubR * L.unit) / 2}" y="${numY}">${this.fretEnd + 1}</text>`;
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
