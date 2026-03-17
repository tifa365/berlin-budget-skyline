import { THEME } from "../config.js";

const { THREE } = window;

const PALETTES = [
  { window: 0xcbe5ff, accent: 0x79b8ff, baseHue: 0.6, sat: 0.28, dark: 0.1, light: 0.23 },
  { window: 0x9af7ff, accent: 0x2ecfc0, baseHue: 0.52, sat: 0.42, dark: 0.08, light: 0.2 },
  { window: 0xffde8d, accent: 0xffaa52, baseHue: 0.1, sat: 0.26, dark: 0.09, light: 0.18 },
  { window: 0xbfffd9, accent: 0x47d79b, baseHue: 0.43, sat: 0.32, dark: 0.08, light: 0.18 },
  { window: 0xffc6aa, accent: 0xff7f56, baseHue: 0.03, sat: 0.4, dark: 0.1, light: 0.21 },
  { window: 0xffd9e4, accent: 0xff8aa7, baseHue: 0.95, sat: 0.2, dark: 0.11, light: 0.24 },
  { window: 0xf0f4ff, accent: 0xc4d7ff, baseHue: 0.64, sat: 0.13, dark: 0.12, light: 0.25 },
  { window: 0xf6d7aa, accent: 0xcf9650, baseHue: 0.08, sat: 0.32, dark: 0.08, light: 0.17 },
  { window: 0x9dfff2, accent: 0x4099ff, baseHue: 0.56, sat: 0.5, dark: 0.07, light: 0.17 },
];

