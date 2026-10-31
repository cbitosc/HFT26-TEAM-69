import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import * as sfx from "./sound.js?v=17";

console.log("Celestria v1.7 loaded");
const VERSION = "17";

// ---------- planets, nearest first ----------
// Distances: NASA Exoplanet Archive (Proxima Cen b, WASP-12 b, from the data you shared),
// Gaia DR3 via Wikipedia (Kepler-452 b, HR 8799), Wikipedia (Kepler-16), littleastronomy.com (the rest).
const PLANETS = [
  { name: "Proxima Centauri b", file: "Proxima_Cen_b.glb", ly: "4.24" },
  { name: "55 Cancri e",        file: "55_Cancri_e.glb",   ly: "41" },
  { name: "GJ 1214 b",          file: "GJ_1214_b.glb",     ly: "48" },
  { name: "51 Pegasi b",        file: "51_Pegasi_b.glb",   ly: "50.5" },
  { name: "HD 189733 b",        file: "HD_189733_b.glb",   ly: "64.5" },
  { name: "K2-18 b",            file: "K2-18_b.glb",       ly: "124" },
  { name: "HR 8799 b",          file: "HR_8799_b.glb",     ly: "133" },
  { name: "Kepler-16 b",        file: "Kepler-16_b.glb",   ly: "245" },
  { name: "WASP-12 b",          file: "WASP-12_b.glb",     ly: "1,393" },
  { name: "Kepler-452 b",       file: "Kepler-452_b.glb",  ly: "1,800" },
];

// ---------- flight geometry (worked out from the ship's rotation in ship.glb) ----------
// NOSE: the direction the ship points, as set in Blender (up, right, and away from the viewer).
// SIDE: the planet passes on this side of the ship (screen right).
// SHIP_POS: where the ship permanently sits in the scene - behind the Earth's position, on the
// title camera's line of sight, so it is simply *there*, hidden by the Earth's bulk, from the
// very first frame. Nothing pops in later; the Earth drifting away is what reveals it.
const NOSE = new THREE.Vector3(0.561, 0.383, -0.7339).normalize();
const SIDE = new THREE.Vector3(0.8278, -0.2595, 0.4973).normalize();
const SHIP_POS = new THREE.Vector3(0, 0, -2.2);
const STOP = SHIP_POS.clone().addScaledVector(NOSE, 2).addScaledVector(SIDE, 2.0); // where a planet halts
const PLANET_RADIUS = 1.4;
const SHIP_SCALE = 0.8;     // ship size relative to its original fit
const EXIT_SIDE = 6;        // how far sideways a planet swings as it flies past
const APPROACH_FROM = 80;   // a planet starts this far ahead, along NOSE
const EXIT_TO = 22;         // after the stop, it travels this far past the ship
const APPROACH_SECONDS = 6;
const EXIT_SECONDS = 2.6;

// Ship view: Blender's front view (looking along -Z), as in the screenshot - translated so the
// ship's rig lives at SHIP_POS instead of the world origin. The relative camera-to-ship vector,
// and the ship's rotation, are untouched.
const SHIP_CAM_POS = SHIP_POS.clone().add(new THREE.Vector3(0.6, 0.3, 3.0));
const BASE_FOV = 65;        // vertical FOV on a 16:9 screen; wider screens keep the same width of view
const TITLE_CAM_POS = new THREE.Vector3(0, 0, 2.4);

// ---------- renderer, scene, camera ----------
const canvas = document.createElement("canvas");
document.body.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
// A filmic response curve - the single cheapest way to stop a 3D scene looking like a tech demo
// and start looking like something that was graded. Highlights roll off instead of clipping flat.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000006);
scene.fog = new THREE.FogExp2(0x000006, 0.0017); // soft depth haze, hides the streak field's far edge
const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 3000);

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(4, 3, 5);
scene.add(sun);

// ---------- post-processing: bloom + a combined vignette/grain pass ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.65, 0.78);
composer.addPass(bloomPass);

const vignetteGrain = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.55 }, uGrain: { value: 0.035 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * uVignette;
      c.rgb += (hash(vUv * (uTime + 1.0)) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
});
composer.addPass(vignetteGrain);
composer.addPass(new OutputPass());

