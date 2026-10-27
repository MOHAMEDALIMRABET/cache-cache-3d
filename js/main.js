// Client du jeu : interface, contrôles, caméra, rendu, et lien avec la salle (solo local ou serveur en ligne).
import * as THREE from 'three';
import { GameRoom, CHARACTERS, MAPS, CONFIG, buildMap, collide, distToObstacle } from '../shared/core.js';
import { buildCharacter, makeSeeker, animateCharacter, makeThumbnails } from './characters.js';
import { buildWorld } from './world.js';
import { getRoomApi, RoomHostSession, RoomClientSession, watchGames } from './net-room.js';
import { getFirebaseApi, firebaseReady, firebaseError } from './net-firebase.js';
import { WEB_URL } from '../firebase-config.js';

// Dans claude.ai (Artifact), le mode en ligne passe par la salle temps réel ; sinon par le serveur Node (WebSocket).
const IN_CLAUDE = !!window.claude?.use;

const $ = (id) => document.getElementById(id);
const charName = (id) => CHARACTERS.find((c) => c.id === id)?.name || '?';
const mapName = (id) => MAPS.find((m) => m.id === id)?.name || '?';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

const thumbs = makeThumbnails(CHARACTERS.map((c) => c.id));

// ---------------- Sons ----------------
let audio = null;
function beep(freq = 600, dur = 0.12, type = 'sine', vol = 0.15) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  } catch {}
}
const jingle = (notes) => notes.forEach(([f, t], i) => setTimeout(() => beep(f, 0.15, 'triangle'), t ?? i * 120));

// ---------------- Sessions ----------------
class LocalSession {
  constructor(name, charId) {
    this.myId = 'me';
    this.room = new GameRoom({ onEvent: (e) => this.onEvent?.(e) });
    this.room.addPlayer('me', name);
    if (charId) this.room.handle('me', { t: 'char', charId });
    for (let i = 0; i < 3; i++) this.room.addBot();
    this.timer = setInterval(() => { this.room.update(0.05); this.push(); }, 50);
    setTimeout(() => this.push());
  }
  push() { this.onState?.(this.room.snapshot('me')); }
  send(m) { this.room.handle('me', m); if (m.t !== 'pos') this.push(); }
  close() { clearInterval(this.timer); }
}

class OnlineSession {
  constructor(mode, name, code, charId) {
    this.myId = null;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);
    this.ws.onopen = () => this.ws.send(JSON.stringify(mode === 'create' ? { t: 'create', name, charId } : { t: 'join', code, name, charId }));
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 'joined') { this.myId = m.id; history.replaceState(null, '', '?room=' + m.code); }
      else if (m.t === 'state') this.onState?.(m.s);
      else if (m.t === 'event') this.onEvent?.(m.e);
      else if (m.t === 'error') { showError(m.msg); if (!this.myId) goHome(); }
    };
    this.ws.onerror = () => showError("Impossible de joindre le serveur. Lance « npm start » et ouvre l'adresse du serveur.");
    this.ws.onclose = () => { if (session === this) { showError('Connexion perdue.'); goHome(); } };
  }
  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  close() { this.ws.onclose = null; this.ws.close(); }
}

let session = null;
let state = null;
let me = null;
let lastPhase = null;

function startSession(s) {
  session = s;
  state = null; lastPhase = null;
  s.onState = onState;
  s.onEvent = onEvent;
}

function goHome() {
  if (session) session.close();
  session = null; state = null; me = null; lastPhase = null;
  clearWorld();
  history.replaceState(null, '', location.pathname);
  show('home');
}

function showError(msg) {
  const e = $('error');
  e.textContent = msg; e.style.display = 'block'; e.classList.remove('info');
  clearTimeout(showError.t);
  showError.t = setTimeout(() => (e.style.display = 'none'), 3500);
}

function info(msg) {
  const e = $('error');
  e.textContent = msg; e.style.display = 'block'; e.classList.remove('info'); e.classList.add('info');
  clearTimeout(showError.t);
  showError.t = setTimeout(() => { e.style.display = 'none'; e.classList.remove('info'); }, 3500);
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
}

