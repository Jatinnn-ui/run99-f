/* ═══════════════════════════════════════════════════════════════
   RUN 99 — main engine
   99-second survival runner in a collapsing modern city
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

gsap.defaults({ overwrite: 'auto' });

/* ───────────────────────── CONFIG ───────────────────────── */
const CFG = {
  laneX: [-3.2, 0, 3.2],
  baseSpeed: 13.5,
  maxSpeed: 30,
  jumpVel: 8.6,
  gravity: 22.5,
  dashMult: 1.85,
  dashTime: 0.62,
  dashCooldown: 1.9,
  chunkLen: 60,
  chunkCount: 13,
  spawnAhead: 130,
  runSeconds: 99
};

const PHASES = [
  { t: 0,  code: 'SYS/01', label: 'CITY TRAFFIC AHEAD',        info: true  },
  { t: 10, code: 'WX/02',  label: 'HEAVY RAIN — LOW VISIBILITY', info: true },
  { t: 20, code: 'TRF/03', label: 'AGGRESSIVE TRAFFIC',        info: false },
  { t: 30, code: 'PWR/04', label: 'GRID BLACKOUT',             info: false },
  { t: 40, code: 'STR/05', label: 'STRUCTURAL COLLAPSE',       info: false },
  { t: 50, code: 'HYD/06', label: 'FLOOD SURGE',               info: false },
  { t: 60, code: 'GRV/07', label: 'GRAVITY ANOMALY',           info: false },
  { t: 70, code: 'GEO/08', label: 'ROAD DISTORTION',           info: false },
  { t: 80, code: 'ALL/09', label: 'MULTI-HAZARD ZONE',         info: false },
  { t: 90, code: 'SYS/99', label: 'TOTAL CITY COLLAPSE',       info: false }
];

/* ───────────────────────── DOM ───────────────────────── */
const $ = id => document.getElementById(id);
const dom = {
  canvas: $('game-canvas'), hud: $('hud'),
  cdTime: $('countdown-time'), cdFill: $('countdown-fill'),
  cdTicks: $('countdown-ticks'), cdMarks: $('countdown-phase-markers'),
  sign: $('event-sign'), signCode: $('event-sign-code'), signText: $('event-sign-text'),
  teleSpeed: $('tele-speed'), teleDist: $('tele-distance'),
  teleScore: $('tele-score'), teleCombo: $('tele-combo'),
  speedFill: $('speed-bar-fill'), comboFill: $('combo-bar-fill'),
  comboRow: document.querySelector('.combo-row'),
  threatRing: $('threat-ring'), threatPct: $('threat-pct'),
  threatInst: $('threat-instrument'), threatBlips: $('threat-blips'),
  routeLanes: [...document.querySelectorAll('.route-lane')],
  ticker: $('bonus-ticker'), instWarn: $('instability-warning'), instPct: $('instability-pct'),
  envRain: $('env-rain-edge'), envBlackout: $('env-blackout-edge'),
  envFlood: $('env-flood-edge'), envCollapse: $('env-collapse-edge'), envFlash: $('env-damage-flash'),
  title: $('title-screen'), titleBest: $('title-best'), btnStart: $('btn-start'),
  death: $('death-screen'), deathTime: $('death-time'), deathCause: $('death-cause'), btnRetry: $('btn-retry'),
  result: $('result-screen'), resultInner: $('result-inner'),
  resTime: $('result-time'), resDist: $('res-distance'), resScore: $('res-score'),
  resBest: $('res-best'), resEvents: $('res-events'), resNM: $('res-nearmiss'),
  resNew: $('res-newbest'), btnAgain: $('btn-again')
};

/* ───────────────────────── RENDERER / SCENE ───────────────────────── */
const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const DEFAULTS = { bg: new THREE.Color(0x2c3138), fog: 0.0105, hemi: 0.55, dir: 0.85, exposure: 1.0 };
scene.background = DEFAULTS.bg.clone();
scene.fog = new THREE.FogExp2(0x2c3138, DEFAULTS.fog);

const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 400);

const hemi = new THREE.HemisphereLight(0x9aa7b5, 0x3a3c3e, DEFAULTS.hemi);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xdfe6ee, DEFAULTS.dir);
dir.position.set(-30, 60, -20);
scene.add(dir);
const playerLight = new THREE.PointLight(0xcfe0f0, 0, 14, 2); // blackout companion
scene.add(playerLight);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ───────────────────────── WORLD : chunks ───────────────────────── */
const world = new THREE.Group();
scene.add(world);
const chunks = [];

function buildChunk(index) {
  const g = new THREE.Group();
  // road
  const road = new THREE.Mesh(new THREE.PlaneGeometry(11.4, CFG.chunkLen), CityKit.roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0;
  g.add(road);
  // sidewalks
  for (const sx of [-8.2, 8.2]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(5, 0.24, CFG.chunkLen), CityKit.walkMat);
    walk.position.set(sx, 0.12, 0);
    g.add(walk);
  }
  // buildings
  g.userData.buildings = [];
  for (const side of [-1, 1]) {
    let z = -CFG.chunkLen / 2;
    while (z < CFG.chunkLen / 2 - 6) {
      const b = CityKit.makeBuilding();
      const off = 11 + b.userData.d / 2 + Math.random() * 6;
      b.position.set(side * (off + 4), 0, z + b.userData.w / 2);
      b.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(b);
      g.userData.buildings.push(b);
      z += b.userData.w + 1.5 + Math.random() * 4;
    }
  }
  // street lamps
  g.userData.lamps = [];
  for (let z = -CFG.chunkLen / 2 + 8; z < CFG.chunkLen / 2; z += 22) {
    for (const side of [-1, 1]) {
      const lamp = CityKit.makeLamp();
      lamp.position.set(side * 7.4, 0, z + (side > 0 ? 11 : 0));
      lamp.rotation.y = side > 0 ? Math.PI : 0;
      g.add(lamp);
      g.userData.lamps.push(lamp);
    }
  }
  g.position.z = -index * CFG.chunkLen;
  g.userData.baseIndex = index;
  world.add(g);
  return g;
}

