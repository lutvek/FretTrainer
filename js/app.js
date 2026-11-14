import { audio } from './audio.js';
import { ex1, ex3, ex4 } from './ex1.js';
import { ex2 } from './ex2.js';

const exercises = [ex1, ex2, ex3, ex4];
const $ = (id) => document.getElementById(id);
const screens = { menu: $('menu'), play: $('play'), result: $('result') };

let running = null; // { exercise, opts, handle }

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
  audio.init(); // inne i ett tryck → ljudet låses upp
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
  running = { exercise, opts, handle: null };
  running.handle = exercise.start(env, opts);
}

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
  show('menu');
}

function restart() {
  if (!running) return;
  running.handle?.stop();
  start(running.exercise, running.opts);
}

$('quit').addEventListener('click', quit);
$('restart').addEventListener('click', restart);
$('to-menu').addEventListener('click', quit);
$('again').addEventListener('click', () => start(running.exercise, running.opts));

// Om appen hamnar i bakgrunden mitt i en övning: avbryt så att takt och klocka inte spårar ur.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running?.handle) quit();
});

buildMenu();
show('menu');
