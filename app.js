/**
 * Jake's Wheel of Stuff — app.js
 * A spinning decision wheel for anything.
 */

// ── Constants ──────────────────────────────────────────────────
const MAX_ITEMS = 100;

// Palette: 12 distinct, vivid-but-harmonious segment colors
const SEGMENT_COLORS = [
  '#7c5cfc', '#fc5c9c', '#5cf4fc', '#fcb55c',
  '#5cfca8', '#fc5c5c', '#a35cfc', '#5c8afc',
  '#fc5ce7', '#9afc5c', '#fc935c', '#5cfcd4',
];

// ── State ──────────────────────────────────────────────────────
let items        = [];      // current wheel items
let spinning     = false;   // is the wheel currently spinning?
let currentAngle = 0;       // radians, cumulative rotation of the wheel
let animFrame    = null;    // requestAnimationFrame handle

// ── DOM refs ───────────────────────────────────────────────────
const screenSetup   = document.getElementById('screen-setup');
const screenWheel   = document.getElementById('screen-wheel');
const setupInput    = document.getElementById('setup-input');
const itemCountEl   = document.getElementById('item-count');
const startBtn      = document.getElementById('start-btn');
const clearBtn      = document.getElementById('clear-btn');
const canvas        = document.getElementById('wheel-canvas');
const ctx           = canvas.getContext('2d');
const spinHint      = document.getElementById('spin-hint');
const optionsBtn    = document.getElementById('options-btn');
const optionsPanel  = document.getElementById('options-panel');
const optionsOverlay= document.getElementById('options-overlay');
const optionsClose  = document.getElementById('options-close');
const optionsInput  = document.getElementById('options-input');
const optionsCount  = document.getElementById('options-count');
const optionsSave   = document.getElementById('options-save');
const speedSlider   = document.getElementById('speed-slider');
const winnerOverlay = document.getElementById('winner-overlay');
const winnerText    = document.getElementById('winner-text');
const confettiCanvas= document.getElementById('confetti-canvas');
const confettiCtx   = confettiCanvas.getContext('2d');

// ── Speed setting ──────────────────────────────────────────────
// Slider value 1–5 maps to spin duration in ms (slow → fast)
const SPEED_LABELS    = ['Slowest', 'Slow', 'Medium', 'Fast', 'Fastest'];
const SPEED_DURATIONS = [7500, 5500, 4000, 2500, 1500]; // ms

function getSpinDuration() {
  const idx = parseInt(speedSlider.value, 10) - 1;
  // Add small random variance (±10%) so it never feels identical
  const base = SPEED_DURATIONS[idx];
  return base * (0.9 + Math.random() * 0.2);
}


// ── Setup screen logic ─────────────────────────────────────────

