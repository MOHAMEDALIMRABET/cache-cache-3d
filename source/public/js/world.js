// Construction 3D des environnements (désert, ville, parc, grande maison) à partir des données de la carte.
import * as THREE from 'three';

const mats = new Map();
const mat = (color, extra) => {
  const key = color + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra }));
  return mats.get(key);
};
const M = (geo, color, x = 0, y = 0, z = 0, extra) => {
  const m = new THREE.Mesh(geo, mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const B = (w, h, d, color, x = 0, y = h / 2, z = 0, extra) => M(new THREE.BoxGeometry(w, h, d), color, x, y, z, extra);
const C = (rt, rb, h, color, x = 0, y = h / 2, z = 0, seg = 16) => M(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z);
const S = (r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = M(new THREE.SphereGeometry(r, 16, 12), color, x, y, z); m.scale.set(sx, sy, sz); return m; };
const K = (r, h, color, x = 0, y = h / 2, z = 0, seg = 12) => M(new THREE.ConeGeometry(r, h, seg), color, x, y, z);

function tree(g, h, trunk = 0x7a4f2a, leaves = 0x3f9a3a) {
  g.add(C(0.3, 0.4, h * 0.5, trunk));
  g.add(S(1.4, leaves, 0, h * 0.6, 0, 1, 0.9, 1));
  g.add(S(1.1, leaves, 0.5, h * 0.8, 0.3));
  g.add(S(1, leaves, -0.5, h * 0.75, -0.3));
}

// Un constructeur par type d'objet. o = obstacle (w,d,h ou r,h)
const KINDS = {
  // ---- Désert
  pyramid: (g, o) => { const p = M(new THREE.ConeGeometry(o.w * 0.72, o.h, 4), 0xd9b56a, 0, o.h / 2, 0); p.rotation.y = Math.PI / 4; g.add(p); },
  ruin: (g, o) => { g.add(B(o.w, o.h, o.d, 0xc8a46a)); for (let i = 0; i < 4; i++) g.add(B(0.8, 0.5, 0.8, 0xb8945a, (Math.random() - 0.5) * o.w, o.h + 0.25 - Math.random() * 0.5, (Math.random() - 0.5) * o.d)); },
  oasis: (g, o) => { g.add(C(o.r, o.r, 0.12, 0x2c8fd6, 0, 0.06, 0, 32)); g.add(C(o.r + 0.6, o.r + 0.6, 0.05, 0x7cc35a, 0, 0.02, 0, 32)); },
  well: (g, o) => { g.add(C(o.r, o.r, 1, 0x9c8a74, 0, 0.5, 0, 16)); g.add(C(o.r * 0.8, o.r * 0.8, 0.02, 0x1a2a3a, 0, 1.01)); g.add(B(0.15, 1.6, 0.15, 0x6b4a2b, -o.r, 1.6)); g.add(B(0.15, 1.6, 0.15, 0x6b4a2b, o.r, 1.6)); const roof = K(o.r * 1.5, 0.8, 0x8b3a2b, 0, 2.7, 0, 4); roof.rotation.y = Math.PI / 4; g.add(roof); },
  tent: (g, o) => { const t = K(o.w * 0.75, o.h, Math.random() < 0.5 ? 0xd94b3b : 0x3b7bd9, 0, o.h / 2, 0, 6); g.add(t); g.add(K(o.w * 0.3, o.h * 0.6, 0x222222, 0, o.h * 0.3, o.w * 0.45, 3)); },
  palm: (g, o) => { const t = C(0.25, 0.35, o.h, 0x8a6a3e); t.rotation.z = 0.12; g.add(t); for (let i = 0; i < 6; i++) { const l = B(0.6, 0.08, 2.8, 0x3caa44, Math.sin(i) * 1, o.h, Math.cos(i) * 1); l.rotation.y = i; l.rotation.x = 0.4; g.add(l); } g.add(S(0.25, 0x6b4a2b, 0.2, o.h - 0.3, 0)); },
  sarcophagus: (g, o) => { g.add(B(o.w, o.h, o.d, 0xd4a017, 0, o.h / 2, 0, { metalness: 0.5, roughness: 0.4 })); g.add(S(0.4, 0x2a5fd4, 0, o.h, o.d / 2 - 0.5, 1, 0.4, 1)); },
  cart: (g, o) => { g.add(B(o.w, 0.8, o.d, 0x8b5a2b, 0, 1.1)); for (const s of [-1, 1]) { const w = C(0.6, 0.6, 0.15, 0x5a3a1b, s * (o.w / 2 + 0.05), 0.6, 0); w.rotation.z = Math.PI / 2; g.add(w); } g.add(B(o.w, 0.6, 0.6, 0xe8d7a0, 0, 1.8, -0.4)); },
  bigrock: (g, o) => { g.add(S(o.r, 0xa0855f, 0, o.h * 0.4, 0, 1, 0.8, 1)); g.add(S(o.r * 0.6, 0x8f7552, o.r * 0.6, o.h * 0.25, 0.3)); },
  rock: (g, o) => g.add(S(o.r, 0xa08a6a, 0, o.r * 0.4, 0, 1, 0.6, 1)),
  barrel: (g, o) => { g.add(C(o.r, o.r * 0.9, o.h, 0x8b5a2b)); for (const y of [0.25, o.h - 0.25]) g.add(C(o.r + 0.02, o.r + 0.02, 0.08, 0x444444, 0, y)); },
  crates: (g, o) => { g.add(B(1.1, 1, 1.1, 0xb07d3e, -0.5, 0.5, -0.4)); g.add(B(1.1, 1, 1.1, 0xa06d2e, 0.55, 0.5, 0.35)); g.add(B(1.1, 1, 1.1, 0xc08d4e, 0, 1.5, 0)); },
  camel: (g, o) => { const c = 0xc89a5a; g.add(S(0.8, c, 0, 1.4, 0, 0.8, 0.7, 1.4)); g.add(S(0.45, c, 0, 2.0, -0.1)); for (const [x, z] of [[-0.3, -0.8], [0.3, -0.8], [-0.3, 0.8], [0.3, 0.8]]) g.add(C(0.12, 0.1, 1.1, c, x, 0.55, z)); const n = C(0.15, 0.2, 1, c, 0, 1.9, 1.2); n.rotation.x = 0.5; g.add(n); g.add(S(0.3, c, 0, 2.4, 1.5, 0.8, 0.8, 1.3)); },
  bush: (g, o) => { const col = o.kind === 'bush' && o.h < 1.4 ? 0x8a8a3a : 0x2f8a35; g.add(S(o.r, col, 0, o.r * 0.6, 0)); g.add(S(o.r * 0.7, col, o.r * 0.5, o.r * 0.5, 0.3)); g.add(S(o.r * 0.7, col, -o.r * 0.4, o.r * 0.6, -0.3)); },
  cactus: (g, o) => { g.add(C(0.35, 0.4, o.h, 0x3f8f3a)); const a = C(0.2, 0.2, 1, 0x3f8f3a, 0.55, o.h * 0.55); g.add(a); const j = C(0.2, 0.2, 0.4, 0x3f8f3a, 0.35, o.h * 0.4); j.rotation.z = Math.PI / 2; g.add(j); },
  // ---- Ville
  building: (g, o) => {
    g.add(B(o.w, o.h, o.d, o.color ?? 0xcccccc));
    g.add(B(o.w + 0.3, 0.3, o.d + 0.3, 0x555555, 0, o.h + 0.15));
    const wm = mat(0x9fd3f5, { emissive: 0x1a3550, roughness: 0.2 });
    for (let y = 1.8; y < o.h - 0.8; y += 3) for (let x = -o.w / 2 + 1.5; x < o.w / 2 - 0.5; x += 2.5) for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), wm);
      w.position.set(x, y, s * (o.d / 2 + 0.01)); if (s < 0) w.rotation.y = Math.PI; g.add(w);
    }
  },
  fountain: (g, o) => { g.add(C(o.r, o.r, 0.7, 0xb0b0b0, 0, 0.35, 0, 24)); g.add(C(o.r - 0.2, o.r - 0.2, 0.05, 0x3a9ae0, 0, 0.66, 0, 24)); g.add(C(0.25, 0.3, 2, 0xb0b0b0, 0, 1)); g.add(S(0.6, 0x3a9ae0, 0, 2.2, 0, 1, 0.5, 1)); },
  phonebooth: (g, o) => { g.add(B(o.w, o.h, o.d, 0xc8102e)); g.add(B(o.w * 0.8, o.h * 0.6, 0.02, 0xbfe6ff, 0, o.h * 0.5, o.d / 2 + 0.01, { transparent: true, opacity: 0.7 })); },
  kiosk: (g, o) => { g.add(B(o.w, o.h, o.d, 0x2d6a4f)); g.add(B(o.w + 0.6, 0.2, o.d + 0.6, 0x1b4332, 0, o.h + 0.1)); g.add(B(o.w * 0.8, 0.6, 0.1, 0xffe066, 0, 1.4, o.d / 2 + 0.05)); },
  foodtruck: (g, o) => { g.add(B(o.w, o.h - 0.6, o.d, 0xf4a261, 0, (o.h - 0.6) / 2 + 0.6)); g.add(B(o.w + 0.02, 0.8, 1.6, 0x264653, 0, 1.9, 0)); g.add(S(0.6, 0xffd166, 0, o.h + 0.4, 0, 1, 0.6, 0.6)); for (const [x, z] of [[-1, -1.6], [1, -1.6], [-1, 1.6], [1, 1.6]]) { const w = C(0.4, 0.4, 0.3, 0x222222, x * o.w / 2, 0.4, z); w.rotation.z = Math.PI / 2; g.add(w); } },
  busstop: (g, o) => { g.add(B(o.w, 0.1, o.d, 0x666666, 0, o.h)); g.add(B(o.w, o.h, 0.08, 0xbfe6ff, 0, o.h / 2, -o.d / 2, { transparent: true, opacity: 0.6 })); g.add(B(o.w * 0.8, 0.5, 0.5, 0x8b5a2b, 0, 0.45, -0.2)); },
  dumpster: (g, o) => g.add(B(o.w, o.h, o.d, o.x > 0 ? 0x2a7a3a : 0x2a4a7a)),
  scaffold: (g, o) => { for (const x of [-o.w / 2, 0, o.w / 2]) for (const z of [-o.d / 2, o.d / 2]) g.add(B(0.1, o.h, 0.1, 0x999999, x, o.h / 2, z)); g.add(B(o.w, 0.1, o.d, 0xa07040, 0, o.h)); g.add(B(o.w, o.h * 0.9, 0.05, 0x2a8a8a, 0, o.h * 0.45, o.d / 2, { transparent: true, opacity: 0.85 })); },
  container: (g, o) => g.add(B(o.w, o.h, o.d, 0xc0392b)),
  car: (g, o) => {
    const inner = new THREE.Group();
    const L = Math.max(o.w, o.d);
    inner.add(B(L, 0.8, 1.9, o.color, 0, 0.7));
    inner.add(B(L * 0.55, 0.65, 1.7, o.color, -0.2, 1.4));
    inner.add(B(L * 0.5, 0.5, 1.72, 0x223344, -0.2, 1.42, 0, { roughness: 0.2 }));
    for (const x of [-L / 2 + 0.7, L / 2 - 0.7]) for (const z of [-0.95, 0.95]) { const w = C(0.38, 0.38, 0.25, 0x111111, x, 0.38, z); w.rotation.x = Math.PI / 2; inner.add(w); }
    if (o.rot) inner.rotation.y = Math.PI / 2;
    g.add(inner);
  },
  trashbin: (g, o) => { g.add(C(o.r, o.r * 0.85, o.h, 0x4a5a6a)); g.add(C(o.r + 0.05, o.r + 0.05, 0.1, 0x3a4a5a, 0, o.h)); },
  hedgebox: (g, o) => { g.add(B(o.w, 0.8, o.d, 0x8b6b4b)); g.add(S(o.w * 0.55, 0x3f9a3a, 0, 1.1, 0, 1, 0.6, 1)); },
  lamp: (g, o) => { g.add(C(0.08, 0.12, o.h, 0x333333)); g.add(S(0.25, 0xfff3b0, 0, o.h, 0)); },
  tree: (g, o) => tree(g, o.h),
  // ---- Parc
  pond: (g, o) => { g.add(C(o.r, o.r, 0.1, 0x3a8ed6, 0, 0.05, 0, 32)); const rim = M(new THREE.TorusGeometry(o.r, 0.25, 8, 32), 0x8a8a8a, 0, 0.08, 0); rim.rotation.x = Math.PI / 2; g.add(rim); },
  bandstand: (g, o) => { g.add(C(o.w / 2, o.w / 2, 0.5, 0xe9e2d0, 0, 0.25, 0, 8)); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(C(0.1, 0.1, o.h - 0.5, 0xffffff, Math.cos(a) * (o.w / 2 - 0.3), o.h / 2, Math.sin(a) * (o.w / 2 - 0.3))); } g.add(K(o.w / 2 + 0.4, 1.4, 0x2d6a4f, 0, o.h + 0.6, 0, 8)); },
  playhouse: (g, o) => { g.add(B(o.w, o.h - 1, o.d, 0xffb4a2)); const r = K(o.w * 0.8, 1.2, 0xe5383b, 0, o.h - 0.4, 0, 4); r.rotation.y = Math.PI / 4; g.add(r); g.add(B(0.8, 1.2, 0.05, 0x6d4c41, 0, 0.6, o.d / 2 + 0.02)); },
  slide: (g, o) => { g.add(B(o.w, o.h, 1.5, 0xf4d35e, 0, o.h / 2, -o.d / 2 + 0.75)); const s = B(1.2, 0.15, o.d, 0x3a86ff, 0, o.h / 2, 0.3); s.rotation.x = 0.5; g.add(s); const t = C(0.7, 0.7, 1.6, 0xff006e, 0, o.h * 0.75, -o.d / 2 + 0.75); t.rotation.x = Math.PI / 2; g.add(t); },
  shed: (g, o) => { g.add(B(o.w, o.h - 0.8, o.d, 0x8d6e63)); const r = B(o.w + 0.4, 0.15, o.d + 0.6, 0x4e342e, 0, o.h - 0.5); r.rotation.z = 0.2; g.add(r); },
  statue: (g, o) => { g.add(B(1.8, 1.4, 1.8, 0xaaaaaa)); g.add(S(0.6, 0xc7c7b8, 0, 2.4, 0, 1, 1.4, 1)); g.add(S(0.35, 0xc7c7b8, 0, 3.6, 0)); },
  boat: (g, o) => { g.add(S(0.8, 0xb5651d, 0, 0.35, 0, 0.9, 0.45, 1.9)); g.add(B(0.1, 0.05, 2.6, 0x8b4513, 0.3, 0.6, 0)); },
  bench: (g, o) => { g.add(B(o.w, 0.12, o.d, 0x8b5a2b, 0, 0.5)); g.add(B(o.w, 0.5, 0.1, 0x8b5a2b, 0, 0.85, -o.d / 2)); for (const x of [-o.w / 2 + 0.2, o.w / 2 - 0.2]) g.add(B(0.1, 0.5, o.d, 0x333333, x, 0.25)); },
  hedge: (g, o) => g.add(B(o.w, o.h, o.d, 0x2f7a2f)),
  hollowtree: (g, o) => { g.add(C(o.r * 0.9, o.r * 1.1, o.h * 0.5, 0x6b4423)); g.add(S(0.35, 0x1a1008, 0, 0.8, o.r * 0.8, 1, 1.5, 0.3)); g.add(S(2, 0x2e8b3a, 0, o.h * 0.65, 0, 1, 0.8, 1)); },
  leafpile: (g, o) => { for (let i = 0; i < 5; i++) g.add(S(0.8, [0xd9822b, 0xc0392b, 0xe6b422][i % 3], (Math.random() - 0.5) * 1.2, 0.3, (Math.random() - 0.5) * 1.2, 1, 0.6, 1)); },
  icecream: (g, o) => { g.add(B(o.w, 1.2, o.d, 0xffffff, 0, 0.9)); for (let i = 0; i < 6; i++) g.add(B(o.w / 6, 0.1, o.d, i % 2 ? 0xff8fab : 0xffffff, -o.w / 2 + o.w / 12 + i * o.w / 6, 2.4)); g.add(C(0.04, 0.04, 1, 0x999999, 0, 1.9)); },
  flowerbed: (g, o) => { g.add(C(o.r, o.r, 0.2, 0x5d4037, 0, 0.1)); for (let i = 0; i < 8; i++) g.add(S(0.15, [0xff006e, 0xffbe0b, 0x8338ec, 0xffffff][i % 4], Math.cos(i) * o.r * 0.6, 0.35, Math.sin(i * 1.3) * o.r * 0.6)); },
  // ---- Maison
  wall: (g, o) => { g.add(B(o.w, o.h, o.d, 0xf1e6d2)); g.add(B(o.w + 0.02, 0.25, o.d + 0.02, 0xc9b79c, 0, 0.12)); },
  bed: (g, o) => { g.add(B(o.w, 0.5, o.d, 0x6d4c41, 0, 0.35)); g.add(B(o.w - 0.1, 0.25, o.d - 0.6, 0x4f86c6, 0, 0.72, 0.3)); g.add(B(o.w, 1.3, 0.2, 0x5d4037, 0, 0.65, -o.d / 2)); g.add(B(1.2, 0.2, 0.6, 0xffffff, -0.9, 0.8, -o.d / 2 + 0.5)); g.add(B(1.2, 0.2, 0.6, 0xffffff, 0.9, 0.8, -o.d / 2 + 0.5)); },
  wardrobe: (g, o) => { g.add(B(o.w, o.h, o.d, 0x8d6e63)); g.add(B(0.05, o.h - 0.3, 0.05, 0x3e2723, o.w / 2 + 0.01, o.h / 2)); },
  curtain: (g, o) => { for (let i = 0; i < 6; i++) g.add(C(0.18, 0.22, o.h, 0xb5179e, -o.w / 2 + 0.25 + i * (o.w - 0.5) / 5, o.h / 2, 0)); g.add(B(o.w + 0.4, 0.1, 0.1, 0x555555, 0, o.h)); },
  nightstand: (g, o) => { g.add(B(o.w, o.h, o.d, 0x8d6e63)); g.add(C(0.15, 0.2, 0.4, 0xffe082, 0, o.h + 0.2)); },
  bathtub: (g, o) => { g.add(B(o.w, o.h, o.d, 0xffffff)); g.add(B(o.w - 0.3, 0.05, o.d - 0.3, 0x9ad0f5, 0, o.h - 0.1)); for (let i = 0; i < 6; i++) g.add(S(0.2, 0xffffff, (Math.random() - 0.5) * 3, o.h + 0.05, (Math.random() - 0.5) * 1.4)); },
  laundry: (g, o) => { g.add(C(o.w / 2, o.w / 2.3, o.h, 0xd7b98e)); g.add(S(0.5, 0x90caf9, 0, o.h, 0, 1, 0.4, 1)); },
  sink: (g, o) => { g.add(B(o.w, o.h, o.d, 0xeeeeee)); g.add(B(o.w, 1, 0.05, 0xaad4f5, 0, o.h + 0.7, -o.d / 2, { roughness: 0.1, metalness: 0.6 })); },
  fridge: (g, o) => { g.add(B(o.w, o.h, o.d, 0xf5f5f5)); g.add(B(0.05, 0.6, 0.05, 0x888888, -o.w / 2 - 0.02, o.h * 0.7, 0.5)); },
  counter: (g, o) => { g.add(B(o.w, o.h, o.d, 0xa1887f)); g.add(B(o.w, 0.06, o.d + 0.05, 0x424242, 0, o.h)); },
  kitchentable: (g, o) => { g.add(B(o.w, 0.1, o.d, 0xd7a86e, 0, o.h)); g.add(B(o.w + 0.1, 0.7, o.d + 0.1, 0xe63946, 0, o.h - 0.32, 0, { transparent: true, opacity: 0.9 })); },
  cupboard: (g, o) => g.add(B(o.w, o.h, o.d, 0xbcaaa4)),
  sofa: (g, o) => { g.add(B(o.w, 0.5, o.d, 0x2a9d8f, 0, 0.35)); g.add(B(o.w, 0.8, 0.4, 0x2a9d8f, 0, 0.9, -o.d / 2 + 0.2)); for (const s of [-1, 1]) g.add(B(0.4, 0.75, o.d, 0x268f82, s * (o.w / 2 - 0.2), 0.55)); },
  tv: (g, o) => { g.add(B(o.w, 0.6, o.d, 0x5d4037, 0, 0.3)); g.add(B(o.w * 0.9, 1, 0.08, 0x111111, 0, 1.2)); },
  piano: (g, o) => { g.add(B(o.w, o.h - 0.5, o.d, 0x111111, 0, (o.h - 0.5) / 2 + 0.5, 0, { roughness: 0.2 })); for (const x of [-1, 1]) g.add(B(0.12, 0.5, 0.12, 0x111111, x * (o.w / 2 - 0.1), 0.25)); g.add(B(o.w - 0.2, 0.05, 0.3, 0xffffff, 0, o.h - 0.4, o.d / 2)); },
  plant: (g, o) => { g.add(C(0.4, 0.3, 0.6, 0xbf6b3a)); g.add(S(0.7, 0x2e7d32, 0, 1.4, 0, 1, 1.4, 1)); },
  fireplace: (g, o) => { g.add(B(o.w, o.h, o.d, 0x8d6e63)); g.add(B(0.1, 1, 1.6, 0x111111, -o.w / 2, 0.6)); g.add(S(0.3, 0xff7b00, -o.w / 2 + 0.3, 0.3, 0, 1, 1, 1)); },
  desk: (g, o) => { g.add(B(o.w, 0.1, o.d, 0x795548, 0, o.h)); for (const x of [-1, 1]) g.add(B(0.6, o.h, o.d, 0x6d4c41, x * (o.w / 2 - 0.3), o.h / 2)); g.add(B(0.8, 0.5, 0.05, 0x111111, 0, o.h + 0.3, -0.4)); },
  bookcase: (g, o) => { g.add(B(o.w, o.h, o.d, 0x6d4c41)); for (let y = 0.5; y < o.h; y += 0.7) for (let z = -o.d / 2 + 0.3; z < o.d / 2; z += 0.35) g.add(B(0.2, 0.5, 0.25, [0xc62828, 0x1565c0, 0x2e7d32, 0xf9a825][Math.floor(Math.random() * 4)], o.w / 2 - 0.05, y + 0.25, z)); },
  boxes: (g, o) => { g.add(B(1.1, 0.9, 1.1, 0xc8a165, -0.4, 0.45, 0)); g.add(B(1, 0.9, 1, 0xb8915a, 0.5, 0.45, 0.2)); g.add(B(0.9, 0.8, 0.9, 0xd4ae72, 0, 1.3, 0)); },
  toychest: (g, o) => { g.add(B(o.w, o.h, o.d, 0xf4a261)); g.add(B(o.w + 0.05, 0.12, o.d + 0.05, 0xe76f51, 0, o.h)); g.add(S(0.25, 0xe63946, 0.4, o.h + 0.2, 0)); },
  ballpit: (g, o) => { g.add(B(o.w, o.h, o.d, 0x48cae4, 0, o.h / 2, 0, { transparent: true, opacity: 0.5 })); for (let i = 0; i < 26; i++) g.add(S(0.15, [0xff006e, 0xffbe0b, 0x3a86ff, 0x8ac926][i % 4], (Math.random() - 0.5) * (o.w - 0.4), o.h - 0.05 + Math.random() * 0.1, (Math.random() - 0.5) * (o.d - 0.4))); },
  coatrack: (g, o) => { g.add(C(0.06, 0.06, o.h, 0x5d4037)); for (let i = 0; i < 3; i++) g.add(S(0.45, [0x6a4c93, 0x8b0000, 0x1d3557][i], Math.cos(i * 2) * 0.25, o.h - 0.8, Math.sin(i * 2) * 0.25, 1, 2, 1)); },
  shoerack: (g, o) => g.add(B(o.w, o.h, o.d, 0x8d6e63)),
};

