// Version "à plat" du site (aucun dossier) : facile à déposer sur GitHub depuis un téléphone.
// Usage : node build-flat.mjs  -> dist-flat/
import fs from 'node:fs';
const out = 'dist-flat';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const fix = (s) => s
  .replaceAll("'../shared/core.js'", "'./core.js'")
  .replaceAll("'../firebase-config.js'", "'./firebase-config.js'")
  .replaceAll('"js/main.js"', '"main.js"')
  .replaceAll('./vendor/three.module.js', './three.module.js')
  .replaceAll('icons/', '');
const files = {
  'index.html': 'public/index.html', 'style.css': 'public/style.css', 'manifest.webmanifest': 'public/manifest.webmanifest',
  'firebase-config.js': 'public/firebase-config.js', 'main.js': 'public/js/main.js', 'characters.js': 'public/js/characters.js',
  'world.js': 'public/js/world.js', 'net-room.js': 'public/js/net-room.js', 'net-firebase.js': 'public/js/net-firebase.js',
  'core.js': 'public/shared/core.js', 'bake.js': 'public/js/bake.js',
};
for (const [dst, src] of Object.entries(files)) fs.writeFileSync(`${out}/${dst}`, fix(fs.readFileSync(src, 'utf8')));
let sw = fs.readFileSync('public/sw.js', 'utf8').replace(/const SHELL = \[[\s\S]*?\];/, `const SHELL = ['./', ${[...Object.keys(files), 'three.module.js', 'icon-192.png', 'icon-512.png'].map((f) => `'${f}'`).join(', ')}];`);
fs.writeFileSync(`${out}/sw.js`, sw);
fs.copyFileSync('node_modules/three/build/three.module.js', `${out}/three.module.js`);
for (const f of fs.readdirSync('public/icons')) fs.copyFileSync(`public/icons/${f}`, `${out}/${f}`);
console.log('OK ->', out, fs.readdirSync(out).length, 'fichiers');