for (let i = -1; i < CFG.chunkCount - 1; i++) chunks.push(buildChunk(i));

function recycleChunks(pz) {
  for (const c of chunks) {
    if (c.position.z > pz + CFG.chunkLen * 1.2) {
      c.position.z -= CFG.chunkCount * CFG.chunkLen;
      // restore any collapsed buildings
      for (const b of c.userData.buildings) {
        b.rotation.x = 0; b.rotation.z = 0;
        b.position.y = 0;
        b.visible = true;
      }
    }
  }
}

/* ───────────────────────── PLAYER ───────────────────────── */
const player = CityKit.makeRunner();
scene.add(player);
const blobShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 20),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false })
);
blobShadow.rotation.x = -Math.PI / 2;
scene.add(blobShadow);

/* ───────────────────────── RAIN ───────────────────────── */
const RAIN_N = 1400;
const rainGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 30;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const rainSprite = (() => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 32);
  gr.addColorStop(0, 'rgba(190,205,220,0)');
  gr.addColorStop(0.5, 'rgba(190,205,220,.85)');
  gr.addColorStop(1, 'rgba(190,205,220,0)');
  g.fillStyle = gr; g.fillRect(3, 0, 2, 32);
  return new THREE.CanvasTexture(c);
})();
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
  map: rainSprite, size: 0.85, transparent: true, opacity: 0,
  depthWrite: false, blending: THREE.AdditiveBlending
}));
rain.visible = false;
scene.add(rain);

/* ───────────────────────── FLOOD WATER ───────────────────────── */
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 600, 30, 60),
  new THREE.MeshStandardMaterial({
    color: 0x2a3d4a, transparent: true, opacity: 0.82,
    roughness: 0.12, metalness: 0.55
  })
);
water.rotation.x = -Math.PI / 2;
water.position.y = -1.5;
water.visible = false;
scene.add(water);
const waterBaseY = water.geometry.attributes.position.array.slice();

/* ───────────────────────── STATE ───────────────────────── */
const S = {};
function resetState() {
  Object.assign(S, {
    running: false, over: false, frozen: false,
    time: 0, timeScale: 1,
    lane: 1, x: 0, y: 0, vy: 0, grounded: true,
    z: 0, speed: CFG.baseSpeed,
    dashT: 0, dashCD: 0, slippery: false,
    gravityMult: 1,
    score: 0, distance: 0, frags: 0, nearMisses: 0,
    combo: 0, comboMult: 1, comboTimer: 0,
    phase: -1, eventsSurvived: 0,
    obstacles: [], fragments: [], vehiclesMoving: [],
    fallingDebris: [], collapsing: [],
    nextSpawnZ: -40,
    trafficTimer: 0, collapseTimer: 0, debrisTimer: 0,
    distortAmp: 0, floodLevel: -1.5,
    shake: 0, camLean: 0, runT: 0,
    deathCause: ''
  });
}
resetState();

const pools = { obstacles: [], fragments: [] };

/* ───────────────────────── OBSTACLES ───────────────────────── */
function laneOffset(z) {
  if (S.distortAmp <= 0) return 0;
  return Math.sin(z * 0.055 + S.runT * 1.6) * S.distortAmp;
}

function addObstacle(mesh, lane, z, type, opts = {}) {
  mesh.userData.type = type;
  mesh.userData.lane = lane;
  mesh.userData.baseX = CFG.laneX[lane] + (opts.xOff || 0);
  mesh.userData.vz = opts.vz || 0;
  mesh.userData.floatY = opts.floatY || 0;
  mesh.userData.driftLane = false;
  mesh.userData.passed = false;
  mesh.position.set(mesh.userData.baseX, opts.y || 0, z);
  scene.add(mesh);
  S.obstacles.push(mesh);
  return mesh;
}

function addFragment(lane, z, y = 1.1) {
  const f = CityKit.makeFragment();
  f.userData.baseX = CFG.laneX[lane];
  f.userData.baseY = y;
  f.position.set(CFG.laneX[lane], y, z);
  scene.add(f);
  S.fragments.push(f);
}

function removeObj(arr, i, o) {
  scene.remove(o);
  arr.splice(i, 1);
}

