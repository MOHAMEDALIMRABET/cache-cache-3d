// Mode en ligne sans serveur : passe par la "salle" temps réel de claude.ai (capability `room`).
// Le navigateur qui crée la partie est l'hôte : il fait tourner GameRoom (règles + bots) et publie l'état.
// Les autres joueurs envoient leurs déplacements et leurs actions dans leur "présence".
import { GameRoom, CONFIG } from '../shared/core.js';

const PHASES = ['lobby', 'reveal', 'hide', 'search', 'roundEnd', 'final'];
const clean = (s, n = 16) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁤﻿]/g, '').slice(0, n);
const uid = () => 'u' + Math.random().toString(36).slice(2, 10);
const roomName = (code) => 'cc-' + code.toLowerCase();
export const newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

let roomApi;
export function getRoomApi() {
  if (!window.claude?.use) return Promise.resolve(null);
  roomApi = roomApi || window.claude.use('room').catch(() => null);
  return roomApi;
}

// ---- compression de l'état (la présence est limitée à 4 Ko) ----
function pack(s) {
  const r = s.results;
  return {
    c: s.code, ph: PHASES.indexOf(s.phase), t: Math.round(s.timeLeft * 10) / 10, r: s.round, R: s.totalRounds,
    h: s.hostId, m: s.mapId, s: s.seed, k: s.seekerId, sd: s.searchDuration,
    P: s.players.map((p) => [p.id, p.name, p.charId, (p.isBot ? 1 : 0) | (p.isSeeker ? 2 : 0) | (p.found ? 4 : 0) | (p.moving ? 8 : 0), p.x, p.z, p.rot, p.tp, p.score, p.roundScore, p.hidden]),
    res: r ? {
      w: r.winner, x: r.cancelled ? 1 : 0, sn: r.seekerName, tl: r.timeLeft,
      L: (r.lines || []).map((l) => [l.id, l.pts, l.total, l.role === 'seeker' ? 1 : 0, l.found ? 1 : 0, l.foundAt, l.last ? 1 : 0]),
      rk: r.ranking ? r.ranking.map((x) => [x.id, x.score]) : null,
    } : null,
  };
}

function unpack(d, myId) {
  const players = (d.P || []).map(([id, name, charId, f, x, z, rot, tp, score, roundScore, hidden]) => ({
    id, name: clean(name), charId, isBot: !!(f & 1), isSeeker: !!(f & 2), found: !!(f & 4), moving: !!(f & 8),
    x, z, rot, tp, score, roundScore, hidden,
  }));
  const byId = (id) => players.find((p) => p.id === id) || { name: '?', charId: 'mario' };
  const phase = PHASES[d.ph] || 'lobby';
  const me = players.find((p) => p.id === myId);
  // le chercheur ne doit pas voir où sont les cachés
  if (me?.isSeeker && (phase === 'hide' || phase === 'search')) {
    for (const p of players) if (!p.isSeeker && p.hidden != null) { p.hidden = -1; p.x = null; p.z = null; }
  }
  let results = null;
  if (d.res) {
    results = {
      winner: d.res.w, cancelled: !!d.res.x, seekerName: clean(d.res.sn), timeLeft: d.res.tl,
      lines: (d.res.L || []).map(([id, pts, total, seeker, found, foundAt, last]) => ({
        id, name: byId(id).name, charId: byId(id).charId, role: seeker ? 'seeker' : 'hider', found: !!found, foundAt, pts, total, last: !!last,
      })),
    };
    if (d.res.rk) results.ranking = d.res.rk.map(([id, score]) => ({ id, name: byId(id).name, charId: byId(id).charId, score }));
  }
  return {
    code: d.c, phase, timeLeft: d.t, round: d.r, totalRounds: d.R, hostId: d.h, mapId: d.m, seed: d.s,
    seekerId: d.k, searchDuration: d.sd, players, results,
  };
}

// ---- Hôte ----
export class RoomHostSession {
  constructor(api, name, charId) {
    this.api = api;
    this.myId = uid();
    this.code = newCode();
    this.name = clean(name);
    this.events = [];
    this.evSeq = 0;
    this.peerState = new Map(); // id -> { lastAct, lastPos, seenAt }
    this.room = new GameRoom({
      code: this.code,
      onEvent: (e) => {
        this.events.push([++this.evSeq, e]);
        this.events = this.events.slice(-6);
        this.onEvent?.(e);
      },
    });
    this.room.addPlayer(this.myId, this.name);
    if (charId) this.room.handle(this.myId, { t: 'char', charId });
    this.ready = this.start();
  }

  async start() {
    this.nr = await this.api.join(roomName(this.code));
    let tick = 0, last = performance.now();
    this.timer = setInterval(() => {
      tick++;
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      this.readPeers();
      this.room.update(dt);
      this.push();
      if (tick % 2 === 0) this.nr.presence({ hs: pack(this.room.snapshot(null)), ev: this.events }).catch(() => {});
      if (tick % 20 === 0) this.advertise();
    }, 50);
    this.advertise();
  }

  advertise() {
    const g = { c: this.code, n: this.name, k: this.room.players.size, p: this.room.phase === 'lobby' ? 0 : 1 };
    const key = JSON.stringify(g);
    if (key !== this.lastAd) { this.lastAd = key; this.api.presence({ g }).catch(() => {}); }
  }

