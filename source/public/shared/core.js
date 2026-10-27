// Cœur du jeu partagé : utilisé par le serveur (mode en ligne) ET par le navigateur (mode solo).
// Contient : configuration, personnages, génération des cartes, collisions, règles, scores et bots.

export const CONFIG = {
  MAX_PLAYERS: 8,
  REVEAL_TIME: 6,          // tirage au sort du chercheur + environnement
  HIDE_TIME: 30,           // temps pour se cacher (le chercheur a les yeux fermés)
  SEARCH_BASE: 120,        // temps de recherche = 2 min + 30 s par joueur caché (max 6 min)
  SEARCH_PER_HIDER: 30,
  SEARCH_MAX: 360,
  ROUND_END_TIME: 10,
  HIDER_SPEED: 5.4,
  SEEKER_SPEED: 6.0,
  RADIUS: 0.45,
  CATCH_DIST: 1.3,         // toucher un joueur visible = trouvé
  SEARCH_DIST: 2.6,        // distance pour fouiller une cachette
  SEARCH_COOLDOWN: 1.0,
  EMPTY_PENALTY: 5,        // fouille d'une cachette vide : -5 s au chronomètre
  HINT_LAST: 60,           // dernière minute : une cachette occupée "éternue" régulièrement
  HINT_EVERY: 15,
  // Points
  PTS_FIND: 100,
  PTS_ALL_FOUND: 150,
  PTS_PER_SEC_LEFT: 2,
  PTS_PER_SEC_HIDDEN: 1,
  PTS_SURVIVE: 150,
  PTS_LAST_STANDING: 50,
};

export const CHARACTERS = [
  { id: 'mario', name: 'Mario' },
  { id: 'luigi', name: 'Luigi' },
  { id: 'peach', name: 'Peach' },
  { id: 'smurf_muscle', name: 'Schtroumpf Costaud' },
  { id: 'smurf_lunettes', name: 'Schtroumpf à lunettes' },
  { id: 'smurf_fillette', name: 'Schtroumpfette' },
  { id: 'smurf_maladroit', name: 'Schtroumpf Maladroit' },
  { id: 'smurf_sauvage', name: 'Schtroumpf Sauvage' },
  { id: 'taoki', name: 'Taoki le dragon' },
  { id: 'lili', name: 'Lili' },
  { id: 'hugo', name: 'Hugo' },
];

export const MAPS = [
  { id: 'desert', name: 'Le Désert' },
  { id: 'ville', name: 'La Ville' },
  { id: 'parc', name: 'Le Parc' },
  { id: 'maison', name: 'La Grande Maison' },
];

const BOT_NAMES = ['Bob', 'Zoé', 'Max', 'Léa', 'Tom', 'Inès', 'Noé', 'Jade', 'Sam', 'Lou'];