/* spawn patterns — each returns length consumed (z metres) */
const PATTERNS = [
  // single barrier (jump) + fragment arc over it
  function singleBarrier(z) {
    const lane = (Math.random() * 3) | 0;
    addObstacle(CityKit.makeBarrier(), lane, z, 'barrier');
    if (Math.random() < 0.7) { addFragment(lane, z + 2.2, 1.9); addFragment(lane, z - 2.2, 1.9); }
    return 16;
  },
  // two blocks, one safe lane with fragment trail (safe route)
  function twoBlocks(z) {
    const safe = (Math.random() * 3) | 0;
    for (let l = 0; l < 3; l++) if (l !== safe) addObstacle(CityKit.makeBlock(), l, z, 'block');
    for (let i = 0; i < 3; i++) addFragment(safe, z - i * 3);
    return 22;
  },
  // full barrier line — must jump (risky, big reward above)
  function barrierLine(z) {
    for (let l = 0; l < 3; l++) addObstacle(CityKit.makeBarrier(), l, z, 'barrier');
    addFragment(1, z, 2.1);
    return 20;
  },
  // parked vehicle + barrier stagger
  function traffic(z) {
    const l1 = (Math.random() * 3) | 0;
    let l2 = (Math.random() * 3) | 0; if (l2 === l1) l2 = (l2 + 1) % 3;
    addObstacle(CityKit.makeVehicle(), l1, z, 'vehicle');
    addObstacle(CityKit.makeBarrier(), l2, z - 9, 'barrier');
    return 26;
  },
  // risky shortcut: two blocks tight, centre gap holds fragments (dash lane)
  function shortcut(z) {
    addObstacle(CityKit.makeBlock(), 0, z, 'block');
    addObstacle(CityKit.makeBlock(), 2, z, 'block');
    addObstacle(CityKit.makeBarrier(), 1, z - 6, 'barrier');
    addFragment(1, z, 1.0); addFragment(1, z - 3, 1.0);
    return 24;
  },
  // debris field
  function debrisField(z) {
    const n = 2 + (Math.random() * 2 | 0);
    const used = [];
    for (let i = 0; i < n; i++) {
      let l = (Math.random() * 3) | 0;
      if (used.includes(l) && used.length < 3) l = (l + 1) % 3;
      used.push(l);
      addObstacle(CityKit.makeDebrisChunk(false), l, z - i * 5, 'debris', { y: 0.4 });
    }
    return 12 + n * 5;
  },
  // slalom
  function slalom(z) {
    const start = Math.random() < 0.5 ? 0 : 2;
    addObstacle(CityKit.makeBlock(), start, z, 'block');
    addObstacle(CityKit.makeBlock(), 1, z - 8, 'block');
    addObstacle(CityKit.makeBlock(), 2 - start, z - 16, 'block');
    addFragment(2 - start, z, 1.1);
    addFragment(1, z - 16, 1.1);
    return 30;
  }
];

function spawnAhead() {
  const targetZ = S.z - CFG.spawnAhead;
  while (S.nextSpawnZ > targetZ) {
    const z = S.nextSpawnZ;
    let pat;
    const r = Math.random();
    if (S.phase >= 8 && r < 0.3) pat = PATTERNS[5];
    else pat = PATTERNS[(Math.random() * PATTERNS.length) | 0];
    const used = pat(z);
    // gravity phase: floating hazards at head height (do NOT jump)
    if (S.phase === 6 && Math.random() < 0.5) {
      const l = (Math.random() * 3) | 0;
      addObstacle(CityKit.makeDebrisChunk(true), l, z - used * 0.5, 'floater', { y: 2.3, floatY: 2.3 });
    }
    const gap = Math.max(10, 20 - S.speed * 0.28 - (S.phase >= 8 ? 4 : 0));
    S.nextSpawnZ -= used + gap + Math.random() * 8;
  }
}

/* moving vehicles (phase 2+) — oncoming in a lane */
function spawnMovingVehicle() {
  const v = CityKit.makeVehicle();
  const lane = (Math.random() * 3) | 0;
  const oncoming = Math.random() < 0.75;
  v.rotation.y = oncoming ? Math.PI : 0;
  const vz = oncoming ? (9 + Math.random() * 6) : -(S.speed * 0.55);
  addObstacle(v, lane, S.z - CFG.spawnAhead - Math.random() * 40, 'movingVehicle', { vz });
  if (S.blackout && v.userData.beam) v.userData.beam.material.opacity = 0.34;
}

/* falling debris with ground warning marker */
function spawnFallingDebris() {
  const lane = (Math.random() * 3) | 0;
  const z = S.z - (30 + Math.random() * 45);
  const d = CityKit.makeDebrisChunk(Math.random() < 0.4);
  d.position.set(CFG.laneX[lane], 26 + Math.random() * 10, z);
  d.userData.lane = lane; d.userData.baseX = CFG.laneX[lane];
  d.userData.vy = -(14 + Math.random() * 8);
  d.userData.spin = new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4);
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.85, 22),
    new THREE.MeshBasicMaterial({ color: 0xc9502e, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(CFG.laneX[lane], 0.03, z);
  scene.add(marker);
  d.userData.marker = marker;
  scene.add(d);
  S.fallingDebris.push(d);
}

/* building collapse */
function collapseNearbyBuilding() {
  let best = null, bestD = 1e9;
  for (const c of chunks) for (const b of c.userData.buildings) {
    if (b.userData.falling || !b.visible) continue;
    const wz = c.position.z + b.position.z;
    const d = S.z - wz; // building ahead: d > 0
    if (d > 18 && d < 85 && d < bestD) { best = b; bestD = d; }
  }
  if (!best) return;
  best.userData.falling = true;
  const side = best.position.x > 0 ? 1 : -1;
  const fallDur = 1.35;
  gsap.to(best.rotation, { z: -side * (Math.PI / 2.35), duration: fallDur, ease: 'power2.in' });
  gsap.to(best.position, { y: -best.userData.h * 0.12, duration: fallDur, ease: 'power2.in' });
  S.collapsing.push({ b: best, t: fallDur, side });
}

/* ───────────────────────── INPUT ───────────────────────── */
function moveLane(dir) {
  if (!S.running || S.frozen) return;
  const nl = Math.min(2, Math.max(0, S.lane + dir));
  if (nl === S.lane) return;
  S.lane = nl;
  gsap.to(S, { camLean: dir * 0.5, duration: 0.18, ease: 'power2.out', overwrite: 'auto',
    onComplete: () => gsap.to(S, { camLean: 0, duration: 0.55, ease: 'power2.out' }) });
}
function jump() {
  if (!S.running || S.frozen || !S.grounded) return;
  S.vy = CFG.jumpVel;
  S.grounded = false;
  gsap.fromTo(S, { }, { duration: 0.01 }); // noop keep gsap warm
}
function dash() {
  if (!S.running || S.frozen || S.dashCD > 0) return;
  S.dashT = CFG.dashTime;
  S.dashCD = CFG.dashCooldown;
  gsap.to(camera, { fov: 74, duration: 0.16, ease: 'power2.out',
    onUpdate: () => camera.updateProjectionMatrix(),
    onComplete: () => gsap.to(camera, { fov: 66, duration: 0.6, ease: 'power2.inOut',
      onUpdate: () => camera.updateProjectionMatrix() }) });
}

addEventListener('keydown', e => {
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyA': case 'ArrowLeft': moveLane(-1); break;
    case 'KeyD': case 'ArrowRight': moveLane(1); break;
    case 'Space': case 'KeyW': case 'ArrowUp': e.preventDefault(); jump(); break;
    case 'ShiftLeft': case 'ShiftRight': dash(); break;
    case 'Enter':
      if (!dom.title.classList.contains('fade') && dom.title.style.display !== 'none') startRun();
      else if (!dom.death.classList.contains('hidden')) restart();
      else if (!dom.result.classList.contains('hidden')) restart();
      break;
  }
});