  readPeers() {
    const now = Date.now();
    for (const peer of this.nr.peers()) {
      if (peer.sameTab) continue;
      const pr = peer.presence || {};
      const j = pr.j;
      if (!j || typeof j.id !== 'string') continue;
      const id = clean(j.id, 12);
      let ps = this.peerState.get(id);
      if (!ps) { ps = { lastAct: 0, lastPos: '' }; this.peerState.set(id, ps); }
      ps.seenAt = now;
      if (!this.room.players.has(id)) {
        if (this.room.phase === 'lobby' && !ps.refused) {
          const err = this.room.addPlayer(id, clean(j.n) || 'Joueur');
          if (err) ps.refused = true;
          else if (typeof j.c === 'string') this.room.handle(id, { t: 'char', charId: j.c });
        }
        continue;
      }
      if (Array.isArray(pr.p)) {
        const key = JSON.stringify(pr.p);
        if (key !== ps.lastPos) {
          ps.lastPos = key;
          const [x, z, rot, moving, tp] = pr.p;
          this.room.handle(id, { t: 'pos', x: +x, z: +z, rot: +rot, moving: !!moving, tp });
        }
      }
      if (Array.isArray(pr.a)) {
        for (const item of pr.a) {
          if (!Array.isArray(item) || typeof item[0] !== 'number' || item[0] <= ps.lastAct) continue;
          ps.lastAct = item[0];
          const m = item[1] || {};
          if (['char', 'hide', 'unhide', 'search'].includes(m.t)) this.room.handle(id, m);
        }
      }
    }
    // joueurs partis (fermeture de la page)
    for (const p of [...this.room.players.values()]) {
      if (p.isBot || p.id === this.myId) continue;
      const ps = this.peerState.get(p.id);
      if (!ps || now - ps.seenAt > 4000) { this.room.removePlayer(p.id); this.peerState.delete(p.id); }
    }
  }

  push() { this.onState?.(this.room.snapshot(this.myId)); }
  send(m) { this.room.handle(this.myId, m); if (m.t !== 'pos') this.push(); }
  close() {
    clearInterval(this.timer);
    this.api.presence({ g: null }).catch(() => {});
    this.nr?.leave().catch(() => {});
  }
}

// ---- Joueur qui rejoint ----
export class RoomClientSession {
  constructor(api, name, charId, code, onFail) {
    this.api = api;
    this.myId = uid();
    this.code = code.toUpperCase();
    this.onFail = onFail;
    this.acts = [];
    this.actSeq = 0;
    this.lastEv = null;
    this.startedAt = Date.now();
    this.ready = this.start(clean(name), charId);
  }

  async start(name, charId) {
    this.nr = await this.api.join(roomName(this.code));
    await this.nr.presence({ j: { id: this.myId, n: name, c: charId || null } });
    this.unsub = this.nr.onPeers(() => this.read());
    this.watch = setInterval(() => this.check(), 1000);
  }

  read() {
    const host = this.nr.peers().find((p) => p.presence?.hs?.c === this.code);
    if (!host) return;
    this.hostSeenAt = Date.now();
    const pr = host.presence;
    if (pr.hs === this.lastHs) return;
    this.lastHs = pr.hs;
    const s = unpack(pr.hs, this.myId);
    if (s.players.some((p) => p.id === this.myId)) this.admittedAt = this.admittedAt || Date.now();
    const evs = Array.isArray(pr.ev) ? pr.ev : [];
    if (this.lastEv == null) this.lastEv = evs.length ? evs[evs.length - 1][0] : 0;
    for (const [seq, e] of evs) if (seq > this.lastEv) { this.lastEv = seq; this.onEvent?.(e); }
    this.state = s;
    this.onState?.(s);
  }

  check() {
    const now = Date.now();
    if (!this.hostSeenAt) {
      if (now - this.startedAt > 9000) this.fail('Partie introuvable : vérifie le code, ou demande à l\'hôte de garder la page ouverte.');
      return;
    }
    if (now - this.hostSeenAt > 5000) return this.fail("L'hôte a quitté la partie.");
    if (!this.admittedAt && now - this.hostSeenAt < 1500 && now - this.startedAt > 5000) {
      this.fail(this.state?.phase !== 'lobby' ? 'Cette partie a déjà commencé. Attends la suivante !' : `La partie est pleine (${CONFIG.MAX_PLAYERS} joueurs max).`);
    }
  }

  fail(msg) { if (this.failed) return; this.failed = true; this.onFail?.(msg); }

  send(m) {
    if (!this.nr) return;
    if (m.t === 'pos') { this.nr.presence({ p: [m.x, m.z, m.rot, m.moving ? 1 : 0, m.tp] }).catch(() => {}); return; }
    this.acts.push([++this.actSeq, m]);
    this.acts = this.acts.slice(-5);
    this.nr.presence({ a: this.acts }).catch(() => {});
  }

  close() {
    clearInterval(this.watch);
    this.unsub?.();
    this.nr?.leave().catch(() => {});
  }
}

// Liste des parties ouvertes (annoncées par les hôtes dans le salon commun)
export function watchGames(api, cb) {
  const emit = () => cb(api.peers()
    .filter((p) => !p.sameTab && p.presence?.g?.c)
    .map((p) => ({ code: clean(p.presence.g.c, 4), name: clean(p.presence.g.n), count: +p.presence.g.k || 0, started: !!p.presence.g.p })));
  const un = api.onPeers(emit);
  emit();
  return un;
}
