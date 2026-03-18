import { LAYOUT_CONFIG } from "../config.js";

const { THREE } = window;

export function createPark(scene, model) {
  const pkW = model.layout.parkSizeX;
  const pkH = model.layout.parkSizeZ;
  const group = new THREE.Group();

  // --- Ground: dark grass base ---
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a10,
    emissive: 0x060e08,
    emissiveIntensity: 0.3,
    roughness: 0.95,
  });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(pkW, pkH), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.15;
  group.add(grass);

  // --- Stone border (like the raised edges around Alexanderplatz) ---
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x2a3040,
    emissive: 0x1a2030,
    emissiveIntensity: 0.25,
  });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const borders = [
    [pkW + 6, 1.5, 3, 0, 0.75, -pkH / 2],
    [pkW + 6, 1.5, 3, 0, 0.75, pkH / 2],
    [3, 1.5, pkH, -pkW / 2, 0.75, 0],
    [3, 1.5, pkH, pkW / 2, 0.75, 0],
  ];
  for (const [sx, sy, sz, px, py, pz] of borders) {
    const m = new THREE.Mesh(boxGeo, edgeMat);
    m.scale.set(sx, sy, sz);
    m.position.set(px, py, pz);
    group.add(m);
  }

  // --- Wide concrete plaza paths (Alexanderplatz-style brutalist grid) ---
  const paveMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c1e,
    emissive: 0x141618,
    emissiveIntensity: 0.2,
    roughness: 0.85,
  });
  const pathW = 8;

  const plazaRadius = 45;

  // Main cross axes — full width/height
  addPlane(group, paveMat, pathW, pkH, 0, 0.2, 0);
  addPlane(group, paveMat, pkW, pathW, 0, 0.2, 0);

  // Diagonal paths — full corner-to-corner through center (star pattern)
  const diagFull = Math.sqrt(pkW * pkW + pkH * pkH);
  const diagAngle1 = Math.atan2(pkW, pkH);
  const diagAngle2 = Math.atan2(-pkW, pkH);
  for (const angle of [diagAngle1, diagAngle2]) {
    const diag = new THREE.Mesh(new THREE.PlaneGeometry(pathW * 0.7, diagFull), paveMat);
    diag.rotation.x = -Math.PI / 2;
    diag.rotation.z = -angle;
    diag.position.set(0, 0.2, 0);
    group.add(diag);
  }

  // --- Central plaza circle (Neptunbrunnen area) ---
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0x1e2228,
    emissive: 0x141820,
    emissiveIntensity: 0.2,
    roughness: 0.8,
  });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(plazaRadius, 32), plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.22;
  group.add(plaza);

  // --- Neptunbrunnen-inspired fountain ---
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x606868,
    emissive: 0x505858,
    emissiveIntensity: 0.25,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3080c0,
    emissive: 0x2060a0,
    emissiveIntensity: 1.8,
    toneMapped: false,
    transparent: true,
    opacity: 0.65,
  });

  // Large octagonal basin
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 17, 2.5, 8),
    stoneMat,
  );
  basin.position.y = 1.25;
  group.add(basin);

  // Water surface in basin
  const basinWater = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 15, 0.4, 8),
    waterMat,
  );
  basinWater.position.y = 2.3;
  group.add(basinWater);

  // Middle tier
  const midTier = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 9, 3, 8),
    stoneMat,
  );
  midTier.position.y = 4;
  group.add(midTier);

  // Top bowl
  const topBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5.5, 2, 8),
    stoneMat,
  );
  topBowl.position.y = 6.5;
  group.add(topBowl);

  // Water spout
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 1.8, 3, 8),
    waterMat,
  );
  spout.position.y = 9;
  group.add(spout);

  // Tree scattering zones (no visible geometry, just coordinates)
  const patches = [
    [-pkW * 0.3, -pkH * 0.3, pkW * 0.18, pkH * 0.15],
    [pkW * 0.3, -pkH * 0.3, pkW * 0.18, pkH * 0.15],
    [-pkW * 0.3, pkH * 0.3, pkW * 0.18, pkH * 0.15],
    [pkW * 0.3, pkH * 0.3, pkW * 0.18, pkH * 0.15],
  ];

  // --- Sparse trees (Berlin-style: not dense, orderly) ---
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x2a1a0e,
    emissive: 0x1a1008,
    emissiveIntensity: 0.2,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x0c2a0e,
    emissive: 0x0c2a0e,
    emissiveIntensity: 0.3,
  });
  const trunkGeo = new THREE.CylinderGeometry(1, 1.3, 1, 6);
  const canopyGeo = new THREE.SphereGeometry(1, 8, 6);
  const treeCols = [0x0c2a0e, 0x0e3018, 0x142a10];

  const treePositions = [];
  const rng = createParkRandom(77);
  const pathHalf = pathW / 2 + 3; // keep trees off paths

  function isOnPath(tx, tz) {
    // Main cross axes
    if (Math.abs(tx) < pathHalf) return true;
    if (Math.abs(tz) < pathHalf) return true;
    // Diagonals
    const d1 = Math.abs(tx * pkH - tz * pkW) / Math.sqrt(pkW * pkW + pkH * pkH);
    const d2 = Math.abs(tx * pkH + tz * pkW) / Math.sqrt(pkW * pkW + pkH * pkH);
    if (d1 < pathHalf || d2 < pathHalf) return true;
    return false;
  }

  function isNearFountain(tx, tz) {
    return Math.sqrt(tx * tx + tz * tz) < plazaRadius + 8;
  }

  // Orderly rows alongside north-south path
  for (let z = -pkH * 0.44; z <= pkH * 0.44; z += 24) {
    if (isNearFountain(0, z)) continue;
    treePositions.push([-pathHalf - 6, z]);
    treePositions.push([pathHalf + 6, z]);
  }

  // Orderly rows alongside east-west path
  for (let x = -pkW * 0.44; x <= pkW * 0.44; x += 24) {
    if (isNearFountain(x, 0)) continue;
    treePositions.push([x, -pathHalf - 6]);
    treePositions.push([x, pathHalf + 6]);
  }

  // Scattered trees throughout the park
  for (let i = 0; i < 30; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const tx = (rng() - 0.5) * pkW * 0.88;
      const tz = (rng() - 0.5) * pkH * 0.88;
      if (isOnPath(tx, tz)) continue;
      if (isNearFountain(tx, tz)) continue;
      // Keep some distance from other trees
      let tooClose = false;
      for (const [ox, oz] of treePositions) {
        if ((tx - ox) ** 2 + (tz - oz) ** 2 < 144) { // 12 unit min distance
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      treePositions.push([tx, tz]);
      break;
    }
  }

  const treeCount = treePositions.length;
  const trunkIM = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopyIM = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
  const dummy = new THREE.Object3D();

  treePositions.forEach(([tx, tz], i) => {
    const v = Math.floor(rng() * 3);
    const trH = 10 + rng() * 5;
    const canH = 9 + rng() * 4;
    const canR = 6 + rng() * 3;

    dummy.position.set(tx, trH / 2, tz);
    dummy.scale.set(1, trH, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunkIM.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, trH + canH / 2 - 2, tz);
    dummy.scale.set(canR, canH, canR);
    dummy.updateMatrix();
    canopyIM.setMatrixAt(i, dummy.matrix);
    canopyIM.setColorAt(i, new THREE.Color(treeCols[v]));
  });

  trunkIM.instanceMatrix.needsUpdate = true;
  canopyIM.instanceMatrix.needsUpdate = true;
  if (canopyIM.instanceColor) canopyIM.instanceColor.needsUpdate = true;
  group.add(trunkIM);
  group.add(canopyIM);

  // --- Lamp posts along paths + perimeter ---
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x404040,
    emissive: 0x303030,
    emissiveIntensity: 0.15,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xe0c880,
    emissive: 0xd0b060,
    emissiveIntensity: 1.5,
    toneMapped: false,
  });
  const poleGeo = new THREE.CylinderGeometry(0.25, 0.4, 14, 6);
  const bulbGeo = new THREE.SphereGeometry(1.4, 8, 8);

  // Collect all lamp positions: along tree rows + perimeter
  const lampPositions = [];

  // Lamps along north-south tree path (between each pair of trees)
  for (let z = -pkH * 0.38; z <= pkH * 0.38; z += 28) {
    if (Math.abs(z) < plazaRadius + 10) continue;
    lampPositions.push([0, z]); // center of path
  }

  // Lamps along east-west tree path
  for (let x = -pkW * 0.38; x <= pkW * 0.38; x += 28) {
    if (Math.abs(x) < plazaRadius + 10) continue;
    lampPositions.push([x, 0]);
  }

  // Perimeter lamps
  const inset = 20;
  const perimW = pkW - inset * 2;
  const perimH = pkH - inset * 2;
  const totalPerim = (perimW + perimH) * 2;
  for (let i = 0; i < 16; i++) {
    let d = (i / 16) * totalPerim;
    let lx, lz;
    if (d < perimW) {
      lx = -perimW / 2 + d;
      lz = -perimH / 2;
    } else if (d < perimW + perimH) {
      d -= perimW;
      lx = perimW / 2;
      lz = -perimH / 2 + d;
    } else if (d < perimW * 2 + perimH) {
      d -= perimW + perimH;
      lx = perimW / 2 - d;
      lz = perimH / 2;
    } else {
      d -= perimW * 2 + perimH;
      lx = -perimW / 2;
      lz = perimH / 2 - d;
    }
    lampPositions.push([lx, lz]);
  }

  // Lamps along diagonal paths
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cornerX = sx * pkW / 2;
    const cornerZ = sz * pkH / 2;
    const dist = Math.sqrt(cornerX * cornerX + cornerZ * cornerZ);
    const dirX = cornerX / dist;
    const dirZ = cornerZ / dist;
    const startOffset = plazaRadius + 15;
    const endOffset = dist - 15;
    for (let d = startOffset; d <= endOffset; d += 40) {
      lampPositions.push([dirX * d, dirZ * d]);
    }
  }

  // Lamps around fountain
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    lampPositions.push([Math.cos(angle) * 38, Math.sin(angle) * 38]);
  }

  const lampCount = lampPositions.length;
  const poleIM = new THREE.InstancedMesh(poleGeo, poleMat, lampCount);
  const bulbIM = new THREE.InstancedMesh(bulbGeo, bulbMat, lampCount);

  lampPositions.forEach(([lx, lz], i) => {
    dummy.position.set(lx, 7, lz);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poleIM.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, 14.5, lz);
    dummy.updateMatrix();
    bulbIM.setMatrixAt(i, dummy.matrix);
  });

  poleIM.instanceMatrix.needsUpdate = true;
  bulbIM.instanceMatrix.needsUpdate = true;
  group.add(poleIM);
  group.add(bulbIM);

  // --- Point lights for actual illumination (limited for performance) ---
  const lightColor = 0xffe4b5;
  const lightIntensity = 1.2;
  const lightDist = 120;

  // Center fountain light
  const centerLight = new THREE.PointLight(lightColor, lightIntensity * 1.5, lightDist);
  centerLight.position.set(0, 16, 0);
  group.add(centerLight);

  // Lights at path intersections and corners
  const lightPositions = [
    [0, -pkH * 0.3],
    [0, pkH * 0.3],
    [-pkW * 0.3, 0],
    [pkW * 0.3, 0],
    [-pkW * 0.25, -pkH * 0.25],
    [pkW * 0.25, -pkH * 0.25],
    [-pkW * 0.25, pkH * 0.25],
    [pkW * 0.25, pkH * 0.25],
  ];
  for (const [lx, lz] of lightPositions) {
    const light = new THREE.PointLight(lightColor, lightIntensity, lightDist);
    light.position.set(lx, 18, lz);
    group.add(light);
  }




  scene.add(group);

  return {
    groundMesh: grass,
    update(elapsedSeconds) {
      // Could animate fountain water here if desired
    },
  };
}

function addPlane(parent, material, w, h, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

function createParkRandom(seed) {
  let current = seed >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = current;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