// touch buttons
$('touch-left').addEventListener('touchstart', e => { e.preventDefault(); moveLane(-1); }, { passive: false });
$('touch-right').addEventListener('touchstart', e => { e.preventDefault(); moveLane(1); }, { passive: false });
$('touch-jump').addEventListener('touchstart', e => { e.preventDefault(); jump(); }, { passive: false });
$('touch-dash').addEventListener('touchstart', e => { e.preventDefault(); dash(); }, { passive: false });
// swipe
let tsx = 0, tsy = 0, tst = 0;
dom.canvas.addEventListener('touchstart', e => {
  tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; tst = performance.now();
}, { passive: true });
dom.canvas.addEventListener('touchend', e => {
  const dt = performance.now() - tst;
  if (dt > 500) return;
  const dx = e.changedTouches[0].clientX - tsx, dy = e.changedTouches[0].clientY - tsy;
  if (Math.abs(dx) > 38 && Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
  else if (dy < -38) jump();
  else if (dy > 38) dash();
}, { passive: true });

/* ───────────────────────── HUD helpers ───────────────────────── */
// countdown ticks + phase markers
for (let i = 1; i < 33; i++) {
  const t = document.createElement('i');
  t.style.left = (i / 33 * 100) + '%';
  dom.cdTicks.appendChild(t);
}
const phaseMarkEls = [];
for (let i = 1; i <= 9; i++) {
  const b = document.createElement('b');
  b.style.left = (i * 10 / 99 * 100) + '%';
  dom.cdMarks.appendChild(b);
  phaseMarkEls.push(b);
}

let signTimer = null;
function showSign(code, text, info) {
  dom.signCode.textContent = code;
  dom.signText.textContent = text;
  dom.sign.classList.toggle('sign-info', !!info);
  dom.sign.classList.remove('sign-hidden');
  clearTimeout(signTimer);
  signTimer = setTimeout(() => dom.sign.classList.add('sign-hidden'), 2800);
}

function popBonus(text, cls) {
  const el = document.createElement('div');
  el.className = 'bonus-pop ' + cls;
  el.textContent = text;
  dom.ticker.appendChild(el);
  while (dom.ticker.children.length > 3) dom.ticker.removeChild(dom.ticker.firstChild);
  setTimeout(() => el.remove(), 1050);
}

function bumpCombo() {
  S.combo++;
  S.comboTimer = 4;
  S.comboMult = Math.min(5, 1 + S.combo * 0.25);
  dom.comboRow.classList.toggle('combo-hot', S.comboMult >= 2.5);
}

function flashDamage() {
  dom.envFlash.style.opacity = 1;
  setTimeout(() => dom.envFlash.style.opacity = 0, 130);
}

/* ───────────────────────── PHASE FX ───────────────────────── */
function tweenEnv({ bg, fog, hemiI, dirI, exp }, dur = 2.4) {
  if (bg !== undefined) { const c = new THREE.Color(bg);
    gsap.to(scene.background, { r: c.r, g: c.g, b: c.b, duration: dur });
    gsap.to(scene.fog.color, { r: c.r, g: c.g, b: c.b, duration: dur }); }
  if (fog !== undefined) gsap.to(scene.fog, { density: fog, duration: dur });
  if (hemiI !== undefined) gsap.to(hemi, { intensity: hemiI, duration: dur });
  if (dirI !== undefined) gsap.to(dir, { intensity: dirI, duration: dur });
  if (exp !== undefined) gsap.to(renderer, { toneMappingExposure: exp, duration: dur });
}

function setWetRoad(on, dur = 2.5) {
  gsap.to(CityKit.roadMat, { roughness: on ? 0.3 : 0.92, metalness: on ? 0.42 : 0.05, duration: dur });
  for (const c of chunks) for (const l of c.userData.lamps)
    gsap.to(l.userData.refl.material, { opacity: on ? 0.22 : 0, duration: dur });
}

function setBlackout(on) {
  S.blackout = on;
  tweenEnv(on
    ? { bg: 0x07080a, fog: 0.02, hemiI: 0.07, dirI: 0.06, exp: 0.85 }
    : { bg: 0x232830, fog: 0.013, hemiI: 0.4, dirI: 0.6, exp: 1.0 }, 1.8);
  gsap.to(playerLight, { intensity: on ? 2.4 : 0, duration: 1.5 });
  for (const c of chunks) for (const b of c.userData.buildings)
    gsap.to(b.userData.mat, { emissiveIntensity: on ? 0.04 : 0.85, duration: 1.4 });
  for (const c of chunks) for (const l of c.userData.lamps)
    l.userData.head.material.color.set(on ? 0x1a1a1c : 0xffd9a0);
  for (const o of S.obstacles) if (o.userData.beam)
    gsap.to(o.userData.beam.material, { opacity: on ? 0.34 : 0, duration: 1.2 });
}

function setRain(on) {
  rain.visible = true;
  gsap.to(rain.material, { opacity: on ? 0.75 : 0, duration: 2,
    onComplete: () => { if (!on) rain.visible = false; } });
  dom.envRain.style.opacity = on ? 1 : 0;
  setWetRoad(on);
  S.slippery = on;
}

function setFlood(on) {
  water.visible = true;
  gsap.to(S, { floodLevel: on ? 0.5 : -1.5, duration: on ? 5 : 2.5, ease: 'power1.inOut' });
  dom.envFlood.style.opacity = on ? 1 : 0;
}

function enterPhase(p) {
  S.phase = p;
  const ph = PHASES[p];
  showSign(ph.code, ph.label, ph.info);
  phaseMarkEls.forEach((el, i) => el.classList.toggle('passed', (i + 1) * 10 <= ph.t + 0.1));
  switch (p) {
    case 0: break;
    case 1: setRain(true); tweenEnv({ bg: 0x1e242c, fog: 0.022, hemiI: 0.38, dirI: 0.45 }); break;
    case 2: /* aggressive traffic handled by timer */ tweenEnv({ fog: 0.016 }); break;
    case 3: setRain(false); setBlackout(true); break;
    case 4: setBlackout(false); dom.envCollapse.style.opacity = 1;
            tweenEnv({ bg: 0x2a2723, fog: 0.016, hemiI: 0.42, dirI: 0.5 }); break;
    case 5: setFlood(true); setWetRoad(true, 3); tweenEnv({ bg: 0x1c262e, fog: 0.018 }); break;
    case 6: setFlood(false); S.gravityMult = 0.42;
            tweenEnv({ bg: 0x232031, fog: 0.012, hemiI: 0.5 }); break;
    case 7: S.gravityMult = 1; gsap.to(S, { distortAmp: 1.05, duration: 3 });
            tweenEnv({ bg: 0x262a28, fog: 0.014 }); break;
    case 8: setRain(true); dom.envCollapse.style.opacity = 1;
            tweenEnv({ bg: 0x14181e, fog: 0.024, hemiI: 0.3, dirI: 0.35 }); break;
    case 9: dom.instWarn.classList.remove('hidden');
            gsap.to(S, { distortAmp: 0.7, duration: 2 });
            tweenEnv({ bg: 0x0d0e10, fog: 0.028, hemiI: 0.22, dirI: 0.25, exp: 0.92 }); break;
  }
}

/* ───────────────────────── COLLISION / SCORING ───────────────────────── */
function playerAABBHit(o, ox) {
  const u = o.userData;
  const px = S.renderX, pz = S.z, py = S.y;
  const hw = (u.w || 1.6) / 2 + 0.32;
  const hd = (u.d || 1.6) / 2 + 0.3;
  if (Math.abs(ox - px) > hw) return false;
  if (Math.abs(o.position.z - pz) > hd) return false;
  const bottom = o.position.y - (u.floatY ? (u.h || 1) / 2 : 0);
  const top = (u.floatY ? o.position.y + (u.h || 1) / 2 : o.position.y + (u.h || 1));
  return py < top - 0.12 && py + 1.62 > bottom + 0.1;
}

function causeFor(type) {
  switch (type) {
    case 'vehicle': case 'movingVehicle': return 'VEHICLE IMPACT';
    case 'barrier': return 'BARRIER IMPACT';
    case 'block': return 'OBSTRUCTION IMPACT';
    case 'debris': case 'floater': case 'fall': return 'STRUCTURAL DEBRIS';
    default: return 'IMPACT';
  }
}

/* ───────────────────────── GAME FLOW ───────────────────────── */
const BEST_KEY = 'run99_best';
function getBest() { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10); }

