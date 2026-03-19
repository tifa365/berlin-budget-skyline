import { ARTICLE_BANNER_CONFIG } from "../config.js";
import { fetchArticleSummary, shouldSuppressBanner } from "./wiki-api.js";

const { THREE } = window;

const panelGeometry = new THREE.PlaneGeometry(1, 1);
const backingMaterial = new THREE.MeshBasicMaterial({
  color: 0x05070d,
  transparent: true,
  opacity: 0.84,
  side: THREE.DoubleSide,
  depthWrite: false,
  toneMapped: false,
});
const trimMaterial = new THREE.MeshBasicMaterial({
  color: 0xd8f2ff,
  transparent: true,
  opacity: 0.58,
  side: THREE.DoubleSide,
  depthWrite: false,
  toneMapped: false,
});
const imageLoader = new THREE.ImageLoader();
imageLoader.setCrossOrigin("anonymous");

export function createArticleBannerLayer(parentGroup, buildings) {
  const layer = new THREE.Group();
  layer.renderOrder = 26;
  parentGroup.add(layer);
  const bannerEntries = [];
  let latestRiseData = null;

  if (!ARTICLE_BANNER_CONFIG.enabled) {
    return {
      group: layer,
      update() {},
    };
  }

  const bannerCandidates = buildings
    .slice()
    .sort((left, right) => right.floors - left.floors || left.rank - right.rank)

  if (!bannerCandidates.length) {
    return {
      group: layer,
      update() {},
    };
  }

  window.setTimeout(() => {
    void populateBanners(layer, bannerCandidates, (bannerGroup, buildingIndex) => {
      bannerEntries.push({ group: bannerGroup, buildingIndex });
      applyBannerRise(bannerGroup, latestRiseData?.[buildingIndex] ?? 0);
    });
  }, ARTICLE_BANNER_CONFIG.startDelayMs);

  return {
    group: layer,
    featuredBuildings: bannerCandidates.slice(0, ARTICLE_BANNER_CONFIG.maxBuildings),
    update(riseData) {
      latestRiseData = riseData;
      for (const entry of bannerEntries) {
        applyBannerRise(entry.group, riseData?.[entry.buildingIndex] ?? 0);
      }
    },
  };
}

async function populateBanners(layer, buildings, registerBanner) {
  const queue = buildings.slice();
  const state = {
    createdCount: 0,
    targetCount: ARTICLE_BANNER_CONFIG.maxBuildings,
  };
  const workers = Array.from(
    { length: ARTICLE_BANNER_CONFIG.loadConcurrency },
    () => drainBannerQueue(layer, queue, registerBanner, state),
  );
  await Promise.all(workers);
}

async function drainBannerQueue(layer, queue, registerBanner, state) {
  while (queue.length && state.createdCount < state.targetCount) {
    const building = queue.shift();
    if (!building) {
      return;
    }

    try {
      const summary = await fetchArticleSummary(building.title);
      if (
        summary.imageMode !== "live" ||
        !summary.imageUrl ||
        shouldSuppressBanner(summary)
      ) {
        continue;
      }

      const texture = await loadBannerTexture(summary.imageUrl);
      if (!texture) {
        continue;
      }
      if (state.createdCount >= state.targetCount) {
        return;
      }

      const bannerGroup = createBannerGroup(building, texture);
      layer.add(bannerGroup);
      state.createdCount += 1;
      registerBanner(bannerGroup, building.index);
    } catch (error) {
      console.warn(`[banner] ${building.title}: ${error.message}`);
    }
  }
}

function createBannerGroup(building, baseTexture) {
  const group = new THREE.Group();
  const bannerHeight = clamp(
    building.height * 0.026,
    ARTICLE_BANNER_CONFIG.minBannerHeight,
    ARTICLE_BANNER_CONFIG.maxBannerHeight,
  );
  const centerY = building.height - bannerHeight * 0.62;
  const offset = ARTICLE_BANNER_CONFIG.facadeOffset;
  const framePad = 3.4;
  const trimHeight = 2.1;

  const sides = [
    {
      width: building.width + 1.5,
      position: [building.x, centerY, building.z + building.depth / 2 + offset],
      rotationY: 0,
    },
    {
      width: building.width + 1.5,
      position: [building.x, centerY, building.z - building.depth / 2 - offset],
      rotationY: Math.PI,
    },
    {
      width: building.depth + 1.5,
      position: [building.x + building.width / 2 + offset, centerY, building.z],
      rotationY: -Math.PI / 2,
    },
    {
      width: building.depth + 1.5,
      position: [building.x - building.width / 2 - offset, centerY, building.z],
      rotationY: Math.PI / 2,
    },
  ];

  for (const side of sides) {
    const frame = new THREE.Mesh(panelGeometry, backingMaterial);
    frame.position.set(...side.position);
    frame.rotation.y = side.rotationY;
    frame.scale.set(side.width + framePad, bannerHeight + framePad, 1);
    frame.renderOrder = 26;
    group.add(frame);

    const topTrim = new THREE.Mesh(panelGeometry, trimMaterial);
    topTrim.position.set(side.position[0], side.position[1] + bannerHeight / 2 + 1.5, side.position[2]);
    topTrim.rotation.y = side.rotationY;
    topTrim.scale.set(side.width + framePad + 1.2, trimHeight, 1);
    topTrim.renderOrder = 27;
    group.add(topTrim);

    const bottomTrim = new THREE.Mesh(panelGeometry, trimMaterial);
    bottomTrim.position.set(side.position[0], side.position[1] - bannerHeight / 2 - 1.5, side.position[2]);
    bottomTrim.rotation.y = side.rotationY;
    bottomTrim.scale.set(side.width + framePad + 1.2, trimHeight, 1);
    bottomTrim.renderOrder = 27;
    group.add(bottomTrim);

    const banner = new THREE.Mesh(
      panelGeometry,
      createBannerMaterial(baseTexture, side.width / 30),
    );
    banner.position.set(...side.position);
    banner.rotation.y = side.rotationY;
    banner.scale.set(side.width, bannerHeight, 1);
    banner.renderOrder = 28;
    group.add(banner);
  }

  return group;
}

function createBannerMaterial(baseTexture, repeatX) {
  const map = baseTexture.clone();
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.repeat.set(Math.max(1, repeatX), 1);
  map.needsUpdate = true;

  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: ARTICLE_BANNER_CONFIG.opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
}

function loadBannerTexture(imageUrl) {
  return new Promise((resolve, reject) => {
    imageLoader.load(
      imageUrl,
      (image) => {
        try {
          const texture = createCroppedBannerTexture(image);
          resolve(texture);
        } catch (error) {
          reject(error);
        }
      },
      undefined,
      reject,
    );
  });
}

function createCroppedBannerTexture(image) {
  const canvas = document.createElement("canvas");
  canvas.width = ARTICLE_BANNER_CONFIG.textureWidth;
  canvas.height = ARTICLE_BANNER_CONFIG.textureHeight;

  const context = canvas.getContext("2d");
  context.fillStyle = "#05070d";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const scale = Math.max(canvas.width / imageWidth, canvas.height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2;

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(4, 8, 14, 0.28)");
  gradient.addColorStop(0.12, "rgba(4, 8, 14, 0)");
  gradient.addColorStop(0.88, "rgba(4, 8, 14, 0)");
  gradient.addColorStop(1, "rgba(4, 8, 14, 0.34)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyBannerRise(group, rise) {
  const clampedRise = clamp(rise, 0, 1);
  group.visible = clampedRise > 0.002;
  group.scale.set(1, Math.max(0.002, clampedRise), 1);
}
