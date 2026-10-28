// Modèles 3D des personnages, construits à partir de formes simples (aucun fichier externe).
import * as THREE from 'three';
import { bake } from './bake.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...extra });
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const sphere = (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);

function letterTexture(letter, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = color; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(letter, 32, 35);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Corps humanoïde de base. Avant du personnage = +z.
function humanoid(o) {
  const g = new THREE.Group();
  const parts = {};
  const skin = mat(o.skin);
  // jambes (pivot à la hanche)
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0.15 * side, 0.62, 0);
    leg.add(mesh(cyl(0.12, 0.12, 0.5), mat(o.legs ?? o.pants), 0, -0.27, 0));
    leg.add(mesh(new THREE.BoxGeometry(0.24, 0.14, 0.36), mat(o.shoes), 0, -0.55, 0.06));
    g.add(leg);
    parts[side < 0 ? 'legL' : 'legR'] = leg;
  }
  // bassin + torse
  g.add(mesh(cyl(0.3, 0.3, 0.2), mat(o.pants), 0, 0.68, 0));
  const torso = mesh(cyl(o.chestR ?? 0.28, 0.32, 0.55), mat(o.shirt), 0, 0.98, 0);
  g.add(torso);
  parts.torso = torso;
  // bras (pivot à l'épaule)
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    const ar = o.armR ?? 0.085;
    arm.position.set((0.36 + ar * 0.6) * side, 1.2, 0);
    arm.add(mesh(cyl(ar, ar * 0.9, 0.5), mat(o.sleeve ?? o.shirt), 0, -0.25, 0));
    arm.add(mesh(sphere(ar + 0.025), mat(o.hands ?? o.skin), 0, -0.52, 0));
    g.add(arm);
    parts[side < 0 ? 'armL' : 'armR'] = arm;
  }
  // tête
  const head = new THREE.Group();
  head.position.set(0, 1.55, 0);
  const hr = o.headR ?? 0.3;
  head.add(mesh(sphere(hr, 20, 16), skin));
  const eyeW = mat(0xffffff), eyeB = mat(0x1a1a2e);
  for (const side of [-1, 1]) {
    const ew = mesh(sphere(o.eyeR ?? 0.06), eyeW, 0.1 * side, 0.05, hr * 0.88);
    ew.scale.set(1, o.eyeTall ?? 1.3, 0.6);
    head.add(ew);
    head.add(mesh(sphere(0.032), eyeB, 0.1 * side, 0.04, hr * 0.88 + 0.035));
  }
  head.add(mesh(sphere(o.noseR ?? 0.06), mat(o.nose ?? o.skin), 0, -0.04, hr * 0.98));
  g.add(head);
  parts.head = head;
  g.userData.parts = parts;
  return g;
}

function cap(head, color, letter, letterColor) {
  const m = mat(color);
  const dome = mesh(new THREE.SphereGeometry(0.315, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.06, -0.01);
  head.add(dome);
  const brim = mesh(cyl(0.22, 0.22, 0.04, 20), m, 0, 0.08, 0.25);
  brim.scale.set(1.2, 1, 0.8);
  head.add(brim);
  const em = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), new THREE.MeshStandardMaterial({ map: letterTexture(letter, letterColor) }));
  em.position.set(0, 0.22, 0.25);
  em.rotation.x = -0.5;
  head.add(em);
}

function mustache(head, color) {
  const m = mat(color);
  for (const side of [-1, 1]) {
    const s = mesh(sphere(0.07), m, 0.07 * side, -0.11, 0.27);
    s.scale.set(1.5, 0.6, 0.7);
    head.add(s);
  }
}

function overalls(g, color) {
  const m = mat(color);
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.3, 0.1), m, 0, 0.92, 0.27));
  const b = mat(0xffd700, { metalness: 0.5 });
  for (const side of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(0.07, 0.38, 0.05), m, 0.13 * side, 1.08, 0.28));
    g.add(mesh(sphere(0.035), b, 0.13 * side, 1.02, 0.33));
  }
}