function clearDynamic() {
  for (const o of S.obstacles) scene.remove(o);
  for (const f of S.fragments) scene.remove(f);
  for (const d of S.fallingDebris) { scene.remove(d); if (d.userData.marker) scene.remove(d.userData.marker); }
  S.obstacles.length = 0; S.fragments.length = 0; S.fallingDebris.length = 0;
}

function fullVisualReset() {
  gsap.globalTimeline.clear();
  setRain(false); setBlackout(false); setFlood(false);
  setWetRoad(false, 0.4);
  S.distortAmp = 0; S.gravityMult = 1;
  tweenEnv({ bg: DEFAULTS.bg.getHex(), fog: DEFAULTS.fog, hemiI: DEFAULTS.hemi, dirI: DEFAULTS.dir, exp: 1 }, 0.4);
  dom.envRain.style.opacity = 0; dom.envBlackout.style.opacity = 0;
  dom.envFlood.style.opacity = 0; dom.envCollapse.style.opacity = 0;
  dom.instWarn.classList.add('hidden');
  dom.sign.classList.add('sign-hidden');
  phaseMarkEls.forEach(el => el.classList.remove('passed'));
  dom.comboRow.classList.remove('combo-hot');
  for (const c of chunks) for (const b of c.userData.buildings) {
    b.rotation.z = 0; b.rotation.x = 0; b.position.y = 0; b.visible = true;
    b.userData.falling = false;
  }
  camera.fov = 66; camera.updateProjectionMatrix();
}

function startRun() {
  clearDynamic();
  fullVisualReset();
  resetState();
  S.running = true;
  world.position.set(0, 0, 0);
  for (let i = 0; i < chunks.length; i++) chunks[i].position.z = -(i - 1) * CFG.chunkLen;
  enterPhase(0);
  dom.hud.classList.remove('hidden');
  dom.title.classList.add('fade');
  setTimeout(() => dom.title.style.display = 'none', 850);
  dom.death.classList.add('hidden');
  dom.result.classList.add('hidden');
  // opening camera swoop
  camera.position.set(6, 9, S.z + 16);
  gsap.fromTo(renderer, { toneMappingExposure: 0.25 }, { toneMappingExposure: 1, duration: 1.4 });
}