// ---------- Aléatoire déterministe ----------
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const shuffle = (arr, r = Math.random) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ---------- Génération des cartes ----------
// Chaque obstacle : { kind, x, z, shape:'box'|'circle', w, d | r, h, rot?, color?, solid, spot? }
// Une cachette (spot) est un obstacle avec spot = { id, name }.
export function buildMap(mapId, seed) {
  const r = rng(seed);
  const map = { id: mapId, half: 30, obstacles: [], spots: [], decor: [], spawn: { x: 0, z: 0 }, foundZone: { x: 0, z: -4 } };
  const H = map.half;
  const add = (o) => {
    o.solid = o.solid !== false;
    map.obstacles.push(o);
    if (o.spot) { o.spot.id = map.spots.length; o.spot.x = o.x; o.spot.z = o.z; map.spots.push(o.spot); o.spotId = o.spot.id; }
    return o;
  };
  const free = (x, z, rad, clear = 7) => {
    if (Math.abs(x) > H - rad - 1 || Math.abs(z) > H - rad - 1) return false;
    if (Math.hypot(x - map.spawn.x, z - map.spawn.z) < clear + rad) return false;
    for (const o of map.obstacles) {
      const orad = o.shape === 'circle' ? o.r : Math.hypot(o.w, o.d) / 2;
      if (Math.hypot(x - o.x, z - o.z) < rad + orad + 1.6) return false;
    }
    return true;
  };
  const scatter = (n, rad, make, area = H - 2) => {
    let placed = 0, tries = 0;
    while (placed < n && tries++ < 600) {
      const x = (r() * 2 - 1) * area, z = (r() * 2 - 1) * area;
      if (free(x, z, rad)) { add(make(x, z)); placed++; }
    }
  };
  const box = (kind, x, z, w, d, h, extra = {}) => ({ kind, x, z, shape: 'box', w, d, h, ...extra });
  const circ = (kind, x, z, rad, h, extra = {}) => ({ kind, x, z, shape: 'circle', r: rad, h, ...extra });

  if (mapId === 'desert') {
    add(box('pyramid', -17, -17, 11, 11, 8));
    add(box('ruin', 14, -18, 9, 1.2, 3));
    add(box('ruin', 18, -14, 1.2, 7, 2.4));
    add(circ('oasis', 15, 14, 4.5, 0.1));
    add(circ('well', -6, 15, 1.2, 1.2, { spot: { name: 'Dans le vieux puits' } }));
    add(box('tent', 9, 4, 3.4, 3.4, 2.6, { spot: { name: 'Dans la tente du nomade' } }));
    add(box('tent', -14, 6, 3.4, 3.4, 2.6, { spot: { name: 'Dans la tente rayée' } }));
    add(circ('palm', 10, 17, 0.5, 6));
    add(circ('palm', 20.5, 10, 0.5, 6));
    add(circ('palm', 21, 17.5, 0.5, 6));
    add(box('sarcophagus', -11, -10, 1.2, 2.6, 1.1, { spot: { name: 'Dans le sarcophage' } }));
    add(box('cart', 4, -14, 2.2, 3.2, 1.6, { spot: { name: 'Sous la charrette' } }));
    scatter(5, 1.4, (x, z) => circ('bigrock', x, z, 1.6, 2.4, { spot: { name: 'Derrière le gros rocher' } }));
    scatter(4, 0.7, (x, z) => circ('barrel', x, z, 0.65, 1.3, { spot: { name: "Dans le tonneau d'eau" } }));
    scatter(3, 1.2, (x, z) => box('crates', x, z, 2.2, 2.2, 2, { spot: { name: 'Dans la pile de caisses' } }));
    scatter(2, 1.3, (x, z) => box('camel', x, z, 1.4, 3, 2.2, { spot: { name: 'Derrière le chameau' } }));
    scatter(2, 1, (x, z) => circ('bush', x, z, 1, 1.2, { spot: { name: 'Dans le buisson sec' } }));
    scatter(14, 0.5, (x, z) => circ('cactus', x, z, 0.45, 2.5 + r() * 1.5));
    scatter(10, 0.8, (x, z) => circ('rock', x, z, 0.7 + r() * 0.5, 1));
    for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = H + 8 + r() * 25; map.decor.push({ kind: 'dune', x: Math.cos(a) * d, z: Math.sin(a) * d, s: 4 + r() * 7 }); }
  }

  if (mapId === 'ville') {
    // Pâtés de maisons sur les bords, routes en croix
    const blocks = [[-21, -21], [21, -21], [-21, 21], [21, 21], [-21, 4], [21, -4]];
    for (const [x, z] of blocks) add(box('building', x, z, 12, 10, 6 + Math.floor(r() * 4) * 3, { color: pick(r, [0xd98c5f, 0xc9b79c, 0x9fb7c9, 0xe0c068, 0xb0a0c8, 0x8fbf9f]) }));
    add(box('building', 4, 22, 9, 12, 12, { color: 0xa98274 }));
    add(circ('fountain', 0, 9, 2.2, 1.2));
    add(box('phonebooth', -6, -9, 1.3, 1.3, 2.6, { spot: { name: 'Dans la cabine téléphonique' } }));
    add(box('kiosk', 9, -9, 2.8, 2.4, 2.6, { spot: { name: 'Dans le kiosque à journaux' } }));
    add(box('foodtruck', -10, 13, 2.6, 5, 3, { spot: { name: 'Dans le camion à frites' } }));
    add(box('busstop', 11, 11, 4, 1.4, 2.6, { spot: { name: "Derrière l'abribus" } }));
    add(box('dumpster', -26, -9, 2.6, 1.6, 1.6, { spot: { name: 'Dans la benne' } }));
    add(box('dumpster', 26, 9, 2.6, 1.6, 1.6, { spot: { name: 'Dans la benne verte' } }));
    add(box('scaffold', -10, 26, 6, 2, 4, { spot: { name: "Sous l'échafaudage" } }));
    add(box('container', 8, -26, 6, 2.4, 2.6, { spot: { name: 'Dans le conteneur' } }));
    const carSpots = ['Dans la voiture rouge', 'Dans la voiture bleue', 'Dans le taxi', 'Dans la camionnette'];
    const carCols = [0xd23b3b, 0x3b6bd2, 0xf2c230, 0xeeeeee];
    const carPos = [[-3, -17], [-4, 15], [-12, -5], [12, 4]];
    carPos.forEach(([x, z], i) => add(box('car', x, z, i % 2 ? 2 : 4.2, i % 2 ? 4.2 : 2, 1.6, { color: carCols[i], spot: { name: carSpots[i] }, rot: i % 2 })));
    scatter(4, 0.6, (x, z) => circ('trashbin', x, z, 0.55, 1.2, { spot: { name: 'Dans la poubelle' } }), 26);
    scatter(3, 1, (x, z) => box('hedgebox', x, z, 2, 2, 1.6, { spot: { name: 'Dans la jardinière' } }), 26);
    scatter(8, 0.3, (x, z) => circ('lamp', x, z, 0.25, 4.5), 26);
    scatter(4, 0.5, (x, z) => circ('tree', x, z, 0.5, 5), 26);
  }

  if (mapId === 'parc') {
    add(circ('pond', 14, -12, 6, 0.1));
    add(box('bandstand', -14, -12, 6, 6, 4, { spot: { name: 'Sous le kiosque à musique' } }));
    add(box('playhouse', 12, 12, 3, 3, 3, { spot: { name: 'Dans la cabane des enfants' } }));
    add(box('slide', 6, 18, 2, 5, 3, { spot: { name: 'Dans le tunnel du toboggan' } }));
    add(box('shed', -20, 18, 4, 3, 3, { spot: { name: 'Dans la cabane du jardinier' } }));
    add(circ('statue', 0, 12, 1.2, 4));
    add(box('boat', 14, -4.6, 1.4, 3, 0.8, { spot: { name: 'Dans la barque' } }));
    add(box('bench', -6, -6, 3, 1, 1, { spot: { name: 'Sous le banc' } }));
    add(box('hedge', -24, 0, 1.6, 14, 2));
    add(box('hedge', 24, 2, 1.6, 12, 2));
    add(box('hedge', 0, -24, 14, 1.6, 2));
    scatter(5, 1.3, (x, z) => circ('bush', x, z, 1.3, 1.6, { spot: { name: 'Dans le buisson' } }));
    scatter(3, 1, (x, z) => circ('hollowtree', x, z, 1, 6, { spot: { name: "Dans le creux de l'arbre" } }));
    scatter(2, 1.2, (x, z) => box('leafpile', x, z, 2.4, 2.4, 1.2, { spot: { name: 'Sous le tas de feuilles' } }));
    scatter(1, 0.8, (x, z) => box('icecream', x, z, 2, 1.4, 2.4, { spot: { name: 'Derrière le chariot de glaces' } }));
    scatter(16, 0.6, (x, z) => circ('tree', x, z, 0.55, 5 + r() * 3));
    scatter(5, 0.6, (x, z) => circ('flowerbed', x, z, 1, 0.4, { solid: false }));
  }

  if (mapId === 'maison') {
    // Une grande maison de 40 x 36 avec des pièces et des portes
    map.half = 24;
    const W = 20, D = 18, T = 0.4, WH = 3.4;
    const wall = (x1, z1, x2, z2) => add(box('wall', (x1 + x2) / 2, (z1 + z2) / 2, Math.max(Math.abs(x2 - x1), T), Math.max(Math.abs(z2 - z1), T), WH));
    // murs extérieurs avec porte d'entrée au sud
    wall(-W, -D, W, -D); wall(-W, D, -2, D); wall(2, D, W, D);
    wall(-W, -D, -W, D); wall(W, -D, W, D);
    // murs intérieurs (avec ouvertures de portes de 3 m)
    wall(-W, -4, -12, -4); wall(-8, -4, 8, -4); wall(12, -4, W, -4);      // sépare nord/sud
    wall(-6, -D, -6, -12); wall(-6, -8, -6, -4);                          // chambre | salle de bain
    wall(6, -D, 6, -12); wall(6, -8, 6, -4);                              // salle de bain | cuisine
    wall(-8, 6, -8, D - 3); wall(-W, 6, -12, 6);                          // salon | bureau
    wall(8, 6, 8, D - 3); wall(12, 6, W, 6);                              // salle de jeux
    map.spawn = { x: 0, z: 8 };
    map.foundZone = { x: 0, z: 13 };
    // Chambre (nord-ouest)
    add(box('bed', -15, -14, 4, 5.5, 0.9, { spot: { name: 'Sous le grand lit' } }));
    add(box('wardrobe', -18.8, -7, 1.6, 3.4, 3, { spot: { name: "Dans l'armoire" } }));
    add(box('curtain', -10, -17.3, 3, 0.8, 3, { spot: { name: 'Derrière les rideaux' } }));
    add(box('nightstand', -12, -16.8, 1, 1, 0.8));
    // Salle de bain (nord-centre)
    add(box('bathtub', 0, -15.8, 4, 2.2, 1, { spot: { name: 'Dans la baignoire' } }));
    add(box('laundry', 4, -7, 1.6, 1.6, 1.5, { spot: { name: 'Dans le panier à linge' } }));
    add(box('sink', -3.5, -6, 1.4, 1, 1.1));
    // Cuisine (nord-est)
    add(box('fridge', 18.8, -15, 1.6, 1.6, 2.6, { spot: { name: 'Derrière le frigo' } }));
    add(box('counter', 13, -17.2, 8, 1.2, 1.1));
    add(box('kitchentable', 13, -9, 4, 2.6, 1.0, { spot: { name: 'Sous la table de la cuisine' } }));
    add(box('cupboard', 8, -16.8, 2, 1.6, 2.2, { spot: { name: 'Dans le placard' } }));
    // Salon (centre-sud)
    add(box('sofa', 0, 1, 5, 1.8, 1.1, { spot: { name: 'Derrière le canapé' } }));
    add(box('tv', 0, -3.2, 3, 0.6, 1.6));
    add(box('piano', -5, 4, 2.6, 1.4, 1.5, { spot: { name: 'Sous le piano' } }));
    add(box('plant', 6.5, 4.5, 1, 1, 2, { spot: { name: 'Derrière la grande plante' } }));
    add(box('fireplace', 7.2, -1, 1.2, 3, 2.4));
    // Bureau (sud-ouest)
    add(box('desk', -15, 12, 3.5, 1.8, 1.1, { spot: { name: 'Sous le bureau' } }));
    add(box('bookcase', -19, 10, 1, 4, 3, { spot: { name: 'Derrière la bibliothèque' } }));
    add(box('boxes', -11, 16, 2, 2, 1.8, { spot: { name: 'Dans les cartons' } }));
    // Salle de jeux (sud-est)
    add(box('toychest', 15, 15.8, 2.4, 1.6, 1.2, { spot: { name: 'Dans le coffre à jouets' } }));
    add(box('tent', 16, 10, 3, 3, 2.4, { spot: { name: 'Dans la tente indienne' } }));
    add(box('ballpit', 10.8, 12, 2.6, 2.6, 0.8, { spot: { name: 'Dans la piscine à balles' } }));
    // Entrée
    add(box('coatrack', -4, 16.5, 1, 1, 2.6, { spot: { name: 'Sous les manteaux' } }));
    add(box('shoerack', 4, 16.6, 2, 0.8, 1));
  }

  // noms uniques : on précise l'endroit quand deux cachettes portent le même nom
  const count = {};
  for (const sp of map.spots) count[sp.name] = (count[sp.name] || 0) + 1;
  const used = {};
  for (const sp of map.spots) {
    if (count[sp.name] < 2) continue;
    const ns = sp.z < -map.half / 3 ? 'nord' : sp.z > map.half / 3 ? 'sud' : '';
    const ew = sp.x < -map.half / 3 ? 'ouest' : sp.x > map.half / 3 ? 'est' : '';
    let where = ns && ew ? `${ns}-${ew}` : ns || ew || 'centre';
    const key = sp.name + where;
    used[key] = (used[key] || 0) + 1;
    if (used[key] > 1) where += ' ' + used[key];
    sp.name += ` (${where})`;
  }
  map.grid = buildGrid(map);
  return map;
}

