import { THEME } from "../config.js";
import { createArticleBannerLayer } from "./article-banner-layer.js?v=wednesday-poster-2";
import { createFacadeMaterial } from "./facade-material.js";

const { THREE } = window;
const MAX_RARE_WINDOW_EVENTS = 16;
const MAX_RARE_CANDIDATES = 12;

export function createCityMesh(scene, model) {
  const group = new THREE.Group();
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = createFacadeMaterial(buildingGeometry, model.buildings);
  const rareWindowState = createRareWindowState(model.buildings);
  const buildings = new THREE.InstancedMesh(
    buildingGeometry,
    buildingMaterial,
    model.buildings.length,
  );
  buildings.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const N = model.buildings.length;

  // Set full-height instance matrices (shader controls visible rise)
  for (const building of model.buildings) {
    dummy.position.set(building.x, building.height / 2, building.z);
    dummy.scale.set(building.width, building.height, building.depth);
    dummy.updateMatrix();
    buildings.setMatrixAt(building.index, dummy.matrix);
  }
  buildings.instanceMatrix.needsUpdate = true;

  // Rise animation: per-instance float attribute drives the shader
  const riseData = new Float32Array(N);
  const riseAttribute = new THREE.InstancedBufferAttribute(riseData, 1);
  riseAttribute.setUsage(THREE.DynamicDrawUsage);
  buildingGeometry.setAttribute("aRise", riseAttribute);

  // Wave follows flyover path: buildings near the camera start rise first
  const RISE_DURATION = 0.9;
  const RISE_WAVE_SPAN = 5.5;
  const riseDelays = new Float32Array(N);
  let maxRiseDist = 0;
  for (let i = 0; i < N; i++) {
    const b = model.buildings[i];
    const d = Math.sqrt((b.x - 3000) ** 2 + (b.z - 3000) ** 2);
    riseDelays[i] = d;
    if (d > maxRiseDist) maxRiseDist = d;
  }
  for (let i = 0; i < N; i++) {
    riseDelays[i] = (riseDelays[i] / maxRiseDist) * RISE_WAVE_SPAN;
  }
  let riseStartTime = -1;
  let riseComplete = false;

  group.add(buildings);
  const bannerLayer = createArticleBannerLayer(group, model.buildings) ?? {};

  group.add(createUrbanBase(model));

  const selectionEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({
      color: 0xf4fbff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    }),
  );
  selectionEdges.visible = false;
  selectionEdges.renderOrder = 34;
  group.add(selectionEdges);

  scene.add(group);

  function update(elapsedSeconds, camera) {
    // Rise animation: shader-driven building growth
    if (!riseComplete) {
      if (riseStartTime < 0) {
        riseStartTime = elapsedSeconds;
      }
      const elapsed = elapsedSeconds - riseStartTime;
      let changed = false;
      for (let i = 0; i < N; i++) {
        if (riseData[i] >= 1) continue;
        const el = elapsed - riseDelays[i];
        if (el < 0) continue;
        riseData[i] = 1 - Math.pow(1 - Math.min(1, el / RISE_DURATION), 3);
        changed = true;
      }
      if (changed) {
        riseAttribute.needsUpdate = true;
      }
      if (!changed && elapsed > RISE_WAVE_SPAN + RISE_DURATION) {
        riseComplete = true;
      }
    }

    buildingMaterial.uniforms.uTime.value = elapsedSeconds;
    if (typeof bannerLayer.update === "function") {
      bannerLayer.update(riseData);
    }
    if (!camera) {
      return;
    }
    updateRareWindowEvents(
      rareWindowState,
      model.buildings,
      camera,
      elapsedSeconds,
      buildingMaterial.uniforms.uRareWindowEvents.value,
      buildingMaterial.uniforms.uRareWindowStarted.value,
      buildingMaterial.uniforms.uRareWindowMode.value,
      buildings,
    );
  }

  function select(index) {
    const building = model.buildings[index];
    if (!building) {
      clearSelection();
      return;
    }

    selectionEdges.position.set(building.x, building.height / 2, building.z);
    selectionEdges.scale.set(
      building.width + 5,
      building.height + 5,
      building.depth + 5,
    );
    selectionEdges.visible = true;
  }

  function clearSelection() {
    selectionEdges.visible = false;
  }

  return {
    mesh: buildings,
    update,
    select,
    clearSelection,
  };
}

