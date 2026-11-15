// Musikteori-hjälpare. Strängindex: 0 = ljusa e ... 5 = låga E.

export const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const OPEN_MIDI = [64, 59, 55, 50, 45, 40];
export const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

export const pc = (midi) => ((midi % 12) + 12) % 12;
export const midiAt = (string, fret) => OPEN_MIDI[string] + fret;
export const noteName = (p, flats = false) => (flats ? FLAT : SHARP)[pc(p)];
export const isAccidental = (p) => SHARP[pc(p)].length > 1;

/** Alla lägen (sträng, band) där tonklassen finns inom givna strängar och band. */
export function positionsOf(pitchClass, strings, fretStart, fretEnd) {
  const out = [];
  for (const string of strings) {
    for (let fret = fretStart; fret <= fretEnd; fret++) {
      if (pc(midiAt(string, fret)) === pitchClass) out.push({ string, fret });
    }
  }
  return out;
}

/**
 * De lägen som ligger närmast `from` (minsta bandavstånd).
 * Utan `from` (första tonen) räknas alla lägen som lika bra.
 */
export function nearestPositions(candidates, from) {
  if (!from) return candidates.slice();
  const dist = (p) => Math.abs(p.fret - from.fret);
  const best = Math.min(...candidates.map(dist));
  return candidates.filter((p) => dist(p) === best);
}

export const samePos = (a, b) => a.string === b.string && a.fret === b.fret;

// ---- Ackord & ackordföljder (övning 2) ----

const DEGREES = {
  I: { semis: 0, minor: false },
  ii: { semis: 2, minor: true },
  iii: { semis: 4, minor: true },
  IV: { semis: 5, minor: false },
  V: { semis: 7, minor: false },
  vi: { semis: 9, minor: true },
};

export const PROGRESSIONS = [
  ['I', 'V', 'vi', 'IV'],
  ['I', 'vi', 'IV', 'V'],
  ['vi', 'IV', 'I', 'V'],
  ['ii', 'V', 'I', 'vi'],
  ['I', 'IV', 'V', 'IV'],
  ['I', 'iii', 'IV', 'V'],
  ['vi', 'ii', 'V', 'I'],
  ['I', 'IV', 'vi', 'V'],
];

// Durtonarter med rimlig stavning (b-tonarter stavas med b-förtecken).
export const KEYS = [
  { root: 0, flats: false }, // C
  { root: 7, flats: false }, // G
  { root: 2, flats: false }, // D
  { root: 9, flats: false }, // A
  { root: 4, flats: false }, // E
  { root: 5, flats: true }, // F
  { root: 10, flats: true }, // Bb
  { root: 3, flats: true }, // Eb
];

export function buildProgression(key, degrees) {
  return degrees.map((d) => {
    const deg = DEGREES[d];
    const root = pc(key.root + deg.semis);
    return {
      root,
      minor: deg.minor,
      name: noteName(root, key.flats) + (deg.minor ? 'm' : ''),
      third: pc(root + (deg.minor ? 3 : 4)),
      fifth: pc(root + 7),
    };
  });
}

export const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];

// ---- Ackordföljder med dur, moll och dim (övning 4) ----
// Följden byggs som en slumpvandring genom funktionsharmonik i en durtonart:
// varje steg vet vilka ackord som brukar komma efter. Dim-ackorden (dim7) är
// ledtonsackord som löser upp sig ett halvt tonsteg upp. Ibland byts tonart via
// den nya tonartens V eller vii°7, som sedan löser upp sig dit – så låter det
// fortfarande som musik även när tonarten flyttar sig.

export const QUALITY = {
  maj: { intervals: [0, 4, 7], suffix: '', labels: ['1', '3', '5'], need: 3 },
  min: { intervals: [0, 3, 7], suffix: 'm', labels: ['1', '♭3', '5'], need: 3 },
  dim: { intervals: [0, 3, 6, 9], suffix: '°7', labels: ['1', '♭3', '♭5', '♭♭7'], need: 3 },
  // Skalans egen vii° (t.ex. B–D–F i C dur), används när följden håller sig i en tonart.
  dim3: { intervals: [0, 3, 6], suffix: '°', labels: ['1', '♭3', '♭5'], need: 3 },
};

// Tonarter som stavas med b: F, B♭, E♭, A♭, D♭.
const FLAT_KEYS = new Set([5, 10, 3, 8, 1]);

const STEPS = {
  I: { semis: 0, q: 'maj', next: { IV: 3, V: 3, vi: 3, ii: 2, iii: 1, '♯i°': 1.2, '♯iv°': 0.6 } },
  ii: { semis: 2, q: 'min', next: { V: 4, 'vii°': 1.5, IV: 1, '♯iv°': 0.6 } },
  iii: { semis: 4, q: 'min', next: { vi: 3, IV: 2, ii: 1 } },
  IV: { semis: 5, q: 'maj', next: { V: 3, I: 2, ii: 1, '♯iv°': 1.5, 'vii°': 1, vi: 1 } },
  V: { semis: 7, q: 'maj', next: { I: 4, vi: 2, '♯v°': 0.8 } },
  vi: { semis: 9, q: 'min', next: { IV: 3, ii: 2, V: 2, iii: 1, '♯iv°': 0.5 } },
  'vii°': { semis: 11, q: 'dim', next: { I: 4, iii: 0.5 } },
  '♯i°': { semis: 1, q: 'dim', next: { ii: 1 } }, // C – C♯°7 – Dm
  '♯iv°': { semis: 6, q: 'dim', next: { V: 3, I: 0.6 } }, // F – F♯°7 – G
  '♯v°': { semis: 8, q: 'dim', next: { vi: 1 } }, // G – G♯°7 – Am
};