// ---------------- Accueil ----------------
$('name').value = store.get('cc-name') || '';
const params = new URLSearchParams(location.search);
if (params.get('room')) $('join-code').value = params.get('room').toUpperCase();
const myName = () => { const n = $('name').value.trim() || 'Joueur'; store.set('cc-name', n); return n; };
const savedChar = () => store.get('cc-char');
$('btn-solo').onclick = () => { startSession(new LocalSession(myName(), savedChar())); beep(700); };
// Où passe le mode en ligne : salle claude.ai, Firebase (application web) ou serveur Node (npm start)
const ONLINE = IN_CLAUDE ? 'claude' : firebaseReady() ? 'firebase' : 'server';
async function onlineApi() {
  try {
    const api = ONLINE === 'claude' ? await getRoomApi() : await getFirebaseApi();
    if (!api) showError("Le mode en ligne n'est pas disponible ici : ouvre le jeu sur claude.ai en étant connecté, ou utilise le jeu complet.");
    return api;
  } catch (e) {
    console.error(e);
    showError(firebaseError(e));
    return null;
  }
}
$('btn-create').onclick = async () => {
  if (ONLINE === 'server') return startSession(new OnlineSession('create', myName(), null, savedChar()));
  info('Création de la partie…');
  const api = await onlineApi();
  if (!api) return;
  const s = new RoomHostSession(api, myName(), savedChar());
  startSession(s);
  s.ready.catch((e) => { console.error(e); showError(ONLINE === 'firebase' ? firebaseError(e) : 'Impossible de créer la salle en ligne. Réessaie dans un instant.'); goHome(); });
};
async function joinGame(code) {
  code = String(code || '').trim().toUpperCase();
  if (code.length !== 4) return showError('Entre le code à 4 caractères de la partie.');
  if (ONLINE === 'server') return startSession(new OnlineSession('join', myName(), code, savedChar()));
  info('Connexion à la partie ' + code + '…');
  const api = await onlineApi();
  if (!api) return;
  const s = new RoomClientSession(api, myName(), savedChar(), code, (msg) => { if (session === s) { showError(msg); goHome(); } });
  startSession(s);
  s.ready.catch((e) => { console.error(e); showError(ONLINE === 'firebase' ? firebaseError(e) : 'Impossible de rejoindre la salle. Réessaie dans un instant.'); goHome(); });
}
$('btn-join').onclick = () => joinGame($('join-code').value);

