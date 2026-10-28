// Réunit tout le jeu dans UN SEUL fichier : dist-single/index.html
// (three.js et Firebase sont chargés depuis Internet). Pratique pour publier depuis un téléphone :
// sur GitHub, « Add file > Create new file », nom « index.html », coller, « Commit ».
import fs from 'node:fs';
const modules = [
  ['core', 'public/shared/core.js'], ['config', 'public/firebase-config.js'], ['bake', 'public/js/bake.js'], ['characters', 'public/js/characters.js'],
  ['world', 'public/js/world.js'], ['room', 'public/js/net-room.js'], ['firebase', 'public/js/net-firebase.js'], ['main', 'public/js/main.js'],
];
const varOf = (spec) => ({ '../shared/core.js': 'core', '../firebase-config.js': 'config', './characters.js': 'characters', './world.js': 'world', './bake.js': 'bake', './net-room.js': 'room', './net-firebase.js': 'firebase' }[spec]);
let js = "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';\n";
for (const [name, file] of modules) {
  let src = fs.readFileSync(file, 'utf8');
  const exported = new Set();
  src = src.replace(/^import \* as THREE from 'three';\n/m, '');
  src = src.replace(/^import \{([^}]+)\} from '([^']+)';$/gm, (_, names, spec) => {
    const v = varOf(spec);
    if (!v) throw new Error('import inconnu ' + spec);
    return `const {${names}} = __${v};`;
  });
  src = src.replace(/^export (const|function|class|async function|let) ([A-Za-z_$][\w$]*)/gm, (_, kw, id) => { exported.add(id); return `${kw} ${id}`; });
  if (/^\s*(import|export)\s/m.test(src.replace(/\/\*[\s\S]*?\*\//g, ''))) throw new Error('import/export restant dans ' + file);
  js += `\n// ===== ${file} =====\nconst __${name} = (() => {\n${src}\nreturn { ${[...exported].join(', ')} };\n})();\n`;
}
const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/style.css', 'utf8');
const icon = 'data:image/png;base64,' + fs.readFileSync('public/icons/icon-192.png').toString('base64');
const safeJs = js.replace(/<\/script/gi, '<\\/script');
let out = html
  .replace(/<link rel="manifest"[^>]*>\n\s*/, '')
  .replace(/<link rel="icon" href="[^"]*">/, `<link rel="icon" href="${icon}">`)
  .replace(/<link rel="apple-touch-icon" href="[^"]*">/, `<link rel="apple-touch-icon" href="${icon}">`)
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace(/\s*<script type="importmap">.*<\/script>/, '')
  .replace('<script type="module" src="js/main.js"></script>', () => `<script type="module">\n${safeJs}\n</script>`);
fs.rmSync('dist-single', { recursive: true, force: true });
fs.mkdirSync('dist-single');
fs.writeFileSync('dist-single/index.html', out);
console.log('OK -> dist-single/index.html', Math.round(out.length / 1024), 'Ko');
