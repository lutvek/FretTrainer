// Övning 7: Vilken ton? – en prick tänds på greppbrädan, välj rätt tonnamn innan tiden tar slut.
// Den omvända riktningen mot övriga övningar: från plats till tonnamn. Mäter svarstid.

import { audio, Scheduler } from './audio.js';
import { Fretboard } from './fretboard.js';
import { SHARP, FLAT, STRING_NAMES, midiAt, pc } from './music.js';

const FRET_START = 0;
const FRET_END = 12;
const BPM = 100;
const STEPS_PER_BAR = 8; // åttondelar
const COUNT_IN_STEPS = 8;
const ROUNDS = 16;
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const LANDMARKS = [0, 3, 5, 7, 9, 12];
const KEYS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

const label = (p) => (SHARP[p].length > 1 ? `${SHARP[p]}/${FLAT[p]}` : SHARP[p]);
const fmtSec = (s) => `${s.toFixed(1).replace('.', ',')} s`;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const ex7 = {
  id: 'name-it',
  title: 'Vilken ton?',
  desc: 'En prick tänds på greppbrädan – välj rätt tonnamn innan tiden tar slut. 16 toner i trumkomp. Svarstiden mäts.',
  options: [
    {
      key: 'strings',
      label: 'Strängar',
      default: 'low',
      choices: [
        { value: 'low', label: 'E & A' },
        { value: 'high3', label: 'G, H & e' },
        { value: 'all', label: 'Alla sex' },
      ],
    },
    {
      key: 'frets',
      label: 'Band',
      default: 'all',
      choices: [
        { value: 'marks', label: 'Prickbanden' },
        { value: 'all', label: '0–12' },
      ],
    },
    {
      key: 'notes',
      label: 'Toner',
      default: 'natural',
      choices: [
        { value: 'natural', label: 'Naturliga' },
        { value: 'all', label: 'Alla 12' },
      ],
    },
    {
      key: 'bars',
      label: 'Tid per ton',
      default: '2',
      choices: [
        { value: '2', label: '2 takter' },
        { value: '1', label: '1 takt' },
      ],
    },
  ],

  start(env, opts) {
    const strings = { all: [0, 1, 2, 3, 4, 5], high3: [0, 1, 2] }[opts.strings] || [4, 5];
    const frets = opts.frets === 'marks' ? LANDMARKS : [...Array(FRET_END - FRET_START + 1).keys()];
    const pool = opts.notes === 'all' ? [...Array(12).keys()] : NATURALS;
    const BARS = Number(opts.bars) || 2;
    const stepDur = 60 / BPM / 2;
    const barDur = STEPS_PER_BAR * stepDur;

    const candidates = [];
    for (const string of strings) {
      for (const fret of frets) {
        if (pool.includes(pc(midiAt(string, fret)))) candidates.push({ string, fret });
      }
    }

    const score = { right: 0, wrong: 0, late: 0 };
    const times = []; // svarstider för rätta svar
    const byString = new Map(); // sträng → svarstider (rätta svar)
    let round = 0;
    let q = null; // { string, fret, pc }
    let accepting = false;
    let roundStart = 0;
    let roundEnd = 0;
    let nextStart = 0;
    let finishAt = null;
    let done = false;

    env.hud.innerHTML = `
      <div class="hud-main">
        <div class="hud-label">Vilken ton? · <span id="ex7-round">–</span></div>
        <div class="target-row">
          <div class="target-note" id="ex7-target">…</div>
          <div class="next-note"><b id="ex7-time"></b></div>
        </div>
        <div class="round-progress"><i id="ex7-progress"></i></div>
      </div>
      <div class="hud-side">
        <div class="pill good" title="Rätt">✓ <b id="ex7-right">0</b></div>
        <div class="pill bad" title="Fel">✗ <b id="ex7-wrong">0</b></div>
        <div class="pill near" title="För sent">⏱ <b id="ex7-late">0</b></div>
      </div>`;
    const $ = (id) => env.hud.querySelector(`#ex7-${id}`);
    const updateScore = () => {
      for (const k of Object.keys(score)) $(k).textContent = score[k];
    };

    // Greppbrädan visar bara frågan – tryck på den ger varken ljud eller namn (det vore fusk).
    env.board.classList.add('with-keypad');
    const boardEl = document.createElement('div');
    boardEl.className = 'keypad-board';
    const keypad = document.createElement('div');
    keypad.className = `keypad${pool.length > 7 ? ' chromatic' : ''}`;
    keypad.innerHTML = pool
      .map((p) => {
        const acc = SHARP[p].length > 1;
        const text = acc ? `<span>${SHARP[p]}</span><span>${FLAT[p]}</span>` : SHARP[p];
        return `<button data-pc="${p}" class="${acc ? 'acc' : ''}">${text}</button>`;
      })
      .join('');
    env.board.replaceChildren(boardEl, keypad);

    const board = new Fretboard(boardEl, {
      fretStart: FRET_START,
      fretEnd: FRET_END,
      activeStrings: strings,
      canJudge: () => false,
      isHit: () => false,
      play: () => null,
      judge() {},
    });

    const flash = (p, kind) => {
      const btn = keypad.querySelector(`[data-pc="${p}"]`);
      if (!btn) return;
      btn.classList.remove('good', 'bad');
      void btn.offsetWidth;
      btn.classList.add(kind);
    };

    const pickQuestion = () => {
      const fresh = candidates.filter((c) => !q || pc(midiAt(c.string, c.fret)) !== q.pc);
      const list = fresh.length ? fresh : candidates;
      const c = list[Math.floor(Math.random() * list.length)];
      return { ...c, pc: pc(midiAt(c.string, c.fret)) };
    };

    const startRound = (at) => {
      round++;
      q = pickQuestion();
      keypad.querySelectorAll('button').forEach((b) => b.classList.remove('good', 'bad'));
      board.clearMarkers();
      board.setMarker('q', { string: q.string, fret: q.fret, label: '?', kind: 'start' });
      audio.pluck(midiAt(q.string, q.fret));
      roundStart = at;
      roundEnd = at + BARS * barDur;
      accepting = true;
      keypad.classList.add('live');
      const targetEl = $('target');
      targetEl.textContent = '?';
      targetEl.className = 'target-note pop';
      $('round').textContent = `${round}/${ROUNDS}`;
      $('time').textContent = '';
      env.feedback('Vilken ton är det?', '');
    };

    // Avsluta frågan och lägg nästa på en kommande taktetta.
    const endRound = (kind, elapsed) => {
      accepting = false;
      keypad.classList.remove('live');
      const targetEl = $('target');
      targetEl.textContent = label(q.pc);
      targetEl.className = `target-note answer ${kind}`;
      board.setMarker('q', { string: q.string, fret: q.fret, label: SHARP[q.pc], kind: kind === 'right' ? 'good' : 'hint' });
      if (kind !== 'right') {
        flash(q.pc, 'good');
        audio.pluck(midiAt(q.string, q.fret));
      }
      updateScore();
      // Rätt svar: nästa ton på nästa etta (minst en kvarts takt paus). Fel/för sent: visa svaret minst en halv takt.
      const minGap = kind === 'right' ? barDur / 4 : barDur / 2;
      const bar = Math.ceil((elapsed + minGap) / barDur);
      if (round >= ROUNDS) finishAt = bar * barDur;
      else nextStart = bar * barDur;
    };

    const answer = (p) => {
      if (!accepting || done) return;
      const elapsed = audio.heardNow - startAt;
      if (p === q.pc) {
        const t = Math.max(0, elapsed - roundStart);
        score.right++;
        times.push(t);
        if (!byString.has(q.string)) byString.set(q.string, []);
        byString.get(q.string).push(t);
        flash(p, 'good');
        $('time').textContent = fmtSec(t);
        env.feedback(`Rätt – ${label(q.pc)} på ${fmtSec(t)}.`, 'good');
        endRound('right', elapsed);
      } else {
        score.wrong++;
        flash(p, 'bad');
        env.feedback(`Fel – det var ${label(q.pc)}, inte ${label(p)}.`, 'bad');
        endRound('wrong', elapsed);
      }
    };

    const onKeypad = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.preventDefault();
      answer(Number(btn.dataset.pc));
    };
    keypad.addEventListener('pointerdown', onKeypad);
    // Tangentbord på dator: c d e f g a b (naturliga toner).
    const onKey = (e) => {
      const p = KEYS[e.key.toLowerCase()];
      if (p !== undefined && pool.includes(p) && !e.metaKey && !e.ctrlKey) answer(p);
    };
    document.addEventListener('keydown', onKey);

    // Trumkomp med en takts inräkning.
    const bus = audio.createBus(0.55);
    const t0 = audio.now + 0.12;
    const startAt = t0 + COUNT_IN_STEPS * stepDur;
    const scheduler = new Scheduler(BPM, (i, t) => {
      if (i < COUNT_IN_STEPS) {
        if (i % 2 === 0) audio.click(t, bus);
      } else {
        audio.drumStep((i - COUNT_IN_STEPS) % STEPS_PER_BAR, t, bus);
      }
    });
    scheduler.start(t0);

    env.setTimer(Math.ceil(BARS * barDur));
    env.feedback('Gör dig redo …', '');
    let raf = requestAnimationFrame(function frame() {
      if (done) return;
      const elapsed = audio.heardNow - startAt;
      if (elapsed >= 0) {
        if (finishAt !== null && elapsed >= finishAt) {
          finish();
          return;
        }
        if (!accepting && finishAt === null && elapsed >= nextStart) startRound(nextStart);
        if (accepting && elapsed >= roundEnd) {
          score.late++;
          env.feedback(`För sent – det var ${label(q.pc)}.`, 'near');
          endRound('late', elapsed);
        }
        if (accepting) {
          const frac = Math.min(1, (elapsed - roundStart) / (roundEnd - roundStart));
          $('progress').style.width = `${frac * 100}%`;
          env.setTimer(Math.ceil(roundEnd - elapsed));
        }
      }
      raf = requestAnimationFrame(frame);
    });

    function finish() {
      stop();
      const stats = [
        { label: `Rätt (av ${ROUNDS})`, value: score.right, kind: 'good' },
        { label: 'Fel', value: score.wrong, kind: 'bad' },
        { label: 'För sent', value: score.late, kind: 'near' },
      ];
      if (times.length) {
        stats.push({ label: 'Mediantid, rätta svar', value: fmtSec(median(times)), kind: '' });
      }
      // Långsammaste strängen (median), bara om flera strängar har minst två rätta svar.
      const per = [...byString.entries()].filter(([, ts]) => ts.length >= 2).map(([s, ts]) => [s, median(ts)]);
      let note = `${ROUNDS} toner · ${{ 2: 'E & A', 3: 'G, H & e' }[strings.length] || 'alla strängar'} · ${opts.frets === 'marks' ? 'prickbanden' : 'band 0–12'} · ${pool.length > 7 ? 'alla 12 toner' : 'naturliga toner'} · ${BARS} ${BARS === 1 ? 'takt' : 'takter'} per ton`;
      if (per.length >= 2) {
        per.sort((a, b) => b[1] - a[1]);
        note += ` · långsammast: ${STRING_NAMES[per[0][0]]}-strängen (${fmtSec(per[0][1])})`;
      }
      env.finish({ title: 'Vilken ton?', note, stats });
    }

    function stop() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      scheduler.stop();
      audio.fadeOutBus(bus);
      document.removeEventListener('keydown', onKey);
      board.destroy();
      env.board.classList.remove('with-keypad');
      env.board.replaceChildren();
    }

    return { stop };
  },
};