/** Parse textarea into a clean array of non-empty strings, capped at MAX_ITEMS. */
function parseItems(raw) {
  return raw.split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

function updateSetupCounter() {
  const count = parseItems(setupInput.value).length;
  itemCountEl.textContent = `${count} / ${MAX_ITEMS}`;
  startBtn.disabled = count < 2;
}

setupInput.addEventListener('input', updateSetupCounter);

clearBtn.addEventListener('click', () => {
  setupInput.value = '';
  updateSetupCounter();
});

startBtn.addEventListener('click', () => {
  items = parseItems(setupInput.value);
  if (items.length < 2) return;
  showScreen('wheel');
  drawWheel();
});

// ── Screen transitions ─────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

// ── Options panel ──────────────────────────────────────────────
function openOptions() {
  optionsInput.value = items.join('\n');
  updateOptionsCounter();
  optionsOverlay.classList.remove('hidden');
  optionsPanel.classList.remove('hidden');
  // slight delay so display:flex is active before transform animates
  requestAnimationFrame(() => optionsPanel.classList.add('open'));
}

function closeOptions() {
  optionsPanel.classList.remove('open');
  setTimeout(() => {
    optionsOverlay.classList.add('hidden');
    optionsPanel.classList.add('hidden');
  }, 300);
}

function updateOptionsCounter() {
  const count = parseItems(optionsInput.value).length;
  optionsCount.textContent = `${count} / ${MAX_ITEMS}`;
}

optionsBtn.addEventListener('click', openOptions);
optionsClose.addEventListener('click', closeOptions);
optionsOverlay.addEventListener('click', closeOptions);
optionsInput.addEventListener('input', updateOptionsCounter);

optionsSave.addEventListener('click', () => {
  const newItems = parseItems(optionsInput.value);
  if (newItems.length < 2) return;
  items = newItems;
  // also keep setup textarea in sync
  setupInput.value = items.join('\n');
  updateSetupCounter();
  closeOptions();
  drawWheel();
});

// ── Wheel drawing ──────────────────────────────────────────────

/** Map item index to a segment color, cycling through the palette. */
function segmentColor(index) {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}

/**
 * Draw the wheel at the given rotation (radians).
 * The wheel is drawn so segment 0 straddles the rightmost point (where the ticker is).
 */
function drawWheel(rotation = currentAngle) {
  const size = canvas.width;
  const cx   = size / 2;
  const cy   = size / 2;
  const r    = cx - 4; // slight inset so nothing clips
  const n    = items.length;
  const arc  = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, size, size);

  items.forEach((label, i) => {
    const startAngle = rotation + i * arc;
    const endAngle   = startAngle + arc;
    const midAngle   = startAngle + arc / 2;

    // Segment fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = segmentColor(i);
    ctx.fill();

    // Subtle separator line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(midAngle);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Dynamic font size: shrink if many items
    const fontSize = Math.max(10, Math.min(18, Math.floor(r * arc * 0.45)));
    ctx.font = `600 ${fontSize}px 'Inter', sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur  = 4;

    // Truncate label if it won't fit
    const maxWidth = r * 0.7;
    ctx.fillText(label, r - 14, 0, maxWidth);
    ctx.restore();
  });

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
  ctx.fillStyle = '#0d0d12';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.15)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, 2 * Math.PI);
  ctx.fillStyle = '#7c5cfc';
  ctx.fill();
}

// ── Spin logic ─────────────────────────────────────────────────

canvas.addEventListener('click', () => {
  if (spinning) return;
  hideWinner();
  spin();
});

function spin() {
  spinning = true;
  spinHint.textContent = 'Spinning…';

  const n     = items.length;
  const arc   = (2 * Math.PI) / n;

  // Random total rotation: 5–9 full turns + a random offset
  const extraTurns  = (5 + Math.random() * 4) * 2 * Math.PI;
  const targetExtra = Math.random() * 2 * Math.PI;
  const totalDelta  = extraTurns + targetExtra;

  const duration = getSpinDuration();
  const start    = performance.now();
  const startAngle = currentAngle;

  function easeOut(t) {
    // Cubic ease-out for a natural deceleration
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(now) {
    const elapsed = now - start;
    const t       = Math.min(elapsed / duration, 1);
    const delta   = totalDelta * easeOut(t);

    currentAngle = startAngle + delta;
    drawWheel(currentAngle);

    if (t < 1) {
      animFrame = requestAnimationFrame(frame);
    } else {
      // Snap cleanly
      currentAngle = startAngle + totalDelta;
      drawWheel(currentAngle);
      onSpinEnd();
    }
  }

  animFrame = requestAnimationFrame(frame);
}

/** Determine the winning item once the wheel stops. */
function onSpinEnd() {
  spinning = false;
  spinHint.textContent = 'Click the wheel to spin';

  const n    = items.length;
  const arc  = (2 * Math.PI) / n;

  // The ticker points at angle 0 (right side of canvas).
  // Normalize wheel angle so we know which segment is at 0.
  const normalised = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // Segment i covers [i*arc, (i+1)*arc). At the ticker (angle 0 relative to wheel),
  // we need the segment whose range wraps around 0 after the rotation.
  const pointed    = (2 * Math.PI - normalised) % (2 * Math.PI);
  const winner     = items[Math.floor(pointed / arc) % n];

  showWinner(winner);
  launchConfetti();
}

// ── Winner display ─────────────────────────────────────────────
function showWinner(name) {
  winnerText.textContent = name;
  winnerOverlay.classList.remove('hidden');
}

function hideWinner() {
  winnerOverlay.classList.add('hidden');
  stopConfetti();
}

// ── Confetti ───────────────────────────────────────────────────
let confettiParticles = [];
let confettiActive    = false;
let confettiFrame     = null;

const CONFETTI_COLORS = [
  '#7c5cfc','#fc5c9c','#5cf4fc','#fcb55c',
  '#5cfca8','#c084fc','#818cf8','#67e8f9',
];

function resizeConfetti() {
  confettiCanvas.width  = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

function launchConfetti() {
  confettiParticles = [];
  confettiActive    = true;
  const count = 180;

  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x:     Math.random() * confettiCanvas.width,
      y:     -10 - Math.random() * 200,
      vx:    (Math.random() - 0.5) * 4,
      vy:    2 + Math.random() * 4,
      w:     6 + Math.random() * 8,
      h:     3 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot:   Math.random() * Math.PI * 2,
      rspd:  (Math.random() - 0.5) * 0.15,
      alpha: 1,
    });
  }

  if (confettiFrame) cancelAnimationFrame(confettiFrame);
  animateConfetti();
}

function animateConfetti() {
  if (!confettiActive) return;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  let alive = false;
  confettiParticles.forEach(p => {
    p.x   += p.vx;
    p.y   += p.vy;
    p.rot += p.rspd;
    p.vy  += 0.05; // gravity

    // Fade out when near bottom
    if (p.y > confettiCanvas.height * 0.7) {
      p.alpha = Math.max(0, p.alpha - 0.02);
    }

    if (p.alpha > 0 && p.y < confettiCanvas.height + 20) {
      alive = true;
      confettiCtx.save();
      confettiCtx.globalAlpha = p.alpha;
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confettiCtx.restore();
    }
  });

  if (alive) {
    confettiFrame = requestAnimationFrame(animateConfetti);
  } else {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiActive = false;
  }
}

function stopConfetti() {
  confettiActive = false;
  if (confettiFrame) cancelAnimationFrame(confettiFrame);
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

// ── Init ───────────────────────────────────────────────────────
updateSetupCounter();
