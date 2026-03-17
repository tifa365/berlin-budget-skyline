import { THEME } from "../config.js";
import { createFacadeMaterial } from "./facade-material.js";

const { THREE } = window;

export function createCityMesh(scene, model) {
  const group = new THREE.Group();
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = createFacadeMaterial(buildingGeometry, model.buildings);
  const buildings = new THREE.InstancedMesh(
    buildingGeometry,
    buildingMaterial,
    model.buildings.length,
  );
  buildings.frustumCulled = false;

  const dummy = new THREE.Object3D();

  for (const building of model.buildings) {
    dummy.position.set(building.x, building.height / 2, building.z);
    dummy.scale.set(building.width, building.height, building.depth);
    dummy.updateMatrix();
    buildings.setMatrixAt(building.index, dummy.matrix);
  }

  buildings.instanceMatrix.needsUpdate = true;
  group.add(buildings);

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
