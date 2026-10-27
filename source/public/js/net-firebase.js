// Mode en ligne de l'application web : Firebase Realtime Database + connexion anonyme.
// Ce module imite l'API "salle" (presence / peers / onPeers / join / leave) utilisée par net-room.js,
// pour que l'hôte et les joueurs fonctionnent exactement comme sur claude.ai.
//   cachecache3d/lobby/<uid>             = annonce d'une partie ouverte par son hôte
//   cachecache3d/rooms/cc-<code>/<uid>     = présence de chaque joueur dans la partie (l'hôte y publie l'état du jeu)
import { FIREBASE_CONFIG } from '../firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const ROOT = 'cachecache3d'; // dossier du jeu dans la base (n'entre pas en conflit avec un autre jeu du même projet)

export const firebaseReady = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL);

// Une "zone" = un dossier de la base où chaque joueur possède une entrée à son uid.
function area(fb, db, uid, path) {
  const mine = fb.ref(db, `${path}/${uid}`);
  let cur = {};
  let list = Object.freeze([]);
  const listeners = new Set();
  fb.onDisconnect(mine).remove();
  const unsub = fb.onValue(fb.ref(db, path), (snap) => {
    const v = snap.val() || {};
    list = Object.freeze(Object.entries(v).map(([k, p]) => ({
      peer: k, by: null, isMe: k === uid, sameTab: k === uid, kind: 'viewer', guest: false,
      presence: p && typeof p === 'object' ? p : {}, updatedAt: Date.now(),
    })));
    for (const l of listeners) l({ peers: list, joined: [], left: [], updated: [] });
  });
  return {
    name: path,
    presence(patch) {
      for (const k in patch) { if (patch[k] == null) delete cur[k]; else cur[k] = patch[k]; }
      return Object.keys(cur).length ? fb.set(mine, cur) : fb.remove(mine);
    },
    peers: () => list,
    onPeers(fn) {
      listeners.add(fn);
      setTimeout(() => listeners.has(fn) && fn({ peers: list, joined: list, left: [], updated: [] }));
      return () => listeners.delete(fn);
    },
    connected: () => true,
    async leave() {
      listeners.clear();
      unsub();
      cur = {};
      await fb.remove(mine);
      fb.onDisconnect(mine).cancel();
    },
  };
}

// API compatible avec la salle claude.ai : le salon commun + join(nom) pour chaque partie.
export function makeApi(fb, db, uid) {
  const lobby = area(fb, db, uid, `${ROOT}/lobby`);
  const rooms = new Map();
  return {
    ...lobby,
    async join(name) {
      if (!rooms.has(name)) {
        const r = area(fb, db, uid, `${ROOT}/rooms/${name}`);
        const leave = r.leave;
        r.leave = async () => { rooms.delete(name); await leave(); };
        rooms.set(name, r);
      }
      return rooms.get(name);
    },
  };
}

let apiPromise = null;
export function getFirebaseApi() {
  if (!firebaseReady()) return Promise.resolve(null);
  apiPromise = apiPromise || (async () => {
    const [appMod, authMod, dbMod] = await Promise.all([
      import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-database.js`),
    ]);
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    const cred = await authMod.signInAnonymously(authMod.getAuth(app));
    return makeApi(dbMod, dbMod.getDatabase(app), cred.user.uid);
  })();
  apiPromise.catch(() => { apiPromise = null; });
  return apiPromise;
}

// Message clair selon l'erreur Firebase
export function firebaseError(e) {
  const code = String(e?.code || e?.message || '');
  if (code.includes('operation-not-allowed') || code.includes('admin-restricted')) return 'Firebase refuse la connexion : active la connexion « Anonyme » dans Authentication.';
  if (code.includes('PERMISSION_DENIED') || code.includes('permission')) return 'Firebase refuse l\'accès : publie les règles de la base (database.rules.json).';
  if (code.includes('api-key') || code.includes('invalid-api')) return 'Firebase refuse cette application : vérifie la clé API dans firebase-config.js.';
  if (code.includes('network')) return 'Connexion impossible. Vérifie ton accès à Internet, puis réessaie.';
  return 'Le jeu en ligne est indisponible pour le moment. Réessaie dans un instant.';
}