// ---------- Collisions ----------
export function collide(map, x, z, rad = CONFIG.RADIUS) {
  const H = map.half - rad;
  for (let iter = 0; iter < 3; iter++) {
    for (const o of map.obstacles) {
      if (!o.solid) continue;
      if (o.shape === 'circle') {
        const dx = x - o.x, dz = z - o.z, dist = Math.hypot(dx, dz), min = o.r + rad;
        if (dist < min) {
          if (dist < 1e-4) { x += min; continue; }
          x = o.x + dx / dist * min; z = o.z + dz / dist * min;
        }
      } else {
        const hw = o.w / 2, hd = o.d / 2;
        const cx = Math.max(o.x - hw, Math.min(x, o.x + hw));
        const cz = Math.max(o.z - hd, Math.min(z, o.z + hd));
        const dx = x - cx, dz = z - cz, dist = Math.hypot(dx, dz);
        if (dist < rad) {
          if (dist < 1e-4) {
            // centre à l'intérieur : sortir par le côté le plus proche
            const px = hw - Math.abs(x - o.x), pz = hd - Math.abs(z - o.z);
            if (px < pz) x = o.x + Math.sign(x - o.x || 1) * (hw + rad);
            else z = o.z + Math.sign(z - o.z || 1) * (hd + rad);
          } else { x = cx + dx / dist * rad; z = cz + dz / dist * rad; }
        }
      }
    }
    x = Math.max(-H, Math.min(H, x)); z = Math.max(-H, Math.min(H, z));
  }
  return { x, z };
}