// parties ouvertes (claude.ai et application web)
if (ONLINE !== 'server') {
  (ONLINE === 'claude' ? getRoomApi() : getFirebaseApi()).then((api) => {
    if (!api) { $('games').innerHTML = '<p class="sub">Mode en ligne indisponible dans cette vue (il faut être connecté à claude.ai). Le solo fonctionne !</p>'; return; }
    watchGames(api, (games) => {
      $('games').innerHTML = games.length
        ? '<h3>Parties ouvertes</h3>' + games.map((g) => `<div class="game"><span><b>${esc(g.name)}</b> · ${g.count}/8 · code ${esc(g.code)}</span><button data-code="${esc(g.code)}" ${g.started || g.count >= 8 ? 'disabled' : ''}>${g.started ? 'En cours' : g.count >= 8 ? 'Pleine' : 'Rejoindre'}</button></div>`).join('')
        : '<p class="sub">Aucune partie ouverte pour l\'instant. Crée-en une et invite tes amis !</p>';
      for (const b of $('games').querySelectorAll('[data-code]')) b.onclick = () => joinGame(b.dataset.code);
    });
  }, (e) => { console.error(e); $('games').innerHTML = `<p class="sub">${esc(firebaseError(e))}</p>`; });
}
// version claude.ai : lien vers le jeu complet
if (IN_CLAUDE && WEB_URL) { $('full-link').href = WEB_URL; $('full-link').hidden = false; }
// application web : installable et jouable hors ligne en solo
if (!IN_CLAUDE && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
$('btn-leave').onclick = goHome;
$('btn-home').onclick = goHome;
$('btn-again').onclick = () => session?.send({ t: 'again' });
$('btn-addbot').onclick = () => session?.send({ t: 'addBot' });
$('btn-start').onclick = () => session?.send({ t: 'start' });
for (let i = 1; i <= 8; i++) $('rounds').add(new Option(String(i), String(i)));
$('rounds').onchange = () => session?.send({ t: 'rounds', n: +$('rounds').value });

// grille des personnages
for (const c of CHARACTERS) {
  const d = document.createElement('div');
  d.className = 'char';
  d.dataset.id = c.id;
  d.innerHTML = `<img src="${thumbs[c.id]}" alt=""><div>${esc(c.name)}</div><span class="owner" hidden></span>`;
  d.onclick = () => { if (!d.classList.contains('taken')) { session?.send({ t: 'char', charId: c.id }); store.set('cc-char', c.id); beep(880, 0.08); } };
  $('char-grid').appendChild(d);
}

function renderLobby() {
  const isHost = state.hostId === session.myId;
  const solo = session instanceof LocalSession;
  const infoKey = solo ? 'solo' : state.code;
  if ($('room-info').dataset.key !== infoKey) {
    $('room-info').dataset.key = infoKey;
    $('room-info').innerHTML = solo ? '🎮 Mode solo' : `Code de la partie : <span class="code">${esc(state.code)}</span> <button class="link" id="btn-copy">${IN_CLAUDE ? '📋 Copier le code' : '📨 Inviter des amis'}</button>`;
    const copy = $('btn-copy');
    if (copy) copy.onclick = () => {
      const url = location.origin + location.pathname + '?room=' + state.code;
      if (!IN_CLAUDE && navigator.share) {
        navigator.share({ title: 'Cache-Cache 3D', text: `Viens jouer à Cache-Cache 3D avec moi ! Code de la partie : ${state.code}`, url }).catch(() => {});
        return;
      }
      const text = IN_CLAUDE ? state.code : url;
      Promise.resolve(navigator.clipboard?.writeText(text)).then(() => { copy.textContent = '✅ Copié !'; }, () => { copy.textContent = text; });
    };
  }
  for (const card of $('char-grid').children) {
    const owner = state.players.find((p) => p.charId === card.dataset.id);
    card.classList.toggle('mine', owner?.id === session.myId);
    card.classList.toggle('taken', !!owner && owner.id !== session.myId);
    const tag = card.querySelector('.owner');
    tag.hidden = !owner || owner.id === session.myId;
    if (owner) tag.textContent = owner.name;
  }
  $('pcount').textContent = `(${state.players.length}/8)`;
  $('player-list').innerHTML = state.players.map((p) => `<li>${p.charId ? `<img src="${thumbs[p.charId]}" alt="">` : '❔'}<span>${p.id === state.hostId ? '👑 ' : ''}${esc(p.name)}${p.id === session.myId ? ' (toi)' : ''}<br><small>${p.charId ? esc(charName(p.charId)) : 'choisit…'}</small></span>${isHost && p.isBot ? `<button class="x" data-bot="${p.id}">✕</button>` : ''}</li>`).join('');
  for (const b of $('player-list').querySelectorAll('[data-bot]')) b.onclick = () => session.send({ t: 'removeBot', id: b.dataset.bot });
  $('host-controls').style.display = isHost ? '' : 'none';
  $('wait-host').style.display = isHost ? 'none' : '';
  $('rounds').value = String(state.totalRounds);
  $('btn-addbot').disabled = state.players.length >= 8;
  $('btn-start').disabled = state.players.length < 2;
  $('btn-start').textContent = state.players.length < 2 ? 'Ajoute au moins 1 joueur' : '▶ Lancer la partie';
}

// ---------------- 3D ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
resize();

let world = null;     // { key, map, root, spotObjects, blockers, markers }
const ents = new Map();
const fx = [];        // effets (secousses, particules, textes)
const cam = { yaw: 0, pitch: 0.5, dist: 7 };
const myPos = { x: 0, z: 0, rot: 0, tp: -1, moving: false };

function clearWorld() {
  for (const e of ents.values()) scene.remove(e.root);
  ents.clear();
  if (world) scene.remove(world.root);
  world = null;
}

function loadWorld(mapId, seed) {
  clearWorld();
  const map = buildMap(mapId, seed);
  const w = buildWorld(scene, map);
  const markers = new Map();
  for (const sp of map.spots) {
    const s = makeSprite('👀', 64, 'rgba(0,0,0,0)', 34);
    const o = map.obstacles.find((ob) => ob.spotId === sp.id);
    s.position.set(sp.x, o.h + 1, sp.z);
    s.scale.set(0.9, 0.9, 1);
    w.root.add(s);
    markers.set(sp.id, s);
  }
  world = { key: mapId + ':' + seed, map, ...w, markers };
  cam.dist = mapId === 'maison' ? 6 : 7.5;
}

function makeSprite(text, size = 48, bg = 'rgba(20,18,45,.8)', font = 26, color = '#fff') {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `bold ${font}px Trebuchet MS, sans-serif`;
  const w = Math.max(size, g.measureText(text).width + 24);
  c.width = w; c.height = size;
  g.font = `bold ${font}px Trebuchet MS, sans-serif`;
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(0, 0, w, size, 14); g.fill();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, size / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(w / size * 0.5, 0.5, 1);
  return s;
}

function makeEnt(p) {
  const root = new THREE.Group();
  const model = buildCharacter(p.charId);
  root.add(model);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.07, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  ring.visible = false;
  root.add(ring);
  scene.add(root);
  return { root, model, ring, charId: p.charId, isSeeker: null, label: null, labelKey: '', ghost: false, tp: -1, tx: p.x ?? 0, tz: p.z ?? 0, trot: 0, p };
}

function setLabel(e, text, bg) {
  const key = text + bg;
  if (e.labelKey === key) return;
  if (e.label) e.root.remove(e.label);
  e.label = makeSprite(text, 44, bg, 24);
  e.label.position.y = 2.35;
  e.root.add(e.label);
  e.labelKey = key;
}

function setGhost(e, on) {
  if (e.ghost === on) return;
  e.ghost = on;
  e.model.traverse((o) => { if (o.isMesh) { o.material.transparent = on; o.material.opacity = on ? 0.35 : 1; o.material.depthWrite = !on; o.material.needsUpdate = true; o.castShadow = !on; } });
}

function syncEnts() {
  const seen = new Set();
  for (const p of state.players) {
    seen.add(p.id);
    let e = ents.get(p.id);
    if (!e || e.charId !== p.charId) { if (e) scene.remove(e.root); e = makeEnt(p); ents.set(p.id, e); }
    if (e.isSeeker !== p.isSeeker) { makeSeeker(e.model, p.isSeeker); e.ring.visible = p.isSeeker; e.isSeeker = p.isSeeker; }
    setLabel(e, p.isSeeker ? `🔍 ${p.name}` : p.found ? `✅ ${p.name}` : p.name, p.isSeeker ? 'rgba(210,20,30,.9)' : 'rgba(20,18,45,.8)');
    if (p.x != null) {
      if (e.tp !== p.tp) { e.root.position.set(p.x, 0, p.z); e.tp = p.tp; }
      e.tx = p.x; e.tz = p.z; e.trot = p.rot;
    }
    e.p = p;
  }
  for (const [id, e] of ents) if (!seen.has(id)) { scene.remove(e.root); ents.delete(id); }
}

// ---------------- Réception de l'état ----------------
function onState(s) {
  state = s;
  me = s.players.find((p) => p.id === session.myId) || null;
  if (!me) return;
  if (s.phase !== 'lobby' && s.phase !== 'final' && s.mapId && (!world || world.key !== s.mapId + ':' + s.seed)) loadWorld(s.mapId, s.seed);
  if (s.phase !== lastPhase) onPhase(lastPhase, s.phase);
  if (world) syncEnts();
  if (me.tp !== myPos.tp && me.x != null) { myPos.x = me.x; myPos.z = me.z; myPos.rot = me.rot; myPos.tp = me.tp; }
  if (s.phase === 'lobby') renderLobby();
  if (s.phase === 'hide' || s.phase === 'search') renderHud();
  if (s.phase === 'roundEnd') $('re-next').textContent = `${s.round >= s.totalRounds ? 'Classement final' : 'Manche suivante'} dans ${Math.ceil(s.timeLeft)} s…`;
}

let suggestions = [];
function onPhase(prev, phase) {
  lastPhase = phase;
  if (phase === 'lobby') { clearWorld(); show('lobby'); if (!store.get('cc-howto')) openHowto(); }
  if (phase === 'reveal') startReveal();
  if (phase === 'hide') {
    show('hud');
    suggestions = [];
    if (me.isSeeker) { toast('🙈 Ferme les yeux pendant que les autres se cachent !'); cam.yaw = 0; }
    else { toast('🫣 Vite ! Choisis une cachette !', 'good'); }
    jingle([[523], [659], [784]]);
  }
  if (phase === 'search') {
    show('hud');
    toast(me.isSeeker ? '🔍 Ouvre les yeux… À toi de chercher !' : '🤫 Le chercheur arrive… chut !', me.isSeeker ? 'good' : 'bad');
    jingle([[784], [659], [523], [1046, 400]]);
  }
  if (phase === 'roundEnd') showRoundEnd();
  if (phase === 'final') showFinal();
}

function startReveal() {
  show('reveal');
  const seeker = state.players.find((p) => p.id === state.seekerId);
  $('reveal-round').textContent = `Manche ${state.round} / ${state.totalRounds}`;
  $('reveal-role').innerHTML = '';
  const names = state.players;
  let i = 0, delay = 60;
  const spin = () => {
    if (lastPhase !== 'reveal') return;
    const p = names[i++ % names.length];
    $('reveal-seeker').textContent = p.name;
    $('reveal-img').src = thumbs[p.charId];
    $('reveal-map').textContent = MAPS[i % MAPS.length].name;
    beep(300 + (i % 5) * 60, 0.05, 'square', 0.05);
    delay *= 1.12;
    if (delay < 420) setTimeout(spin, delay);
    else {
      $('reveal-seeker').textContent = `${seeker.name}${seeker.id === session.myId ? ' (toi !)' : ''}`;
      $('reveal-img').src = thumbs[seeker.charId];
      $('reveal-map').textContent = mapName(state.mapId);
      const touch = document.body.classList.contains('touch');
      const act = touch ? 'le <b>gros bouton jaune</b>' : 'la touche <b>E</b>';
      $('reveal-role').innerHTML = seeker.id === session.myId
        ? `🔍 <b>C'est toi qui cherches !</b><br>Ferme les yeux 30 s, puis approche-toi des cachettes et utilise ${act} pour les fouiller.`
        : `🙈 <b>Cache-toi !</b><br>Tu auras 30 s : choisis une cachette dans la liste, ou approche-toi d'un 👀 et utilise ${act}.`;
      jingle([[392], [523], [659], [784, 450]]);
    }
  };
  spin();
}

function showRoundEnd() {
  show('roundend');
  const r = state.results;
  if (!r) return;
  $('re-title').textContent = r.cancelled ? 'Manche annulée' : r.winner === 'seeker' ? `🔍 ${r.seekerName} a trouvé tout le monde !` : '🙈 Les cachés gagnent la manche !';
  $('re-sub').textContent = r.cancelled ? '' : r.winner === 'seeker' ? `Avec ${fmt(r.timeLeft)} d'avance.` : 'Le temps est écoulé !';
  $('re-table').innerHTML = '<tr><th></th><th>Joueur</th><th>Résultat</th><th>Points</th><th>Total</th></tr>' + r.lines.map((l) => {
    const res = l.role === 'seeker' ? '🔍 Chercheur' : l.found ? `Trouvé à ${fmt(l.foundAt)}${l.last ? ' · dernier 🥇' : ''}` : '🏅 Survivant !';
    return `<tr><td><img src="${thumbs[l.charId]}" alt=""></td><td>${esc(l.name)}</td><td>${res}</td><td class="pts">+${l.pts}</td><td>${l.total}</td></tr>`;
  }).join('');
  const mine = r.lines.find((l) => l.id === session.myId);
  if (mine) {
    const won = (r.winner === 'seeker' && mine.role === 'seeker') || (r.winner === 'hiders' && mine.role === 'hider' && !mine.found);
    jingle(won ? [[523], [659], [784], [1046, 420]] : [[392], [330], [262, 300]]);
  }
}

function showFinal() {
  show('final');
  const rk = state.results?.ranking || [];
  const heights = [140, 100, 70], colors = ['#ffb703', '#adb5bd', '#cd7f32'];
  const order = [1, 0, 2].filter((i) => rk[i]);
  $('podium').innerHTML = order.map((i) => `<div class="pod"><img src="${thumbs[rk[i].charId]}" alt=""><div class="nm">${esc(rk[i].name)}</div><div>${rk[i].score} pts</div><div class="block" style="height:${heights[i]}px;background:${colors[i]}">${i + 1}</div></div>`).join('');
  $('final-list').innerHTML = rk.map((p) => `<li>${esc(p.name)} — ${esc(charName(p.charId))} — <b>${p.score} pts</b></li>`).join('');
  $('btn-again').style.display = state.hostId === session.myId ? '' : 'none';
  if (rk[0]?.id === session.myId) jingle([[523], [659], [784], [1046], [1318, 600]]);
}

// ---------------- Événements ----------------
function toast(text, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = text;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3500);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}