let fovMode = "title";
function verticalFovFor(mode, aspect) {
  const baseVertical = mode === "ship" ? BASE_FOV : 45;
  const halfWidth = Math.tan(THREE.MathUtils.degToRad(baseVertical / 2)) * (16 / 9);
  // Keep the horizontal field of view fixed, so narrower screens see more height, not less width.
  return aspect >= 16 / 9 ? baseVertical : THREE.MathUtils.radToDeg(2 * Math.atan(halfWidth / aspect));
}
function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = verticalFovFor(fovMode, aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  const pr = renderer.getPixelRatio();
  bloomPass.setSize(window.innerWidth * pr, window.innerHeight * pr);
}
window.addEventListener("resize", fitCamera);

// ---------- background stars (static) and speed streaks (move during flight) ----------
{
  const n = 2500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(900);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
}

// Speed streaks: short LINE segments that elongate with speed, not round point sprites - the
// earlier dot version read as falling snow. A line only ever looks like a streak of light.
const STREAKS = 900, STREAK_BEHIND = -20, STREAK_AHEAD = 120;
const streakAnchor = new Float32Array(STREAKS * 3);       // the centre of each streak
const streakPos = new Float32Array(STREAKS * 2 * 3);       // the two endpoints actually drawn
const streakGeo = new THREE.BufferGeometry();
streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3));
const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({
  color: 0xbfe0ff, transparent: true, opacity: 0.75 }));
streaks.visible = false;
scene.add(streaks);

const tmpA = new THREE.Vector3(), tmpOff = new THREE.Vector3();
function placeStreak(i, along) {
  // a random point in a tube around the flight line, kept clear of the ship itself
  let off;
  do { off = new THREE.Vector3().randomDirection().projectOnPlane(NOSE).setLength(2 + Math.random() * 30); }
  while (off.length() < 2);
  tmpA.copy(SHIP_POS).addScaledVector(NOSE, along).add(off);
  streakAnchor.set([tmpA.x, tmpA.y, tmpA.z], i * 3);
}
for (let i = 0; i < STREAKS; i++) placeStreak(i, STREAK_BEHIND + Math.random() * (STREAK_AHEAD - STREAK_BEHIND));

let flightSpeed = 0; // units per second the world rushes past the ship
const shipAlong0 = SHIP_POS.dot(NOSE);
function moveStreaks(dt) {
  if (!streaks.visible) return;
  const step = flightSpeed * dt;
  // thin lines that lengthen with speed and shrink to near-nothing when drifting - true
  // motion blur, never a round, floating, snow-like dot.
  const halfLen = 0.03 + Math.min(flightSpeed, 90) * 0.013;
  for (let i = 0; i < STREAKS; i++) {
    tmpA.fromArray(streakAnchor, i * 3).addScaledVector(NOSE, -step);
    if (tmpA.dot(NOSE) - shipAlong0 < STREAK_BEHIND) { placeStreak(i, STREAK_AHEAD); continue; }
    streakAnchor.set([tmpA.x, tmpA.y, tmpA.z], i * 3);
    tmpOff.copy(NOSE).multiplyScalar(halfLen);
    streakPos.set([
      tmpA.x + tmpOff.x, tmpA.y + tmpOff.y, tmpA.z + tmpOff.z,
      tmpA.x - tmpOff.x, tmpA.y - tmpOff.y, tmpA.z - tmpOff.z,
    ], i * 6);
  }
  streakGeo.attributes.position.needsUpdate = true;
}

// ---------- helpers ----------
const loader = new GLTFLoader();
function load(url, onProgress) {
  return new Promise((res, rej) => loader.load(url + "?v=" + VERSION, res, onProgress, rej));
}
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);     // fast then slow: braking into a stop
const easeIn = (t) => t * t * t;                    // slow then fast: accelerating away