function smurfHat(head, color = 0xffffff, tilt = 0) {
  const m = mat(color);
  const hat = new THREE.Group();
  const base = mesh(new THREE.SphereGeometry(0.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.02, -0.02);
  base.scale.set(1, 0.9, 1);
  hat.add(base);
  const tip = mesh(new THREE.ConeGeometry(0.22, 0.45, 16), m, 0, 0.42, -0.15);
  tip.rotation.x = -1.1;
  hat.add(tip);
  hat.add(mesh(sphere(0.12), m, 0, 0.35, -0.35));
  hat.rotation.z = tilt;
  head.add(hat);
  return hat;
}

function smurfBase(extra = {}) {
  const blue = 0x3e8ee0;
  const g = humanoid({ skin: blue, shirt: blue, pants: 0xffffff, legs: 0xffffff, shoes: 0xffffff, headR: 0.36, eyeR: 0.085, eyeTall: 1.5, noseR: 0.1, ...extra });
  // petite queue
  g.add(mesh(sphere(0.08), mat(blue), 0, 0.7, -0.3));
  return g;
}

function hairBob(head, color, long = false) {
  const m = mat(color);
  const h = mesh(new THREE.SphereGeometry(0.33, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), m, 0, 0.03, -0.03);
  head.add(h);
  if (long) {
    const back = mesh(cyl(0.3, 0.36, 0.7, 18), m, 0, -0.3, -0.12);
    head.add(back);
  }
}

const BUILDERS = {
  mario() {
    const g = humanoid({ skin: 0xf3c38f, shirt: 0xe02020, pants: 0x2b4fc4, shoes: 0x6b3b1a, hands: 0xffffff, nose: 0xf0b07a, noseR: 0.08 });
    const { head } = g.userData.parts;
    cap(head, 0xe02020, 'M', '#e02020');
    mustache(head, 0x3a2414);
    overalls(g, 0x2b4fc4);
    head.add(mesh(sphere(0.12), mat(0x4a2c17), 0, -0.02, -0.22));
    return g;
  },
  luigi() {
    const g = humanoid({ skin: 0xf3c38f, shirt: 0x1ea84a, pants: 0x223c9e, shoes: 0x6b3b1a, hands: 0xffffff, nose: 0xf0b07a, noseR: 0.075 });
    const { head } = g.userData.parts;
    cap(head, 0x1ea84a, 'L', '#1ea84a');
    mustache(head, 0x3a2414);
    overalls(g, 0x223c9e);
    g.scale.set(0.95, 1.12, 0.95);
    return g;
  },
  peach() {
    const g = humanoid({ skin: 0xfbd9c0, shirt: 0xf58fc0, pants: 0xf58fc0, shoes: 0xf58fc0, legs: 0xf58fc0, hands: 0xffffff, eyeTall: 1.4 });
    const { head, legL, legR } = g.userData.parts;
    legL.visible = legR.visible = false;
    const dress = mat(0xf58fc0);
    g.add(mesh(cyl(0.3, 0.62, 0.85, 22), dress, 0, 0.42, 0));
    g.add(mesh(cyl(0.64, 0.66, 0.1, 22), mat(0xe0559a), 0, 0.05, 0));
    for (const side of [-1, 1]) g.add(mesh(sphere(0.14), mat(0xffb3d6), 0.4 * side, 1.18, 0));
    g.add(mesh(sphere(0.06), mat(0x2a6cf0, { metalness: 0.4 }), 0, 1.15, 0.3));
    hairBob(head, 0xf7d64a, true);
    const crown = mesh(cyl(0.13, 0.15, 0.14, 8, 1), mat(0xffcc00, { metalness: 0.7, roughness: 0.3 }), 0, 0.32, 0);
    head.add(crown);
    head.add(mesh(sphere(0.035), mat(0xd01030), 0, 0.33, 0.14));
    return g;
  },
  smurf_muscle() {
    const g = smurfBase({ armR: 0.16, chestR: 0.36 });
    smurfHat(g.userData.parts.head);
    // tatouage cœur sur le bras
    const heart = mesh(sphere(0.06), mat(0xd01030), 0.08, -0.15, 0.12);
    g.userData.parts.armR.add(heart);
    g.scale.set(1.08, 1, 1.08);
    return g;
  },
  smurf_lunettes() {
    const g = smurfBase();
    const { head } = g.userData.parts;
    smurfHat(head);
    const fr = mat(0x111111);
    for (const side of [-1, 1]) {
      const ring = mesh(new THREE.TorusGeometry(0.095, 0.018, 8, 20), fr, 0.12 * side, 0.06, 0.36);
      head.add(ring);
    }
    head.add(mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), fr, 0, 0.07, 0.37));
    // livre sous le bras
    g.userData.parts.armL.add(mesh(new THREE.BoxGeometry(0.06, 0.3, 0.22), mat(0x8b1d1d), 0.1, -0.35, 0.05));
    return g;
  },
  smurf_fillette() {
    const g = smurfBase({ shirt: 0xffffff, pants: 0xffffff, eyeTall: 1.6 });
    const { head, legL, legR } = g.userData.parts;
    legL.visible = legR.visible = false;
    g.add(mesh(cyl(0.3, 0.5, 0.75, 20), mat(0xffffff), 0, 0.4, 0));
    for (const side of [-1, 1]) g.add(mesh(cyl(0.07, 0.07, 0.1), mat(0xffffff), 0.14 * side, 0.03, 0.05));
    hairBob(head, 0xf9d648, true);
    smurfHat(head);
    return g;
  },
  smurf_maladroit() {
    const g = smurfBase();
    const { head } = g.userData.parts;
    smurfHat(head, 0xffffff, 0.45);
    // pansement
    const band = mesh(new THREE.BoxGeometry(0.16, 0.05, 0.02), mat(0xf2d2a2), -0.15, 0.17, 0.31);
    band.rotation.z = 0.5;
    head.add(band);
    return g;
  },
  smurf_sauvage() {
    const g = smurfBase({ pants: 0x4c9a2a, legs: 0x3e8ee0, shoes: 0x3e8ee0 });
    const { head } = g.userData.parts;
    const leaf = mat(0x4caf32);
    for (let i = 0; i < 7; i++) {
      const l = mesh(new THREE.ConeGeometry(0.1, 0.3, 4), leaf, Math.cos(i) * 0.2, 0.3 + Math.random() * 0.05, Math.sin(i * 1.7) * 0.15);
      l.rotation.set(Math.random() - 0.5, 0, (Math.random() - 0.5) * 0.8);
      head.add(l);
    }
    // jupe de feuilles
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const l = mesh(new THREE.ConeGeometry(0.1, 0.35, 4), leaf, Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3);
      l.rotation.x = Math.PI;
      g.add(l);
    }
    // barbe hirsute (petits poils)
    head.add(mesh(sphere(0.12), mat(0x8a6a3a), 0, -0.25, 0.22));
    return g;
  },
  taoki() {
    const teal = 0x29b6a8;
    const g = humanoid({ skin: teal, shirt: teal, pants: teal, shoes: 0x1d8a7f, headR: 0.36, noseR: 0.02, eyeR: 0.08 });
    const { head, torso } = g.userData.parts;
    torso.scale.set(1.25, 1.1, 1.2);
    const belly = mesh(sphere(0.26), mat(0xf6d25a), 0, 0.95, 0.2);
    belly.scale.set(1, 1.3, 0.6);
    g.add(belly);
    const snout = mesh(sphere(0.2), mat(0x3fc9bb), 0, -0.1, 0.3);
    snout.scale.set(1.2, 0.8, 1);
    head.add(snout);
    for (const side of [-1, 1]) {
      head.add(mesh(sphere(0.025), mat(0x114444), 0.07 * side, -0.07, 0.49));
      const horn = mesh(new THREE.ConeGeometry(0.06, 0.22, 10), mat(0xf6d25a), 0.18 * side, 0.32, -0.05);
      horn.rotation.z = -0.3 * side;
      head.add(horn);
      // ailes
      const wing = mesh(new THREE.ConeGeometry(0.25, 0.6, 3), mat(0x7ee0c8, { side: THREE.DoubleSide }), 0.3 * side, 1.15, -0.32);
      wing.rotation.set(0.3, 0, -1.2 * side);
      wing.scale.set(1, 1, 0.25);
      g.add(wing);
    }
    // queue
    const tail = mesh(new THREE.ConeGeometry(0.16, 0.8, 12), mat(teal), 0, 0.5, -0.55);
    tail.rotation.x = -1.9;
    g.add(tail);
    // crête
    for (let i = 0; i < 4; i++) {
      const spike = mesh(new THREE.ConeGeometry(0.06, 0.16, 6), mat(0xff8a3d), 0, 1.25 - i * 0.18, -0.36 + i * 0.02);
      spike.rotation.x = -0.6;
      g.add(spike);
    }
    g.scale.setScalar(1.08);
    return g;
  },
  lili() {
    const g = humanoid({ skin: 0xf6cfae, shirt: 0xe84a7a, pants: 0x3a62c9, legs: 0xf6cfae, shoes: 0xd12f2f, eyeTall: 1.4 });
    const { head } = g.userData.parts;
    g.add(mesh(cyl(0.3, 0.42, 0.3, 18), mat(0x3a62c9), 0, 0.62, 0));
    hairBob(head, 0x6b3a1e);
    const pony = mesh(sphere(0.13), mat(0x6b3a1e), 0, 0.05, -0.36);
    pony.scale.set(0.8, 1.6, 0.8);
    head.add(pony);
    head.add(mesh(sphere(0.06), mat(0xffd23f), 0, 0.17, -0.3));
    g.scale.setScalar(0.92);
    return g;
  },
  hugo() {
    const g = humanoid({ skin: 0xf0c49c, shirt: 0x2fa84f, pants: 0x2d4f9a, shoes: 0xffffff, legs: 0xf0c49c });
    const { head } = g.userData.parts;
    g.add(mesh(cyl(0.31, 0.33, 0.3, 18), mat(0x2d4f9a), 0, 0.58, 0));
    const hair = mesh(new THREE.SphereGeometry(0.315, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(0x3b2412), 0, 0.03, -0.02);
    head.add(hair);
    const tuft = mesh(new THREE.ConeGeometry(0.08, 0.14, 6), mat(0x3b2412), 0.05, 0.3, 0.08);
    tuft.rotation.z = -0.4;
    head.add(tuft);
    g.scale.setScalar(0.94);
    return g;
  },
};