function spotObj(id) { return world?.spotObjects.get(id); }

function onEvent(e) {
  if (!world && e.t !== 'msg') return;
  if (e.t === 'found') {
    const mine = e.id === session.myId;
    toast(mine ? `😱 ${e.by} t'a trouvé !` : `🔍 ${e.by} a trouvé ${e.name} ${e.where === 'touché' ? '(attrapé !)' : `(${e.where})`}`, mine ? 'bad' : me?.isSeeker ? 'good' : '');
    if (e.spot != null && spotObj(e.spot)) { shake(spotObj(e.spot)); burst(spotObj(e.spot).position, 0xffd23f); }
    jingle(me?.isSeeker ? [[660], [880], [1100, 260]] : [[440], [330, 150]]);
  }
  if (e.t === 'empty') {
    if (me?.isSeeker) { toast(`❌ Personne dans « ${e.name} » ! −${e.penalty} s`, 'bad'); beep(160, 0.25, 'sawtooth', 0.08); }
    if (spotObj(e.spot)) shake(spotObj(e.spot), 0.5);
  }
  if (e.t === 'hint') {
    const o = spotObj(e.spot);
    if (o) { shake(o, 1.2); floatText('Atchoum ! 🤧', o.position); burst(o.position, 0xffffff); }
    toast("🤧 Atchoum ! Quelqu'un a éternué…");
    beep(1200, 0.1, 'square', 0.06);
  }
  if (e.t === 'msg') toast(e.text);
}

