// Grundtonsövningar: hitta tonen på givna strängar, så nära förra tonen som möjligt.

import { audio, Scheduler } from './audio.js';
import { Fretboard } from './fretboard.js';
import {
  SHARP,
  FLAT,
  STRING_NAMES,
  isAccidental,
  midiAt,
  nearestPositions,
  pc,
  positionsOf,
  samePos,
} from './music.js';

const FRET_START = 0;
const FRET_END = 12;
const DURATION = 60; // sekunder
const BPM = 120;
const PAUSE_MS = 500;
const COUNT_IN_STEPS = 8; // en takt i åttondelar

function rootsExercise({ id, title, desc, strings: STRINGS }) {
  return {
    id,
    title,
    desc,
    options: [],

    start(env) {
      const score = { perfect: 0, near: 0, wrong: 0 };
      let target = null;
      let prev = null;
      let accepting = false;
      let done = false;
      let pauseTimer = null;

      env.hud.innerHTML = `
      <div class="hud-main">
        <div class="hud-label">Hitta tonen</div>
        <div class="target-note" id="ex1-target">…</div>
      </div>
      <div class="hud-side">
        <div class="pill good" title="Rätt plats">✓ <b id="ex1-perfect">0</b></div>
        <div class="pill near" title="Rätt ton, annan plats">≈ <b id="ex1-near">0</b></div>
        <div class="pill bad" title="Fel">✗ <b id="ex1-wrong">0</b></div>
      </div>`;
      const targetEl = env.hud.querySelector('#ex1-target');
      const updateScore = () => {
        for (const k of Object.keys(score)) env.hud.querySelector(`#ex1-${k}`).textContent = score[k];
      };

      const showTarget = () => {
        let next;
        do next = Math.floor(Math.random() * 12);
        while (next === target);
        target = next;
        targetEl.innerHTML = isAccidental(target)
          ? `${SHARP[target]}<span class="alt"> / ${FLAT[target]}</span>`
          : SHARP[target];
        targetEl.classList.remove('pop');
        void targetEl.offsetWidth;
        targetEl.classList.add('pop');
        accepting = true;
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
          if (!prev || !samePos(pos, prev))
            board.setMarker('free', { ...pos, label: SHARP[pc(midi)], kind: 'neutral', ttl: 400 });
          return audio.fretNote(midi, how);
        },
        judge(tap) {
          const midi = midiAt(tap.string, tap.fret);
          const label = SHARP[pc(midi)];
          board.removeMarker('free');
          if (pc(midi) !== target) {
            score.wrong++;
            updateScore();
            board.setMarker('bad', { ...tap, label, kind: 'bad', ttl: 800 });
            env.feedback(`Fel – det där var ${label}. Leta vidare!`, 'bad');
            return;
          }

          const candidates = positionsOf(target, STRINGS, FRET_START, FRET_END);
          const best = nearestPositions(candidates, prev);
          board.removeMarker('bad');
          board.removeMarker('hint');
          if (best.some((p) => samePos(p, tap))) {
            score.perfect++;
            board.setMarker('anchor', { ...tap, label, kind: 'good' });
            env.feedback('Rätt ton på rätt plats!', 'good');
          } else {
            score.near++;
            const b = best[0];
            board.setMarker('anchor', { ...tap, label, kind: 'near' });
            board.setMarker('hint', { ...b, label, kind: 'hint', ttl: 1800 });
            env.feedback(
              `Rätt ton – men ${STRING_NAMES[b.string]}-strängen, band ${b.fret} låg närmare.`,
              'near',
            );
          }
          updateScore();
          prev = tap;
          accepting = false;
          // Kort andningspaus innan nästa ton visas.
          pauseTimer = setTimeout(showTarget, PAUSE_MS);
        },
      });

      // Trumkomp i 120 bpm, med en takts inräkning.
      const bus = audio.createBus(0.55);
      const t0 = audio.now + 0.12;
      const stepDur = 60 / BPM / 2;
      const startAt = t0 + COUNT_IN_STEPS * stepDur;
      const scheduler = new Scheduler(BPM, (i, t) => {
        if (i < COUNT_IN_STEPS) {
          if (i % 2 === 0) audio.click(t, bus);
        } else {
          audio.drumStep((i - COUNT_IN_STEPS) % 8, t, bus);
        }
      });
      scheduler.start(t0);

      env.setTimer(DURATION);
      env.feedback('Gör dig redo …', '');
      let started = false;
      const clock = setInterval(() => {
        const elapsed = audio.heardNow - startAt;
        if (elapsed < 0) return;
        if (!started) {
          started = true;
          env.feedback('Tryck på greppbrädan för att spela tonen.', '');
          showTarget();
        }
        env.setTimer(Math.max(0, Math.ceil(DURATION - elapsed)));
        if (elapsed >= DURATION) {
          stop();
          env.finish({
            title,
            stats: [
              { label: 'Rätt ton, rätt plats', value: score.perfect, kind: 'good' },
              { label: 'Rätt ton, annan plats', value: score.near, kind: 'near' },
              { label: 'Fel', value: score.wrong, kind: 'bad' },
            ],
          });
        }
      }, 50);

      function stop() {
        if (done) return;
        done = true;
        clearInterval(clock);
        clearTimeout(pauseTimer);
        scheduler.stop();
        audio.fadeOutBus(bus);
        board.destroy();
      }

      return { stop };
    },
  };
}

export const ex1 = rootsExercise({
  id: 'roots',
  title: 'Grundtoner på E & A',
  desc: 'Hitta tonen på E- eller A-strängen – så nära din förra ton som möjligt. 1 minut, band 0–12.',
  strings: [5, 4],
});

export const ex3 = rootsExercise({
  id: 'roots-ead',
  title: 'Grundtoner på E, A & D',
  desc: 'Som övning 1, men med D-strängen också: hitta tonen på E-, A- eller D-strängen, så nära din förra ton som möjligt.',
  strings: [5, 4, 3],
});