function restart() { startRun(); }

dom.btnStart.addEventListener('click', startRun);
dom.btnRetry.addEventListener('click', restart);
dom.btnAgain.addEventListener('click', restart);

function die(cause) {
  if (S.over) return;
  S.over = true; S.running = false;
  S.deathCause = cause;
  flashDamage();
  S.shake = 1.4;
  gsap.to(S, { timeScale: 0.08, duration: 0.09, ease: 'power3.out' });
  gsap.to(S, { shake: 0, duration: 1.2 });
  setTimeout(() => {
    dom.deathTime.textContent = S.time.toFixed(2);
    dom.deathCause.textContent = cause + ' — ' + PHASES[S.phase].label;
    dom.death.classList.remove('hidden');
    const inner = $('death-inner');
    gsap.fromTo(inner, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
  }, 550);
}

function survive() {
  if (S.over) return;
  S.over = true; S.frozen = true; S.running = false;
  S.time = 99;
  const finalScore = Math.round(S.score);
  const best = getBest();
  const newBest = finalScore > best;
  if (newBest) localStorage.setItem(BEST_KEY, String(finalScore));
  // freeze the world in slow-mo, then reveal
  gsap.to(S, { timeScale: 0, duration: 1.6, ease: 'power2.inOut' });
  gsap.to(renderer, { toneMappingExposure: 0.35, duration: 1.6, delay: 0.4 });
  dom.cdTime.textContent = '99.00';
  setTimeout(() => {
    dom.hud.classList.add('hidden');
    dom.result.classList.remove('hidden');
    dom.resTime.textContent = '99.00';
    dom.resEvents.textContent = '10 / 10';
    dom.resNM.textContent = String(S.nearMisses);
    dom.resBest.textContent = String(Math.max(best, finalScore)).padStart(6, '0');
    dom.resNew.classList.toggle('hidden', !newBest);
    // choreographed entrance
    const els = [dom.resTime, $('result-survived'), $('result-rule'),
                 ...dom.result.querySelectorAll('#result-stats > div'),
                 dom.resNew, dom.btnAgain];
    gsap.set(els, { opacity: 0, y: 22 });
    gsap.to(els, { opacity: 1, y: 0, duration: 0.7, stagger: 0.09, ease: 'power3.out' });
    // count-ups
    const cu = { d: 0, s: 0 };
    gsap.to(cu, { d: Math.round(S.distance), s: finalScore, duration: 1.4, delay: 0.5, ease: 'power2.out',
      onUpdate: () => {
        dom.resDist.textContent = Math.round(cu.d) + ' m';
        dom.resScore.textContent = String(Math.round(cu.s)).padStart(6, '0');
      } });
  }, 1900);
}

/* ───────────────────────── UPDATE ───────────────────────── */
const clock = new THREE.Clock();
let hudFrame = 0;

function update() {
  requestAnimationFrame(update);
  let dt = Math.min(clock.getDelta(), 0.05) * S.timeScale;
  S.runT += dt;

  if (S.running && !S.frozen) {
    /* time & phase */
    S.time += dt;
    if (S.time >= CFG.runSeconds) { survive(); }
    const phaseIdx = Math.min(9, Math.floor(S.time / 10));
    if (phaseIdx > S.phase) { S.eventsSurvived = phaseIdx; enterPhase(phaseIdx); }

    /* speed */
    const prog = S.time / CFG.runSeconds;
    let spd = CFG.baseSpeed + (CFG.maxSpeed - CFG.baseSpeed) * prog;
    if (S.dashT > 0) { S.dashT -= dt; spd *= CFG.dashMult; }
    if (S.dashCD > 0) S.dashCD -= dt;
    if (S.floodLevel > 0 && S.y < S.floodLevel) spd *= 0.9;
    S.speed = spd;
    S.z -= spd * dt;
    S.distance = -S.z;

    /* lateral */
    const targetX = CFG.laneX[S.lane];
    const lerpK = S.slippery ? 6.5 : 12;
    S.x += (targetX - S.x) * Math.min(1, lerpK * dt);
    S.renderX = S.x + laneOffset(S.z);

    /* vertical */
    S.vy -= CFG.gravity * S.gravityMult * dt;
    S.y += S.vy * dt;
    if (S.y <= 0) { S.y = 0; S.vy = 0; S.grounded = true; }

    /* score over time */
    S.score += (spd * 2 + 100) * dt * (1 + prog);
    if (S.comboTimer > 0) { S.comboTimer -= dt; }
    else if (S.combo > 0) { S.combo = 0; S.comboMult = 1; dom.comboRow.classList.remove('combo-hot'); }

    /* spawn systems */
    spawnAhead();
    recycleChunks(S.z);

    if (S.phase >= 2 && S.phase !== 3 || S.phase >= 8) {
      S.trafficTimer -= dt;
      if (S.trafficTimer <= 0) { spawnMovingVehicle(); S.trafficTimer = S.phase >= 8 ? 2.2 : 3.2; }
    }
    if (S.phase === 3) { // blackout still has occasional headlight traffic
      S.trafficTimer -= dt;
      if (S.trafficTimer <= 0) { spawnMovingVehicle(); S.trafficTimer = 4.5; }
    }
    if (S.phase === 4 || S.phase >= 8) {
      S.collapseTimer -= dt;
      if (S.collapseTimer <= 0) {
        collapseNearbyBuilding();
        S.collapseTimer = S.phase === 9 ? 1.6 : 2.8;
      }
      S.debrisTimer -= dt;
      if (S.debrisTimer <= 0) { spawnFallingDebris(); S.debrisTimer = S.phase === 9 ? 0.9 : 1.7; }
    }
    if (S.phase === 9) S.shake = Math.max(S.shake, 0.18);

    /* obstacles update + collisions + near miss */
    for (let i = S.obstacles.length - 1; i >= 0; i--) {
      const o = S.obstacles[i];
      const u = o.userData;
      if (u.vz) o.position.z += u.vz * dt;
      // distortion drift
      o.position.x = u.baseX + laneOffset(o.position.z);
      // gravity floaters bob
      if (u.floatY) o.position.y = u.floatY + Math.sin(S.runT * 2 + o.id) * 0.35;
      // flood: debris floats on water
      if (S.floodLevel > 0 && (u.type === 'debris'))
        o.position.y = S.floodLevel + Math.sin(S.runT * 1.7 + o.id) * 0.12;

      if (o.position.z > S.z + 14) { removeObj(S.obstacles, i, o); continue; }

      // collision
      if (Math.abs(o.position.z - S.z) < 4 && playerAABBHit(o, o.position.x)) {
        die(causeFor(u.type)); break;
      }
      // near miss: passed player closely without hit
      if (!u.passed && o.position.z > S.z + 1.2) {
        u.passed = true;
        const dx = Math.abs(o.position.x - S.renderX);
        const closeX = dx < ((u.w || 1.6) / 2 + 1.15);
        const jumpedOver = S.y > 0.4 && dx < 1.4;
        if (closeX || jumpedOver) {
          S.nearMisses++;
          bumpCombo();
          S.score += 120 * S.comboMult;
          popBonus('NEAR MISS +' + Math.round(120 * S.comboMult), 'nm');
        }
      }
    }

    /* fragments */
    for (let i = S.fragments.length - 1; i >= 0; i--) {
      const f = S.fragments[i];
      f.rotation.y += 2.4 * dt;
      f.position.x = f.userData.baseX + laneOffset(f.position.z);
      f.position.y = f.userData.baseY + Math.sin(S.runT * 3 + f.id) * 0.12;
      if (f.position.z > S.z + 6) { removeObj(S.fragments, i, f); continue; }
      const dx = f.position.x - S.renderX, dz = f.position.z - S.z, dy = f.position.y - (S.y + 1);
      if (dx * dx + dz * dz < 1.2 && Math.abs(dy) < 1.5) {
        removeObj(S.fragments, i, f);
        S.frags++;
        bumpCombo();
        S.score += 250 * S.comboMult;
        popBonus('+' + Math.round(250 * S.comboMult), 'frag');
      }
    }

    /* falling debris */
    for (let i = S.fallingDebris.length - 1; i >= 0; i--) {
      const d = S.fallingDebris[i];
      d.position.y += d.userData.vy * dt;
      d.rotation.x += d.userData.spin.x * dt;
      d.rotation.y += d.userData.spin.y * dt;
      const m = d.userData.marker;
      if (m) m.material.opacity = 0.35 + 0.4 * Math.abs(Math.sin(S.runT * 8));
      if (d.position.y <= d.userData.r) {
        // landed → becomes ground obstacle
        d.position.y = d.userData.r * 0.6;
        if (m) scene.remove(m);
        d.userData.marker = null;
        S.fallingDebris.splice(i, 1);
        d.userData.type = 'debris'; d.userData.passed = false;
        d.userData.vz = 0; d.userData.floatY = 0;
        S.obstacles.push(d);
        if (Math.abs(d.position.z - S.z) < 26) S.shake = Math.max(S.shake, 0.35);
        continue;
      }
      // mid-air hit
      if (Math.abs(d.position.z - S.z) < 1.4 && Math.abs(d.position.x - S.renderX) < 1
          && d.position.y < S.y + 2 && d.position.y > S.y - 0.5) {
        die('STRUCTURAL DEBRIS'); break;
      }
    }

    /* collapsing buildings → debris + shake when they land */
    for (let i = S.collapsing.length - 1; i >= 0; i--) {
      const c = S.collapsing[i];
      c.t -= dt;
      if (c.t <= 0) {
        S.shake = Math.max(S.shake, 0.8);
        const bz = c.b.parent.position.z + c.b.position.z;
        for (let k = 0; k < 3; k++) {
          const lane = (Math.random() * 3) | 0;
          addObstacle(CityKit.makeDebrisChunk(Math.random() < 0.5), lane,
            bz - 4 - Math.random() * 10, 'debris', { y: 0.4 });
        }
        S.collapsing.splice(i, 1);
      }
    }
  }

  /* ── player mesh ── */
  player.position.set(S.renderX ?? S.x, S.y, S.z);
  player.rotation.y = Math.PI; // face -z
  player.rotation.z = (S.x - CFG.laneX[S.lane]) * -0.08 + (S.camLean * -0.12);
  // run cycle
  const u = player.userData;
  const runPhase = S.runT * (8 + S.speed * 0.35);
  if (S.grounded && S.running) {
    u.legL.rotation.x = Math.sin(runPhase) * 0.9;
    u.legR.rotation.x = -Math.sin(runPhase) * 0.9;
    u.armL.rotation.x = -Math.sin(runPhase) * 0.75;
    u.armR.rotation.x = Math.sin(runPhase) * 0.75;
    player.position.y += Math.abs(Math.sin(runPhase)) * 0.07;
    u.torso.rotation.x = 0.12 + (S.dashT > 0 ? 0.3 : 0);
  } else {
    u.legL.rotation.x = 0.5; u.legR.rotation.x = -0.35;
    u.armL.rotation.x = -0.9; u.armR.rotation.x = 0.6;
  }
  blobShadow.position.set(player.position.x, Math.max(0.02, S.floodLevel > 0 ? S.floodLevel + 0.02 : 0.02), S.z);
  blobShadow.material.opacity = Math.max(0.06, 0.42 - S.y * 0.12);
  playerLight.position.set(player.position.x, S.y + 2.2, S.z - 1.5);

  /* ── rain follow ── */
  if (rain.visible) {
    rain.position.set(camera.position.x, 0, camera.position.z - 20);
    const p = rainGeo.attributes.position;
    const fall = (S.phase === 6 ? 12 : 34) * dt;
    for (let i = 0; i < RAIN_N; i++) {
      let y = p.getY(i) - fall;
      if (y < 0) y = 28 + Math.random() * 4;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  }

  /* ── flood water follow + waves ── */
  if (water.visible) {
    water.position.set(0, S.floodLevel, S.z - 100);
    const wp = water.geometry.attributes.position;
    for (let i = 0; i < wp.count; i += 3)
      wp.setZ(i, waterBaseY[i * 3 + 2] + Math.sin(S.runT * 1.8 + i * 0.7) * 0.14);
    wp.needsUpdate = true;
    if (S.floodLevel < -1.4 && !gsap.isTweening(S)) water.visible = false;
  }

  /* ── camera ── */
  const camTX = (S.renderX ?? S.x) * 0.72;
  const camTY = 4.4 + S.y * 0.35 + (S.phase === 6 ? 0.8 : 0);
  const camTZ = S.z + 9.2 - Math.min(2.2, S.speed * 0.055) - (S.dashT > 0 ? 1.2 : 0);
  camera.position.x += (camTX - camera.position.x) * Math.min(1, 5.5 * dt || 0.08);
  camera.position.y += (camTY - camera.position.y) * Math.min(1, 4.5 * dt || 0.08);
  camera.position.z += (camTZ - camera.position.z) * Math.min(1, 6 * dt || 0.08);
  if (S.shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * S.shake;
    camera.position.y += (Math.random() - 0.5) * S.shake * 0.7;
    S.shake *= Math.pow(0.02, dt || 0.016);
  }
  const look = new THREE.Vector3((S.renderX ?? S.x) * 0.85, 1.7 + S.y * 0.5, S.z - 11);
  camera.lookAt(look);
  camera.rotation.z += S.camLean * 0.06 + (S.distortAmp > 0 ? Math.sin(S.runT * 0.9) * 0.02 * S.distortAmp : 0);

  /* ── HUD (throttled) ── */
  if (S.running && !S.frozen) {
    const remain = Math.max(0, CFG.runSeconds - S.time);
    dom.cdTime.textContent = remain.toFixed(2);
    dom.cdFill.style.transform = `scaleX(${remain / CFG.runSeconds})`;
    dom.cdTime.classList.toggle('critical', remain < 10);
    if (S.phase === 9) dom.instPct.textContent = Math.min(99.9, 98 + (S.time - 90) * 0.21).toFixed(1);

    if ((hudFrame++ & 3) === 0) {
      dom.teleSpeed.textContent = S.speed.toFixed(1).padStart(4, '0');
      dom.teleDist.textContent = String(Math.round(S.distance)).padStart(4, '0');
      dom.teleScore.textContent = String(Math.round(S.score)).padStart(6, '0');
      dom.teleCombo.textContent = '×' + S.comboMult.toFixed(1);
      dom.speedFill.style.width = (S.speed / CFG.maxSpeed / CFG.dashMult * 100 * (S.dashT > 0 ? CFG.dashMult : 1)) + '%';
      dom.comboFill.style.width = (S.comboTimer / 4 * 100) + '%';

      // threat: nearest hazards ahead
      let maxThreat = 0;
      let blipHTML = '';
      let blips = 0;
      const laneBlocked = [false, false, false];
      for (const o of S.obstacles) {
        const dz = S.z - o.position.z; // >0 = ahead
        if (dz < -2 || dz > 45) continue;
        const dx = o.position.x - S.renderX;
        if (Math.abs(dx) < 1.6) maxThreat = Math.max(maxThreat, 1 - dz / 45);
        if (dz > 0 && dz < 24 && o.userData.lane !== undefined && o.userData.type !== 'floater')
          laneBlocked[o.userData.lane] = true;
        if (blips < 5 && dz > 0) {
          const bx = 50 + (dx / 8) * 34;
          const by = 50 - (1 - dz / 45) * 34;
          blipHTML += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="2.4" fill="${dz < 14 ? '#c9502e' : '#8fc1e8'}"/>`;
          blips++;
        }
      }
      for (const d of S.fallingDebris) {
        const dz = S.z - d.position.z;
        if (dz > 0 && dz < 24) { laneBlocked[d.userData.lane] = true; maxThreat = Math.max(maxThreat, 0.6); }
      }
      const pct = Math.round(maxThreat * 100);
      dom.threatPct.textContent = pct;
      dom.threatRing.style.strokeDashoffset = 276.5 * (1 - maxThreat);
      dom.threatRing.style.stroke = pct > 60 ? '#c9502e' : pct > 30 ? '#d8b25e' : '#d8dde2';
      dom.threatInst.classList.toggle('threat-high', pct > 60);
      dom.threatBlips.innerHTML = blipHTML;

      dom.routeLanes.forEach((el, i) => {
        el.classList.toggle('active', i === S.lane);
        el.classList.toggle('danger', laneBlocked[i] && i !== S.lane);
      });
    }
  }

  renderer.render(scene, camera);
}

/* ───────────────────────── BOOT ───────────────────────── */
const best = getBest();
dom.titleBest.textContent = best > 0 ? 'CITY RECORD — ' + String(best).padStart(6, '0') : '';
// idle title camera drift over the city
camera.position.set(7, 10, 14);
camera.lookAt(0, 3, -30);
S.renderX = 0;
update();

})();
