// Övning 10: Intervall – en starton tänds på greppbrädan, hitta tonen ett visst intervall upp
// (eller ned) från den, innan tiden tar slut. Exakt tonhöjd räknas: rätt ton i fel oktav är fel.

import { audio, Scheduler } from './audio.js';
import { Fretboard } from './fretboard.js';
import { midiAt, pc } from './music.js';

const FRET_START = 0;
const FRET_END = 12;
const STRINGS = [0, 1, 2, 3, 4, 5];
const BPM = 100;
const STEPS_PER_BAR = 8; // åttondelar
const COUNT_IN_STEPS = 8;
const ROUNDS = 16;
const REACH = 4; // målet ska gå att nå inom så här många band från startonen

// semis: halvtoner, deg: tonsteg (1 = prim) – används för att stava måltonen rätt.
const INTERVALS = [
  { semis: 1, deg: 2, short: '♭2', name: 'liten sekund' },
  { semis: 2, deg: 2, short: '2', name: 'stor sekund' },
  { semis: 3, deg: 3, short: '♭3', name: 'liten ters' },
  { semis: 4, deg: 3, short: '3', name: 'stor ters' },
  { semis: 5, deg: 4, short: '4', name: 'ren kvart' },
  { semis: 6, deg: 5, alt: 4, short: '♭5', name: 'tritonus' }, // stavas som ♭5 eller ♯4
  { semis: 7, deg: 5, short: '5', name: 'ren kvint' },
  { semis: 8, deg: 6, short: '♭6', name: 'liten sext' },
  { semis: 9, deg: 6, short: '6', name: 'stor sext' },
  { semis: 10, deg: 7, short: '♭7', name: 'liten septima' },
  { semis: 11, deg: 7, short: '7', name: 'stor septima' },
  { semis: 12, deg: 8, short: '8', name: 'oktav' },
];
const BASIC = new Set([3, 4, 5, 7, 12]); // terser, kvart, kvint, oktav
const bySemis = new Map(INTERVALS.map((iv) => [iv.semis, iv]));

// Stavning: bokstav + förtecken, så att t.ex. liten ters från C blir E♭ och inte D♯.
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ACC = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
const ODD = new Set(['E♯', 'B♯', 'F♭', 'C♭']);
const wrap = (d) => ((((d + 6) % 12) + 12) % 12) - 6; // -6..5
const spell = (letter, p) => {
  const acc = wrap(p - LETTER_PC[letter]);
  return Math.abs(acc) > 2 ? null : { letter, acc, text: LETTERS[letter] + ACC[acc] };
};
// Stavningar för en tonklass utan dubbelförtecken (naturliga toner bara en).
const spellings = (p) => [0, 1, 2, 3, 4, 5, 6]
  .map((l) => spell(l, p))
  .filter((s) => s && Math.abs(s.acc) <= 1)
  .sort((a, b) => Math.abs(a.acc) - Math.abs(b.acc))
  .filter((s, i, all) => Math.abs(s.acc) === Math.abs(all[0].acc));

const fmtSec = (s) => `${s.toFixed(1).replace('.', ',')} s`;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const posKey = (p) => `${p.string}-${p.fret}`;

/** Alla lägen inom band 0–12 där exakt den här tonhöjden finns. */
const placesOf = (midi) => STRINGS.flatMap((string) => {
  const fret = midi - midiAt(string, 0);
  return fret >= FRET_START && fret <= FRET_END ? [{ string, fret }] : [];
});

