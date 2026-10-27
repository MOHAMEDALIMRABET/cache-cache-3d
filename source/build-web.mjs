// Assemble l'application web dans dist/ (à héberger sur Firebase Hosting).
// Usage : node build-web.mjs   (ou npm run deploy pour construire et publier)
import fs from 'node:fs';
fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('public', 'dist', { recursive: true });
fs.mkdirSync('dist/vendor', { recursive: true });
fs.copyFileSync('node_modules/three/build/three.module.js', 'dist/vendor/three.module.js');
const cfg = fs.readFileSync('public/firebase-config.js', 'utf8');
if (/FIREBASE_CONFIG = null/.test(cfg)) console.warn('⚠️  firebase-config.js est encore vide : le mode en ligne ne marchera pas sur le site.');
console.log('OK -> dist/');