function shake(obj, dur = 0.8) { fx.push({ type: 'shake', obj, t: 0, dur }); }
function floatText(text, pos) {
  const s = makeSprite(text, 52, 'rgba(255,255,255,.95)', 28, '#c1121f');
  s.position.set(pos.x, 3.2, pos.z);
  scene.add(s);
  fx.push({ type: 'float', obj: s, t: 0, dur: 2 });
}
function burst(pos, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), m);
    p.position.set(pos.x, 1.5, pos.z);
    p.userData.v = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 6 + 2, (Math.random() - 0.5) * 6);
    g.add(p);
  }
  scene.add(g);
  fx.push({ type: 'burst', obj: g, t: 0, dur: 1.2 });
}

// ---------------- HUD ----------------
function nearestSpot(x, z) {
  if (!world) return null;
  let best = null, bd = Infinity;
  for (const o of world.map.obstacles) {
    if (o.spotId == null) continue;
    const d = distToObstacle(o, x, z);
    if (d < bd) { bd = d; best = o; }
  }
  return best ? { o: best, d: bd } : null;
}
const occupant = (spotId) => state.players.find((p) => p.hidden === spotId && p.id !== session.myId);

function refreshSuggestions(force) {
  const free = world.map.spots.filter((s) => !occupant(s.id));
  suggestions = suggestions.filter((id) => free.some((s) => s.id === id));
  if (force || suggestions.length < 4) {
    const pool = free.filter((s) => !suggestions.includes(s.id) || force).sort(() => Math.random() - 0.5);
    suggestions = (force ? [] : suggestions).concat(pool.map((s) => s.id)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
  }
}
$('btn-more').onclick = () => { refreshSuggestions(true); renderHud(); };

let lastSpotHtml = '';
function renderHud() {
  if (!me || !world) return;
  const s = state;
  const searching = s.phase === 'search';
  $('phase-label').textContent = searching ? `🔍 Recherche · ${mapName(s.mapId)}` : '🫣 On se cache !';
  $('timer').textContent = fmt(s.timeLeft);
  $('timer').classList.toggle('urgent', searching && s.timeLeft < 30);
  const hiders = s.players.filter((p) => !p.isSeeker);
  const left = hiders.filter((p) => !p.found).length;
  $('remaining').textContent = `🙈 ${left}/${hiders.length}`;
  const role = $('role');
  role.className = me.isSeeker ? 'seeker' : '';
  role.innerHTML = me.isSeeker
    ? `🔍 Tu es le CHERCHEUR<br><small>${esc(charName(me.charId))} · trouve tout le monde !</small>`
    : me.found ? '😵 Trouvé !<br><small>Tu regardes le chercheur…</small>'
      : `🙈 Tu te caches<br><small>${esc(charName(me.charId))} · ne te fais pas trouver !</small>`;
  $('hud-players').innerHTML = s.players.map((p) => {
    let st = p.isSeeker ? '🔍' : p.found ? '✅' : p.hidden === -1 ? '❓' : p.hidden != null ? '🫣' : '🏃';
    return `<li class="${p.isSeeker ? 'seeker' : ''} ${p.found ? 'found' : ''}">${st} ${esc(p.name)} <small>· ${p.score + p.roundScore}</small></li>`;
  }).join('');
  // cécité du chercheur
  const blind = s.phase === 'hide' && me.isSeeker;
  $('blind').style.display = blind ? 'flex' : 'none';
  $('blind-count').textContent = Math.ceil(s.timeLeft);
  // panneau des cachettes
  const panel = s.phase === 'hide' && !me.isSeeker;
  $('hide-panel').style.display = panel ? 'block' : 'none';
  if (panel) {
    refreshSuggestions(false);
    const html = suggestions.map((id) => `<button data-spot="${id}" class="${me.hidden === id ? 'current' : ''}">${me.hidden === id ? '✅ ' : ''}${esc(world.map.spots[id].name)}</button>`).join('');
    if (html !== lastSpotHtml) {
      lastSpotHtml = html;
      $('spot-list').innerHTML = html;
      for (const b of $('spot-list').children) b.onclick = () => { session.send({ t: 'hide', spot: +b.dataset.spot, fromMenu: true }); beep(700, 0.08); };
    }
  }
}

function updatePrompt() {
  const el = $('prompt');
  let text = '';
  if (me && world && (state.phase === 'hide' || state.phase === 'search')) {
    if (me.isSeeker) {
      if (state.phase === 'search') {
        const visible = state.players.find((p) => !p.isSeeker && !p.found && p.hidden == null && p.x != null && Math.hypot(p.x - myPos.x, p.z - myPos.z) < CONFIG.CATCH_DIST + 0.8);
        const n = nearestSpot(myPos.x, myPos.z);
        if (visible) text = `E : attraper ${visible.name} !`;
        else if (n && n.d <= CONFIG.SEARCH_DIST) text = `E : fouiller « ${n.o.spot.name} »`;
      }
    } else if (me.found) text = '😵 Tu as été trouvé… regarde le chercheur !';
    else if (me.hidden != null) text = `🫣 Caché : ${world.map.spots[me.hidden].name} — E pour sortir (tu seras visible !)`;
    else {
      const n = nearestSpot(myPos.x, myPos.z);
      if (n && n.d <= CONFIG.SEARCH_DIST) {
        const occ = occupant(n.o.spotId);
        text = occ ? `« ${n.o.spot.name} » est déjà prise par ${occ.name}` : `E : se cacher — ${n.o.spot.name}`;
      } else if (state.phase === 'search') text = '⚠️ Tu es visible ! Trouve vite une cachette !';
    }
  }
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
  // gros bouton (téléphone) : le mot de l'action possible ici
  const btn = $('btn-action');
  const word = actionWord();
  if (btn.textContent !== (word || 'E')) btn.textContent = word || 'E';
  btn.classList.toggle('idle', !word);
}

function actionWord() {
  if (!me || !world || !(state.phase === 'hide' || state.phase === 'search') || me.found) return '';
  if (me.isSeeker) {
    if (state.phase !== 'search') return '';
    if (state.players.some((p) => !p.isSeeker && !p.found && p.hidden == null && p.x != null && Math.hypot(p.x - myPos.x, p.z - myPos.z) < CONFIG.CATCH_DIST + 0.8)) return 'Attraper';
    const n = nearestSpot(myPos.x, myPos.z);
    return n && n.d <= CONFIG.SEARCH_DIST ? 'Fouiller' : '';
  }
  if (me.hidden != null) return 'Sortir';
  const n = nearestSpot(myPos.x, myPos.z);
  return n && n.d <= CONFIG.SEARCH_DIST && !occupant(n.o.spotId) ? 'Se cacher' : '';
}

// ---------------- Comment jouer ----------------
function howtoHtml(role) {
  const touch = document.body.classList.contains('touch');
  const ctrl = touch
    ? `<li>🕹️ <b>Rond en bas à gauche</b> : pose ton pouce et glisse pour te déplacer.</li>
       <li>👆 <b>Glisse un doigt</b> ailleurs sur l'écran : tourner la caméra.</li>
       <li>🟡 <b>Gros bouton jaune</b> en bas à droite : il affiche l'action possible (<b>Se cacher</b>, <b>Sortir</b>, <b>Fouiller</b>, <b>Attraper</b>).</li>
       <li>❓ Le petit bouton <b>?</b> réaffiche cette aide à tout moment.</li>`
    : `<li>⌨️ <b>Z Q S D</b> (ou les flèches) : se déplacer.</li>
       <li>🖱️ <b>Clic maintenu + souris</b> : tourner la caméra · <b>molette</b> : zoom.</li>
       <li>🟡 <b>E</b> (ou Espace) : se cacher, sortir de sa cachette, fouiller.</li>
       <li>❓ Le bouton <b>?</b> réaffiche cette aide à tout moment.</li>`;
  const hider = `<h3>🙈 Si tu te caches</h3><ol>
       <li>Tu as <b>30 secondes</b> : touche une cachette dans la liste « Choisis ta cachette », ou marche jusqu'à un 👀 et fais <b>Se cacher</b>.</li>
       <li>Le chercheur est <b>tout rouge</b> 🔴. S'il fouille ta cachette ou te <b>touche</b>, tu es trouvé.</li>
       <li>Il s'approche ? Tu peux <b>Sortir</b> et courir vers une autre cachette… mais à découvert, on te voit !</li>
       <li>Tiens jusqu'à la fin du chrono : <b>+150 points</b> (et +1 point par seconde caché).</li></ol>`;
  const seeker = `<h3>🔍 Si tu es le chercheur</h3><ol>
       <li>Pendant 30 secondes ton écran est noir : <b>les autres se cachent</b>.</li>
       <li>Ensuite, va près des cachettes et fais <b>Fouiller</b>. Un joueur à découvert : <b>touche-le</b> pour l'attraper.</li>
       <li>Cachette vide = <b>−5 secondes</b>. Dans la dernière minute, une cachette occupée <b>éternue</b> 🤧 : fonce !</li>
       <li>Trouve tout le monde avant la fin : <b>+100 par joueur</b>, +150 de bonus et des points pour le temps restant.</li></ol>`;
  const goal = `<h3>🎯 Le but</h3><p>Un joueur tiré au sort <b>cherche</b>, les autres <b>se cachent</b>. Le chrono dépend du nombre de joueurs (2 min + 30 s par caché, 6 min max). Chacun cherche à son tour ; à la fin, le plus gros score gagne 🏆.</p>`;
  const body = role === 'seeker' ? seeker : role === 'hider' ? hider : goal + hider + seeker;
  return body + `<h3>🎮 Commandes</h3><ul>${ctrl}</ul>`;
}
function openHowto(role) {
  $('howto').innerHTML = howtoHtml(role);
  $('howto-wrap').hidden = false;
}
$('btn-howto-close').onclick = () => { $('howto-wrap').hidden = true; store.set('cc-howto', '1'); };
$('btn-howto-home').onclick = () => openHowto();
$('btn-howto-lobby').onclick = () => openHowto();
$('btn-help').onclick = () => openHowto(me?.isSeeker ? 'seeker' : 'hider');

function action() {
  if (!me || !session) return;
  if (me.isSeeker) { if (state.phase === 'search') session.send({ t: 'search' }); return; }
  if (me.found || !(state.phase === 'hide' || state.phase === 'search')) return;
  if (me.hidden != null) { session.send({ t: 'unhide' }); return; }
  const n = nearestSpot(myPos.x, myPos.z);
  if (n && n.d <= CONFIG.SEARCH_DIST && !occupant(n.o.spotId)) session.send({ t: 'hide', spot: n.o.spotId });
}

// ---------------- Contrôles ----------------
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Enter' && e.target.id === 'join-code') $('btn-join').click(); return; }
  keys.add(e.code);
  if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && !e.repeat) { action(); e.preventDefault(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  cam.yaw -= (e.clientX - drag.x) * 0.006;
  cam.pitch = Math.max(0.1, Math.min(1.3, cam.pitch + (e.clientY - drag.y) * 0.004));
  drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(3, Math.min(14, cam.dist + Math.sign(e.deltaY) * 0.6)); }, { passive: true });

