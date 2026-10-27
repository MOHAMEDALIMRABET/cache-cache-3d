// Serveur du mode en ligne : sert les fichiers du jeu et gère les salles via WebSocket.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GameRoom } from './public/shared/core.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const TICK = 1 / 20;
const MIME = { '.webmanifest': 'application/manifest+json', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const STATIC = {
  '/vendor/three.module.js': path.join(ROOT, 'node_modules/three/build/three.module.js'),
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = STATIC[url] || path.join(ROOT, 'public', path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(path.join(ROOT, 'public')) && !STATIC[url]) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> { room, sockets: Map(id -> ws) }

function newCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join('');
  while (rooms.has(c));
  return c;
}

function createRoom() {
  const code = newCode();
  const entry = { sockets: new Map() };
  entry.room = new GameRoom({ code, onEvent: (e) => broadcast(entry, { t: 'event', e }) });
  rooms.set(code, entry);
  return entry;
}

function broadcast(entry, msg) {
  const data = JSON.stringify(msg);
  for (const ws of entry.sockets.values()) if (ws.readyState === 1) ws.send(data);
}

function sendStates(entry) {
  for (const [id, ws] of entry.sockets) if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'state', s: entry.room.snapshot(id) }));
}

let nextId = 1;
wss.on('connection', (ws) => {
  const id = 'p' + nextId++;
  let entry = null;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!entry) {
      if (m.t === 'create') entry = createRoom();
      else if (m.t === 'join') {
        entry = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!entry) return send({ t: 'error', msg: 'Salle introuvable.' });
      } else return;
      const err = entry.room.addPlayer(id, m.name);
      if (err) { const e = entry; entry = null; if (!e.sockets.size) rooms.delete(e.room.code); return send({ t: 'error', msg: err }); }
      entry.sockets.set(id, ws);
      if (m.charId) entry.room.handle(id, { t: 'char', charId: m.charId });
      send({ t: 'joined', id, code: entry.room.code });
      sendStates(entry);
      return;
    }
    entry.room.handle(id, m);
    if (m.t !== 'pos') sendStates(entry);
  });

  ws.on('close', () => {
    if (!entry) return;
    entry.sockets.delete(id);
    entry.room.removePlayer(id);
    if (!entry.sockets.size) rooms.delete(entry.room.code);
    else sendStates(entry);
  });
});

let tickCount = 0;
setInterval(() => {
  tickCount++;
  for (const entry of rooms.values()) {
    entry.room.update(TICK);
    if (tickCount % 2 === 0) sendStates(entry); // 10 envois par seconde
  }
}, TICK * 1000);

server.listen(PORT, () => {
  console.log(`🎮 Cache-Cache 3D prêt sur http://localhost:${PORT}`);
  console.log('   Les autres joueurs du même réseau peuvent se connecter avec l\'adresse IP de cet ordinateur.');
});
