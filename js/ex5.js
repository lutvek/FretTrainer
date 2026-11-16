// Övning 5 och 6: triader på de tre ljusaste strängarna (G, B, e) i en position.
// En ackordföljd på 8 ackord går 4 varv i 90 bpm, en takt per ackord.
// Övning 5 håller sig i en durtonart (skalans egna ackord) i ett läge som passar
// tonarten. Övning 6 har dim7-ackord och tonartsbyten i ett helt slumpat läge.
// Spelaren ska hitta alla tre tonerna i ackordet (3 av 4 för dim7).
// Med "Vänta på rätt toner" stannar musiken efter ackordets första slag tills alla
// toner är hittade (som i Ackordstoner); annars rullar den på och ackordet räknas
// som missat. Inräkningen startar först när spelaren trycker Redo.

import { audio } from './audio.js';
import { Fretboard } from './fretboard.js';
import { keyName, midiAt, noteName, pc, randomTriadProgression } from './music.js';

const BPM = 90;
const STEPS_PER_BAR = 8; // åttondelar i en 4/4-takt
const LOOPS = 4;
const COUNT_IN_BEATS = 8; // två takters inräkning
const CHORDS = 8;
const WINDOW_FRETS = 5; // 5 band på G, B och e räcker för att alla tonklasser ska finnas
const STRINGS = [0, 1, 2]; // e, B, G
const LEAD = 0.12; // marginal (s) när något schemaläggs "nu"

/** Bas i A1–G♯2. */
const bassNote = (p) => 33 + ((p + 3) % 12);

/** Komp-voicing (sluten, G3–D5) som rör sig så lite som möjligt från förra ackordet. */
function voice(pcs, prev) {
  let best = null;
  for (let inv = 0; inv < pcs.length; inv++) {
    const order = [...pcs.slice(inv), ...pcs.slice(0, inv)];
    for (let low = 52; low < 64; low++) {
      if (pc(low) !== order[0]) continue;
      const notes = [low];
      for (const p of order.slice(1)) {
        let n = notes[notes.length - 1] + 1;
        while (pc(n) !== p) n++;
        notes.push(n);
      }
      const cost = prev
        ? notes.reduce((s, n) => s + Math.min(...prev.map((m) => Math.abs(m - n))), 0)
        : Math.abs(notes[0] - 55) + inv * 2;
      if (!best || cost < best.cost) best = { notes, cost };
    }
  }
  return best.notes;
}

/** Bandintervall [start, slut] med start 1–10. */
const windowAt = (start) => [start, start + WINDOW_FRETS - 1];

/**
 * Greppformer för ackordet i fönstret: en ton per sträng (G, B, e), alla tre olika
 * ackordtoner (för dim7 räcker 3 av 4). Returnerar formernas bredd i band.
 */
function shapeSpans(chord, start, end) {
  const spans = [];
  for (let g = start; g <= end; g++) {
    for (let b = start; b <= end; b++) {
      for (let e = start; e <= end; e++) {
        const got = [midiAt(2, g), midiAt(1, b), midiAt(0, e)].map(pc);
        if (new Set(got).size === 3 && got.every((p) => chord.pcs.includes(p))) {
          spans.push(Math.max(g, b, e) - Math.min(g, b, e));
        }
      }
    }
  }
  return spans;
}

/** Går ackordet att ta med en ton per sträng i fönstret? */
const hasShape = (chord, start, end) => shapeSpans(chord, start, end).length > 0;

/** Finns en sluten form (högst 4 band brett) för ackordet i fönstret? */
const hasCompactShape = (chord, start, end) => shapeSpans(chord, start, end).some((w) => w <= 3);

/** Fönsterstarter (1–10) där varje ackord i följden går att ta med en ton per sträng. */
function playableStarts(chords) {
  const out = [];
  for (let start = 1; start <= 10; start++) {
    const [lo, hi] = windowAt(start);
    if (chords.every((c) => hasShape(c, lo, hi))) out.push(start);
  }
  return out;
}

/**
 * Läge som passar tonarten: bland de spelbara fönstren det där flest av följdens
 * ackord har en sluten form, och där tonikan ligger på G- eller B-strängen.
 * Lika bra fönster lottas.
 */
function positionForKey(chords, starts) {
  const tonic = chords[0].key;
  const unique = [...new Map(chords.map((c) => [c.name, c])).values()];
  let best = [];
  let bestScore = -1;
  for (const start of starts) {
    const [lo, hi] = windowAt(start);
    let score = unique.filter((c) => hasCompactShape(c, lo, hi)).length * 2;
    for (let f = lo; f <= hi; f++) {
      if (pc(midiAt(2, f)) === tonic || pc(midiAt(1, f)) === tonic) { score += 1; break; }
    }
    if (score > bestScore) { bestScore = score; best = [start]; } else if (score === bestScore) best.push(start);
  }
  return best[Math.floor(Math.random() * best.length)];
}

