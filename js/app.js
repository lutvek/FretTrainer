import { audio } from './audio.js';
import { ex1, ex3 } from './ex1.js';
import { ex2 } from './ex2.js';
import { ex4 } from './ex4.js';
import { ex5, ex6 } from './ex5.js';

const exercises = [ex1, ex2, ex3, ex4, ex5, ex6];
const $ = (id) => document.getElementById(id);
const screens = { menu: $('menu'), play: $('play'), result: $('result') };

let running = null; // { exercise, opts, env, handle }

// Telefoner kör övningarna i liggande läge. Surfplattor och datorer påverkas inte.
const isPhone = () => matchMedia('(pointer: coarse)').matches
  && Math.min(screen.width, screen.height) < 600;
const portrait = matchMedia('(orientation: portrait)');
const needsRotate = () => isPhone() && portrait.matches;

// Android: helskärm + lås till liggande. iPhone saknar stöd – där visas i stället
// en "vrid telefonen"-skärm tills den står liggande.
function lockLandscape() {
  if (!isPhone()) return;
  const el = document.documentElement;
  const full = !document.fullscreenElement && el.requestFullscreen
    ? el.requestFullscreen({ navigationUI: 'hide' })
    : Promise.resolve();
  full.then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
}

function unlockOrientation() {
  try { screen.orientation?.unlock?.(); } catch { /* ok */ }
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
}

function loadOpts(ex) {
  const opts = {};
  for (const o of ex.options) {
    let v = null;
    try { v = localStorage.getItem(`ft.${ex.id}.${o.key}`); } catch { /* lagring kan vara avstängd */ }
    opts[o.key] = o.choices.some((c) => c.value === v) ? v : o.default;
  }
  return opts;
}

function buildMenu() {
  const list = $('exercise-list');
  exercises.forEach((ex, n) => {
    const opts = loadOpts(ex);
    const card = document.createElement('section');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-num">${n + 1}</div>
      <div class="card-body">
        <h2>${ex.title}</h2>
        <p>${ex.desc}</p>
        ${ex.options.map((o) => `
          <div class="option">
            <span>${o.label}</span>
            <div class="segmented" data-key="${o.key}">
              ${o.choices.map((c) => `<button data-value="${c.value}" class="${opts[o.key] === c.value ? 'on' : ''}">${c.label}</button>`).join('')}
            </div>
          </div>`).join('')}
        <button class="primary start">Starta</button>
      </div>`;
    card.querySelectorAll('.segmented').forEach((seg) => {
      seg.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        opts[seg.dataset.key] = btn.dataset.value;
        try { localStorage.setItem(`ft.${ex.id}.${seg.dataset.key}`, btn.dataset.value); } catch { /* ok */ }
        seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      });
    });
    card.querySelector('.start').addEventListener('click', () => start(ex, { ...opts }));
    list.appendChild(card);
  });
}

function start(exercise, opts) {
  audio.init(); // inne i ett tryck → ljudet låses upp (om det går)
  lockLandscape(); // också inne i trycket, krävs för helskärm
  show('play');
  $('play-title').textContent = exercise.title;
  const fb = $('feedback');
  const env = {
    hud: $('hud'),
    board: $('board'),
    setTimer(sec) {
      $('timer').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    },
    feedback(text, kind) {
      fb.textContent = text;
      fb.className = kind || '';
    },
    finish(result) {
      running.handle = null;
      showResult(result);
    },
  };
  running = { exercise, opts, env, handle: null };
  launch();
}

// Startar övningen om skärmen är liggande, annars väntar den bakom "vrid telefonen".
function launch() {
  const wait = needsRotate();
  $('rotate').hidden = !wait;
  if (!wait) running.handle = running.exercise.start(running.env, running.opts);
}

// Vrids telefonen till stående mitt i en övning avbryts den och startar om när den
// vrids tillbaka (precis som när appen hamnar i bakgrunden).
portrait.addEventListener('change', () => {
  if (!running || screens.play.hidden) return;
  if (needsRotate()) {
    running.handle?.stop();
    running.handle = null;
    $('rotate').hidden = false;
  } else if (!running.handle) {
    launch();
  }
});

function showResult(result) {
  $('result-title').textContent = result.title;
  $('result-note').textContent = result.note || '';
  $('result-stats').innerHTML = result.stats.map((s) => `
    <div class="stat ${s.kind}">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
  show('result');
}

function quit() {
  running?.handle?.stop();
  running = null;
  $('rotate').hidden = true;
  unlockOrientation();
  show('menu');
}

$('quit').addEventListener('click', quit);
$('to-menu').addEventListener('click', quit);
$('rotate-quit').addEventListener('click', quit);
$('again').addEventListener('click', () => start(running.exercise, running.opts));

// Om appen hamnar i bakgrunden mitt i en övning: avbryt så att takt och klocka inte spårar ur.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running?.handle) quit();
});

// Ljudet är valfritt – övningarna går på en egen klocka och fungerar tyst. Om telefonen
// pausat ljudet (eller ljudet slås på mitt i en övning) väcker nästa tryck det igen.
for (const type of ['pointerdown', 'touchend']) {
  document.addEventListener(type, () => {
    if (running?.handle && !audio.live) audio.init();
  }, { capture: true, passive: true });
}

buildMenu();
show('menu');