function tween(seconds, step, easing = smooth) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now) => {
      const raw = Math.min(1, (now - start) / (seconds * 1000));
      step(easing(raw), raw);
      if (raw < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

// A smooth, low-frequency wobble built from a few summed sine waves - reads as organic
// hand-held motion instead of the high-frequency buzz of frame-to-frame random jitter.
function smoothNoise(t, seed) {
  return Math.sin(t * 1.3 + seed) * 0.5 + Math.sin(t * 2.7 + seed * 1.7) * 0.3 + Math.sin(t * 4.1 + seed * 2.3) * 0.2;
}

// Scale a model so its bounding sphere has radius 1 and sits on the origin. Rotation is kept.
function normalise(object3d) {
  object3d.updateMatrixWorld(true);
  const sphere = new THREE.Box3().setFromObject(object3d).getBoundingSphere(new THREE.Sphere());
  object3d.position.sub(sphere.center);
  const wrapper = new THREE.Group();
  wrapper.add(object3d);
  wrapper.scale.setScalar(1 / sphere.radius);
  return wrapper;
}

// ---------- text on screen ----------
const titleEl = document.getElementById("title");
const titleHint = titleEl.querySelector("p");
const label = document.getElementById("label");
const fade = document.getElementById("fade");
const progressBar = document.getElementById("progress-bar");

function setHint(text) { titleHint.textContent = text; titleHint.classList.remove("hint-fixed"); }
function setProgress(fraction) {
  progressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
}
function revealTitle() {
  const h1 = titleEl.querySelector("h1");
  if (h1.dataset.revealed) return;
  h1.dataset.revealed = "1";
  const text = h1.textContent;
  h1.textContent = "";
  [...text].forEach((ch, i) => {
    const span = document.createElement("span");
    span.textContent = ch;
    span.style.animationDelay = `${0.55 + i * 0.07}s`;
    span.className = "letter";
    h1.appendChild(span);
  });
}
function showLabel(name, ly) {
  label.classList.remove("show");
  void label.offsetWidth; // restart the CSS animation on each new planet
  label.querySelector("h2").textContent = name;
  label.querySelector("p").textContent = ly ? ly + " light-years from Earth" : "";
  label.querySelector("small").textContent = "Click to continue";
  label.classList.add("show");
}
function hideLabel() { label.classList.remove("show"); }
async function fadeTo(opacity, seconds) {
  fade.style.transition = `opacity ${seconds}s ease`;
  fade.style.opacity = String(opacity);
  await new Promise((r) => setTimeout(r, seconds * 1000));
}

// ---------- clicks: one handler, used both to start and to continue ----------
let clickWaiter = null;
function nextClick() { return new Promise((r) => { clickWaiter = r; }); }
function onClick(e) {
  if (e && e.target && e.target.id === "mute") return;
  sfx.init();
  if (clickWaiter) { const r = clickWaiter; clickWaiter = null; sfx.blip(); r(); }
}
window.addEventListener("pointerdown", onClick);
window.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") { toggleMute(); return; }
  onClick(e);
});
const muteBtn = document.getElementById("mute");
function toggleMute() { muteBtn.textContent = sfx.toggleMute() ? "Sound: off" : "Sound: on"; }
muteBtn.addEventListener("click", (e) => { e.stopPropagation(); sfx.init(); toggleMute(); });

// Gentle parallax on the title screen only - the camera drifts a touch with the cursor,
// a cheap trick that makes a static shot feel alive. Disabled once the flight begins.
const mouse = new THREE.Vector2(0, 0);
const mouseTarget = new THREE.Vector2(0, 0);
window.addEventListener("pointermove", (e) => {
  mouseTarget.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
});

// ---------- loading ----------
let earthPivot, shipRoot, shipMixer;
const planetModels = [];
let planetsLoaded = Promise.resolve();
let spinEarth = true, earthSpinRate = 0.12;
const clock = new THREE.Clock();
let elapsed = 0;
let shake = 0;
let cameraMode = "title"; // "title" | "locked" | "ship"