/**
 * Slumpar följd och läge tills varje ackord går att spela med en ton per sträng
 * i fönstret. Övning 5 väljer det läge som passar tonarten bäst, övning 6 ett
 * slumpat bland de spelbara.
 */
function progressionAndPosition(inKey) {
  for (let tries = 0; tries < 200; tries++) {
    const chords = randomTriadProgression(CHORDS, Math.random, { diatonic: inKey });
    const starts = playableStarts(chords);
    if (!starts.length) continue;
    const fretStart = inKey
      ? positionForKey(chords, starts)
      : starts[Math.floor(Math.random() * starts.length)];
    return { chords, fretStart };
  }
  throw new Error('Hittade ingen spelbar triadföljd');
}

function makeTriadExercise({ id, title, desc, inKey }) {
  return {
    id,
    title,
    desc,
    options: [
      {
        key: 'wait',
        label: 'Vänta på rätt toner',
        default: 'on',
        choices: [
          { value: 'off', label: 'Nej' },
          { value: 'on', label: 'Ja' },
        ],
      },
    ],

    start(env, opts = {}) {
      const waitMode = opts.wait !== 'off';
      const { chords, fretStart } = progressionAndPosition(inKey);
      const fretEnd = fretStart + WINDOW_FRETS - 1;
      const totalBars = LOOPS * CHORDS;
      const stepDur = 60 / BPM / 2;
      const barDur = STEPS_PER_BAR * stepDur;

      // Komp-voicings räknas fram en gång och följer varandra runt hela loopen.
      let v = null;
      for (let pass = 0; pass < 2; pass++) chords.forEach((c) => { v = c.voicing = voice(c.pcs, v); });

      const score = { hits: 0, missed: 0, wrong: 0, findTime: 0 };
      // { start } = ljudtiden för taktens första slag. I vänteläget flyttas den fram
      // när musiken fortsätter, så att takten är 8 åttondelar lång räknat från start.
      const bars = [];
      let cur = -1; // takten som hörs just nu
      let found = new Map(); // tonklass → läge
      let complete = false;
      let waitingNow = false;
      let barHeardAt = 0;
      let done = false;
      let endAt = null;

      env.hud.innerHTML = `
        <div class="hud-main">
          <div class="hud-label">${inKey ? `${keyName(chords[0].key)} dur · ` : ''}Band ${fretStart}–${fretEnd} · G, B, e · <span id="ex5-loop">Varv 1/${LOOPS}</span></div>
          <div class="target-row">
            <div class="target-note" id="ex5-chord">${chords[0].name}</div>
            <div class="next-note ex5-next">Nästa <b id="ex5-next">…</b></div>
          </div>
        </div>
        <div class="chord-strip eight">
          ${chords.map((c, i) => `
            <div class="chord-chip" data-i="${i}">
              <div class="chord-name">${c.name}</div>
              <div class="chord-progress"><i></i></div>
            </div>`).join('')}
        </div>`;
      const chordEl = env.hud.querySelector('#ex5-chord');
      const nextEl = env.hud.querySelector('#ex5-next');
      const loopEl = env.hud.querySelector('#ex5-loop');
      const chips = [...env.hud.querySelectorAll('.chord-chip')];

      const chordOf = (bar) => chords[bar % CHORDS];

      const board = new Fretboard(env.board, {
        fretStart,
        fretEnd,
        activeStrings: STRINGS,
        canJudge: () => !done && cur >= 0 && !complete,
        isHit: (pos) => chordOf(cur).pcs.includes(pc(midiAt(pos.string, pos.fret))),
        play(pos, how) {
          if (done) return null;
          const midi = midiAt(pos.string, pos.fret);
          const flats = chordOf(Math.max(cur, 0)).flats;
          board.setMarker('free', { ...pos, label: noteName(midi, flats), kind: 'neutral', ttl: 500 });
          return audio.fretNote(midi, how);
        },
        judge(pos) {
          const chord = chordOf(cur);
          const p = pc(midiAt(pos.string, pos.fret));
          const label = noteName(p, chord.flats);
          board.removeMarker('free');
          if (!chord.pcs.includes(p)) {
            score.wrong++;
            board.setMarker('bad', { ...pos, label, kind: 'bad', ttl: 800 });
            env.feedback(`${label} finns inte i ${chord.name}.`, 'bad');
            return;
          }
          board.removeMarker('bad');
          if (found.has(p)) {
            env.feedback(`${label} har du redan – leta efter de andra.`, '');
            return;
          }
          found.set(p, pos);
          board.setMarker(`t${p}`, { ...pos, label, kind: 'good' });
          if (found.size >= chord.need) onComplete();
          else env.feedback(`${label} ✓`, 'good');
        },
      });

      // ---- Komp: en takt schemaläggs i taget, först när förra ackordet är klart ----
      const bus = audio.createBus(0.6);

      // Ett steg (åttondel) i takten. hold = ackordets första slag i vänteläget,
      // som får klinga ut länge eftersom musiken stannar efter det.
      const playStep = (bar, s, t, hold) => {
        const chord = chordOf(bar);
        const root = bassNote(chord.root);
        audio.drumStep(s, t, bus);
        if (s === 0) {
          audio.chord(chord.voicing, t, stepDur * (hold ? 16 : 2.8), bus);
          audio.bass(root, t, stepDur * (hold ? 8 : 2.6), bus);
        } else if (s === 3) {
          audio.chord(chord.voicing, t, stepDur * 4.6, bus);
          audio.bass(root, t, stepDur * 0.9, bus);
        } else if (s === 4) {
          audio.bass(root + (chord.quality === 'dim' ? 6 : 7), t, stepDur * 1.8, bus);
        } else if (s === 6) {
          audio.bass(root + 12, t, stepDur * 0.9, bus);
        } else if (s === 7) {
          let approach = bassNote(chordOf(bar + 1).root) - 1;
          if (approach < 33) approach += 2;
          audio.bass(approach, t, stepDur * 0.9, bus);
        }
      };

      /** Planerar in steg from…to-1 av takten, där t0 är ljudtiden för taktens första slag. */
      const scheduleBar = (bar, t0, from = 0, to = STEPS_PER_BAR) => {
        for (let s = from; s < to; s++) playStep(bar, s, t0 + s * stepDur, waitMode && s === 0);
        bars[bar] = { start: t0 };
      };

      // I vänteläget planeras bara första slaget; resten av takten när ackordet är klart.
      const scheduleNext = (bar, t0) => {
        if (bar >= totalBars) scheduleEnding(t0);
        else scheduleBar(bar, t0, 0, waitMode ? 1 : STEPS_PER_BAR);
      };

      // Slutackord: första ackordet i följden, så att sista varvet landar.
      const scheduleEnding = (t) => {
        const chord = chords[0];
        audio.kick(t, bus);
        audio.hat(t, bus, 0.2);
        audio.chord(chord.voicing, t, 2.4, bus);
        audio.bass(bassNote(chord.root), t, 2.2, bus);
        endAt = t + 1.6;
      };

      function onComplete() {
        complete = true;
        const chord = chordOf(cur);
        score.hits++;
        score.findTime += audio.heardNow - barHeardAt;
        chips[cur % CHORDS].classList.add('found');
        chips[cur % CHORDS].classList.remove('waiting');
        if (waitMode) {
          // Resten av takten börjar på andra åttondelen – eller direkt om musiken redan väntar.
          const t1 = Math.max(bars[cur].start + stepDur, audio.now + LEAD);
          const t0 = t1 - stepDur;
          scheduleBar(cur, t0, 1, STEPS_PER_BAR);
          scheduleNext(cur + 1, t0 + barDur);
        }
        if (waitingNow) {
          waitingNow = false;
          env.feedback(`${chord.name} klart – vi kör vidare!`, 'good');
        } else {
          env.feedback(`${chord.name} klart! Spela fritt tills nästa ackord.`, 'good');
        }
      }

      const enterBar = (bar) => {
        if (cur >= 0 && !complete) score.missed++;
        cur = bar;
        found = new Map();
        complete = false;
        waitingNow = false;
        barHeardAt = audio.heardNow;
        // Utan vänteläge rullar musiken på: nästa takt planeras redan nu.
        if (!waitMode) scheduleNext(bar + 1, bars[bar].start + barDur);
        board.clearMarkers();
        const chord = chordOf(bar);
        const idx = bar % CHORDS;
        chips.forEach((c, i) => {
          c.classList.toggle('active', i === idx);
          c.classList.remove('found', 'waiting');
        });
        chordEl.textContent = chord.name;
        chordEl.classList.remove('pop');
        void chordEl.offsetWidth;
        chordEl.classList.add('pop');
        nextEl.textContent = bar + 1 < totalBars ? chordOf(bar + 1).name : '–';
        loopEl.textContent = `Varv ${Math.floor(bar / CHORDS) + 1}/${LOOPS}`;
        env.feedback('', '');
      };

      nextEl.textContent = chords[1].name;
      env.feedback('Orientera dig på greppbrädan och tryck Redo.', '');
      env.setTimer(0);

      // Inräkningen (två takter med klick) börjar först när spelaren trycker Redo.
      // Fram till dess är det fritt spel.
      let startAt = 0;
      let raf = 0;
      // Redo-knappen ligger mitt på greppbrädan tills spelaren trycker på den.
      const readyBtn = document.createElement('button');
      readyBtn.className = 'primary ready-btn board-ready';
      readyBtn.textContent = 'Redo';
      env.board.append(readyBtn);
      readyBtn.addEventListener('click', () => {
        if (done) return;
        readyBtn.remove();
        const t0 = audio.now + LEAD;
        for (let i = 0; i < COUNT_IN_BEATS; i++) audio.click(t0 + i * 2 * stepDur, bus);
        startAt = t0 + COUNT_IN_BEATS * 2 * stepDur;
        scheduleNext(0, startAt);
        env.feedback('Lyssna in takten …', '');
        raf = requestAnimationFrame(frame);
      });

      function frame() {
        if (done) return;
        const now = audio.heardNow;
        env.setTimer(Math.max(0, Math.floor(now - startAt)));

        if (endAt !== null && now >= endAt) {
          finish();
          return;
        }
        const next = cur + 1;
        if (bars[next] && now >= bars[next].start) enterBar(next);

        if (cur >= 0) {
          const chip = chips[cur % CHORDS];
          let into = now - bars[cur].start;
          if (waitMode && !complete) into = Math.min(into, stepDur); // står still medan musiken väntar
          chip.querySelector('i').style.width = `${Math.min(1, Math.max(0, into) / barDur) * 100}%`;
          if (waitMode && !complete && !waitingNow && into >= stepDur) {
            // Musiken står still efter första slaget tills tonerna är hittade.
            waitingNow = true;
            chip.classList.add('waiting');
            env.feedback(`Musiken väntar – hitta tonerna i ${chordOf(cur).name}.`, 'near');
          }
        }
        raf = requestAnimationFrame(frame);
      }

      function finish() {
        if (cur >= 0 && !complete) score.missed++;
        const seconds = Math.round(endAt - startAt);
        stop();
        const keys = [...new Set(chords.map((c) => keyName(c.key)))];
        env.finish({
          title,
          note: `${chords.map((c) => c.name).join(' – ')} · band ${fretStart}–${fretEnd} · `
            + `${keys.length > 1 ? 'tonarter' : 'tonart'} ${keys.join(', ')} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
          stats: [
            { label: `Klara ackord (av ${totalBars})`, value: score.hits, kind: 'good' },
            { label: 'Feltryck', value: score.wrong, kind: 'bad' },
            waitMode
              ? { label: 'Snittid per ackord', value: `${(score.findTime / Math.max(1, score.hits)).toFixed(1).replace('.', ',')} s`, kind: 'near' }
              : { label: 'Missade ackord', value: score.missed, kind: 'near' },
          ],
        });
      }

      function stop() {
        if (done) return;
        done = true;
        readyBtn.remove();
        cancelAnimationFrame(raf);
        audio.fadeOutBus(bus);
        board.destroy();
      }

      return { stop };
    },
  };
}

export const ex5 = makeTriadExercise({
  id: 'triads-gbe-key',
  title: 'Triader på G, B & e – i tonart',
  desc: 'En ackordföljd på 8 ackord ur en durskala (dur, moll och skalans dim-ackord) går 4 varv i 90 bpm, en takt per ackord, i ett läge som passar tonarten. Spela ackordets alla tre toner på G-, B- och e-strängen. Med Vänta på rätt toner stannar musiken efter ackordets första slag tills du hittat dem. Inräkningen startar när du trycker Redo.',
  inKey: true,
});

export const ex6 = makeTriadExercise({
  id: 'triads-gbe',
  title: 'Triader på G, B & e – slumpat läge',
  desc: 'Svårare: 8 ackord – dur, moll och dim7 (°7), ibland med tonartsbyte – i ett helt slumpat läge, 4 varv i 90 bpm, en takt per ackord. Spela ackordets alla tre toner (3 av 4 för °7) på G-, B- och e-strängen. Med Vänta på rätt toner stannar musiken efter ackordets första slag tills du hittat dem. Inräkningen startar när du trycker Redo.',
  inKey: false,
});