// joystick tactile
const stick = { x: 0, y: 0, id: null };
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
const stickEl = $('stick'), knob = $('knob');
stickEl.addEventListener('pointerdown', (e) => { stick.id = e.pointerId; stickEl.setPointerCapture(e.pointerId); moveStick(e); });
stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
const endStick = () => { stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
stickEl.addEventListener('pointerup', endStick);
stickEl.addEventListener('pointercancel', endStick);
function moveStick(e) {
  const r = stickEl.getBoundingClientRect();
  let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const l = Math.hypot(dx, dy);
  if (l > 1) { dx /= l; dy /= l; }
  stick.x = dx; stick.y = dy;
  knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
}
$('btn-action').addEventListener('pointerdown', (e) => { e.preventDefault(); action(); });

// ---------------- Boucle principale ----------------
const clock = new THREE.Clock();
const ray = new THREE.Raycaster();
let sendTimer = 0, hudTimer = 0, lastSent = '';

function canMove() {
  if (!me || !world || me.found || me.hidden != null) return false;
  if (state.phase === 'search') return true;
  return state.phase === 'hide' && !me.isSeeker;
}

function angleLerp(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (!world || !state || !me) return;

  // déplacement local
  myPos.moving = false;
  if (canMove()) {
    let f = 0, s = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
    f -= stick.y; s += stick.x;
    const l = Math.hypot(f, s);
    if (l > 0.1) {
      const k = Math.min(1, l) / l;
      const fx_ = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      const mx = (fx_ * f + rx * s) * k, mz = (fz * f + rz * s) * k;
      const speed = me.isSeeker ? CONFIG.SEEKER_SPEED : CONFIG.HIDER_SPEED;
      const c = collide(world.map, myPos.x + mx * speed * dt, myPos.z + mz * speed * dt);
      myPos.x = c.x; myPos.z = c.z;
      myPos.rot = Math.atan2(mx, mz);
      myPos.moving = true;
    }
  }
  sendTimer -= dt;
  if (sendTimer <= 0 && canMove()) {
    sendTimer = 1 / 15;
    const msg = { t: 'pos', x: +myPos.x.toFixed(2), z: +myPos.z.toFixed(2), rot: +myPos.rot.toFixed(2), moving: myPos.moving, tp: myPos.tp };
    const key = JSON.stringify(msg);
    if (key !== lastSent) { session.send(msg); lastSent = key; }
  }

  // personnages
  const viewerSeeker = me.isSeeker && (state.phase === 'hide' || state.phase === 'search');
  for (const e of ents.values()) {
    const p = e.p;
    const self = p.id === session.myId;
    if (self) {
      e.root.position.set(myPos.x, 0, myPos.z);
      e.root.rotation.y = angleLerp(e.root.rotation.y, myPos.rot, 0.3);
    } else {
      const k = 1 - Math.exp(-dt * 12);
      e.root.position.x += (e.tx - e.root.position.x) * k;
      e.root.position.z += (e.tz - e.root.position.z) * k;
      e.root.rotation.y = angleLerp(e.root.rotation.y, e.trot, 0.2);
    }
    const secret = p.hidden === -1 || p.x == null;
    e.root.visible = !secret && !(viewerSeeker && p.hidden != null);
    setGhost(e, p.hidden != null && p.hidden !== -1);
    animateCharacter(e.model, t, self ? myPos.moving : p.moving);
    if (p.isSeeker) { e.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.12); }
    if (e.label) e.label.visible = !p.hidden || !viewerSeeker;
  }

  // marqueurs de cachettes (seulement pour ceux qui se cachent)
  const showMarkers = !me.isSeeker && !me.found && (state.phase === 'hide' || state.phase === 'search');
  for (const [id, s] of world.markers) {
    s.visible = showMarkers && !occupant(id) && me.hidden !== id;
    s.position.y += Math.sin(t * 3 + id) * 0.003;
  }

  // effets
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    const k = f.t / f.dur;
    if (f.type === 'shake') f.obj.rotation.z = k < 1 ? Math.sin(f.t * 45) * 0.08 * (1 - k) : 0;
    if (f.type === 'float') { f.obj.position.y += dt * 0.8; f.obj.material.opacity = 1 - k; }
    if (f.type === 'burst') for (const p of f.obj.children) { p.userData.v.y -= 15 * dt; p.position.addScaledVector(p.userData.v, dt); }
    if (k >= 1) { if (f.type !== 'shake') scene.remove(f.obj); fx.splice(i, 1); }
  }

  // caméra
  let target = new THREE.Vector3(myPos.x, 0, myPos.z);
  if (me.found && state.phase === 'search') {
    const se = ents.get(state.seekerId);
    if (se) target.copy(se.root.position);
  }
  target.y = 1.4;
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  let dist = cam.dist;
  ray.set(target, dir);
  ray.far = dist;
  const hit = ray.intersectObjects(world.blockers, true)[0];
  if (hit) dist = Math.max(1.2, hit.distance - 0.3);
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.lookAt(target);

  hudTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 0.1; updatePrompt(); if (state.phase === 'hide' || state.phase === 'search') { $('timer').textContent = fmt(state.timeLeft); } }
  renderer.render(scene, camera);
}
frame();
window.ccDebug = () => ({ session, state, cam });

// rejoindre directement via un lien ?room=CODE
if (params.get('room') && store.get('cc-name')) $('join-code').focus();
