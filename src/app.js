import { APP_CONFIG } from "./config.js";
import { buildCityModel } from "./core/city-data.js";
import { createCameraController } from "./core/camera-controller.js?v=vice-intro-1";
import {
  formatInteger,
  formatViews,
} from "./core/formatting.js";
import { createScene } from "./core/scene.js";
import { createCarLights } from "./core/car-lights.js";
import { createCityMesh } from "./core/city-mesh.js?v=wednesday-poster-2";
import { createPark } from "./core/park.js";
import { fetchArticleSummary } from "./core/wiki-api.js";
import { WIKI_DATA } from "./data/wiki-data.js";
import { createInspector } from "./ui/panel.js";
import { createSearch } from "./ui/search.js?v=search-close-fix-2";

const { THREE } = window;

const stage = document.getElementById("stage");
const loading = document.getElementById("loading");
const loadingStatus = document.getElementById("loadingStatus");
const tooltip = document.getElementById("tooltip");
const BATMAN_SOUND_URL = new URL("../assets/media/audio/transition.mp3", import.meta.url).href;
const VICE_SIGN_MODEL_URL = new URL("../assets/models/vice-sign/scene.gltf", import.meta.url).href;
const VICE_SIGN_COLOR = 0xec76aa;

setLoading("Preparing article dataset...");

