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
  desc: 'Fyra ackord går på repeat. Hitta tersen eller kvinten i varje ackord, var som helst i positionen. Ca 2 minuter. Välj om musiken ska stanna på första slaget i varje ackord och vänta tills du hittat tonen.',
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
    {
      key: 'wait',
      label: 'Vänta på rätt ton',
      default: 'off',
      choices: [
        { value: 'off', label: 'Nej' },
        { value: 'on', label: 'Ja' },
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
    const totalSteps = totalWindows * STEPS_PER_CHORD;
    const waitMode = opts.wait === 'on';

    const score = { hits: 0, wrong: 0, missed: 0, findTime: 0 };
    const foundIn = []; // foundIn[w] = true när tonen i ackordfönster w är hittad
    let current = -1; // index för pågående ackordfönster
    let found = false;
    let done = false;
    // Vänteläge: musiken stannar efter första slaget i varje ackord tills tonen är hittad.
    let pausedAt = -1; // musikaliskt steg (efter inräkning) där musiken står still, annars -1
    let windowHeardAt = 0; // när pågående ackord började höras (för snittid i vänteläge)

    env.hud.innerHTML = `
      <div class="hud-main">
        <div class="hud-label">Position: band ${fretStart}–${fretEnd}</div>
        <div class="target-line" id="ex2-target"><button class="primary ready-btn" id="ex2-ready">Redo</button></div>
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
          foundIn[current] = true;
          score.hits++;
          score.findTime += audio.heardNow - windowHeardAt;
          board.removeMarker('bad');
          board.setMarker('hit', { ...tap, kind: 'good' });
          chips[current % chords.length].classList.add('found');
          env.feedback(`Rätt! ${label} är ${TONE[chord.tone].name} i ${chord.name}. Spela fritt tills nästa ackord.`, 'good');
          if (pausedAt >= 0) resume();
        } else {
          score.wrong++;
          board.setMarker('bad', { ...tap, kind: 'bad', ttl: 800 });
          env.feedback(`${label} är inte ${TONE[chord.tone].name} i ${chord.name}.`, 'bad');
        }
      },
    });

    // ---- Bakgrundskomp ----
    const bus = audio.createBus(0.6);
    // Musikalisk tid = audio.heardNow - offset. Sätts när Redo trycks; varje paus flyttar fram den.
    let offset = 0;
    let scheduler = null;

    // Kör komp från musikaliskt steg baseStep (negativt = inräkning) med start på ljudtiden tStart.
    const runFrom = (baseStep, tStart) => {
      const s = new Scheduler(BPM, (i, t) => {
        if (s !== scheduler) return; // stoppad i samma tick
        const m = baseStep + i;
        if (m < 0) {
          if (m % 2 === 0) audio.click(t, bus);
          return;
        }
        // Vänteläge: efter ackordets första slag står musiken still tills tonen är hittad.
        if (waitMode && m % STEPS_PER_CHORD === 1 && m < totalSteps
          && !foundIn[(m - 1) / STEPS_PER_CHORD]) {
          pause(m);
          return;
        }
        playStep(m, t);
      });
      scheduler = s;
      s.start(tStart);
      if (scheduler !== s) s.stop(); // pausade redan i första tick, innan timern fanns
    };

    const playStep = (m, t) => {
      const w = Math.floor(m / STEPS_PER_CHORD);
      if (w >= totalWindows) return;
      const chord = chords[w % chords.length];
      const step = m % 8;
      audio.drumStep(step, t, bus);
      const root = 48 + chord.root; // C3–B3
      // I vänteläget får ackordets första slag klinga ut länge, eftersom musiken stannar efter det.
      const hold = waitMode && m % STEPS_PER_CHORD === 0;
      if (step === 0) {
        audio.chord([root, root + (chord.minor ? 3 : 4), root + 7], t, stepDur * (hold ? 16 : 7.6), bus);
      }
      const bassRoot = 36 + chord.root;
      if (step === 0) audio.bass(bassRoot, t, stepDur * (hold ? 8 : 2.8), bus);
      if (step === 3) audio.bass(bassRoot, t, stepDur * 0.9, bus);
      if (step === 4) audio.bass(chord.root >= 5 ? bassRoot - 5 : bassRoot + 7, t, stepDur * 2.6, bus);
    };

    function pause(m) {
      scheduler.stop();
      scheduler = null;
      pausedAt = m;
    }

    function resume() {
      // Musiken fortsätter strax efter rätt ton. Högst ett steg, så att ackordfönstret inte backar.
      const tStart = audio.now + stepDur;
      offset = tStart - pausedAt * stepDur;
      const m = pausedAt;
      pausedAt = -1;
      runFrom(m, tStart);
    }


    const enterWindow = (w) => {
      if (current >= 0 && !found) score.missed++;
      current = w;
      found = false;
      windowHeardAt = audio.heardNow;
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
    env.feedback(`Tonart ${noteName(key.root, key.flats)} dur. Orientera dig på greppbrädan och tryck Redo.`, '');

    // Inräkningen börjar först när spelaren trycker Redo. Fram till dess är det fritt spel.
    let raf = 0;
    env.hud.querySelector('#ex2-ready').addEventListener('click', () => {
      if (done) return;
      targetEl.textContent = 'Gör dig redo …';
      env.feedback(`Tonart ${noteName(key.root, key.flats)} dur – lyssna in takten.`, '');
      const t0 = audio.now + 0.12;
      offset = t0 + COUNT_IN_STEPS * stepDur;
      runFrom(-COUNT_IN_STEPS, t0);
      raf = requestAnimationFrame(frame);
    });

    function frame() {
      if (done) return;
      let elapsed = audio.heardNow - offset;
      const waiting = pausedAt >= 0 && elapsed >= pausedAt * stepDur;
      // Medan musiken väntar står klockan still precis före ackordbytet.
      if (pausedAt >= 0) elapsed = Math.min(elapsed, pausedAt * stepDur - 1e-6);
      // Efter en paus kan den hörda tiden hamna strax före ackordets start (utgångslatens +
      // ett stegs uppstart). Låt aldrig ackordfönstret backa – då nollställs en hittad ton.
      if (current >= 0) elapsed = Math.max(elapsed, current * windowDur);
      if (waiting && !targetEl.classList.contains('waiting')) {
        targetEl.classList.add('waiting');
        const chord = chords[current % chords.length];
        env.feedback(`Musiken väntar – hitta ${TONE[chord.tone].name} i ${chord.name}.`, '');
      } else if (!waiting) {
        targetEl.classList.remove('waiting');
      }
      if (elapsed >= totalDur) {
        if (!found) score.missed++;
        stop();
        env.finish({
          title: 'Ackordstoner',
          note: `${chords.map((c) => `${c.name} (${TONE[c.tone].short})`).join(' – ')} · band ${fretStart}–${fretEnd}`,
          stats: [
            { label: `Hittade ackordstoner (av ${totalWindows})`, value: score.hits, kind: 'good' },
            { label: 'Feltryck', value: score.wrong, kind: 'bad' },
            waitMode
              ? { label: 'Snittid att hitta tonen', value: `${(score.findTime / Math.max(1, score.hits)).toFixed(1).replace('.', ',')} s`, kind: 'near' }
              : { label: 'Missade ackord', value: score.missed, kind: 'near' },
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
    }

    function stop() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      scheduler?.stop();
      scheduler = null;
      audio.fadeOutBus(bus);
      board.destroy();
    }

    return { stop };
  },
};
