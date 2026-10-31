// Sound effects made with the Web Audio API: nothing to download.
// Browsers only allow audio after a click, so call init() from a click handler.

let ctx = null;
let master, engineGain, engineFilter, humGain;
let muted = false;

function noiseBuffer(seconds, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; } else { d[i] = white; }
  }
  return buf;
}

export function init() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);

  // Engine: deep rumbling noise plus a low hum, both silent until setEngine() is called.
  const rumble = ctx.createBufferSource();
  rumble.buffer = noiseBuffer(4, true);
  rumble.loop = true;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 220;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  rumble.connect(engineFilter).connect(engineGain).connect(master);
  rumble.start();

  const hum = ctx.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.value = 46;
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = "lowpass";
  humFilter.frequency.value = 160;
  humGain = ctx.createGain();
  humGain.gain.value = 0;
  hum.connect(humFilter).connect(humGain).connect(master);
  hum.start();
}

// level from 0 (silent) to 1 (full thrust)
export function setEngine(level) {
  if (!ctx) return;
  const t = ctx.currentTime;
  engineGain.gain.setTargetAtTime(0.15 + level * 0.55, t, 0.25);
  engineFilter.frequency.setTargetAtTime(160 + level * 520, t, 0.25);
  humGain.gain.setTargetAtTime(0.03 + level * 0.07, t, 0.25);
}

export function engineOff() {
  if (!ctx) return;
  const t = ctx.currentTime;
  engineGain.gain.setTargetAtTime(0, t, 0.4);
  humGain.gain.setTargetAtTime(0, t, 0.4);
}

// A rushing sweep, for a planet flying past.
export function whoosh(seconds = 1.6) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(seconds);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(250, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + seconds * 0.6);
  bp.frequency.exponentialRampToValueAtTime(400, t + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9, t + seconds * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + seconds);
}

// A soft two-note chime, for arriving at a planet.
export function chime() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [[660, 0], [990, 0.12]].forEach(([freq, delay]) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(0.25, t + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 1.4);
    o.connect(g).connect(master);
    o.start(t + delay);
    o.stop(t + delay + 1.5);
  });
}

// A short blip, for clicks.
export function blip() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(1300, t);
  o.frequency.exponentialRampToValueAtTime(700, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.12);
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
  return muted;
}