requestAnimationFrame(() => {
  const articles = WIKI_DATA.map((entry) => ({
    title: entry.t,
    words: entry.w,
    views: entry.v,
  }));

  setLoading("Plotting the skyline...");

  requestAnimationFrame(() => {
    const skylineBtn = document.getElementById("skylineBtn");
    const model = buildCityModel(articles);
    const sceneState = createScene(stage);
    const city = createCityMesh(sceneState.scene, model);
    const carLights = createCarLights(sceneState.scene, model);
    const park = createPark(sceneState.scene, model);
    const batmanSound = new window.Audio(BATMAN_SOUND_URL);
    batmanSound.preload = "auto";

    const batmanBuilding = model.buildings.reduce(
      (tallest, building) => (building.height > tallest.height ? building : tallest),
      model.buildings[0],
    );
    const gtaViceBuilding = model.buildings.find(
      (building) => building.title === "Grand Theft Auto VI",
    ) || null;
    const wednesdayBuilding = model.buildings.find(
      (building) => building.title === "Wednesday (Fernsehserie)",
    ) || null;
    const introBuilding = gtaViceBuilding || wednesdayBuilding || batmanBuilding;
    const introView = gtaViceBuilding ? createViceIntroView(gtaViceBuilding) : null;
    let batmanModel = null;
    let batmanSelectionOutline = null;
    const loader = new THREE.GLTFLoader();
    loader.load("./assets/models/batman/scene.gltf", (gltf) => {
      console.log("Batman loaded", gltf);
      const batman = gltf.scene;
      const batmanScale = 0.3;
      batman.scale.set(batmanScale, batmanScale, batmanScale);
      batman.position.set(
        batmanBuilding.x,
        batmanBuilding.height,
        batmanBuilding.z + batmanBuilding.depth / 2,
      );
      sceneState.scene.add(batman);
      batmanModel = batman;
      batmanSelectionOutline = createBatmanSelectionOutline(batmanModel);
      if (batmanSelectionOutline) {
        batmanModel.add(batmanSelectionOutline);
      }
    }, undefined, (err) => console.error("Batman load error", err));
    if (gtaViceBuilding) {
      loader.load(VICE_SIGN_MODEL_URL, (gltf) => {
        const viceBillboard = createRooftopViceBillboard(gltf.scene, gtaViceBuilding);
        if (viceBillboard) {
          sceneState.scene.add(viceBillboard);
        }
      }, undefined, (err) => console.error("VICE sign load error", err));
    }
    const cameraController = createCameraController({
      camera: sceneState.camera,
      domElement: sceneState.renderer.domElement,
    });
    if (introView) {
      cameraController.startAtView(introView);
    } else {
      cameraController.startAtBuilding(introBuilding);
    }

    const inspector = createInspector(
      {
        panel: document.getElementById("inspector"),
        closeButton: document.getElementById("closeInspector"),
        title: document.getElementById("articleTitle"),
        tagline: document.getElementById("articleTagline"),
        rank: document.getElementById("articleRank"),
        views: document.getElementById("articleViews"),
        words: document.getElementById("articleWords"),
        floors: document.getElementById("articleFloors"),
        link: document.getElementById("articleLink"),
        preview: document.getElementById("articlePreview"),
        image: document.getElementById("articleImage"),
        summaryState: document.getElementById("articleSummaryState"),
        description: document.getElementById("articleDescription"),
        extract: document.getElementById("articleExtract"),
        neighborList: document.getElementById("neighborList"),
      },
      {
        onClose: clearSelection,
        onNeighborSelect: selectBuilding,
      },
    );

    const search = createSearch({
      shell: document.querySelector(".search-shell"),
      input: document.getElementById("articleSearch"),
      results: document.getElementById("searchResults"),
      closeButton: document.getElementById("closeSearch"),
      items: model.buildings.map((building) => ({
        index: building.index,
        title: building.title,
        views: building.views,
        rank: building.rank,
      })),
      onSelect: selectBuilding,
      limit: APP_CONFIG.searchLimit,
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerX = 0;
    let pointerY = 0;
    let pointerInside = false;
    let hoverIndex = -1;
    let selectedIndex = -1;
    let lastHoverCheck = 0;
    let lastTime = performance.now();
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastPointerType = "mouse";
    let previewController = null;
    let previewRequestId = 0;
    let pendingBatmanSound = null;

    sceneState.renderer.domElement.addEventListener("pointermove", (event) => {
      lastPointerType = event.pointerType || "mouse";
      pointerInside = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      updatePointer(event);
    });

    sceneState.renderer.domElement.addEventListener("pointerleave", () => {
      pointerInside = false;
      hoverIndex = -1;
      hideTooltip();
    });

    sceneState.renderer.domElement.addEventListener("pointerdown", (event) => {
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      lastPointerType = event.pointerType || "mouse";
      updatePointer(event);
    });

    sceneState.renderer.domElement.addEventListener("pointerup", (event) => {
      const moved =
        Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > 6;
      if (moved) {
        return;
      }

      updatePointer(event);
      const batmanHit = pickBatmanHit();
      const buildingHit = pickBuildingHit();
      if (batmanHit && (!buildingHit || batmanHit.distance <= buildingHit.distance + 4)) {
        if (selectedIndex >= 0) {
          clearSelection();
        }
        selectBatman();
        if (focusBatman()) {
          queueBatmanSound();
        }
        return;
      }
      cancelBatmanSound();
      const index = buildingHit?.index ?? -1;
      if (index >= 0 && index !== selectedIndex) {
        clearBatmanSelection();
        selectBuilding(index);
      } else if (selectedIndex >= 0) {
        clearBatmanSelection();
        clearSelection();
        setTimeout(() => cameraController.reset(), 1000);
      } else if (pickPark()) {
        clearBatmanSelection();
        console.log("Park clicked!");
        cameraController.focusPark();
        skylineBtn.classList.add("is-visible");
      } else {
        clearBatmanSelection();
      }
    });

    function updatePointer(event) {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function pickBuilding() {
      return pickBuildingHit()?.index ?? -1;
    }

    function pickBuildingHit() {
      raycaster.setFromCamera(pointer, sceneState.camera);
      const hits = [];
      city.mesh.raycast(raycaster, hits);
      if (!hits.length) {
        return null;
      }
      hits.sort((left, right) => left.distance - right.distance);
      return {
        index: hits[0].instanceId ?? -1,
        distance: hits[0].distance,
      };
    }

    function pickBatmanHit() {
      if (!batmanModel) {
        return null;
      }

      raycaster.setFromCamera(pointer, sceneState.camera);
      batmanModel.updateMatrixWorld(true);
      const hits = raycaster.intersectObject(batmanModel, true);
      if (!hits.length) {
        return null;
      }

      return {
        distance: hits[0].distance,
      };
    }

    function pickPark() {
      raycaster.setFromCamera(pointer, sceneState.camera);
      park.groundMesh.updateMatrixWorld();
      const hits = raycaster.intersectObject(park.groundMesh, true);
      return hits.length > 0;
    }

    function playBatmanSound() {
      batmanSound.pause();
      batmanSound.currentTime = 0;
      void batmanSound.play().catch(() => {});
    }

    function queueBatmanSound() {
      pendingBatmanSound = {
        deadline: performance.now() + 2600,
      };
    }

    function cancelBatmanSound() {
      pendingBatmanSound = null;
    }

    function selectBatman() {
      if (batmanSelectionOutline) {
        batmanSelectionOutline.visible = true;
      }
    }

    function clearBatmanSelection() {
      if (batmanSelectionOutline) {
        batmanSelectionOutline.visible = false;
      }
    }

    function focusBatman() {
      if (!batmanModel) {
        playBatmanSound();
        return false;
      }

      batmanModel.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(batmanModel);
      if (bounds.isEmpty()) {
        playBatmanSound();
        return false;
      }

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      bounds.getCenter(center);
      bounds.getSize(size);
      const target = new THREE.Vector3(
        center.x,
        center.y + size.y * 0.16,
        center.z,
      );
      const focusDistance = Math.max(90, size.y * 3.8, size.x * 9, size.z * 9);
      cameraController.focusTarget({
        target,
        distance: focusDistance,
        phi: 0.88,
        speed: 0.09,
      });
      return true;
    }

    function selectBuilding(index) {
      const building = model.buildings[index];
      if (!building) {
        return;
      }

      selectedIndex = index;
      city.select(index);
      cameraController.focusBuilding(building);
      skylineBtn.classList.remove("is-visible");
      search.setValue(building.title);

      inspector.show(
        building,
        findNearestNeighbors(model.buildings, index, APP_CONFIG.neighborCount),
      );
      loadArticlePreview(building);
      tooltip.innerHTML = "";
      hideTooltip();
    }

    function clearSelection() {
      previewRequestId += 1;
      if (previewController) {
        previewController.abort();
        previewController = null;
      }
      selectedIndex = -1;
      city.clearSelection();
      inspector.hide();
      skylineBtn.classList.remove("is-visible");
    }

    async function loadArticlePreview(building) {
      previewRequestId += 1;
      const requestId = previewRequestId;

      if (previewController) {
        previewController.abort();
      }

      previewController = new AbortController();

      try {
        const summary = await fetchArticleSummary(building.title, {
          signal: previewController.signal,
        });
        if (requestId !== previewRequestId || selectedIndex !== building.index) {
          return;
        }
        inspector.applyArticlePreview(summary);
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
        console.error("Wikipedia preview error", error);
        if (requestId !== previewRequestId || selectedIndex !== building.index) {
          return;
        }
        inspector.showArticlePreviewError();
      }
    }

    function showTooltip(index) {
      const building = model.buildings[index];
      if (!building) {
        hideTooltip();
        return;
      }

      tooltip.replaceChildren();

      const title = document.createElement("strong");
      title.className = "tooltip__title";
      title.textContent = building.title;

      const meta = document.createElement("span");
      meta.className = "tooltip__meta";
      meta.textContent = `${formatViews(building.views)} views • #${formatInteger(building.rank)}`;

      tooltip.append(title, meta);
      tooltip.style.left = `${Math.min(pointerX + 16, window.innerWidth - 280)}px`;
      tooltip.style.top = `${Math.min(pointerY + 16, window.innerHeight - 120)}px`;
      tooltip.classList.add("is-visible");
    }

    function hideTooltip() {
      tooltip.classList.remove("is-visible");
    }

    function animate(now) {
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (
        pointerInside &&
        lastPointerType !== "touch" &&
        !cameraController.isDragging() &&
        now - lastHoverCheck >= APP_CONFIG.hoverThrottleMs
      ) {
        lastHoverCheck = now;
        const index = pickBuilding();
        hoverIndex = index;
        if (index >= 0) {
          showTooltip(index);
        } else {
          hideTooltip();
        }
      }

      cameraController.update(deltaSeconds);
      if (pendingBatmanSound && (cameraController.isSettled() || now >= pendingBatmanSound.deadline)) {
        playBatmanSound();
        pendingBatmanSound = null;
      }
      city.update(now / 1000, sceneState.camera);
      carLights.update(now / 1000);
      sceneState.update(now / 1000);
      sceneState.renderer.render(sceneState.scene, sceneState.camera);
      requestAnimationFrame(animate);
    }

    skylineBtn.addEventListener("click", () => {
      cameraController.viewSkyline();
      skylineBtn.classList.remove("is-visible");
    });

    loading.classList.add("is-hidden");
    requestAnimationFrame(animate);
  });
});

function findNearestNeighbors(buildings, index, limit) {
  const current = buildings[index];
  const best = [];

  for (const candidate of buildings) {
    if (candidate.index === index) {
      continue;
    }

    const distance =
      (candidate.x - current.x) ** 2 + (candidate.z - current.z) ** 2;
    insertNeighbor(best, { distance, building: candidate }, limit);
  }

  return best.map((entry) => entry.building);
}

function insertNeighbor(entries, candidate, limit) {
  let insertIndex = entries.findIndex((entry) => candidate.distance < entry.distance);
  if (insertIndex === -1) {
    insertIndex = entries.length;
  }
  entries.splice(insertIndex, 0, candidate);
  if (entries.length > limit) {
    entries.length = limit;
  }
}

function setLoading(message) {
  loadingStatus.textContent = message;
}

function createBatmanSelectionOutline(root) {
  if (!root) {
    return null;
  }

  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const outlineGroup = new THREE.Group();
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });

  let lineCount = 0;
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry) {
      return;
    }

    const edgeGeometry = new THREE.EdgesGeometry(node.geometry, 32);
    if (!edgeGeometry.attributes.position?.count) {
      return;
    }

    const outline = new THREE.LineSegments(edgeGeometry, outlineMaterial);
    const relativeMatrix = rootInverse.clone().multiply(node.matrixWorld);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    relativeMatrix.decompose(position, quaternion, scale);
    scale.multiplyScalar(1.015);
    outline.position.copy(position);
    outline.quaternion.copy(quaternion);
    outline.scale.copy(scale);
    outline.renderOrder = 34;
    outline.frustumCulled = false;
    outlineGroup.add(outline);
    lineCount += 1;
  });

  outlineGroup.visible = false;
  return lineCount ? outlineGroup : null;
}