function createRareWindowState(buildings) {
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;
  return {
    events: [],
    nextEventTime: 16 + Math.random() * 20,
    forward: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    projected: new THREE.Vector3(),
    target: new THREE.Vector3(),
    candidates: [],
    raycaster,
    hits: [],
    metadata: buildings.map((building) => buildRareWindowMetadata(building)),
  };
}

function updateRareWindowEvents(state, buildings, camera, elapsedSeconds, uniformEvents, uniformStarted, uniformModes, buildingMesh) {
  if (elapsedSeconds < state.nextEventTime) {
    return;
  }

  const rareEventData = pickRareWindowEvent(state, buildings, camera, buildingMesh);
  if (rareEventData) {
    for (const eventData of rareEventData.events) {
      state.events.push({
        data: eventData.data,
        mode: eventData.mode,
        startedAt: elapsedSeconds,
      });
      if (state.events.length > MAX_RARE_WINDOW_EVENTS) {
        state.events.shift();
      }
    }
    syncRareWindowUniforms(uniformEvents, uniformStarted, uniformModes, state.events);
    const floorSummary = rareEventData.rows
      .map((row) => `f${row + 1}`)
      .join(", ");
    const logMessage =
      `[rare-lights] t=${elapsedSeconds.toFixed(1)}s building="${rareEventData.title}" mode=${rareEventData.mode > 0 ? "on" : "off"} rows=${rareEventData.rows.length} floors=${floorSummary}`;
    window.setTimeout(() => console.info(logMessage), 0);
  }

  state.nextEventTime = elapsedSeconds + 14 + Math.random() * 18;
}

function pickRareWindowEvent(state, buildings, camera, buildingMesh) {
  collectRareWindowCandidates(state, buildings, camera, 0.3, 0.28, 0.83, 3600);
  if (!state.candidates.length) {
    collectRareWindowCandidates(state, buildings, camera, 0.5, 0.42, 0.78, 4300);
  }
  if (!state.candidates.length) {
    collectRareWindowCandidates(state, buildings, camera, 0.72, 0.62, 0.72, 5200);
  }

  if (!state.candidates.length) {
    return null;
  }

  const attemptOrder = state.candidates
    .map((candidate) => ({
      index: candidate.index,
      score: candidate.score * (0.92 + Math.random() * 0.16),
    }))
    .sort((left, right) => right.score - left.score);

  for (const candidate of attemptOrder) {
    const buildingIndex = candidate.index;
    const building = buildings[buildingIndex];
    const metadata = state.metadata[buildingIndex];
    const face = pickVisibleFace(building, camera);
    const block = pickReadableLightBlock(building, metadata, face, state.events);

    if (block && isRareRowBlockVisible(state, building, buildingIndex, face, block.rows, camera, buildingMesh)) {
      return {
        events: block.rows.map((row) => ({
          data: new THREE.Vector4(metadata.seed, face, -1, row),
          mode: block.mode,
        })),
        title: building.title,
        floors: building.floors,
        mode: block.mode,
        face,
        rows: block.rows,
      };
    }
  }

  return null;
}

function isRareRowBlockVisible(state, building, buildingIndex, face, rows, camera, buildingMesh) {
  const middleRow = rows[Math.floor(rows.length / 2)];
  const samples = [
    { row: rows[0], horizontal: 0.5 },
    { row: middleRow, horizontal: 0.5 },
    { row: rows[rows.length - 1], horizontal: 0.5 },
  ];

  return samples.every((sample) =>
    isRareFacadePointVisible(
      state,
      building,
      buildingIndex,
      face,
      sample.row,
      sample.horizontal,
      camera,
      buildingMesh,
    ),
  );
}