// Distance du point (x,z) au bord d'un obstacle
export function distToObstacle(o, x, z) {
  if (o.shape === 'circle') return Math.max(0, Math.hypot(x - o.x, z - o.z) - o.r);
  const dx = Math.max(Math.abs(x - o.x) - o.w / 2, 0), dz = Math.max(Math.abs(z - o.z) - o.d / 2, 0);
  return Math.hypot(dx, dz);
}

// ---------- Grille de navigation (A*) pour les bots ----------
function buildGrid(map) {
  const size = map.half * 2, n = size; // cases de 1 m
  const blocked = new Uint8Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -map.half + i + 0.5, z = -map.half + j + 0.5;
    for (const o of map.obstacles) if (o.solid && distToObstacle(o, x, z) < 0.55) { blocked[i + j * n] = 1; break; }
    if (Math.abs(x) > map.half - 0.6 || Math.abs(z) > map.half - 0.6) blocked[i + j * n] = 1;
  }
  return { n, blocked };
}
const cellOf = (map, x, z) => {
  const n = map.grid.n;
  return [Math.max(0, Math.min(n - 1, Math.floor(x + map.half))), Math.max(0, Math.min(n - 1, Math.floor(z + map.half)))];
};
function nearestFree(map, ci, cj) {
  const { n, blocked } = map.grid;
  for (let rad = 0; rad < 8; rad++) for (let di = -rad; di <= rad; di++) for (let dj = -rad; dj <= rad; dj++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
    const i = ci + di, j = cj + dj;
    if (i >= 0 && j >= 0 && i < n && j < n && !blocked[i + j * n]) return [i, j];
  }
  return [ci, cj];
}
export function findPath(map, x0, z0, x1, z1) {
  const { n, blocked } = map.grid;
  let [si, sj] = nearestFree(map, ...cellOf(map, x0, z0));
  let [gi, gj] = nearestFree(map, ...cellOf(map, x1, z1));
  const start = si + sj * n, goal = gi + gj * n;
  const g = new Float32Array(n * n).fill(Infinity), came = new Int32Array(n * n).fill(-1);
  const heap = [], closed = new Uint8Array(n * n);
  const h = (k) => Math.hypot((k % n) - gi, Math.floor(k / n) - gj);
  const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, rr = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  g[start] = 0; push(start, h(start));
  while (heap.length) {
    const [, k] = pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (k === goal) break;
    const ci = k % n, cj = Math.floor(k / n);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const nk = i + j * n;
      if (blocked[nk]) continue;
      if (di && dj && (blocked[ci + di + cj * n] || blocked[ci + (cj + dj) * n])) continue;
      const ng = g[k] + (di && dj ? 1.414 : 1);
      if (ng < g[nk]) { g[nk] = ng; came[nk] = k; push(nk, ng + h(nk)); }
    }
  }
  if (came[goal] === -1 && goal !== start) return [{ x: x1, z: z1 }];
  const path = [];
  for (let k = goal; k !== -1 && k !== start; k = came[k]) path.push({ x: (k % n) - map.half + 0.5, z: Math.floor(k / n) - map.half + 0.5 });
  path.reverse();
  return path;
}