const THEMES = {
  desert: { sky: 0xf3d9a4, fog: [35, 110], ground: 0xe8c98a, sun: 0xfff1d6, hemi: [0xfff3d6, 0xc9a26b] },
  ville: { sky: 0xa6d0f5, fog: [40, 120], ground: 0x707780, sun: 0xffffff, hemi: [0xdbeeff, 0x666666] },
  parc: { sky: 0x9fd8ff, fog: [40, 120], ground: 0x69b34c, sun: 0xffffff, hemi: [0xe6f6ff, 0x4f7f3a] },
  maison: { sky: 0x2b2d42, fog: [40, 100], ground: 0x5d8a3a, sun: 0xfff3e0, hemi: [0xffffff, 0x8a7a6a] },
};

export function buildWorld(scene, map) {
  const theme = THEMES[map.id];
  const root = new THREE.Group();
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.sky, ...theme.fog);
  root.add(new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], 1.3));
  const sun = new THREE.DirectionalLight(theme.sun, 2.2);
  sun.position.set(25, 40, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
  root.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat(theme.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  const flat = (w, d, color, x, z, y = 0.02) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color)); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; root.add(p); };

  if (map.id === 'ville') {
    flat(10, 60, 0x3a3d42, 0, 0); flat(60, 10, 0x3a3d42, 0, 0, 0.021);
    for (let i = -28; i < 30; i += 4) { flat(0.3, 2, 0xffffff, 0, i, 0.03); flat(2, 0.3, 0xffffff, i, 0, 0.03); }
    for (let i = -4; i <= 4; i += 1.2) { flat(0.6, 3, 0xffffff, i, 7, 0.031); }
  }
  if (map.id === 'parc') {
    flat(4, 60, 0xd8c08f, 0, 0); flat(60, 4, 0xd8c08f, 0, 0, 0.021);
    const circle = new THREE.Mesh(new THREE.CircleGeometry(7, 32), mat(0xd8c08f)); circle.rotation.x = -Math.PI / 2; circle.position.y = 0.022; root.add(circle);
  }
  if (map.id === 'maison') {
    flat(40, 36, 0xc8955f, 0, 0, 0.02);
    flat(6, 4, 0x9d0208, 0, 4, 0.03);       // tapis du salon
    flat(10, 12, 0xdfe7ec, 0, -11, 0.025);  // carrelage salle de bain
    flat(12, 12, 0xe9e4d8, 13, -11, 0.025); // carrelage cuisine
    flat(12, 10, 0x7fb3d5, 14, 12, 0.025);  // salle de jeux
    for (const [x, z] of [[-13, 0], [13, 0], [0, -4]]) { const l = new THREE.PointLight(0xffe9c4, 25, 18); l.position.set(x, 3, z); root.add(l); }
  }
  if (map.id === 'desert') {
    for (const d of map.decor) root.add(S(d.s, 0xdcb978, d.x, -d.s * 0.75, d.z, 1.4, 1, 1));
  }

  const spotObjects = new Map();
  const blockers = [];
  for (const o of map.obstacles) {
    const g = new THREE.Group();
    g.position.set(o.x, 0, o.z);
    const build = KINDS[o.kind];
    if (build) build(g, o);
    else g.add(o.shape === 'circle' ? C(o.r, o.r, o.h, 0x999999) : B(o.w, o.h, o.d, 0x999999));
    root.add(g);
    if (o.spotId != null) spotObjects.set(o.spotId, g);
    if (o.h > 2.2 && o.kind !== 'tree' && o.kind !== 'palm' && o.kind !== 'lamp') blockers.push(g);
  }
  scene.add(root);
  return { root, spotObjects, blockers };
}
