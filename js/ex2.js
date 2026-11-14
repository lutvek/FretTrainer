// Övning 2: hitta en given ackordston (ters eller kvint) över en ackordföljd på repeat.

import { audio, Scheduler } from './audio.js';
import { Fretboard } from './fretboard.js';
import { KEYS, PROGRESSIONS, buildProgression, midiAt, noteName, pc, pick } from './music.js';

const BPM = 100;
const STEPS_PER_CHORD = 16; // två takter i åttondelar
const LOOPS = 6; // 6 varv × 4 ackord × 4,8 s ≈ 2 minuter
const COUNT_IN_STEPS = 8;
const WINDOW_FRETS = 6;

const TONE = {
  third: { short: '3', name: 'tersen' },
  fifth: { short: '5', name: 'kvinten' },
};

export const ex2 = {
  id: 'chord-tones',
  title: 'Ackordstoner',
  desc: 'Fyra ackord går på repeat. Hitta tersen eller kvinten i varje ackord, var som helst i positionen. Ca 2 minuter.',
  options: [
    {
      key: 'tones',
      label: 'Ackordston',
      default: 'mixed',
      choices: [
        { value: 'third', label: 'Ters' },
        { value: 'fifth', label: 'Kvint' },
        { value: 'mixed', label: 'Blandat' },
      ],
    },
  ],

  start(env, opts) {
    const key = pick(KEYS);
    const chords = buildProgression(key, pick(PROGRESSIONS));
    // Vilken ackordston som gäller för varje ackord bestäms här och ligger fast hela övningen.
    chords.forEach((c) => {
      c.tone = opts.tones === 'mixed' ? pick(['third', 'fifth']) : opts.tones;
      c.targetPc = c[c.tone];
    });
    const fretStart = 1 + Math.floor(Math.random() * 8); // position 1–8
    const fretEnd = fretStart + WINDOW_FRETS - 1;

    const stepDur = 60 / BPM / 2;
    const windowDur = STEPS_PER_CHORD * stepDur;
    const totalWindows = LOOPS * chords.length;
    const totalDur = totalWindows * windowDur;

    const score = { hits: 0, wrong: 0, missed: 0 };
    let current = -1; // index för pågående ackordfönster
    let found = false;
    let done = false;

    env.hud.innerHTML = `
      <div class="hud-main">
        <div class="hud-label">Position: band ${fretStart}–${fretEnd}</div>
        <div class="target-line" id="ex2-target">Gör dig redo …</div>
      </div>
      <div class="chord-strip">
        ${chords.map((c, i) => `
          <div class="chord-chip" data-i="${i}">
            <div class="chord-name">${c.name}</div>
            <div class="chord-tone">${TONE[c.tone].short}</div>
            <div class="chord-progress"><i></i></div>
          </div>`).join('')}
      </div>`;
    const targetEl = env.hud.querySelector('#ex2-target');
    const chips = [...env.hud.querySelectorAll('.chord-chip')];

    const board = new Fretboard(env.board, {
      fretStart,
      fretEnd,
      canJudge: () => !done && current >= 0 && !found,
      isHit: (pos) => pc(midiAt(pos.string, pos.fret)) === chords[current % chords.length].targetPc,
      // Före start, eller när tonen redan är hittad, blir detta fritt spel utan bedömning.
      play(pos, how) {
        if (done) return null;
        const midi = midiAt(pos.string, pos.fret);
        board.setMarker('free', { ...pos, label: noteName(midi, key.flats), kind: 'neutral', ttl: 500 });
        return audio.fretNote(midi, how);
      },
      judge({ string, fret }) {
        const midi = midiAt(string, fret);
        const label = noteName(midi, key.flats);
        const tap = { string, fret, label };
        board.removeMarker('free');
        const chord = chords[current % chords.length];
        if (pc(midi) === chord.targetPc) {
          found = true;
          score.hits++;
          board.removeMarker('bad');
          board.setMarker('hit', { ...tap, kind: 'good' });
          chips[current % chords.length].classList.add('found');
          env.feedback(`Rätt! ${label} är ${TONE[chord.tone].name} i ${chord.name}. Spela fritt tills nästa ackord.`, 'good');
        } else {
          score.wrong++;
          board.setMarker('bad', { ...tap, kind: 'bad', ttl: 800 });
          env.feedback(`${label} är inte ${TONE[chord.tone].name} i ${chord.name}.`, 'bad');
        }
      },
    });

    // ---- Bakgrundskomp ----
    const bus = audio.createBus(0.6);
    const t0 = audio.now + 0.12;
    const startAt = t0 + COUNT_IN_STEPS * stepDur;
    const scheduler = new Scheduler(BPM, (i, t) => {
      if (i < COUNT_IN_STEPS) {
        if (i % 2 === 0) audio.click(t, bus);
        return;
      }
      const m = i - COUNT_IN_STEPS;
      const w = Math.floor(m / STEPS_PER_CHORD);
      if (w >= totalWindows) return;
      const chord = chords[w % chords.length];
      const step = m % 8;
      audio.drumStep(step, t, bus);
      const root = 48 + chord.root; // C3–B3
      if (step === 0) {
        audio.chord([root, root + (chord.minor ? 3 : 4), root + 7], t, stepDur * 7.6, bus);
      }
      const bassRoot = 36 + chord.root;
      if (step === 0) audio.bass(bassRoot, t, stepDur * 2.8, bus);
      if (step === 3) audio.bass(bassRoot, t, stepDur * 0.9, bus);
      if (step === 4) audio.bass(chord.root >= 5 ? bassRoot - 5 : bassRoot + 7, t, stepDur * 2.6, bus);
    });
    scheduler.start(t0);

    const enterWindow = (w) => {
      if (current >= 0 && !found) score.missed++;
      current = w;
      found = false;
      board.clearMarkers();
      const idx = w % chords.length;
      const chord = chords[idx];
      chips.forEach((c, i) => {
        c.classList.toggle('active', i === idx);
        c.classList.remove('found');
      });
      targetEl.innerHTML = `Hitta <b>${TONE[chord.tone].name}</b> i <b>${chord.name}</b>`;
      env.feedback('', '');
    };

    env.setTimer(Math.ceil(totalDur));
    env.feedback(`Tonart ${noteName(key.root, key.flats)} dur – lyssna in takten.`, '');
    let raf = requestAnimationFrame(function frame() {
      if (done) return;
      const elapsed = audio.heardNow - startAt;
      if (elapsed >= totalDur) {
        if (!found) score.missed++;
        stop();
        env.finish({
          title: 'Ackordstoner',
          note: `${chords.map((c) => `${c.name} (${TONE[c.tone].short})`).join(' – ')} · band ${fretStart}–${fretEnd}`,
          stats: [
            { label: `Hittade ackordstoner (av ${totalWindows})`, value: score.hits, kind: 'good' },
            { label: 'Feltryck', value: score.wrong, kind: 'bad' },
            { label: 'Missade ackord', value: score.missed, kind: 'near' },
          ],
        });
        return;
      }
      if (elapsed >= 0) {
        const w = Math.floor(elapsed / windowDur);
        if (w !== current) enterWindow(w);
        const frac = (elapsed - w * windowDur) / windowDur;
        chips[w % chords.length].querySelector('i').style.width = `${frac * 100}%`;
        env.setTimer(Math.ceil(totalDur - elapsed));
      }
      raf = requestAnimationFrame(frame);
    });

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
