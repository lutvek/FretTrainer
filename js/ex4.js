// Övning 4: triader på de tre ljusaste strängarna (G, B, e) i en position.
// En ackordföljd på 8 ackord (dur, moll, dim7) går 4 varv i 90 bpm, en takt per ackord.
// Spelaren ska hitta alla tre tonerna i ackordet (3 av 4 för dim7). Hinner man inte
// före taktens slut pausas komp och trummor tills alla toner är hittade.

import { audio } from './audio.js';
import { Fretboard } from './fretboard.js';
import { keyName, midiAt, noteName, pc, randomTriadProgression } from './music.js';

const BPM = 90;
const STEPS_PER_BAR = 8; // åttondelar i en 4/4-takt
const LOOPS = 4;
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

export const ex4 = {
  id: 'triads-gbe',
  title: 'Triader på G, B & e',
  desc: 'En ackordföljd på 8 ackord – dur, moll och dim7 (°7), ibland med tonartsbyte – går 4 varv i 90 bpm, en takt per ackord. Spela ackordets alla tre toner (3 av 4 för °7) på G-, B- och e-strängen i positionen. Hinner du inte pausas takten tills du hittat dem.',
  options: [],

  start(env) {
    const chords = randomTriadProgression(CHORDS);
    const fretStart = 1 + Math.floor(Math.random() * 10); // position 1–10
    const fretEnd = fretStart + WINDOW_FRETS - 1;
    const totalBars = LOOPS * CHORDS;
    const stepDur = 60 / BPM / 2;
    const barDur = STEPS_PER_BAR * stepDur;

    // Komp-voicings räknas fram en gång och följer varandra runt hela loopen.
    let v = null;
    for (let pass = 0; pass < 2; pass++) chords.forEach((c) => { v = c.voicing = voice(c.pcs, v); });

    const score = { onTime: 0, paused: 0, wrong: 0 };
    const bars = []; // { start } i ljudklockans tid, en per inplanerad takt
    let cur = -1; // takten som hörs just nu
    let found = new Map(); // tonklass → läge
    let complete = false;
    let pausedNow = false;
    let wasPaused = false;
    let done = false;
    let endAt = null;

    env.hud.innerHTML = `
      <div class="hud-main">
        <div class="hud-label">Band ${fretStart}–${fretEnd} · G, B, e · <span id="ex4-loop">Varv 1/${LOOPS}</span></div>
        <div class="target-row">
          <div class="target-note" id="ex4-chord">${chords[0].name}</div>
          <div class="tone-slots" id="ex4-slots"></div>
          <div class="next-note ex4-next">Nästa <b id="ex4-next">…</b></div>
        </div>
      </div>
      <div class="chord-strip eight">
        ${chords.map((c, i) => `
          <div class="chord-chip" data-i="${i}">
            <div class="chord-name">${c.name}</div>
            <div class="chord-progress"><i></i></div>
          </div>`).join('')}
      </div>`;
    const chordEl = env.hud.querySelector('#ex4-chord');
    const slotsEl = env.hud.querySelector('#ex4-slots');
    const nextEl = env.hud.querySelector('#ex4-next');
    const loopEl = env.hud.querySelector('#ex4-loop');
    const chips = [...env.hud.querySelectorAll('.chord-chip')];

    const chordOf = (bar) => chords[bar % CHORDS];

    const renderSlots = (chord) => {
      slotsEl.innerHTML = chord.pcs.map((p, i) => {
        const hit = found.has(p);
        return `<span class="slot${hit ? ' found' : ''}">${hit ? noteName(p, chord.flats) : chord.labels[i]}</span>`;
      }).join('') + (chord.need < chord.pcs.length ? '<span class="slot-note">3 av 4</span>' : '');
    };

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
        renderSlots(chord);
        if (found.size >= chord.need) onComplete();
        else env.feedback(`${label} ✓`, 'good');
      },
    });

    // ---- Komp: en takt schemaläggs i taget, först när förra ackordet är klart ----
    const bus = audio.createBus(0.6);

    const scheduleBar = (bar, t) => {
      const chord = chordOf(bar);
      const next = chordOf(bar + 1);
      const root = bassNote(chord.root);
      const fifth = root + (chord.quality === 'dim' ? 6 : 7);
      let approach = bassNote(next.root) - 1;
      if (approach < 33) approach += 2;
      for (let s = 0; s < STEPS_PER_BAR; s++) audio.drumStep(s, t + s * stepDur, bus);
      audio.chord(chord.voicing, t, stepDur * 2.8, bus);
      audio.chord(chord.voicing, t + 3 * stepDur, stepDur * 4.6, bus);
      audio.bass(root, t, stepDur * 2.6, bus);
      audio.bass(root, t + 3 * stepDur, stepDur * 0.9, bus);
      audio.bass(fifth, t + 4 * stepDur, stepDur * 1.8, bus);
      audio.bass(root + 12, t + 6 * stepDur, stepDur * 0.9, bus);
      audio.bass(approach, t + 7 * stepDur, stepDur * 0.9, bus);
      bars[bar] = { start: t };
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
      if (wasPaused) score.paused++;
      else score.onTime++;
      chips[cur % CHORDS].classList.add('found');
      // Nästa takt börjar när den här tar slut – eller direkt om takten redan väntar.
      const t = Math.max(bars[cur].start + barDur, audio.now + LEAD);
      if (cur + 1 < totalBars) scheduleBar(cur + 1, t);
      else scheduleEnding(t);
      if (pausedNow) {
        pausedNow = false;
        env.feedback(`${chord.name} klart – vi kör vidare!`, 'good');
      } else {
        env.feedback(`${chord.name} klart! Spela fritt tills nästa ackord.`, 'good');
      }
    }

    const enterBar = (bar) => {
      cur = bar;
      found = new Map();
      complete = false;
      pausedNow = false;
      wasPaused = false;
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
      renderSlots(chord);
      env.feedback('', '');
    };

    // Inräkning: en takt med klick, sedan första ackordet.
    const t0 = audio.now + LEAD;
    for (let i = 0; i < 4; i++) audio.click(t0 + i * 2 * stepDur, bus);
    scheduleBar(0, t0 + barDur);
    renderSlots(chords[0]);
    nextEl.textContent = chords[1].name;
    env.feedback('Lyssna in takten …', '');
    env.setTimer(0);

    const startAt = t0 + barDur;
    let raf = requestAnimationFrame(function frame() {
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
        const into = now - bars[cur].start;
        const chip = chips[cur % CHORDS];
        chip.querySelector('i').style.width = `${Math.min(1, into / barDur) * 100}%`;
        if (!complete && into >= barDur && !pausedNow) {
          // Takten är slut men ackordet inte klart: kompet står still tills tonerna är hittade.
          pausedNow = true;
          wasPaused = true;
          chip.classList.add('waiting');
          audio.chord(chordOf(cur).voicing, audio.now, 3, bus);
          env.feedback(`Paus – hitta resten av ${chordOf(cur).name}, sedan går takten vidare.`, 'near');
        }
      }
      raf = requestAnimationFrame(frame);
    });

    function finish() {
      const seconds = Math.round(endAt - startAt);
      stop();
      const keys = [...new Set(chords.map((c) => keyName(c.key)))];
      env.finish({
        title: 'Triader på G, B & e',
        note: `${chords.map((c) => c.name).join(' – ')} · band ${fretStart}–${fretEnd} · `
          + `${keys.length > 1 ? 'tonarter' : 'tonart'} ${keys.join(', ')} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
        stats: [
          { label: `Ackord i tid (av ${totalBars})`, value: score.onTime, kind: 'good' },
          { label: 'Ackord som pausade takten', value: score.paused, kind: 'near' },
          { label: 'Feltryck', value: score.wrong, kind: 'bad' },
        ],
      });
    }

    function stop() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      audio.fadeOutBus(bus);
      board.destroy();
    }

    return { stop };
  },
};
