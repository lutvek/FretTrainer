// Övning 9: arpeggios över en ackordföljd i en durtonart, i en position om 5 band
// på alla sex strängar. Spelaren spelar ackordets toner en i taget i ordning,
// 1–3–5–1 uppåt (eller 1–5–3–1 nedåt), där varje ton ska vara närmaste ackordston
// ovanför (nedanför) den förra. Samma upplägg som triadövningarna: 8 ackord, en
// takt per ackord i 90 bpm, Redo-knapp, inräkning och "Vänta på rätt toner".

import { audio } from './audio.js';
import { Fretboard } from './fretboard.js';
import { bassNote, voice } from './ex5.js';
import { keyName, midiAt, noteName, pc, randomTriadProgression } from './music.js';

const BPM = 90;
const STEPS_PER_BAR = 8; // åttondelar i en 4/4-takt
const LOOPS = 2;
const COUNT_IN_BEATS = 8; // två takters inräkning
const CHORDS = 8;
const WINDOW_FRETS = 5;
const STRINGS = [0, 1, 2, 3, 4, 5];
const LEAD = 0.12; // marginal (s) när något schemaläggs "nu"

// Ackordtonernas ordning (index i chord.pcs): grundton, ters, kvint, grundton en oktav bort.
const ORDER = { up: [0, 1, 2, 0], down: [0, 2, 1, 0] };

/** Fönsterstart (1–8) där tonikan finns på E- eller A-strängen. Lika bra lägen lottas. */
function positionForKey(key) {
  const starts = [];
  for (let start = 1; start <= 8; start++) {
    for (let f = start; f < start + WINDOW_FRETS; f++) {
      if (pc(midiAt(5, f)) === key || pc(midiAt(4, f)) === key) { starts.push(start); break; }
    }
  }
  return starts[Math.floor(Math.random() * starts.length)];
}