// ---------- Salle de jeu ----------
export class GameRoom {
  constructor({ onEvent = () => {}, code = 'SOLO' } = {}) {
    this.code = code;
    this.onEvent = onEvent;
    this.players = new Map();
    this.order = [];
    this.phase = 'lobby';
    this.timeLeft = 0;
    this.round = 0;
    this.totalRounds = 3;
    this.hostId = null;
    this.mapId = null;
    this.seed = 0;
    this.map = null;
    this.seekerId = null;
    this.results = null;
    this.hintTimer = 0;
    this.searchDuration = 0;
    this.lastMapId = null;
    this.botCount = 0;
  }

  emit(e) { this.onEvent(e); }

  addPlayer(id, name, isBot = false) {
    if (this.players.size >= CONFIG.MAX_PLAYERS) return 'La partie est pleine (8 joueurs max).';
    if (this.phase !== 'lobby') return 'La partie a déjà commencé.';
    if (isBot) name = name || BOT_NAMES[this.botCount++ % BOT_NAMES.length] + ' 🤖';
    const p = {
      id, name: (name || 'Joueur').slice(0, 16), isBot, charId: null,
      x: 0, z: 0, rot: 0, moving: false, tp: 0,
      isSeeker: false, found: false, hidden: null, foundAt: 0,
      score: 0, roundScore: 0, seekerCount: 0, hiddenTime: 0,
      cooldown: 0, bot: null,
    };
    this.players.set(id, p);
    this.order.push(id);
    if (!this.hostId && !isBot) this.hostId = id;
    if (isBot) this.pickFreeChar(p);
    return null;
  }

  addBot() {
    const id = 'bot' + Math.random().toString(36).slice(2, 8);
    return this.addPlayer(id, null, true);
  }

  pickFreeChar(p) {
    const used = new Set([...this.players.values()].map((q) => q.charId));
    const freeChars = CHARACTERS.filter((c) => !used.has(c.id));
    p.charId = (freeChars.length ? pick(Math.random, freeChars) : pick(Math.random, CHARACTERS)).id;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.order = this.order.filter((x) => x !== id);
    if (this.hostId === id) this.hostId = this.order.find((k) => !this.players.get(k).isBot) || null;
    if (this.phase === 'lobby' || this.phase === 'final') return;
    if (id === this.seekerId && (this.phase === 'hide' || this.phase === 'search' || this.phase === 'reveal')) {
      this.emit({ t: 'msg', text: `${p.name} (le chercheur) a quitté la partie : manche annulée.` });
      this.endRound(null, true);
    } else this.checkAllFound();
  }

  humans() { return [...this.players.values()].filter((p) => !p.isBot); }
  hiders() { return [...this.players.values()].filter((p) => !p.isSeeker); }

  handle(id, m) {
    const p = this.players.get(id);
    if (!p || !m) return;
    switch (m.t) {
      case 'char':
        if (this.phase !== 'lobby' && this.phase !== 'final') return;
        if (CHARACTERS.some((c) => c.id === m.charId) && ![...this.players.values()].some((q) => q !== p && q.charId === m.charId)) p.charId = m.charId;
        break;
      case 'name': p.name = String(m.name || '').slice(0, 16) || p.name; break;
      case 'addBot': if (id === this.hostId && this.phase === 'lobby') this.addBot(); break;
      case 'removeBot': {
        const b = this.players.get(m.id);
        if (id === this.hostId && b && b.isBot && this.phase === 'lobby') this.removePlayer(m.id);
        break;
      }
      case 'rounds': if (id === this.hostId && this.phase === 'lobby') this.totalRounds = Math.max(1, Math.min(8, m.n | 0)); break;
      case 'start': if (id === this.hostId) this.startGame(); break;
      case 'again': if (id === this.hostId && this.phase === 'final') this.toLobby(); break;
      case 'pos':
        if (!(this.phase === 'hide' || this.phase === 'search') || p.found || p.hidden != null) return;
        if (p.isSeeker && this.phase === 'hide') return;
        if (typeof m.x !== 'number' || typeof m.z !== 'number' || !isFinite(m.x) || !isFinite(m.z)) return;
        if (m.tp != null && m.tp !== p.tp) return; // position envoyée avant une téléportation : ignorée
        {
          // anti-téléportation simple
          const maxStep = 2.5;
          const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
          const k = d > maxStep ? maxStep / d : 1;
          const c = collide(this.map, p.x + dx * k, p.z + dz * k);
          p.x = c.x; p.z = c.z; p.rot = +m.rot || 0; p.moving = !!m.moving;
          if (k < 1) p.tp++;
        }
        break;
      case 'hide': this.tryHide(p, m.spot | 0, !!m.fromMenu); break;
      case 'unhide': this.unhide(p); break;
      case 'search': this.trySearch(p); break;
    }
  }

  startGame() {
    if (this.phase !== 'lobby') return;
    if (this.players.size < 2) { this.emit({ t: 'msg', text: 'Il faut au moins 2 joueurs (ajoute des bots !).' }); return; }
    for (const p of this.players.values()) { if (!p.charId) this.pickFreeChar(p); p.score = 0; p.seekerCount = 0; }
    this.round = 0;
    this.startRound();
  }

  toLobby() {
    this.phase = 'lobby';
    this.results = null;
    for (const p of this.players.values()) { p.score = 0; p.roundScore = 0; p.isSeeker = false; p.found = false; p.hidden = null; }
  }

