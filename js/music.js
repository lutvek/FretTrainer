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