export const ex10 = {
  id: 'intervals',
  title: 'Intervall',
  desc: 'En starton tänds på greppbrädan – hitta tonen ett visst intervall från den, i rätt oktav, innan tiden tar slut. 16 intervall i trumkomp. Vanliga = terser, kvart, kvint och oktav.',
  options: [
    {
      key: 'set',
      label: 'Intervall',
      default: 'basic',
      choices: [
        { value: 'basic', label: 'Vanliga' },
        { value: 'all', label: 'Alla 12' },
      ],
    },
    {
      key: 'dir',
      label: 'Riktning',
      default: 'up',
      choices: [
        { value: 'up', label: 'Uppåt' },
        { value: 'both', label: 'Upp & ned' },
      ],
    },
    {
      key: 'bars',
      label: 'Tid per intervall',
      default: '2',
      choices: [
        { value: '2', label: '2 takter' },
        { value: '1', label: '1 takt' },
      ],
    },
  ],

  start(env, opts) {
    const pool = opts.set === 'all' ? INTERVALS : INTERVALS.filter((iv) => BASIC.has(iv.semis));
    const dirs = opts.dir === 'both' ? [1, -1] : [1];
    const BARS = Number(opts.bars) || 2;
    const stepDur = 60 / BPM / 2;
    const barDur = STEPS_PER_BAR * stepDur;

    const score = { right: 0, wrong: 0, late: 0 };
    const times = []; // svarstider för rätta svar
    const byInterval = new Map(); // intervall → svarstider (rätta svar)
    const missed = new Map(); // intervall → antal fel/för sent
    let round = 0;
    let q = null; // { root, rootMidi, iv, dir, targetMidi, rootName, targetName, flats, places }
    let tried = false; // har ett fel gjorts i aktuellt intervall?
    let accepting = false;
    let roundStart = 0;
    let roundEnd = 0;
    let nextStart = 0;
    let finishAt = null;
    let done = false;

    env.hud.innerHTML = `
      <div class="hud-main">
        <div class="hud-label">Intervall · <span id="ex10-round">–</span> · <span id="ex10-name">…</span></div>
        <div class="target-row">
          <div class="target-note" id="ex10-target">…</div>
          <div class="next-note">från <b id="ex10-root">…</b></div>
        </div>
        <div class="round-progress"><i id="ex10-progress"></i></div>
      </div>
      <div class="hud-side">
        <div class="pill good" title="Rätt">✓ <b id="ex10-right">0</b></div>
        <div class="pill bad" title="Fel">✗ <b id="ex10-wrong">0</b></div>
        <div class="pill near" title="För sent">⏱ <b id="ex10-late">0</b></div>
      </div>`;
    const $ = (id) => env.hud.querySelector(`#ex10-${id}`);
    const updateScore = () => {
      for (const k of Object.keys(score)) $(k).textContent = score[k];
    };
    const dirWord = (d) => (d > 0 ? 'upp' : 'ned');
    const ivLabel = (iv, d) => `${iv.short}${d > 0 ? '↑' : '↓'}`;
    // Namn på en tryckt ton: stavas med ♭ eller ♯ efter aktuell fråga.
    const noteText = (p) => {
      const s = spellings(p);
      return (s.find((x) => (q.flats ? x.acc <= 0 : x.acc >= 0)) || s[0]).text;
    };

    // Slumpa starton + intervall så att målet finns inom räckhåll (REACH band) och
    // båda tonerna går att stava utan dubbelförtecken.
    let prevRoot = null;
    let prevIv = null;
    const pickQuestion = () => {
      for (let tries = 0; tries < 500; tries++) {
        const iv = pool[Math.floor(Math.random() * pool.length)];
        if (pool.length > 1 && iv === prevIv && tries < 400) continue;
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const root = { string: STRINGS[Math.floor(Math.random() * 6)], fret: Math.floor(Math.random() * (FRET_END + 1)) };
        const rootMidi = midiAt(root.string, root.fret);
        if (prevRoot !== null && pc(rootMidi) === prevRoot && tries < 400) continue;
        const targetMidi = rootMidi + dir * iv.semis;
        const places = placesOf(targetMidi).filter((p) => posKey(p) !== posKey(root));
        if (!places.some((p) => Math.abs(p.fret - root.fret) <= REACH)) continue;
        const rs = spellings(pc(rootMidi));
        const rootSp = rs[Math.floor(Math.random() * rs.length)];
        // Enklaste stavningen av målet; udda namn som E♯ och C♭ undviks.
        const targetSp = [iv.deg, iv.alt].filter(Boolean)
          .map((deg) => spell((((rootSp.letter + dir * (deg - 1)) % 7) + 7) % 7, pc(targetMidi)))
          .filter((sp) => sp && Math.abs(sp.acc) <= 1 && !ODD.has(sp.text))
          .sort((a, b) => Math.abs(a.acc) - Math.abs(b.acc))[0];
        if (!targetSp) continue;
        prevRoot = pc(rootMidi);
        prevIv = iv;
        return {
          root, rootMidi, iv, dir, targetMidi, places,
          rootName: rootSp.text,
          targetName: targetSp.text,
          flats: rootSp.acc < 0 || targetSp.acc < 0,
        };
      }
      // Reserv (bör aldrig behövas): stor ters upp från C på A-strängen.
      const root = { string: 4, fret: 3 };
      return {
        root, rootMidi: 48, iv: bySemis.get(4), dir: 1, targetMidi: 52, places: placesOf(52),
        rootName: 'C', targetName: 'E', flats: false,
      };
    };

    const board = new Fretboard(env.board, {
      fretStart: FRET_START,
      fretEnd: FRET_END,
      activeStrings: STRINGS,
      canJudge: () => !done && accepting,
      isHit: (pos) => midiAt(pos.string, pos.fret) === q.targetMidi,
      play(pos, how) {
        if (done) return null;
        const midi = midiAt(pos.string, pos.fret);
        if (q && posKey(pos) !== posKey(q.root)) {
          board.setMarker('free', { ...pos, label: noteText(pc(midi)), kind: 'neutral', ttl: 400 });
        }
        return audio.fretNote(midi, how);
      },
      judge(tap) {
        if (posKey(tap) === posKey(q.root)) return; // startonen själv räknas inte
        const midi = midiAt(tap.string, tap.fret);
        board.removeMarker('free');
        const elapsed = audio.heardNow - startAt;
        if (midi === q.targetMidi) {
          const t = Math.max(0, elapsed - roundStart);
          score.right++;
          if (!tried) {
            times.push(t);
            if (!byInterval.has(q.iv)) byInterval.set(q.iv, []);
            byInterval.get(q.iv).push(t);
          }
          board.removeMarker('bad');
          board.setMarker('target', { ...tap, label: q.targetName, kind: 'good' });
          audio.pluck(q.rootMidi, 0, 0.6); // starton + mål klingar ihop
          $('target').className = 'target-note answer right';
          env.feedback(`Rätt – ${q.iv.name} ${dirWord(q.dir)} från ${q.rootName} är ${q.targetName} (${fmtSec(t)}).`, 'good');
          endRound(elapsed);
          return;
        }
        score.wrong++;
        if (!tried) missed.set(q.iv, (missed.get(q.iv) || 0) + 1);
        tried = true;
        updateScore();
        const label = noteText(pc(midi));
        board.setMarker('bad', { ...tap, label, kind: 'bad', ttl: 800 });
        const diff = midi - q.rootMidi;
        if (pc(midi) === pc(q.targetMidi)) {
          env.feedback(`Rätt ton (${label}) men fel oktav – ${dirWord(q.dir)} från startonen.`, 'bad');
        } else if (diff !== 0 && bySemis.has(Math.abs(diff))) {
          env.feedback(`Fel – det där var ${bySemis.get(Math.abs(diff)).name} ${dirWord(diff)} (${label}).`, 'bad');
        } else {
          env.feedback(`Fel – det där var ${label}.`, 'bad');
        }
      },
    });

    const startRound = (at) => {
      round++;
      q = pickQuestion();
      tried = false;
      board.clearMarkers();
      board.setMarker('root', { ...q.root, label: q.rootName, kind: 'start' });
      audio.pluck(q.rootMidi);
      roundStart = at;
      roundEnd = at + BARS * barDur;
      accepting = true;
      const targetEl = $('target');
      targetEl.textContent = ivLabel(q.iv, q.dir);
      targetEl.className = 'target-note';
      void targetEl.offsetWidth;
      targetEl.classList.add('pop');
      $('root').textContent = q.rootName;
      $('name').textContent = `${q.iv.name} ${dirWord(q.dir)}`;
      $('round').textContent = `${round}/${ROUNDS}`;
      env.feedback(`Hitta ${q.iv.name} ${dirWord(q.dir)} från ${q.rootName}.`, '');
    };

    // Avsluta intervallet och lägg nästa på en kommande taktetta.
    const endRound = (elapsed, late = false) => {
      accepting = false;
      board.removeMarker('free');
      if (late) {
        board.removeMarker('bad');
        // Visa de lägen som ligger närmast startonen.
        const dist = (p) => Math.abs(p.fret - q.root.fret) + Math.abs(p.string - q.root.string) * 0.5;
        const best = Math.min(...q.places.map(dist));
        q.places.filter((p) => dist(p) <= best + 1)
          .forEach((p) => board.setMarker(`h${posKey(p)}`, { ...p, label: q.targetName, kind: 'hint' }));
        audio.pluck(q.targetMidi);
      }
      updateScore();
      const minGap = late ? barDur / 2 : barDur / 4;
      const bar = Math.ceil((elapsed + minGap) / barDur);
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
        if (accepting && elapsed >= roundEnd) {
          score.late++;
          if (!tried) missed.set(q.iv, (missed.get(q.iv) || 0) + 1);
          $('target').className = 'target-note answer late';
          env.feedback(`För sent – ${q.iv.name} ${dirWord(q.dir)} från ${q.rootName} är ${q.targetName} (streckad).`, 'near');
          endRound(elapsed, true);
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
        stats.push({ label: 'Mediantid, rätt direkt', value: fmtSec(median(times)), kind: '' });
      }
      let note = `${ROUNDS} intervall · ${opts.set === 'all' ? 'alla intervall' : 'ters, kvart, kvint, oktav'} · ${dirs.length > 1 ? 'upp & ned' : 'uppåt'} · ${BARS} ${BARS === 1 ? 'takt' : 'takter'} per intervall`;
      // Svårast: flest missar, annars långsammast (median, minst två rätta svar).
      const worst = [...missed.entries()].sort((a, b) => b[1] - a[1])[0];
      const slow = [...byInterval.entries()].filter(([, ts]) => ts.length >= 2)
        .map(([iv, ts]) => [iv, median(ts)]).sort((a, b) => b[1] - a[1]);
      if (worst) note += ` · svårast: ${worst[0].name} (${worst[1]} miss${worst[1] === 1 ? '' : 'ar'})`;
      else if (slow.length >= 2) note += ` · långsammast: ${slow[0][0].name} (${fmtSec(slow[0][1])})`;
      env.finish({ title: 'Intervall', note, stats });
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