async function loadAll() {
  // Rough byte budget so the bar moves at a believable pace; exact totals don't matter.
  const weights = { earth: 2.5, ship: 0.6 };
  const progress = { earth: 0, ship: 0 };
  const report = () => setProgress((progress.earth * weights.earth + progress.ship * weights.ship) /
    (weights.earth + weights.ship));

  const earthGltf = await load("models/earth.glb", (ev) => {
    if (ev.lengthComputable) { progress.earth = ev.loaded / ev.total; report(); }
  });
  earthPivot = new THREE.Group();
  earthPivot.add(normalise(earthGltf.scene));
  scene.add(earthPivot);
  progress.earth = 1; report();

  const shipGltf = await load("models/ship.glb", (ev) => {
    if (ev.lengthComputable) { progress.ship = ev.loaded / ev.total; report(); }
  });
  shipMixer = new THREE.AnimationMixer(shipGltf.scene);
  shipGltf.animations.forEach((clip) => shipMixer.clipAction(clip).play());
  shipRoot = normalise(shipGltf.scene);   // keeps the Blender rotation exactly
  shipRoot.scale.multiplyScalar(SHIP_SCALE);
  shipRoot.position.copy(SHIP_POS);
  // Visible from the very first frame: it's sitting behind the Earth, not appearing later.
  shipRoot.visible = true;
  scene.add(shipRoot);
  progress.ship = 1; report();

  planetsLoaded = Promise.all(PLANETS.map((p, i) =>
    load("models/" + p.file)
      .then((gltf) => {
        const m = normalise(gltf.scene);
        m.scale.multiplyScalar(PLANET_RADIUS);
        m.visible = false;
        scene.add(m);
        planetModels[i] = m;
      })
      .catch((err) => { console.warn("Skipping " + p.name, err); planetModels[i] = null; })
  ));
}

// ---------- main loop ----------
function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  elapsed += dt;
  vignetteGrain.uniforms.uTime.value = elapsed;
  mouse.lerp(mouseTarget, 1 - Math.pow(0.001, dt)); // smooth, frame-rate-independent easing

  if (spinEarth && earthPivot) earthPivot.rotation.y += dt * earthSpinRate; // west to east
  if (shipMixer) shipMixer.update(dt);
  moveStreaks(dt);
  planetModels.forEach((m) => { if (m && m.visible) m.rotation.y += dt * 0.15; });

  if (cameraMode === "title") {
    camera.position.set(TITLE_CAM_POS.x + mouse.x * 0.12, TITLE_CAM_POS.y - mouse.y * 0.08, TITLE_CAM_POS.z);
    camera.lookAt(mouse.x * 0.3, -mouse.y * 0.2, 0);
  } else if (cameraMode === "ship") {
    // smooth multi-axis engine wobble - never literal random jitter, so it never reads as jerky
    const k = 0.006 + shake * 0.02;
    camera.position.set(
      SHIP_CAM_POS.x + smoothNoise(elapsed * 3.1, 1.1) * k,
      SHIP_CAM_POS.y + smoothNoise(elapsed * 2.6, 7.3) * k,
      SHIP_CAM_POS.z
    );
    camera.lookAt(SHIP_CAM_POS.x, SHIP_CAM_POS.y, SHIP_CAM_POS.z - 1);
  }
  composer.render();
  requestAnimationFrame(animate);
}

// ---------- the experience ----------
async function titlePage() {
  fovMode = "title";
  fitCamera();
  cameraMode = "title";
  camera.position.copy(TITLE_CAM_POS);
  camera.lookAt(0, 0, 0);
  await nextClick();
}

async function leaveEarth() {
  document.body.classList.add("started");
  cameraMode = "locked";
  sfx.setEngine(0.3);

  // Zoom in toward the surface while the Earth spins a little faster - a slow push-in, not a
  // snap. The ship is already in the scene the whole time, directly behind the Earth on this
  // same line of sight, simply hidden by it - nothing is switched on later.
  const from = camera.position.clone();
  const to = new THREE.Vector3(0, 0, 1.3);
  await tween(3.4, (t) => {
    camera.position.lerpVectors(from, to, t);
    camera.lookAt(0, 0, 0);
    earthSpinRate = 0.12 + t * 0.25;
    sfx.setEngine(0.3 + t * 0.4);
  }, smooth);

  // The Earth falls away down-left, revealing the ship that was there all along.
  sfx.whoosh(2.4);
  const eFrom = earthPivot.position.clone();
  const eTo = new THREE.Vector3(-2.8, -2.2, 0);
  await tween(2.6, (t) => earthPivot.position.lerpVectors(eFrom, eTo, t), easeIn);
  earthPivot.visible = false;
  spinEarth = false;

  // One continuous move into the cockpit framing - no cut, no fade, just a glide.
  fovMode = "ship";
  const targetFov = verticalFovFor("ship", camera.aspect);
  streaks.visible = true;
  document.body.classList.add("flight"); // slides the letterbox bars in over the same glide
  const camFrom = camera.position.clone();
  const fovFrom = camera.fov;
  const lookFrom = new THREE.Vector3(0, 0, 0);
  const lookTo = new THREE.Vector3(SHIP_CAM_POS.x, SHIP_CAM_POS.y, SHIP_CAM_POS.z - 1);
  await tween(2.8, (t) => {
    camera.position.lerpVectors(camFrom, SHIP_CAM_POS, t);
    camera.fov = THREE.MathUtils.lerp(fovFrom, targetFov, t);
    camera.updateProjectionMatrix();
    camera.lookAt(lookFrom.clone().lerp(lookTo, t));
    flightSpeed = t * 25;
    sfx.setEngine(0.3 + t * 0.5);
  }, smooth);
  cameraMode = "ship";
  renderer.setSize(window.innerWidth, window.innerHeight); // in case the window changed mid-glide
  composer.setSize(window.innerWidth, window.innerHeight);
}