function isRareFacadePointVisible(state, building, buildingIndex, face, row, horizontal, camera, buildingMesh) {
  setRareFacadeSamplePoint(state.target, building, face, row, horizontal);
  state.offset.copy(state.target).sub(camera.position);
  const distance = state.offset.length();
  if (distance <= 1) {
    return false;
  }

  state.offset.multiplyScalar(1 / distance);
  state.raycaster.near = 1;
  state.raycaster.far = distance + 12;
  state.raycaster.set(camera.position, state.offset);
  state.hits.length = 0;
  buildingMesh.raycast(state.raycaster, state.hits);

  if (!state.hits.length) {
    return false;
  }

  state.hits.sort((left, right) => left.distance - right.distance);
  return state.hits[0].instanceId === buildingIndex;
}

function setRareFacadeSamplePoint(target, building, face, row, horizontal) {
  const rowCenterY = ((row + 0.5) / Math.max(3, building.floors)) * building.height;
  const xOffset = (horizontal - 0.5) * building.width * 0.72;
  const zOffset = (horizontal - 0.5) * building.depth * 0.72;

  if (face === 0) {
    target.set(building.x + building.width * 0.5 - 0.05, rowCenterY, building.z + zOffset);
    return;
  }
  if (face === 1) {
    target.set(building.x - building.width * 0.5 + 0.05, rowCenterY, building.z + zOffset);
    return;
  }
  if (face === 2) {
    target.set(building.x + xOffset, rowCenterY, building.z + building.depth * 0.5 - 0.05);
    return;
  }
  target.set(building.x + xOffset, rowCenterY, building.z - building.depth * 0.5 + 0.05);
}

function collectRareWindowCandidates(state, buildings, camera, maxX, maxY, minForward, maxDistance) {
  state.candidates.length = 0;
  camera.getWorldDirection(state.forward);

  for (let index = 0; index < buildings.length; index += 1) {
    const building = buildings[index];
    const metadata = state.metadata[index];
    state.offset.set(
      building.x - camera.position.x,
      Math.min(building.height * 0.72, building.height - 10) - camera.position.y,
      building.z - camera.position.z,
    );

    const distance = state.offset.length();
    if (distance < 320 || distance > maxDistance) {
      continue;
    }

    state.offset.multiplyScalar(1 / distance);
    const forwardness = state.offset.dot(state.forward);
    if (forwardness < minForward) {
      continue;
    }

    state.projected.set(
      building.x,
      Math.min(building.height * 0.72, building.height - 10),
      building.z,
    ).project(camera);

    if (
      state.projected.z < -1 ||
      state.projected.z > 1 ||
      Math.abs(state.projected.x) > maxX ||
      Math.abs(state.projected.y) > maxY
    ) {
      continue;
    }

    const centerBiasX = 1 - Math.abs(state.projected.x) / maxX;
    const centerBiasY = 1 - Math.abs(state.projected.y) / maxY;
    const proximity = 1 - (distance - 320) / (maxDistance - 320);
    const prominence = clamp(building.intensity * 0.7 + building.height / 900 * 0.6, 0.12, 1.2);
    const windowSpan = faceWindowSpan(building, metadata, pickVisibleFace(building, camera));
    const score =
      centerBiasX * 1.7 +
      centerBiasY * 1.3 +
      proximity * 1.1 +
      prominence * 1.2 +
      windowSpan * 0.25 +
      forwardness * 0.4;

    insertRareCandidate(state.candidates, { index, score }, MAX_RARE_CANDIDATES);
  }
}

function insertRareCandidate(candidates, candidate, limit) {
  if (candidates.length >= limit && candidate.score <= candidates[candidates.length - 1].score) {
    return;
  }

  let insertIndex = candidates.findIndex((entry) => candidate.score > entry.score);
  if (insertIndex === -1) {
    insertIndex = candidates.length;
  }
  candidates.splice(insertIndex, 0, candidate);

  if (candidates.length > limit) {
    candidates.length = limit;
  }
}