  startRound() {
    if (this.players.size < 2) { this.emit({ t: 'msg', text: 'Plus assez de joueurs.' }); this.toLobby(); return; }
    this.round++;
    // tirage au sort du chercheur parmi ceux qui ont le moins cherché
    const list = [...this.players.values()];
    const min = Math.min(...list.map((p) => p.seekerCount));
    const candidates = list.filter((p) => p.seekerCount === min);
    const seeker = pick(Math.random, candidates);
    seeker.seekerCount++;
    this.seekerId = seeker.id;
    // environnement au hasard (différent du précédent si possible)
    const maps = MAPS.filter((mp) => mp.id !== this.lastMapId);
    this.mapId = pick(Math.random, maps).id;
    this.lastMapId = this.mapId;
    this.seed = (Math.random() * 1e9) | 0;
    this.map = buildMap(this.mapId, this.seed);
    const hiders = list.filter((p) => p !== seeker);
    hiders.forEach((p, i) => {
      const a = (i / hiders.length) * Math.PI * 2;
      Object.assign(p, { isSeeker: false, found: false, hidden: null, roundScore: 0, hiddenTime: 0, foundAt: 0, bot: null });
      const c = collide(this.map, this.map.spawn.x + Math.cos(a) * 3, this.map.spawn.z + Math.sin(a) * 3);
      p.x = c.x; p.z = c.z; p.rot = a; p.tp++;
    });
    Object.assign(seeker, { isSeeker: true, found: false, hidden: null, roundScore: 0, x: this.map.spawn.x, z: this.map.spawn.z, rot: 0, bot: null });
    seeker.tp++;
    this.searchDuration = Math.min(CONFIG.SEARCH_MAX, CONFIG.SEARCH_BASE + CONFIG.SEARCH_PER_HIDER * hiders.length);
    this.results = null;
    this.setPhase('reveal', CONFIG.REVEAL_TIME);
  }

  setPhase(phase, t) {
    this.phase = phase;
    this.timeLeft = t;
    this.emit({ t: 'phase', phase });
  }

  spotOccupant(spotId) {
    for (const p of this.players.values()) if (p.hidden === spotId) return p;
    return null;
  }

  tryHide(p, spotId, fromMenu) {
    if (p.isSeeker || p.found || !this.map) return;
    if (!(this.phase === 'hide' || this.phase === 'search')) return;
    const spot = this.map.spots[spotId];
    if (!spot || this.spotOccupant(spotId)) return;
    const o = this.map.obstacles.find((ob) => ob.spotId === spotId);
    // Pendant la phase de cache, la cachette proposée peut être choisie depuis le menu (téléportation).
    // Pendant la recherche, il faut être à côté.
    if (!(fromMenu && this.phase === 'hide') && distToObstacle(o, p.x, p.z) > CONFIG.SEARCH_DIST) return;
    p.hidden = spotId;
    p.x = spot.x; p.z = spot.z; p.moving = false; p.tp++;
    this.emit({ t: 'hidden', id: p.id, spot: spotId });
  }

  unhide(p) {
    if (p.hidden == null || p.found) return;
    const o = this.map.obstacles.find((ob) => ob.spotId === p.hidden);
    p.hidden = null;
    const rad = (o.shape === 'circle' ? o.r : Math.max(o.w, o.d) / 2) + 0.8;
    const a = Math.random() * Math.PI * 2;
    const c = collide(this.map, o.x + Math.cos(a) * rad, o.z + Math.sin(a) * rad);
    p.x = c.x; p.z = c.z; p.tp++;
    this.emit({ t: 'unhidden', id: p.id });
  }

  trySearch(p) {
    if (!p.isSeeker || this.phase !== 'search' || p.cooldown > 0) return;
    p.cooldown = CONFIG.SEARCH_COOLDOWN;
    // 1) joueur visible à portée ?
    for (const q of this.players.values()) {
      if (q.isSeeker || q.found || q.hidden != null) continue;
      if (Math.hypot(q.x - p.x, q.z - p.z) < CONFIG.CATCH_DIST + 0.8) { this.markFound(q, 'touché'); return; }
    }
    // 2) cachette la plus proche
    let best = null, bd = Infinity;
    for (const o of this.map.obstacles) {
      if (o.spotId == null) continue;
      const d = distToObstacle(o, p.x, p.z);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best || bd > CONFIG.SEARCH_DIST) return;
    const occ = this.spotOccupant(best.spotId);
    if (occ) this.markFound(occ, best.spot.name);
    else {
      this.timeLeft = Math.max(1, this.timeLeft - CONFIG.EMPTY_PENALTY);
      this.emit({ t: 'empty', spot: best.spotId, name: best.spot.name, penalty: CONFIG.EMPTY_PENALTY });
    }
  }

  markFound(q, where) {
    if (q.found) return;
    const seeker = this.players.get(this.seekerId);
    q.found = true;
    q.foundAt = this.searchDuration - this.timeLeft;
    const spot = q.hidden;
    q.hidden = null;
    // place le joueur trouvé sur le "banc des trouvés"
    const nFound = this.hiders().filter((h) => h.found).length;
    const c = collide(this.map, this.map.foundZone.x - 5 + nFound * 1.7, this.map.foundZone.z);
    q.x = c.x; q.z = c.z; q.rot = Math.PI; q.moving = false; q.tp++;
    if (seeker) seeker.roundScore += CONFIG.PTS_FIND;
    this.emit({ t: 'found', id: q.id, name: q.name, by: seeker ? seeker.name : '?', where, spot });
    this.checkAllFound();
  }