export function buildCharacter(charId) {
  const g = (BUILDERS[charId] || BUILDERS.mario)();
  // une quarantaine de petits morceaux -> 6 maillages (corps, tête, 2 bras, 2 jambes) : bien plus fluide
  const parts = g.userData.parts;
  for (const k of ['legL', 'legR', 'armL', 'armR', 'head']) { parts[k].userData.bakeRoot = true; bake(parts[k]); }
  bake(g);
  const outer = new THREE.Group();
  outer.add(g);
  outer.userData.parts = g.userData.parts;
  outer.userData.body = g;
  return outer;
}

// Teinte rouge du chercheur
export function makeSeeker(model, on) {
  model.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    if (o.material.vertexColors) {
      // maillage fusionné : on teinte toute la matière en rouge
      o.material.color.setRGB(on ? 1 : 1, on ? 0.38 : 1, on ? 0.38 : 1);
      o.material.emissive = new THREE.Color(on ? 0x5a0000 : 0x000000);
      return;
    }
    if (!o.userData.baseColor) o.userData.baseColor = o.material.color.clone();
    if (on) {
      o.material.color.copy(o.userData.baseColor).lerp(new THREE.Color(0xff1a1a), 0.55);
      o.material.emissive = new THREE.Color(0x550000);
    } else {
      o.material.color.copy(o.userData.baseColor);
      o.material.emissive = new THREE.Color(0x000000);
    }
  });
}