// Tonartsbyten (halvtoner upp) med vikter: närliggande tonarter oftast.
const MODULATIONS = { 7: 3, 5: 3, 2: 2, 10: 1.2, 3: 1, 9: 1, 8: 1, 1: 0.5 };
const MOD_WEIGHT = 0.12; // andel av vikten som går till tonartsbyten

function makeChord(key, deg, diatonic = false) {
  const st = STEPS[deg];
  const root = pc(key + st.semis);
  const q = QUALITY[diatonic && st.q === 'dim' ? 'dim3' : st.q];
  // Höjda dim-ackord (♯iv° osv.) stavas med ♯, övriga efter tonarten.
  const flats = deg.startsWith('♯') ? false : FLAT_KEYS.has(key);
  return {
    key,
    deg,
    root,
    quality: st.q,
    flats,
    name: noteName(root, flats) + q.suffix,
    pcs: q.intervals.map((i) => pc(root + i)),
    labels: q.labels,
    need: q.need,
  };
}

const sameChord = (a, b) => a.root === b.root && a.quality === b.quality;

function options(ch, diatonic = false) {
  const out = Object.entries(STEPS[ch.deg].next)
    // I en tonart: bara skalans egna ackord, inga höjda dim-ackord.
    .filter(([deg]) => !diatonic || !deg.startsWith('♯'))
    .map(([deg, w]) => ({ key: ch.key, deg, w, mod: false }));
  if (!diatonic && ch.quality !== 'dim') {
    // Dim-ackord måste lösas upp – tonartsbyten görs bara från dur/moll.
    const base = out.reduce((s, o) => s + o.w, 0) * MOD_WEIGHT;
    const modSum = Object.values(MODULATIONS).reduce((s, w) => s + w, 0);
    for (const [d, w] of Object.entries(MODULATIONS)) {
      const key = pc(ch.key + Number(d));
      out.push({ key, deg: 'V', w: (base * w * 0.7) / modSum, mod: true });
      out.push({ key, deg: 'vii°', w: (base * w * 0.3) / modSum, mod: true });
    }
  }
  return out.filter((o) => !sameChord(makeChord(o.key, o.deg, diatonic), ch));
}

function weighted(list, rnd) {
  let r = rnd() * list.reduce((s, o) => s + o.w, 0);
  for (const o of list) if ((r -= o.w) < 0) return o;
  return list[list.length - 1];
}

/**
 * Slumpar en ackordföljd på `length` ackord som går att spela på repeat:
 * sista ackordet leder tillbaka till det första. Innehåller dur, moll och 1–2 dim.
 * Med `diatonic` håller sig följden i en durtonart och använder bara skalans sju
 * ackord (vii° som vanlig dim-triad). Då måste något ackord komma igen, men aldrig
 * två gånger i rad.
 */
export function randomTriadProgression(length = 8, rnd = Math.random, { diatonic = false } = {}) {
  for (let tries = 0; tries < 20000; tries++) {
    const key = Math.floor(rnd() * 12);
    const chords = [makeChord(key, rnd() < 0.75 ? 'I' : 'vi', diatonic)];
    let mods = 0;
    for (let i = 1; i < length; i++) {
      const o = weighted(options(chords[i - 1], diatonic), rnd);
      if (o.mod) mods++;
      chords.push(makeChord(o.key, o.deg, diatonic));
    }
    const last = chords[length - 1];
    const loops = options(last, diatonic).some((o) => !o.mod && sameChord(makeChord(o.key, o.deg, diatonic), chords[0]))
      || (last.deg === 'V' || last.deg === 'vii°') && pc(last.key - chords[0].root) === 0;
    if (!loops || sameChord(last, chords[0])) continue;
    const count = (q) => chords.filter((c) => c.quality === q).length;
    if (count('maj') < 2 || count('min') < 2 || count('dim') < 1 || count('dim') > 2) continue;
    // Varje ackord får bara förekomma en gång. Dim7 är symmetriska (B°7 = D°7 = F°7 = G♯°7),
    // så ackord jämförs på sina toner, inte på namnet.
    const sound = (c) => [...c.pcs].sort((a, b) => a - b).join(',');
    const distinct = new Set(chords.map(sound)).size;
    if (diatonic) {
      // 8 ackord ur en skala med 7: minst 6 olika, inget fler än två gånger.
      const most = Math.max(...chords.map((c) => chords.filter((d) => sound(d) === sound(c)).length));
      if (distinct < Math.min(6, length) || most > 2) continue;
    } else if (distinct < length || mods > 2) continue;
    return chords;
  }
  if (diatonic) {
    // Reserv i C dur: C – Am – F – Dm – G – Em – Am – G (G leder tillbaka till C).
    return ['I', 'vi', 'IV', 'ii', 'V', 'iii', 'vi', 'V'].map((d) => makeChord(0, d, true));
  }
  // Reserv (bör aldrig behövas): C – C♯°7 – Dm – G – Am – F – F♯°7 – G
  return ['I', '♯i°', 'ii', 'V', 'vi', 'IV', '♯iv°', 'V'].map((d) => makeChord(0, d));
}

export const keyName = (key) => noteName(key, FLAT_KEYS.has(key));