export const ex9 = {
  id: 'arpeggios',
  title: 'Arpeggios i tonart',
  desc: 'En ackordföljd på 8 ackord ur en durskala går 2 varv i 90 bpm, en takt per ackord, i en position om 5 band. Spela ackordet som arpeggio, en ton i taget: grundton, ters, kvint och grundtonen en oktav upp (eller nedåt: 1–5–3–1). Varje ton ska vara närmaste ackordston från den förra. Med Vänta på rätt toner stannar musiken efter ackordets första slag tills arpeggiot är klart. Inräkningen startar när du trycker Redo.',
  options: [
    {
      key: 'dir',
      label: 'Riktning',
      default: 'up',
      choices: [
        { value: 'up', label: 'Uppåt' },
        { value: 'down', label: 'Nedåt' },
        { value: 'mixed', label: 'Växla' },
      ],
    },
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
    const chords = randomTriadProgression(CHORDS, Math.random, { diatonic: true });
    const fretStart = positionForKey(chords[0].key);
    const fretEnd = fretStart + WINDOW_FRETS - 1;
    const lowest = midiAt(5, fretStart);
    const highest = midiAt(0, fretEnd);
    const totalBars = LOOPS * CHORDS;
    const stepDur = 60 / BPM / 2;
    const barDur = STEPS_PER_BAR * stepDur;
    // Riktning per takt: fast, eller växlande upp/ner ackord för ackord.
    const dirOf = (bar) => (opts.dir === 'mixed' ? (bar % 2 ? 'down' : 'up') : opts.dir === 'down' ? 'down' : 'up');

    let v = null;
    for (let pass = 0; pass < 2; pass++) chords.forEach((c) => { v = c.voicing = voice(c.pcs, v); });

    const score = { hits: 0, missed: 0, wrong: 0, findTime: 0 };
    const bars = [];
    let cur = -1;
    let step = 0; // antal spelade toner i arpeggiot
    let last = null; // midi för förra tonen
    let complete = false;
    let waitingNow = false;
    let barHeardAt = 0;
    let done = false;
    let endAt = null;

    env.hud.innerHTML = `
      <div class="hud-main">
        <div class="hud-label">${keyName(chords[0].key)} dur · Band ${fretStart}–${fretEnd} · <span id="ex9-loop">Varv 1/${LOOPS}</span></div>
        <div class="target-row">
          <div class="target-note" id="ex9-chord">${chords[0].name}</div>
          <div class="arp-steps" id="ex9-steps"></div>
        </div>
      </div>
      <div class="chord-strip eight">
        ${chords.map((c, i) => `
          <div class="chord-chip" data-i="${i}">
            <div class="chord-name">${c.name}</div>
            <div class="chord-progress"><i></i></div>
          </div>`).join('')}
      </div>`;
    const chordEl = env.hud.querySelector('#ex9-chord');
    const stepsEl = env.hud.querySelector('#ex9-steps');
    const loopEl = env.hud.querySelector('#ex9-loop');
    const chips = [...env.hud.querySelectorAll('.chord-chip')];

    const chordOf = (bar) => chords[((bar % CHORDS) + CHORDS) % CHORDS];
    const orderOf = (bar) => ORDER[dirOf(bar)];
    const expectedPc = () => chordOf(cur).pcs[orderOf(cur)[step]];

    /** Visar arpeggiots steg: gradtal för de som är kvar, tonnamn för de som är spelade. */
    const renderSteps = (bar) => {
      const chord = chordOf(bar);
      const order = orderOf(bar);
      const arrow = dirOf(bar) === 'up' ? '↑' : '↓';
      stepsEl.innerHTML = `<span class="arp-dir">${arrow}</span>${order.map((idx, i) => {
        const cls = i < step && bar === cur ? 'done' : i === step && bar === cur && !complete ? 'now' : '';
        const text = cls === 'done' ? noteName(chord.pcs[idx], chord.flats) : chord.labels[idx];
        return `<span class="arp-step ${cls}">${text}</span>`;
      }).join('')}`;
    };

    /** Går det att spela hela arpeggiot från grundtonen `m` inom fönstret? */
    const fits = (m) => (dirOf(cur) === 'up' ? m + 12 <= highest : m - 12 >= lowest);

    /** Är tonen nästa rätta ton i arpeggiot? */
    const isNext = (m) => {
      if (pc(m) !== expectedPc()) return false;
      if (step === 0) return fits(m);
      const d = dirOf(cur) === 'up' ? m - last : last - m;
      return d > 0 && d <= 12;
    };

    const board = new Fretboard(env.board, {
      fretStart,
      fretEnd,
      activeStrings: STRINGS,
      canJudge: () => !done && cur >= 0 && !complete,
      isHit: (pos) => isNext(midiAt(pos.string, pos.fret)),
      play(pos, how) {
        if (done) return null;
        const midi = midiAt(pos.string, pos.fret);
        const flats = chordOf(Math.max(cur, 0)).flats;
        board.setMarker('free', { ...pos, label: noteName(midi, flats), kind: 'neutral', ttl: 500 });
        return audio.fretNote(midi, how);
      },
      judge(pos) {
        const chord = chordOf(cur);
        const m = midiAt(pos.string, pos.fret);
        const label = noteName(m, chord.flats);
        board.removeMarker('free');
        if (m === last) return; // samma ton igen – ingen bedömning
        if (isNext(m)) {
          board.removeMarker('bad');
          board.setMarker(`a${step}`, { ...pos, label, kind: 'good' });
          last = m;
          step++;
          if (step >= 4) onComplete();
          else {
            renderSteps(cur);
            env.feedback(`${label} ✓`, 'good');
          }
          return;
        }
        board.setMarker('bad', { ...pos, label, kind: 'bad', ttl: 800 });
        const want = noteName(expectedPc(), chord.flats);
        const up = dirOf(cur) === 'up';
        if (pc(m) === expectedPc() && step === 0) {
          // Rätt grundton men arpeggiot får inte plats åt det hållet – räknas inte som fel.
          env.feedback(`Ta en ${up ? 'lägre' : 'högre'} ${want} – arpeggiot ska få plats i läget.`, 'near');
          return;
        }
        score.wrong++;
        if (pc(m) === expectedPc()) {
          env.feedback(`Rätt ton, fel oktav – ta närmaste ${want} ${up ? 'ovanför' : 'nedanför'}.`, 'bad');
        } else if (chord.pcs.includes(pc(m))) {
          env.feedback(`${label} finns i ${chord.name}, men nu är det ${want}.`, 'bad');
        } else {
          env.feedback(`${label} finns inte i ${chord.name}.`, 'bad');
        }
      },
    });

    // ---- Komp: samma som i triadövningarna ----
    const bus = audio.createBus(0.6);

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

    const scheduleBar = (bar, t0, from = 0, to = STEPS_PER_BAR) => {
      for (let s = from; s < to; s++) playStep(bar, s, t0 + s * stepDur, waitMode && s === 0);
      bars[bar] = { start: t0 };
    };

    const scheduleNext = (bar, t0) => {
      if (bar >= totalBars) scheduleEnding(t0);
      else scheduleBar(bar, t0, 0, waitMode ? 1 : STEPS_PER_BAR);
    };

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
      renderSteps(cur);
      if (waitMode) {
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
      step = 0;
      last = null;
      complete = false;
      waitingNow = false;
      barHeardAt = audio.heardNow;
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
      renderSteps(bar);
      loopEl.textContent = `Varv ${Math.floor(bar / CHORDS) + 1}/${LOOPS}`;
      env.feedback('', '');
    };

    renderSteps(0);
    env.feedback('Orientera dig på greppbrädan och tryck Redo.', '');
    env.setTimer(0);

    let startAt = 0;
    let raf = 0;
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
        if (waitMode && !complete) into = Math.min(into, stepDur);
        chip.querySelector('i').style.width = `${Math.min(1, Math.max(0, into) / barDur) * 100}%`;
        if (waitMode && !complete && !waitingNow && into >= stepDur) {
          waitingNow = true;
          chip.classList.add('waiting');
          env.feedback(`Musiken väntar – spela arpeggiot i ${chordOf(cur).name}.`, 'near');
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function finish() {
      if (cur >= 0 && !complete) score.missed++;
      const seconds = Math.round(endAt - startAt);
      const dirText = { up: 'uppåt', down: 'nedåt', mixed: 'växlande' }[opts.dir] || 'uppåt';
      stop();
      env.finish({
        title: 'Arpeggios i tonart',
        note: `${chords.map((c) => c.name).join(' – ')} · band ${fretStart}–${fretEnd} · `
          + `tonart ${keyName(chords[0].key)} · ${dirText} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
        stats: [
          { label: `Klara arpeggios (av ${totalBars})`, value: score.hits, kind: 'good' },
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
