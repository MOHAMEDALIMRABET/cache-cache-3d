// Assemble la version "claude.ai" du jeu dans artifact/ (page + modules JS).
// Usage : node build-artifact.mjs
import fs from 'node:fs';
const out = 'artifact';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(`${out}/js`, { recursive: true });
fs.mkdirSync(`${out}/shared`, { recursive: true });
const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/style.css', 'utf8');
const body = html.split('<body>')[1].split('</body>')[0];
const page = `<title>Cache-Cache 3D</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;700;800&display=swap">
<style>
${css}
</style>
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }</script>
${body.trim()}
`;
fs.writeFileSync(`${out}/index.html`, page);
for (const f of ['main.js', 'characters.js', 'world.js', 'net-room.js', 'net-firebase.js', 'bake.js']) fs.copyFileSync(`public/js/${f}`, `${out}/js/${f}`);
fs.copyFileSync('public/shared/core.js', `${out}/shared/core.js`);
fs.copyFileSync('public/firebase-config.js', `${out}/firebase-config.js`);
console.log('OK ->', out);