export function animateCharacter(model, t, moving, speed = 1) {
  const p = model.userData.parts;
  if (!p) return;
  const s = moving ? Math.sin(t * 11 * speed) * 0.7 : 0;
  const lerp = (a, b) => a + (b - a) * 0.3;
  p.legL.rotation.x = lerp(p.legL.rotation.x, s);
  p.legR.rotation.x = lerp(p.legR.rotation.x, -s);
  p.armL.rotation.x = lerp(p.armL.rotation.x, -s * 0.8);
  p.armR.rotation.x = lerp(p.armR.rotation.x, s * 0.8);
  model.userData.body.position.y = moving ? Math.abs(Math.sin(t * 11 * speed)) * 0.06 : 0;
}

// Génère des vignettes (images) de chaque personnage pour l'écran de sélection
export function makeThumbnails(ids) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(160, 180);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 5);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(32, 160 / 180, 0.1, 50);
  cam.position.set(0.9, 1.4, 4.2);
  cam.lookAt(0, 0.95, 0);
  const out = {};
  for (const id of ids) {
    const m = buildCharacter(id);
    m.rotation.y = 0.25;
    scene.add(m);
    renderer.render(scene, cam);
    out[id] = renderer.domElement.toDataURL();
    scene.remove(m);
  }
  renderer.dispose();
  return out;
}
