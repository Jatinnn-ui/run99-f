/* ═══════════════════════════════════════════════════════
   RUN 99 — CityKit : procedural city assets
   charcoal / concrete palette, natural window lighting
   ═══════════════════════════════════════════════════════ */
const CityKit = (() => {

  // ---------- canvas texture helpers ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  // building facade + matching emissive (lit windows) maps
  function facadeMaps(seed) {
    const cols = 6 + Math.floor(Math.random() * 4);
    const rows = 14 + Math.floor(Math.random() * 8);
    const base = 34 + Math.floor(Math.random() * 26); // concrete gray
    const lit = [];
    const map = canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = `rgb(${base},${base + 2},${base + 5})`;
      g.fillRect(0, 0, w, h);
      // concrete streaks
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
        g.fillRect(Math.random() * w, 0, 1 + Math.random() * 3, h);
      }
      const cw = w / cols, ch = h / rows;
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
        const px = x * cw + cw * 0.18, py = y * ch + ch * 0.2;
        const on = Math.random() < 0.26;
        lit.push(on);
        g.fillStyle = on ? 'rgb(16,16,18)' : `rgb(${10 + Math.random() * 14 | 0},${12 + Math.random() * 14 | 0},${16 + Math.random() * 14 | 0})`;
        g.fillRect(px, py, cw * 0.64, ch * 0.6);
      }
    });
    let k = 0;
    const emis = canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const cw = w / cols, ch = h / rows;
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
        if (lit[k++]) {
          const warm = Math.random() < 0.7;
          g.fillStyle = warm ? `rgba(255,214,150,${0.55 + Math.random() * 0.45})`
                             : `rgba(180,205,235,${0.4 + Math.random() * 0.4})`;
          g.fillRect(x * cw + cw * 0.18, y * ch + ch * 0.2, cw * 0.64, ch * 0.6);
        }
      }
    });
    return { map, emis };
  }

  function roadTexture() {
    return canvasTex(512, 1024, (g, w, h) => {
      g.fillStyle = '#232527'; g.fillRect(0, 0, w, h);
      // asphalt noise
      for (let i = 0; i < 9000; i++) {
        const v = 26 + Math.random() * 26 | 0;
        g.fillStyle = `rgba(${v},${v},${v + 3},${0.4})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      // cracks
      g.strokeStyle = 'rgba(12,12,14,.55)'; g.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        let x = Math.random() * w, y = Math.random() * h;
        g.moveTo(x, y);
        for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 60; y += Math.random() * 60; g.lineTo(x, y); }
        g.stroke();
      }
      // lane dashes at x = w*(1/3±) — two divider lines for 3 lanes
      g.fillStyle = 'rgba(200,200,196,.5)';
      for (const lx of [w * 0.333, w * 0.667])
        for (let y = 0; y < h; y += 120) g.fillRect(lx - 3, y, 6, 56);
      // edge lines
      g.fillStyle = 'rgba(200,200,196,.6)';
      g.fillRect(10, 0, 5, h); g.fillRect(w - 15, 0, 5, h);
    });
  }

  function sidewalkTexture() {
    return canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = '#3a3d40'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        const v = 48 + Math.random() * 24 | 0;
        g.fillStyle = `rgba(${v},${v},${v},.4)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.strokeStyle = 'rgba(18,18,20,.7)'; g.lineWidth = 3;
      for (let y = 0; y < h; y += 86) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    });
  }

  // ---------- shared materials ----------
  const roadTex = roadTexture();
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92, metalness: 0.05 });

  const walkTex = sidewalkTexture();
  walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping;
  const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.95 });

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 0.9 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.55, metalness: 0.6 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: 0xb44a2a, roughness: 0.7 });
  const whitePaint = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.6 });
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x55524c, roughness: 0.95 });
  const fragMat = new THREE.MeshStandardMaterial({
    color: 0xd8b25e, emissive: 0xc9973a, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.5
  });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff3b2a });

  const facadeVariants = [];
  for (let i = 0; i < 6; i++) facadeVariants.push(facadeMaps(i));

  // ---------- builders ----------
  function makeBuilding() {
    const v = facadeVariants[Math.random() * facadeVariants.length | 0];
    const wdt = 8 + Math.random() * 10;
    const hgt = 16 + Math.random() * 42;
    const dep = 8 + Math.random() * 8;
    const mat = new THREE.MeshStandardMaterial({
      map: v.map, emissiveMap: v.emis, emissive: 0xffffff, emissiveIntensity: 0.85,
      roughness: 0.85
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(wdt, hgt, dep), mat);
    b.position.y = hgt / 2;
    // rooftop clutter
    const g = new THREE.Group(); g.add(b);
    if (Math.random() < 0.7) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(wdt * 0.3, 1.6, dep * 0.3), concreteMat);
      box.position.set((Math.random() - 0.5) * wdt * 0.4, hgt + 0.8, 0);
      g.add(box);
    }
    g.userData = { w: wdt, h: hgt, d: dep, mat };
    return g;
  }

  function makeLamp() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 6.4, 6), darkMetal);
    pole.position.y = 3.2; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.09), darkMetal);
    arm.position.set(-0.8, 6.3, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.22), lampGlowMat.clone());
    head.position.set(-1.6, 6.26, 0); g.add(head);
    // wet-road reflection streak (toggled by game)
    const refl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 7),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(-1.6, 0.02, 0);
    g.add(refl);
    g.userData = { head, refl };
    return g;
  }

  function makeVehicle() {
    const palette = [0x8a8d90, 0x3d4144, 0x6b6e71, 0x2e3336, 0x93867a, 0x51565a];
    const col = palette[Math.random() * palette.length | 0];
    const bodyMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.55 });
    const g = new THREE.Group();
    const isVan = Math.random() < 0.3;
    const L = isVan ? 4.6 : 4.1, W = 1.85, H = isVan ? 2.1 : 1.42;
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.62, L), bodyMat);
    body.position.y = 0.55 + H * 0.31; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88, H * 0.5, L * (isVan ? 0.8 : 0.5)), bodyMat);
    cab.position.set(0, 0.55 + H * 0.62 + H * 0.2, isVan ? L * 0.05 : -L * 0.05); g.add(cab);
    // glass
    const glass = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, H * 0.34, L * (isVan ? 0.76 : 0.46)),
      new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.15, metalness: 0.8 }));
    glass.position.copy(cab.position); glass.position.y += 0.03; g.add(glass);
    // wheels
    const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 10);
    for (const [x, z] of [[-0.8, 1.3], [0.8, 1.3], [-0.8, -1.3], [0.8, -1.3]]) {
      const wh = new THREE.Mesh(wg, darkMetal);
      wh.rotation.z = Math.PI / 2; wh.position.set(x, 0.34, z); g.add(wh);
    }
    // headlights (front = -z) + taillights
    const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.06), headlightMat);
    const hl2 = hl1.clone();
    hl1.position.set(-0.6, 0.85, -L / 2 - 0.01); hl2.position.set(0.6, 0.85, -L / 2 - 0.01);
    g.add(hl1, hl2);
    const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), taillightMat);
    const tl2 = tl1.clone();
    tl1.position.set(-0.6, 0.85, L / 2 + 0.01); tl2.position.set(0.6, 0.85, L / 2 + 0.01);
    g.add(tl1, tl2);
    // headlight beam (fake volumetric)
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 9),
      new THREE.MeshBasicMaterial({ color: 0xfff0cc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(0, 0.06, -L / 2 - 4.5);
    g.add(beam);
    g.userData = { w: W, h: H + 0.55, d: L, beam };
    return g;
  }

  function makeBarrier() { // jumpable concrete road barrier
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.5), concreteMat);
    b.position.y = 0.475; g.add(b);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.2, 0.52), hazardMat);
    stripe.position.y = 0.78; g.add(stripe);
    g.userData = { w: 2.6, h: 0.95, d: 0.5 };
    return g;
  }

  function makeBlock() { // tall — must change lane
    const g = new THREE.Group();
    const h = 2.6 + Math.random() * 1.2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, 1.6), darkMetal);
    b.position.y = h / 2; g.add(b);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 1.7), whitePaint);
    top.position.y = h; g.add(top);
    g.userData = { w: 2.4, h, d: 1.6 };
    return g;
  }

  function makeDebrisChunk(big) {
    const s = big ? 1.4 + Math.random() * 1.2 : 0.5 + Math.random() * 0.6;
    const geo = new THREE.DodecahedronGeometry(s, 0);
    const m = new THREE.Mesh(geo, debrisMat);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    m.userData = { w: s * 1.6, h: s * 1.6, d: s * 1.6, r: s };
    return m;
  }

  function makeFragment() {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), fragMat);
    m.userData = { r: 0.55 };
    return m;
  }

  function makeRunner() {
    const suit = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.7 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x4a7ba6, roughness: 0.4, emissive: 0x244560, emissiveIntensity: 0.6 });
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), suit);
    torso.position.y = 1.02; g.add(torso);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.44, 0.16), accent);
    pack.position.set(0, 1.06, 0.22); g.add(pack);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), dark);
    head.position.y = 1.52; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), dark);
    legL.position.set(-0.13, 0.4, 0);
    const legR = legL.clone(); legR.position.x = 0.13;
    g.add(legL, legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.14), suit);
    armL.position.set(-0.34, 1.06, 0);
    const armR = armL.clone(); armR.position.x = 0.34;
    g.add(armL, armR);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = { legL, legR, armL, armR, torso, head };
    return g;
  }

  return {
    roadMat, roadTex, walkMat, concreteMat, darkMetal, hazardMat, debrisMat, fragMat,
    makeBuilding, makeLamp, makeVehicle, makeBarrier, makeBlock,
    makeDebrisChunk, makeFragment, makeRunner
  };
})();