  checkAllFound() {
    if (this.phase !== 'search') return;
    const hiders = this.hiders();
    if (hiders.length === 0) { this.endRound(null, true); return; }
    if (hiders.every((h) => h.found)) this.endRound('seeker');
  }

  endRound(winner, cancelled = false) {
    const seeker = this.players.get(this.seekerId);
    const hiders = this.hiders();
    if (!winner && !cancelled) winner = 'hiders';
    const lines = [];
    if (!cancelled) {
      if (winner === 'seeker' && seeker) {
        seeker.roundScore += CONFIG.PTS_ALL_FOUND + Math.floor(this.timeLeft) * CONFIG.PTS_PER_SEC_LEFT;
      }
      // dernier joueur trouvé (s'il y en a eu un) ou survivants
      const foundList = hiders.filter((h) => h.found).sort((a, b) => b.foundAt - a.foundAt);
      for (const h of hiders) {
        h.roundScore += Math.floor(h.hiddenTime) * CONFIG.PTS_PER_SEC_HIDDEN;
        if (!h.found) h.roundScore += CONFIG.PTS_SURVIVE;
      }
      if (winner === 'seeker' && foundList[0]) foundList[0].roundScore += CONFIG.PTS_LAST_STANDING;
      for (const p of this.players.values()) {
        p.score += p.roundScore;
        lines.push({
          id: p.id, name: p.name, charId: p.charId, role: p.isSeeker ? 'seeker' : 'hider',
          found: p.found, foundAt: Math.round(p.foundAt), hiddenTime: Math.floor(p.hiddenTime || 0),
          pts: p.roundScore, total: p.score,
          last: winner === 'seeker' && foundList[0] === p,
        });
      }
    }
    lines.sort((a, b) => b.pts - a.pts);
    this.results = { winner, cancelled, lines, seekerName: seeker ? seeker.name : '?', timeLeft: Math.floor(this.timeLeft) };
    for (const p of this.players.values()) p.hidden = null;
    this.setPhase('roundEnd', CONFIG.ROUND_END_TIME);
  }

  update(dt) {
    if (this.phase === 'lobby' || this.phase === 'final') return;
    this.timeLeft -= dt;
    for (const p of this.players.values()) {
      if (p.cooldown > 0) p.cooldown -= dt;
      if (p.isBot) this.updateBot(p, dt);
    }
    if (this.phase === 'search') {
      const seeker = this.players.get(this.seekerId);
      for (const h of this.hiders()) {
        if (h.found) continue;
        h.hiddenTime += dt;
        // toucher un joueur visible = trouvé
        if (seeker && h.hidden == null && Math.hypot(h.x - seeker.x, h.z - seeker.z) < CONFIG.CATCH_DIST) this.markFound(h, 'touché');
      }
      if (this.phase !== 'search') return;
      // indice : dans la dernière minute, une cachette occupée éternue
      if (this.timeLeft < CONFIG.HINT_LAST) {
        this.hintTimer -= dt;
        if (this.hintTimer <= 0) {
          this.hintTimer = CONFIG.HINT_EVERY;
          const occ = this.hiders().filter((h) => !h.found && h.hidden != null);
          if (occ.length) {
            const h = pick(Math.random, occ);
            this.emit({ t: 'hint', spot: h.hidden });
            if (seeker && seeker.bot && Math.random() < 0.4) { seeker.bot.priority = h.hidden; seeker.bot.lastHint = h.hidden; seeker.bot.searched.delete(h.hidden); }
          }
        }
      }
    }
    if (this.timeLeft <= 0) {
      if (this.phase === 'reveal') this.setPhase('hide', CONFIG.HIDE_TIME);
      else if (this.phase === 'hide') {
        // Les retardataires restent visibles là où ils sont !
        this.hintTimer = 0;
        this.setPhase('search', this.searchDuration);
      } else if (this.phase === 'search') this.endRound('hiders');
      else if (this.phase === 'roundEnd') {
        if (this.round >= this.totalRounds) this.finish();
        else this.startRound();
      }
    }
  }

  finish() {
    const ranking = [...this.players.values()].sort((a, b) => b.score - a.score)
      .map((p) => ({ id: p.id, name: p.name, charId: p.charId, score: p.score }));
    this.results = { ...(this.results || {}), ranking };
    this.phase = 'final';
    this.emit({ t: 'phase', phase: 'final' });
  }

  // ---------- Intelligence des bots ----------
  moveBot(p, tx, tz, dt, speed) {
    const b = p.bot;
    if (!b.path || b.pathTarget == null || Math.hypot(b.pathTarget.x - tx, b.pathTarget.z - tz) > 1.5 || b.repath <= 0) {
      b.path = findPath(this.map, p.x, p.z, tx, tz);
      b.pathTarget = { x: tx, z: tz };
      b.repath = 2;
    }
    b.repath -= dt;
    let wp = b.path[0];
    while (wp && Math.hypot(wp.x - p.x, wp.z - p.z) < 0.6 && b.path.length > 1) { b.path.shift(); wp = b.path[0]; }
    if (!wp) wp = { x: tx, z: tz };
    const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { p.moving = false; return; }
    const step = Math.min(d, speed * dt);
    const c = collide(this.map, p.x + dx / d * step, p.z + dz / d * step);
    p.x = c.x; p.z = c.z;
    p.rot = Math.atan2(dx, dz);
    p.moving = true;
  }