function createRooftopViceBillboard(modelRoot, building) {
  if (!modelRoot || !building) {
    return null;
  }

  tintViceSignMaterials(modelRoot);
  const wrapper = new THREE.Group();
  wrapper.add(modelRoot);
  modelRoot.updateMatrixWorld(true);

  const initialBounds = new THREE.Box3().setFromObject(modelRoot);
  if (initialBounds.isEmpty()) {
    return null;
  }

  const initialSize = new THREE.Vector3();
  initialBounds.getSize(initialSize);
  const scale = Math.min(
    (building.width * 0.82) / Math.max(0.001, initialSize.x),
    Math.max(18, building.height * 0.18) / Math.max(0.001, initialSize.y),
    (building.depth * 0.62) / Math.max(0.001, initialSize.z),
  );
  modelRoot.scale.multiplyScalar(scale);

  modelRoot.updateMatrixWorld(true);
  const fittedBounds = new THREE.Box3().setFromObject(modelRoot);
  const fittedCenter = new THREE.Vector3();
  fittedBounds.getCenter(fittedCenter);
  modelRoot.position.x -= fittedCenter.x;
  modelRoot.position.y -= fittedBounds.min.y;
  modelRoot.position.z -= fittedCenter.z;

  const inward = getInwardDirection(building);
  const roofInset = Math.min(building.width, building.depth) * 0.14;
  wrapper.position.set(
    building.x + inward.x * roofInset,
    building.height + 3.5,
    building.z + inward.z * roofInset,
  );
  wrapper.rotation.y = Math.atan2(inward.x, inward.z);
  return wrapper;
}