function pickReadableLightBlock(building, metadata, face, existingEvents) {
  const columns = face < 2 ? metadata.frontColumns : metadata.sideColumns;
  const rows = Math.max(3, building.floors);
  const candidates = [];

  for (let rowCount = 1; rowCount <= 3; rowCount += 1) {
    const minStartRow = Math.max(0, Math.floor(rows * 0.38));
    const maxStartRow = Math.min(rows - rowCount, Math.ceil(rows * 0.9) - rowCount);
    const rowCountBias = rowCount === 1 ? 1.14 : rowCount === 2 ? 0.92 : 0.74;

    for (let startRow = minStartRow; startRow <= maxStartRow; startRow += 1) {
      const blockRows = Array.from({ length: rowCount }, (_, index) => startRow + index);
      const overlapsExisting = existingEvents.some(
        (event) =>
          Math.abs(event.data.x - metadata.seed) < 0.001 &&
          event.data.y === face &&
          blockRows.includes(event.data.w),
      );
      if (overlapsExisting) {
        continue;
      }

      let totalLitCount = 0;
      let strongestLitRatio = 0;

      for (const row of blockRows) {
        let rowLitCount = 0;
        for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
          if (isLitWindow(metadata, building, face, columnIndex, row)) {
            rowLitCount += 1;
          }
        }
        totalLitCount += rowLitCount;
        strongestLitRatio = Math.max(strongestLitRatio, rowLitCount / columns);
      }

      const averageLitRatio = totalLitCount / (columns * rowCount);
      const uvY = (startRow + rowCount * 0.5) / rows;
      const verticalFocus = 1 - Math.abs(uvY - 0.76) * 2.6;
      const onScore =
        (Math.max(0, verticalFocus) * 0.52 +
          (1 - averageLitRatio) * 0.28 +
          Math.min(1, strongestLitRatio + 0.15) * 0.2) *
        rowCountBias;
      const offScore =
        (Math.max(0, verticalFocus) * 0.5 +
          averageLitRatio * 0.32 +
          strongestLitRatio * 0.18) *
        rowCountBias;

      if (averageLitRatio >= 0.28) {
        candidates.push({ rows: blockRows, mode: -1, score: offScore });
      }
      if (averageLitRatio <= 0.52) {
        candidates.push({ rows: blockRows, mode: 1, score: onScore * 0.88 });
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => right.score - left.score);
  const shortlist = candidates.slice(0, Math.min(8, candidates.length));
  const selected = shortlist[Math.floor(Math.random() * shortlist.length)];
  return {
    rows: selected.rows.slice(),
    mode: selected.mode,
  };
}

function syncRareWindowUniforms(uniformEvents, uniformStarted, uniformModes, events) {
  for (let index = 0; index < MAX_RARE_WINDOW_EVENTS; index += 1) {
    if (index < events.length) {
      uniformEvents[index].copy(events[index].data);
      uniformStarted[index] = events[index].startedAt;
      uniformModes[index] = events[index].mode;
    } else {
      uniformEvents[index].set(-1, -1, -1, -1);
      uniformStarted[index] = -1;
      uniformModes[index] = 0;
    }
  }
}

function pickVisibleFace(building, camera) {
  if (Math.abs(camera.position.x - building.x) > Math.abs(camera.position.z - building.z)) {
    return camera.position.x >= building.x ? 0 : 1;
  }
  return camera.position.z >= building.z ? 2 : 3;
}

function buildRareWindowMetadata(building) {
  const titleHash = hashString(building.title);
  return {
    seed: randomFromHash(titleHash, 22) * 1000,
    style: Math.floor(randomFromHash(titleHash, 3) * 5),
    variation: randomFromHash(titleHash, 8),
    crown: clamp(
      building.intensity * 0.7 + randomFromHash(titleHash, 7) * 0.26,
      0.06,
      1,
    ),
    lightDensity: clamp(
      0.14 + building.intensity * 0.72 + (randomFromHash(titleHash, 6) - 0.5) * 0.08,
      0.08,
      0.95,
    ),
    frontColumns: Math.max(
      3,
      Math.floor(building.width / (4.1 + randomFromHash(titleHash, 4) * 1.4)),
    ),
    sideColumns: Math.max(
      3,
      Math.floor(building.depth / (4.0 + randomFromHash(titleHash, 5) * 1.5)),
    ),
  };
}

function isLitWindow(metadata, building, face, cellX, cellY) {
  const columns = face < 2 ? metadata.frontColumns : metadata.sideColumns;
  const rows = Math.max(3, building.floors);
  const uvX = (cellX + 0.5) / columns;
  const uvY = (cellY + 0.5) / rows;
  let occupancy = metadata.lightDensity;
  occupancy += (hash12(cellX + metadata.seed * 0.13, cellY + metadata.seed * 0.29) - 0.5) * 0.08;
  occupancy += mix(-0.08, 0.12, uvY) * mix(0.35, 1.0, metadata.crown);

  let verticalAccent = 0;
  let horizontalAccent = 0;

  if (metadata.style < 0.5) {
    occupancy += Math.sin(cellY * 0.72 + metadata.seed * 0.08) * 0.05;
  } else if (metadata.style < 1.5) {
    occupancy += (hash12(cellY + metadata.seed * 0.21, Math.floor(cellX * 0.5) + metadata.seed) - 0.5) * 0.16;
  } else if (metadata.style < 2.5) {
    const stripeCount = 2 + Math.floor(metadata.variation * 4);
    verticalAccent = 1 - smoothstep(
      0.16,
      0.44,
      Math.abs(fract(uvX * stripeCount + metadata.seed * 0.013) - 0.5),
    );
    occupancy += verticalAccent * 0.22;
  } else if (metadata.style < 3.5) {
    const beltCount = 4 + Math.floor(metadata.variation * 5);
    horizontalAccent = 1 - smoothstep(
      0.12,
      0.4,
      Math.abs(fract(uvY * beltCount + metadata.seed * 0.017) - 0.5),
    );
    occupancy += horizontalAccent * 0.12;
  } else {
    occupancy -= 0.1;
    occupancy += smoothstep(0.72, 1.0, uvY) * 0.22;
  }

  const crownBand = smoothstep(0.82, 1.0, uvY);
  occupancy = clamp(occupancy + crownBand * metadata.crown * 0.22, 0.04, 0.98);

  return hash12(cellX + metadata.seed * 0.071, cellY + metadata.seed * 0.117) <= occupancy;
}

function faceWindowSpan(building, metadata, face) {
  const columns = face < 2 ? metadata.frontColumns : metadata.sideColumns;
  return face < 2 ? building.width / columns : building.depth / columns;
}

function createUrbanBase(model) {
  const baseGroup = new THREE.Group();

  const sidewalkGeometry = new THREE.PlaneGeometry(1, 1);
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.72,
  });
  const sidewalks = new THREE.InstancedMesh(
    sidewalkGeometry,
    sidewalkMaterial,
    model.blocks.length,
  );
  const dummy = new THREE.Object3D();

  model.blocks.forEach((block, index) => {
    dummy.position.set(block.x, -0.5, block.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(model.layout.blockFootprintX + 10, model.layout.blockFootprintZ + 10, 1);
    dummy.updateMatrix();
    sidewalks.setMatrixAt(index, dummy.matrix);
  });
  sidewalks.instanceMatrix.needsUpdate = true;
  baseGroup.add(sidewalks);

  // Park is now handled by park.js

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4300, 100, 8, 64),
    new THREE.MeshBasicMaterial({
      color: 0x050505,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 5;
  baseGroup.add(ring);

  return baseGroup;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromHash(hash, salt) {
  let value = (hash ^ Math.imul(salt, 0x45d9f3b)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 15;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function hash12(x, y) {
  let p3x = fract(x * 0.1031);
  let p3y = fract(y * 0.1031);
  let p3z = fract(x * 0.1031);
  const dot =
    p3x * (p3y + 33.33) +
    p3y * (p3z + 33.33) +
    p3z * (p3x + 33.33);
  p3x += dot;
  p3y += dot;
  p3z += dot;
  return fract((p3x + p3y) * p3z);
}

function smoothstep(min, max, value) {
  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function fract(value) {
  return value - Math.floor(value);
}
