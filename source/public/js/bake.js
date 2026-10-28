// Fusionne les nombreux petits morceaux d'un objet 3D en quelques gros maillages (un par type de matière),
// en gardant les couleurs dans les sommets. Moins d'objets à dessiner = jeu bien plus fluide sur téléphone.
import * as THREE from 'three';

const sharedMats = new Map();
function bakedMaterial(src, shared) {
  const key = [src.transparent, src.opacity, src.emissive?.getHex() ?? 0, src.roughness, src.metalness, src.side].join('|');
  if (shared && sharedMats.has(key)) return sharedMats.get(key);
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: src.roughness, metalness: src.metalness, side: src.side,
    transparent: src.transparent, opacity: src.opacity, emissive: src.emissive?.clone() ?? new THREE.Color(0),
  });
  if (shared) sharedMats.set(key, m);
  return m;
}

// Les enfants marqués userData.bakeRoot (bras, jambes, cachettes qui tremblent…) sont fusionnés à part.
function collect(root) {
  const out = [];
  const walk = (o) => {
    for (const c of o.children) {
      if (c.userData.bakeRoot) continue;
      if (c.isMesh && !c.material.map && c.material.isMeshStandardMaterial) out.push(c);
      walk(c);
    }
  };
  walk(root);
  return out;
}

// shared = true : les matières fusionnées sont partagées (décor) ; false : propres à cet objet (personnage teinté en rouge)
export function bake(root, shared = false) {
  const meshes = collect(root);
  if (meshes.length < 2) return;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  for (const m of meshes) {
    const mat = bakedMaterial(m.material, true); // clé de regroupement
    if (!groups.has(mat)) groups.set(mat, { src: m.material, items: [], cast: false });
    const g = groups.get(mat);
    g.items.push(m);
    g.cast = g.cast || m.castShadow;
  }
  const tmp = new THREE.Matrix4();
  for (const { src, items, cast } of groups.values()) {
    let count = 0;
    const geos = items.map((m) => {
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
      geo.applyMatrix4(tmp.multiplyMatrices(inv, m.matrixWorld));
      count += geo.attributes.position.count;
      return { geo, color: m.material.color };
    });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
    let off = 0;
    for (const { geo, color } of geos) {
      const n = geo.attributes.position.count;
      pos.set(geo.attributes.position.array, off * 3);
      nor.set(geo.attributes.normal.array, off * 3);
      for (let i = 0; i < n; i++) { col[(off + i) * 3] = color.r; col[(off + i) * 3 + 1] = color.g; col[(off + i) * 3 + 2] = color.b; }
      off += n;
      geo.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, bakedMaterial(src, shared));
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.userData.baked = true;
    for (const m of items) m.parent.remove(m);
    root.add(mesh);
  }
}