function tintViceSignMaterials(root) {
  const viceColor = new THREE.Color(VICE_SIGN_COLOR);
  root.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const tinted = materials.map((material) => {
      if (!material || typeof material.clone !== "function") {
        return material;
      }

      const next = material.clone();
      next.color = viceColor.clone();
      next.map = null;
      if ("emissive" in next) {
        next.emissive = viceColor.clone();
        next.emissiveIntensity = 0.28;
      }
      if ("metalness" in next) {
        next.metalness = 0.18;
      }
      if ("roughness" in next) {
        next.roughness = 0.42;
      }
      next.needsUpdate = true;
      return next;
    });

    node.material = Array.isArray(node.material) ? tinted : tinted[0];
  });
}

function createViceIntroView(building) {
  const inward = getInwardDirection(building);
  const roofInset = Math.min(building.width, building.depth) * 0.14;
  const target = new THREE.Vector3(
    building.x + inward.x * roofInset,
    building.height + Math.max(18, building.height * 0.1),
    building.z + inward.z * roofInset,
  );
  return {
    target,
    distance: Math.max(96, building.width * 3.8, building.depth * 4.2),
    phi: 1.12,
    theta: Math.atan2(inward.z, inward.x),
  };
}

function getInwardDirection(building) {
  const inward = new THREE.Vector3(-building.x, 0, -building.z);
  if (inward.lengthSq() < 0.001) {
    inward.set(0, 0, -1);
  } else {
    inward.normalize();
  }
  return inward;
}