export function createFacadeMaterial(geometry, buildings) {
  const count = buildings.length;
  const facadeGrid = new Float32Array(count * 4);
  const facadeStyle = new Float32Array(count * 4);
  const facadeBase = new Float32Array(count * 3);
  const facadeWindow = new Float32Array(count * 3);
  const facadeAccent = new Float32Array(count * 3);

  const lowBuilding = new THREE.Color(THEME.lowBuilding);
  const eliteAccent = new THREE.Color(0xffdf9b);

  for (const building of buildings) {
    const titleHash = hashString(building.title);
    const paletteIndex = clamp(
      Math.floor(randomFromHash(titleHash, 1) * PALETTES.length),
      0,
      PALETTES.length - 1,
    );
    const pairOffset = 1 + Math.floor(randomFromHash(titleHash, 2) * (PALETTES.length - 1));
    const pairedPalette = PALETTES[(paletteIndex + pairOffset) % PALETTES.length];
    const palette = PALETTES[paletteIndex];
    const pattern = Math.floor(randomFromHash(titleHash, 3) * 5);
    const intensity = building.intensity;
    const frontColumns = Math.max(3, Math.floor(building.width / (4.1 + randomFromHash(titleHash, 4) * 1.4)));
    const sideColumns = Math.max(3, Math.floor(building.depth / (4.0 + randomFromHash(titleHash, 5) * 1.5)));
    const lightDensity = clamp(
      0.14 + intensity * 0.72 + (randomFromHash(titleHash, 6) - 0.5) * 0.08,
      0.08,
      0.95,
    );
    const crownIntensity = clamp(
      intensity * 0.7 + randomFromHash(titleHash, 7) * 0.26,
      0.06,
      1,
    );
    const variation = randomFromHash(titleHash, 8);
    const paletteMix = 0.14 + randomFromHash(titleHash, 9) * 0.34;
    const districtField = sampleDistrictField(building.x, building.z);
    const districtWarmBias = clamp(0.5 + districtField * 0.5, 0, 1);
    const warmHue = 0.075 + (randomFromHash(titleHash, 10) - 0.5) * 0.05;
    const coolHue = 0.58 + (randomFromHash(titleHash, 11) - 0.5) * 0.08;
    const districtHue = wrapHue(
      mixScalar(warmHue, coolHue, districtWarmBias) +
        (randomFromHash(titleHash, 12) - 0.5) * 0.04,
    );
    const districtSat = clamp(
      0.15 + Math.abs(districtField) * 0.28 + intensity * 0.08,
      0.12,
      0.66,
    );
    const districtLight = clamp(
      0.11 + intensity * 0.11 + randomFromHash(titleHash, 13) * 0.05,
      0.1,
      0.32,
    );
    const districtColor = new THREE.Color().setHSL(districtHue, districtSat, districtLight);

    const facadeHue = wrapHue(
      mixScalar(palette.baseHue, pairedPalette.baseHue, paletteMix) +
        (randomFromHash(titleHash, 14) - 0.5) * 0.055 +
        districtField * 0.08,
    );
    const facadeSaturation = clamp(
      mixScalar(palette.sat, pairedPalette.sat, paletteMix) +
        (randomFromHash(titleHash, 15) - 0.5) * 0.12,
      0.1,
      0.72,
    );
    const facadeLightness = clamp(
      mixScalar(palette.dark, pairedPalette.dark, paletteMix) * (1 - intensity) +
        mixScalar(palette.light, pairedPalette.light, paletteMix) * intensity +
        districtField * 0.025,
      0.08,
      0.3,
    );
    const facadeFamilyColor = new THREE.Color().setHSL(
      facadeHue,
      facadeSaturation,
      facadeLightness,
    );
    const sheenColor = new THREE.Color().setHSL(
      wrapHue(districtHue + 0.015 + (randomFromHash(titleHash, 16) - 0.5) * 0.05),
      clamp(districtSat * 0.78 + 0.06, 0.12, 0.7),
      clamp(districtLight + 0.07 + intensity * 0.04, 0.16, 0.38),
    );

    const baseColor = lowBuilding
      .clone()
      .lerp(facadeFamilyColor, 0.32 + randomFromHash(titleHash, 17) * 0.14)
      .lerp(districtColor, 0.12 + randomFromHash(titleHash, 18) * 0.14)
      .lerp(sheenColor, 0.04 + variation * 0.05);

    const windowColor = new THREE.Color(palette.window)
      .lerp(new THREE.Color(pairedPalette.window), 0.18 + paletteMix * 0.42)
      .lerp(
        new THREE.Color().setHSL(
          wrapHue(districtHue + 0.03),
          clamp(districtSat * 0.48, 0.12, 0.46),
          0.78 + randomFromHash(titleHash, 19) * 0.12,
        ),
        0.18 + randomFromHash(titleHash, 20) * 0.16,
      )
      .lerp(
        new THREE.Color(0xffffff),
        intensity * 0.07 + variation * 0.05,
      );

    const accentColor = new THREE.Color(palette.accent)
      .lerp(new THREE.Color(pairedPalette.accent), 0.24 + paletteMix * 0.46)
      .lerp(
        new THREE.Color().setHSL(
          wrapHue(districtHue + 0.04),
          clamp(districtSat + 0.08, 0.14, 0.84),
          clamp(0.44 + intensity * 0.12, 0.36, 0.68),
        ),
        0.28 + randomFromHash(titleHash, 21) * 0.22,
      )
      .lerp(windowColor, 0.12);

    if (building.rank <= 24) {
      accentColor.lerp(eliteAccent, 0.24);
      windowColor.lerp(eliteAccent, 0.12);
    }

    const gridOffset = building.index * 4;
    facadeGrid[gridOffset] = frontColumns;
    facadeGrid[gridOffset + 1] = sideColumns;
    facadeGrid[gridOffset + 2] = building.floors;
    facadeGrid[gridOffset + 3] = lightDensity;

    facadeStyle[gridOffset] = randomFromHash(titleHash, 22) * 1000;
    facadeStyle[gridOffset + 1] = pattern;
    facadeStyle[gridOffset + 2] = crownIntensity;
    facadeStyle[gridOffset + 3] = variation;

    const colorOffset = building.index * 3;
    facadeBase[colorOffset] = baseColor.r;
    facadeBase[colorOffset + 1] = baseColor.g;
    facadeBase[colorOffset + 2] = baseColor.b;

    facadeWindow[colorOffset] = windowColor.r;
    facadeWindow[colorOffset + 1] = windowColor.g;
    facadeWindow[colorOffset + 2] = windowColor.b;

    facadeAccent[colorOffset] = accentColor.r;
    facadeAccent[colorOffset + 1] = accentColor.g;
    facadeAccent[colorOffset + 2] = accentColor.b;
  }

  geometry.setAttribute("aFacadeGrid", new THREE.InstancedBufferAttribute(facadeGrid, 4));
  geometry.setAttribute("aFacadeStyle", new THREE.InstancedBufferAttribute(facadeStyle, 4));
  geometry.setAttribute("aFacadeBase", new THREE.InstancedBufferAttribute(facadeBase, 3));
  geometry.setAttribute("aFacadeWindow", new THREE.InstancedBufferAttribute(facadeWindow, 3));
  geometry.setAttribute("aFacadeAccent", new THREE.InstancedBufferAttribute(facadeAccent, 3));

  return new THREE.ShaderMaterial({
    uniforms: {
      uFogColor: { value: new THREE.Color(THEME.fog) },
      uFogNear: { value: 900 },
      uFogFar: { value: 6200 },
    },
    vertexShader: `
      attribute vec4 aFacadeGrid;
      attribute vec4 aFacadeStyle;
      attribute vec3 aFacadeBase;
      attribute vec3 aFacadeWindow;
      attribute vec3 aFacadeAccent;

      varying vec4 vSurface;
      varying vec4 vFacadeGridData;
      varying vec4 vFacadeStyleData;
      varying vec4 vColorA;
      varying vec4 vColorB;
      varying vec4 vColorC;

      void main() {
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vSurface = vec4(normalize(mat3(instanceMatrix) * normal), position.y + 0.5);
        vFacadeGridData = aFacadeGrid;
        vFacadeStyleData = aFacadeStyle;
        vColorA = vec4(aFacadeBase, aFacadeWindow.r);
        vColorB = vec4(aFacadeWindow.g, aFacadeWindow.b, aFacadeAccent.r, aFacadeAccent.g);
        vColorC = vec4(aFacadeAccent.b, length(mvPosition.xyz), uv.x, uv.y);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;

      varying vec4 vSurface;
      varying vec4 vFacadeGridData;
      varying vec4 vFacadeStyleData;
      varying vec4 vColorA;
      varying vec4 vColorB;
      varying vec4 vColorC;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        vec3 normal = normalize(vSurface.xyz);
        float height = vSurface.w;
        vec2 uv = vColorC.zw;
        vec3 facadeBase = vColorA.rgb;
        vec3 facadeWindow = vec3(vColorA.w, vColorB.x, vColorB.y);
        vec3 facadeAccent = vec3(vColorB.z, vColorB.w, vColorC.x);
        float roofMask = step(0.6, abs(normal.y));
        float useSideFace = step(abs(normal.x), abs(normal.z));
        float cols = mix(vFacadeGridData.x, vFacadeGridData.y, useSideFace);
        float rows = max(3.0, vFacadeGridData.z);
        float seed = vFacadeStyleData.x;
        float style = vFacadeStyleData.y;
        float crown = vFacadeStyleData.z;
        float variation = vFacadeStyleData.w;

        vec2 gridUv = vec2(uv.x * cols, uv.y * rows);
        vec2 cellId = floor(gridUv);
        vec2 cellUv = fract(gridUv);

        float frameX = mix(0.11, 0.2, variation * 0.85);
        float frameY = mix(0.1, 0.16, hash12(cellId.yx + vec2(seed, seed * 0.37)));
        float windowMask =
          step(frameX, cellUv.x) *
          step(frameY, cellUv.y) *
          step(cellUv.x, 1.0 - frameX) *
          step(cellUv.y, 1.0 - frameY);

        float occupancy = vFacadeGridData.w;
        occupancy += (hash12(cellId + vec2(seed * 0.13, seed * 0.29)) - 0.5) * 0.08;
        occupancy += mix(-0.08, 0.12, height) * mix(0.35, 1.0, crown);

        float verticalAccent = 0.0;
        float horizontalAccent = 0.0;

        if (style < 0.5) {
          occupancy += sin(cellId.y * 0.72 + seed * 0.08) * 0.05;
        } else if (style < 1.5) {
          occupancy += (hash12(vec2(cellId.y + seed * 0.21, floor(cellId.x * 0.5) + seed)) - 0.5) * 0.16;
        } else if (style < 2.5) {
          float stripeCount = 2.0 + floor(variation * 4.0);
          verticalAccent = 1.0 - smoothstep(
            0.16,
            0.44,
            abs(fract(uv.x * stripeCount + seed * 0.013) - 0.5)
          );
          occupancy += verticalAccent * 0.22;
        } else if (style < 3.5) {
          float beltCount = 4.0 + floor(variation * 5.0);
          horizontalAccent = 1.0 - smoothstep(
            0.12,
            0.4,
            abs(fract(uv.y * beltCount + seed * 0.017) - 0.5)
          );
          occupancy += horizontalAccent * 0.12;
        } else {
          occupancy -= 0.1;
          occupancy += smoothstep(0.72, 1.0, height) * 0.22;
        }

        float crownBand = smoothstep(0.82, 1.0, height);
        occupancy += crownBand * crown * 0.22;
        occupancy = clamp(occupancy, 0.04, 0.98);

        float lit = step(hash12(cellId + vec2(seed * 0.071, seed * 0.117)), occupancy);
        float heightWash = smoothstep(0.0, 1.0, height);
        float rootFade = smoothstep(0.06, 0.18, uv.y);
        float accentWash = max(verticalAccent * 0.56, horizontalAccent * 0.44) + crownBand * 0.4;
        float faceEdge = 1.0 - smoothstep(
          0.024,
          0.11,
          min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y))
        );
        float cellEdge = 1.0 - smoothstep(
          0.035,
          0.2,
          min(min(cellUv.x, 1.0 - cellUv.x), min(cellUv.y, 1.0 - cellUv.y))
        );

        vec3 wallColor = mix(vec3(0.008, 0.012, 0.028), facadeBase * 0.38, 0.52);
        wallColor *= 0.88 + (hash12(cellId + vec2(seed * 0.09, seed * 0.19)) - 0.5) * 0.06;
        wallColor += facadeAccent * (0.008 + heightWash * 0.012);

        vec3 offWindowColor = mix(vec3(0.006, 0.009, 0.024), facadeBase * 0.12, 0.3);
        vec3 litWindowColor = mix(
          facadeWindow,
          facadeAccent,
          verticalAccent * 0.34 + horizontalAccent * 0.2 + crownBand * crown * 0.24
        );
        litWindowColor *= 1.0 + hash12(cellId.yx + vec2(seed * 0.031, seed * 0.041)) * 0.3;
        vec3 neonTraceColor = mix(facadeAccent, facadeWindow, 0.36 + crownBand * 0.16);

        vec3 facadeColor = mix(
          wallColor,
          mix(offWindowColor, litWindowColor, lit),
          windowMask
        );

        float tracerMask =
          faceEdge * (0.68 + crownBand * 0.22) +
          cellEdge * (0.07 + accentWash * 0.22 + lit * windowMask * 0.15);
        facadeColor += neonTraceColor * tracerMask * 0.42 * rootFade;
        facadeColor += facadeAccent * verticalAccent * 0.06 * rootFade;
        facadeColor += facadeAccent * horizontalAccent * 0.05 * rootFade;
        facadeColor += facadeAccent * crownBand * crown * 0.08;
        facadeColor += litWindowColor * lit * windowMask * (0.08 + accentWash * 0.06) * rootFade;

        vec2 roofGrid = floor(uv * (4.0 + floor(variation * 5.0)));
        float roofNoise = hash12(roofGrid + vec2(seed * 0.23, seed * 0.29));
        vec3 roofColor = mix(vec3(0.008, 0.012, 0.024), facadeBase * 0.28, 0.46);
        roofColor += neonTraceColor * faceEdge * (0.26 + crown * 0.18);
        roofColor += step(0.82, roofNoise) * facadeAccent * (0.08 + crown * 0.18);

        vec3 color = mix(facadeColor, roofColor, roofMask);

        vec3 lightDir = normalize(vec3(0.35, 0.92, 0.45));
        float diffuse = max(dot(normal, lightDir), 0.0);
        float skyLight = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
        float glowMask = mix(rootFade, 1.0, roofMask);

        color *= 0.24 + diffuse * 0.18 + skyLight * 0.08;
        color += neonTraceColor * faceEdge * (0.28 + crownBand * 0.14) * glowMask;
        color += facadeAccent * (verticalAccent * 0.1 + horizontalAccent * 0.08) * glowMask;
        color += litWindowColor * lit * windowMask * (0.1 + crownBand * 0.08) * glowMask;

        float fogFactor = smoothstep(uFogNear, uFogFar, vColorC.y);
        color = mix(color, uFogColor, fogFactor);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mixScalar(start, end, amount) {
  return start + (end - start) * amount;
}

function sampleDistrictField(x, z) {
  const majorWave = Math.sin(x * 0.00062 + z * 0.00019);
  const crossWave = Math.cos(z * 0.00074 - x * 0.00023);
  const fineWave = Math.sin((x + z) * 0.0011);
  return (majorWave * 0.55 + crossWave * 0.3 + fineWave * 0.15) * 0.9;
}

function wrapHue(value) {
  if (value < 0) {
    return value + 1;
  }
  if (value > 1) {
    return value - 1;
  }
  return value;
}
