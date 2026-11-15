// Övning 4: Hitta alla – tryck alla platser där en ton finns, på alla sex strängar (band 0–12).
// Med "oktavhopp" tänds en starton på E- eller A-strängen, och resten hittas utifrån den.

import { audio, Scheduler } from './audio.js';
import { Fretboard } from './fretboard.js';
import { SHARP, FLAT, midiAt, pc, positionsOf } from './music.js';

const FRET_START = 0;
const FRET_END = 12;
const STRINGS = [0, 1, 2, 3, 4, 5];
const BPM = 100;
const STEPS_PER_BAR = 8; // åttondelar
const COUNT_IN_STEPS = 8;
const ROUNDS = 8;
const NATURALS = [0, 2, 4, 5, 7, 9, 11];

const posKey = (p) => `${p.string}-${p.fret}`;

export const ex4 = {
  id: 'find-all',
  title: 'Hitta alla',
  desc: 'En ton visas – tryck alla platser där den finns, på alla sex strängar (band 0–12), innan takterna tar slut. 8 toner.',
  options: [
    {
      key: 'support',
      label: 'Stöd',
      default: 'anchor',
      choices: [
        { value: 'anchor', label: 'Oktavhopp' },
        { value: 'none', label: 'Utan' },
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
      default: '4',
      choices: [
        { value: '4', label: '4 takter' },
        { value: '3', label: '3 takter' },
        { value: '2', label: '2 takter' },
      ],
    },
  ],

  start(env, opts) {
    const anchorMode = opts.support === 'anchor';
    const pool = opts.notes === 'all' ? [...Array(12).keys()] : NATURALS;
    const BARS = Number(opts.bars) || 4;
    const stepDur = 60 / BPM / 2;
    const barDur = STEPS_PER_BAR * stepDur;

    const score = { hits: 0, missed: 0, wrong: 0, complete: 0 };
    let round = 0; // antal påbörjade toner
    let target = null; // tonklass
    let name = (p) => SHARP[p];
    let anchor = null;
    let todo = []; // platser att hitta i aktuell ton
    let found = new Set();
    let accepting = false;
    let roundStart = 0;
    let roundEnd = 0;
    let nextStart = 0; // när nästa ton börjar (sekunder efter inräkningen)
    let finishAt = null;
    let done = false;

    env.hud.innerHTML = `
      <div class="hud-main">
        <div class="hud-label">Hitta alla · ton <span id="ex4-round">–</span></div>
        <div class="target-row">
          <div class="target-note" id="ex4-target">…</div>
          <div class="next-note">kvar <b id="ex4-left">–</b></div>
        </div>
        <div class="round-progress"><i id="ex4-progress"></i></div>
      </div>
      <div class="hud-side">
        <div class="pill good" title="Hittade">✓ <b id="ex4-hits">0</b></div>
        <div class="pill near" title="Missade">○ <b id="ex4-missed">0</b></div>
        <div class="pill bad" title="Fel">✗ <b id="ex4-wrong">0</b></div>
      </div>`;
    const $ = (id) => env.hud.querySelector(`#ex4-${id}`);
    const updateScore = () => {
      for (const k of ['hits', 'missed', 'wrong']) $(k).textContent = score[k];
      $('left').textContent = accepting ? todo.length - found.size : '–';
    };

    let prevTarget = null;
    const drawNote = () => {
      let p;
      do p = pool[Math.floor(Math.random() * pool.length)];
      while (p === prevTarget);
      prevTarget = p;
      const flats = SHARP[p].length > 1 && Math.random() < 0.5;
      return { pc: p, name: (q) => (flats ? FLAT : SHARP)[q] };
    };

    const board = new Fretboard(env.board, {
      fretStart: FRET_START,
      fretEnd: FRET_END,
      activeStrings: STRINGS,
      canJudge: () => !done && accepting,
      isHit: (pos) => pc(midiAt(pos.string, pos.fret)) === target,
      play(pos, how) {
        if (done) return null;
        const midi = midiAt(pos.string, pos.fret);
        const k = posKey(pos);
        if (!found.has(k) && !(anchor && posKey(anchor) === k)) {
          board.setMarker('free', { ...pos, label: name(pc(midi)), kind: 'neutral', ttl: 400 });
        }
        return audio.fretNote(midi, how);
      },
      judge(tap) {
        const midi = midiAt(tap.string, tap.fret);
        const label = name(pc(midi));
        board.removeMarker('free');
        if (pc(midi) !== target) {
          score.wrong++;
          updateScore();
          board.setMarker('bad', { ...tap, label, kind: 'bad', ttl: 800 });
          env.feedback(`Fel – det där var ${label}.`, 'bad');
          return;
        }
        const k = posKey(tap);
        if (found.has(k) || (anchor && posKey(anchor) === k)) {
          env.feedback('Den har du redan – leta vidare!', '');
          return;
        }
        found.add(k);
        score.hits++;
        board.setMarker(`f${k}`, { ...tap, label, kind: 'good' });
        const left = todo.length - found.size;
        updateScore();
        if (left > 0) {
          env.feedback(`Rätt! ${left} kvar.`, 'good');
        } else {
          env.feedback(`Alla ${label} hittade!`, 'good');
          endRound(true, audio.heardNow - startAt);
        }
      },
    });

    const startRound = (at) => {
      round++;
      const note = drawNote();
      target = note.pc;
      name = note.name;
      const all = positionsOf(target, STRINGS, FRET_START, FRET_END);
      anchor = null;
      if (anchorMode) {
        const low = all.filter((p) => p.string >= 4 && p.fret > 0);
        anchor = low[Math.floor(Math.random() * low.length)];
      }
      todo = anchor ? all.filter((p) => posKey(p) !== posKey(anchor)) : all;
      found = new Set();
      board.clearMarkers();
      if (anchor) {
        board.setMarker('anchor', { ...anchor, label: name(target), kind: 'start' });
        audio.pluck(midiAt(anchor.string, anchor.fret));
      }
      roundStart = at;
      roundEnd = at + BARS * barDur;
      accepting = true;
      const targetEl = $('target');
      targetEl.textContent = name(target);
      targetEl.classList.remove('pop');
      void targetEl.offsetWidth;
      targetEl.classList.add('pop');
      $('round').textContent = `${round}/${ROUNDS}`;
      updateScore();
      env.feedback(
        anchor ? 'Utgå från den orange tonen – hitta oktaverna och resten.' : `Hitta alla ${name(target)}.`,
        '',
      );
    };

    // Avsluta tonen: visa missade platser och starta nästa ton på en taktetta.
    const endRound = (complete, elapsed) => {
      accepting = false;
      board.removeMarker('free');
      board.removeMarker('bad');
      if (complete) {
        score.complete++;
      } else {
        const missed = todo.filter((p) => !found.has(posKey(p)));
        score.missed += missed.length;
        missed.forEach((p) => board.setMarker(`m${posKey(p)}`, { ...p, label: name(target), kind: 'hint' }));
        env.feedback(`Tiden är ute – ${missed.length} missade (streckade).`, 'near');
      }
      updateScore();
      // Missar visas minst en takt; en komplett ton går vidare på nästa etta (minst en halv takt paus).
      let bar = Math.floor(elapsed / barDur) + (complete ? 1 : 2);
      if (bar * barDur - elapsed < barDur / 2) bar++;
      if (round >= ROUNDS) finishAt = bar * barDur;
      else nextStart = bar * barDur;
    };

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
        if (accepting && elapsed >= roundEnd) endRound(false, elapsed);
        if (accepting) {
          const frac = Math.min(1, (elapsed - roundStart) / (roundEnd - roundStart));
          $('progress').style.width = `${frac * 100}%`;
          env.setTimer(Math.ceil(roundEnd - elapsed));
        }
      }
      raf = requestAnimationFrame(frame);
    });

    function finish() {
      const total = score.hits + score.missed;
      stop();
      env.finish({
        title: 'Hitta alla',
        note: `${ROUNDS} toner · ${anchorMode ? 'oktavhopp' : 'utan stöd'} · ${BARS} takter per ton`,
        stats: [
          { label: `Hittade platser (av ${total})`, value: score.hits, kind: 'good' },
          { label: `Kompletta toner (av ${ROUNDS})`, value: score.complete, kind: 'good' },
          { label: 'Missade platser', value: score.missed, kind: 'near' },
          { label: 'Fel', value: score.wrong, kind: 'bad' },
        ],
      });
    }

    function stop() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      scheduler.stop();
      audio.fadeOutBus(bus);
      board.destroy();
    }

    return { stop };
  },
};
