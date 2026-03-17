import { APP_CONFIG } from "./config.js";
import { buildCityModel } from "./core/city-data.js";
import { createCameraController } from "./core/camera-controller.js";
import {
  formatInteger,
  formatViews,
  formatWords,
} from "./core/formatting.js";
import { createScene } from "./core/scene.js";
import { createCityMesh } from "./core/city-mesh.js";
import { WIKI_DATA } from "./data/wiki-data.js";
import { createInspector } from "./ui/panel.js";
import { createSearch } from "./ui/search.js";

const { THREE } = window;

const stage = document.getElementById("stage");
const loading = document.getElementById("loading");
const loadingStatus = document.getElementById("loadingStatus");
const tooltip = document.getElementById("tooltip");

setLoading("Preparing article dataset...");

requestAnimationFrame(() => {
  const articles = WIKI_DATA.map((entry) => ({
    title: entry.t,
    words: entry.w,
    views: entry.v,
  }));

  setLoading("Plotting the skyline...");

  requestAnimationFrame(() => {
    const model = buildCityModel(articles);
    const sceneState = createScene(stage);
    const city = createCityMesh(sceneState.scene, model);
    const cameraController = createCameraController({
      camera: sceneState.camera,
      domElement: sceneState.renderer.domElement,
    });

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
        neighborList: document.getElementById("neighborList"),
      },
      {
        onClose: clearSelection,
        onNeighborSelect: selectBuilding,
      },
    );

    const search = createSearch({
      input: document.getElementById("articleSearch"),
      results: document.getElementById("searchResults"),
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
      if (moved || cameraController.movedSinceDown()) {
        return;
      }

      updatePointer(event);
      const index = pickBuilding();
      if (index >= 0) {
        selectBuilding(index);
      } else {
        clearSelection();
      }
    });

    function updatePointer(event) {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function pickBuilding() {
      raycaster.setFromCamera(pointer, sceneState.camera);
      const hits = [];
      city.mesh.raycast(raycaster, hits);
      if (!hits.length) {
        return -1;
      }
      hits.sort((left, right) => left.distance - right.distance);
      return hits[0].instanceId ?? -1;
    }

    function selectBuilding(index) {
      const building = model.buildings[index];
      if (!building) {
        return;
      }

      selectedIndex = index;
      city.select(index);
      cameraController.focusBuilding(building);
      search.setValue(building.title);

      inspector.show(
        building,
        findNearestNeighbors(model.buildings, index, APP_CONFIG.neighborCount),
      );
      tooltip.innerHTML = "";
      hideTooltip();
    }

    function clearSelection() {
      selectedIndex = -1;
      city.clearSelection();
      inspector.hide();
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
      meta.textContent = `${formatViews(building.views)} views • ${formatWords(building.words)} words • #${formatInteger(building.rank)}`;

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
      city.update(now / 1000, sceneState.camera);
      sceneState.update(now / 1000);
      sceneState.renderer.render(sceneState.scene, sceneState.camera);
      requestAnimationFrame(animate);
    }

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