async function visitPlanet(i) {
  const planet = planetModels[i];
  const info = PLANETS[i];
  if (!planet) return;

  // Approach: the planet rushes in from far ahead and brakes smoothly to a halt beside the
  // ship - straight in, no crossing past the mark and swinging back.
  let prev = STOP.clone().addScaledVector(NOSE, APPROACH_FROM);
  planet.position.copy(prev);
  planet.visible = true;
  sfx.setEngine(0.9);
  await tween(APPROACH_SECONDS, (t, raw) => {
    const along = APPROACH_FROM * (1 - t);
    const next = STOP.clone().addScaledVector(NOSE, along);
    planet.position.copy(next);
    flightSpeed = Math.max(0.6, prev.distanceTo(next) / (1 / 60));
    prev = next;
    shake = Math.max(0, 1 - raw * 1.3);
    sfx.setEngine(0.25 + 0.65 * Math.max(0, 1 - raw));
  }, easeOut);
  planet.position.copy(STOP);

  flightSpeed = 0.6;   // drifting
  shake = 0;
  sfx.setEngine(0.2);
  sfx.chime();
  showLabel(info.name, info.ly);
  await nextClick();
  hideLabel();

  // Exit: accelerate past the planet, which sweeps by close on the right.
  sfx.whoosh(EXIT_SECONDS);
  let exitPrev = planet.position.clone();
  await tween(EXIT_SECONDS, (t, raw) => {
    const along = -EXIT_TO * t;
    const next = STOP.clone().addScaledVector(NOSE, along).addScaledVector(SIDE, EXIT_SIDE * t);
    planet.position.copy(next);
    flightSpeed = Math.max(0.6, exitPrev.distanceTo(next) / (1 / 60));
    exitPrev = next;
    shake = raw;
    sfx.setEngine(0.2 + 0.7 * raw);
  }, easeIn);
  planet.visible = false;
}

async function run() {
  await titlePage();
  await leaveEarth();
  await planetsLoaded;
  for (let i = 0; i < PLANETS.length; i++) await visitPlanet(i);

  // The ship punches away in a clean, steady sprint - no shake, no wobble - and the streaks
  // stretch into full motion blur as it vanishes into the starfield behind a fade to black.
  shake = 0;
  await tween(2.6, (t) => {
    flightSpeed = 2 + t * 70;
    sfx.setEngine(0.6 + t * 0.4);
  }, easeIn);
  await fadeTo(1, 1.3);
  flightSpeed = 0;
  sfx.engineOff();
  streaks.visible = false;

  label.querySelector("h2").textContent = "Tour complete";
  label.querySelector("p").textContent = "10 worlds, from 4.24 to 1,800 light-years away";
  label.querySelector("small").textContent = "Click to start again";
  label.classList.add("show");
  await fadeTo(0, 1.0);
  await nextClick();
  location.reload();
}

// ---------- start ----------
fitCamera();
camera.position.copy(TITLE_CAM_POS);
camera.lookAt(0, 0, 0);
animate();
setProgress(0);
if (location.protocol === "file:") {
  setHint("OPEN VIA A LOCAL SERVER - SEE README");
} else {
  loadAll()
    .then(() => { setProgress(1); titleHint.textContent = "CLICK TO BEGIN"; titleHint.classList.add("hint-fixed"); revealTitle(); })
    .then(run)
    .catch((err) => { console.error(err); setHint("COULD NOT LOAD MODELS - SEE CONSOLE"); });
}
