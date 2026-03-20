export const APP_CONFIG = {
  hoverThrottleMs: 90,
  neighborCount: 5,
  searchLimit: 20,
};

export const ARTICLE_BANNER_CONFIG = {
  enabled: false,
  maxBuildings: 20,
  loadConcurrency: 6,
  startDelayMs: 1400,
  facadeOffset: 1.6,
  minBannerHeight: 18,
  maxBannerHeight: 28,
  textureWidth: 512,
  textureHeight: 192,
  opacity: 0.96,
};

export const CAMERA_CONFIG = {
  theta: -0.65,
  phi: 1.02,
  distance: 1700,
  minDistance: 140,
  maxDistance: 4200,
  minPhi: 0.22,
  maxPhi: 1.48,
};

export const LAYOUT_CONFIG = {
  seed: 42,
  blockSize: 4,
  lotWidth: 40,
  lotDepth: 34,
  alley: 4,
  street: 18,
  avenueWidth: 34,
  avenueEvery: 3,
  parkRadius: 1,
  minHeight: 4,
  maxHeight: 900,
  floorHeight: 6,
  centralPoolSize: 160,
  reserveTopCount: 24,
  reserveSpacing: 5,
};

export const THEME = {
  background: 0x000000,
  fog: 0x010103,
  ground: 0x000000,
  grid: 0xff7a45,
  park: 0x030805,
  sidewalk: 0x010101,
  lowBuilding: 0x03070d,
  highBuilding: 0x5ae0ff,
  highlight: 0xc3efff,
  glow: 0x69c4ff,
};
