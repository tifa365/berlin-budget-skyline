import { LAYOUT_CONFIG, THEME } from "../config.js";

const { THREE } = window;

export function createCityMesh(scene, model) {
  const group = new THREE.Group();
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.08,
    vertexColors: true,
  });
  const buildings = new THREE.InstancedMesh(
    buildingGeometry,
    buildingMaterial,
    model.buildings.length,
  );
  buildings.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const lowColor = new THREE.Color(THEME.lowBuilding);
  const highColor = new THREE.Color(THEME.highBuilding);
  const accentColor = new THREE.Color(0xffcf70);

  for (const building of model.buildings) {
    dummy.position.set(building.x, building.height / 2, building.z);
    dummy.scale.set(building.width, building.height, building.depth);
    dummy.updateMatrix();
    buildings.setMatrixAt(building.index, dummy.matrix);

    const color = lowColor.clone().lerp(highColor, building.intensity);
    if (building.rank <= 20) {
      color.lerp(accentColor, 0.24);
    }
    buildings.setColorAt(building.index, color);
  }

  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) {
    buildings.instanceColor.needsUpdate = true;
  }
  group.add(buildings);

  group.add(createUrbanBase(model));

  const selectionEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({
      color: THEME.highlight,
      transparent: true,
      opacity: 0.9,
    }),
  );
  selectionEdges.visible = false;
  group.add(selectionEdges);

  const selectionGlow = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      color: THEME.glow,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
    }),
  );
  selectionGlow.visible = false;
  group.add(selectionGlow);

  scene.add(group);

  function select(index) {
    const building = model.buildings[index];
    if (!building) {
      clearSelection();
      return;
    }

    selectionEdges.visible = true;
    selectionGlow.visible = true;
    selectionEdges.position.set(building.x, building.height / 2, building.z);
    selectionGlow.position.copy(selectionEdges.position);
    selectionEdges.scale.set(
      building.width + 4,
      building.height + 4,
      building.depth + 4,
    );
    selectionGlow.scale.set(
      building.width + 10,
      building.height + 10,
      building.depth + 10,
    );
  }

  function clearSelection() {
    selectionEdges.visible = false;
    selectionGlow.visible = false;
  }

  return {
    mesh: buildings,
    select,
    clearSelection,
  };
}

function createUrbanBase(model) {
  const baseGroup = new THREE.Group();

  const sidewalkGeometry = new THREE.PlaneGeometry(1, 1);
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: THEME.sidewalk,
    roughness: 0.92,
    metalness: 0.02,
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

  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(model.layout.parkSizeX, model.layout.parkSizeZ),
    new THREE.MeshStandardMaterial({
      color: THEME.park,
      roughness: 1,
      metalness: 0,
    }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.y = -0.3;
  baseGroup.add(park);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4300, 100, 8, 64),
    new THREE.MeshBasicMaterial({
      color: 0x17314b,
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