  freeSpots() {
    return this.map.spots.filter((s) => !this.spotOccupant(s.id));
  }

  updateBot(p, dt) {
    if (!this.map) return;
    if (!p.bot) p.bot = { state: 'idle', delay: 1 + Math.random() * 6, path: null, repath: 0, searched: new Set(), think: 0, priority: null, alerted: false };
    const b = p.bot;
    if (p.isSeeker) {
      if (this.phase !== 'search') return;
      const speed = CONFIG.SEEKER_SPEED * 0.7;
      // poursuivre un joueur visible proche
      let prey = null, pd = 8;
      for (const h of this.players.values()) {
        if (h.isSeeker || h.found || h.hidden != null) continue;
        const d = Math.hypot(h.x - p.x, h.z - p.z);
        if (d < pd) { pd = d; prey = h; }
      }
      if (prey) { this.moveBot(p, prey.x, prey.z, dt, speed); b.repath = Math.min(b.repath, 0.4); return; }
      if (b.think > 0) { b.think -= dt; p.moving = false; return; }
      if (b.target == null || this.map.spots[b.target] == null) {
        if (b.priority != null && !b.searched.has(b.priority)) { b.target = b.priority; b.priority = null; }
        else {
          let remaining = this.map.spots.filter((s) => !b.searched.has(s.id));
          if (!remaining.length) { b.searched.clear(); remaining = this.map.spots.slice(); }
          remaining.sort((s1, s2) => (Math.hypot(s1.x - p.x, s1.z - p.z) + Math.random() * 40) - (Math.hypot(s2.x - p.x, s2.z - p.z) + Math.random() * 40));
          b.target = remaining[0].id;
        }
      }
      const o = this.map.obstacles.find((ob) => ob.spotId === b.target);
      if (distToObstacle(o, p.x, p.z) < CONFIG.SEARCH_DIST - 0.6) {
        p.moving = false;
        if (p.cooldown <= 0) {
          // le bot est parfois distrait et oublie de bien regarder
          if (Math.random() > 0.3 || b.target === b.lastHint) this.trySearch(p);
          b.searched.add(b.target);
          b.target = null;
          b.think = 1.5 + Math.random() * 2.5;
        }
      } else this.moveBot(p, o.x, o.z, dt, speed);
      return;
    }
    // Bot qui se cache
    if (p.found) { p.moving = false; return; }
    if (this.phase === 'hide') {
      if (p.hidden != null) return;
      b.delay -= dt;
      if (b.delay > 0) return;
      const spots = this.freeSpots();
      if (!spots.length) return;
      const sp = pick(Math.random, spots);
      this.tryHide(p, sp.id, true);
      return;
    }
    if (this.phase !== 'search') return;
    const seeker = this.players.get(this.seekerId);
    if (!seeker) return;
    const ds = Math.hypot(seeker.x - p.x, seeker.z - p.z);
    if (p.hidden != null) {
      // le chercheur approche : parfois le bot tente de s'enfuir !
      if (ds < 4.5 && !b.alerted) {
        b.alerted = true;
        if (Math.random() < 0.3) {
          const far = this.freeSpots().sort((a, c) => Math.hypot(c.x - seeker.x, c.z - seeker.z) - Math.hypot(a.x - seeker.x, a.z - seeker.z));
          if (far.length) { this.unhide(p); b.state = 'flee'; b.target = far[Math.floor(Math.random() * Math.min(3, far.length))].id; }
        }
      }
      if (ds > 8) b.alerted = false;
      return;
    }
    // bot visible : courir vers une cachette libre
    if (b.target == null || this.spotOccupant(b.target)) {
      const free = this.freeSpots().sort((a, c) => Math.hypot(c.x - seeker.x, c.z - seeker.z) - Math.hypot(a.x - seeker.x, a.z - seeker.z));
      if (!free.length) return;
      b.target = free[Math.floor(Math.random() * Math.min(3, free.length))].id;
    }
    const o = this.map.obstacles.find((ob) => ob.spotId === b.target);
    if (distToObstacle(o, p.x, p.z) < 1.2) { this.tryHide(p, b.target, false); b.target = null; b.alerted = false; }
    else this.moveBot(p, o.x, o.z, dt, CONFIG.HIDER_SPEED);
  }

  // ---------- Vue envoyée à un joueur ----------
  snapshot(forId) {
    const viewer = this.players.get(forId);
    const viewerIsSeeker = viewer && viewer.isSeeker && (this.phase === 'hide' || this.phase === 'search');
    const players = this.order.map((id) => {
      const p = this.players.get(id);
      const secret = viewerIsSeeker && p.hidden != null && !p.isSeeker;
      return {
        id: p.id, name: p.name, charId: p.charId, isBot: p.isBot, isSeeker: p.isSeeker, found: p.found,
        hidden: secret ? -1 : p.hidden,
        x: secret ? null : +p.x.toFixed(2), z: secret ? null : +p.z.toFixed(2), rot: +p.rot.toFixed(2),
        moving: p.moving, tp: p.tp, score: p.score, roundScore: p.roundScore,
      };
    });
    return {
      code: this.code, phase: this.phase, timeLeft: Math.max(0, this.timeLeft), round: this.round, totalRounds: this.totalRounds,
      hostId: this.hostId, mapId: this.mapId, seed: this.seed, seekerId: this.seekerId, searchDuration: this.searchDuration,
      players, results: this.results,
    };
  }
}
