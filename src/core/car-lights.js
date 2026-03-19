import { LAYOUT_CONFIG, THEME } from "../config.js";

const { THREE } = window;

export function createCarLights(scene, model) {
  const blockFootprintX =
    LAYOUT_CONFIG.blockSize * LAYOUT_CONFIG.lotWidth +
    (LAYOUT_CONFIG.blockSize - 1) * LAYOUT_CONFIG.alley;
  const blockFootprintZ =
    LAYOUT_CONFIG.blockSize * LAYOUT_CONFIG.lotDepth +
    (LAYOUT_CONFIG.blockSize - 1) * LAYOUT_CONFIG.alley;
  const blockSpanX = blockFootprintX + LAYOUT_CONFIG.street;
  const blockSpanZ = blockFootprintZ + LAYOUT_CONFIG.street;
  const cityBounds = getCityBounds(model, {
    paddingX: blockFootprintX * 0.5 + LAYOUT_CONFIG.avenueWidth,
    paddingZ: blockFootprintZ * 0.5 + LAYOUT_CONFIG.avenueWidth,
  });
  const streetMask = createStreetMaskTexture(model, cityBounds, {
    blockFootprintX,
    blockFootprintZ,
    blockSpanX,
    blockSpanZ,
    parkMaskWidth: blockSpanX * (LAYOUT_CONFIG.parkRadius * 2 + 1),
    parkMaskDepth: blockSpanZ * (LAYOUT_CONFIG.parkRadius * 2 + 1),
  });

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uBlockSpanX: { value: blockSpanX },
      uBlockSpanZ: { value: blockSpanZ },
      uBlockFootprintX: { value: blockFootprintX },
      uBlockFootprintZ: { value: blockFootprintZ },
      uStreetWidth: { value: LAYOUT_CONFIG.street },
      uFogColor: { value: new THREE.Color(THEME.fog) },
      uStreetMask: { value: streetMask },
      uMaskMin: { value: new THREE.Vector2(cityBounds.minX, cityBounds.minZ) },
      uMaskSize: {
        value: new THREE.Vector2(
          Math.max(cityBounds.maxX - cityBounds.minX, 1),
          Math.max(cityBounds.maxZ - cityBounds.minZ, 1),
        ),
      },
    },
    vertexShader: `
      varying vec2 vWorldXZ;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldXZ = worldPos.xz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uBlockSpanX;
      uniform float uBlockSpanZ;
      uniform float uBlockFootprintX;
      uniform float uBlockFootprintZ;
      uniform float uStreetWidth;
      uniform vec3 uFogColor;
      uniform sampler2D uStreetMask;
      uniform vec2 uMaskMin;
      uniform vec2 uMaskSize;

      varying vec2 vWorldXZ;

      float hash(vec2 p) {
        float h = dot(p, vec2(127.1, 311.7));
        return fract(sin(h) * 43758.5453);
      }

      float hash2(vec2 p) {
        float h = dot(p, vec2(269.5, 183.3));
        return fract(sin(h) * 28716.1973);
      }

      float asphaltNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float carDot(float pos, float carPos, float size) {
        float d = abs(pos - carPos);
        return smoothstep(size, size * 0.2, d);
      }

      // Pick car type: 0=yellow cab, 1=white sedan, 2=dark sedan,
      // 3=police, 4=amber truck
      vec3 getHeadlightColor(float seed) {
        // ~35% yellow cabs
        if (seed < 0.35) return vec3(1.0, 0.85, 0.2);
        // ~30% cool white headlights
        if (seed < 0.65) return vec3(0.9, 0.92, 1.0);
        // ~20% warm white headlights
        if (seed < 0.85) return vec3(1.0, 0.95, 0.85);
        // ~10% blue-white (newer LEDs)
        if (seed < 0.95) return vec3(0.8, 0.88, 1.0);
        // ~5% amber (trucks/vans)
        return vec3(1.0, 0.7, 0.2);
      }

      vec3 getTaillightColor(float seed) {
        if (seed < 0.90) return vec3(0.5, 0.03, 0.0);
        return vec3(0.5, 0.12, 0.0);
      }

      // Occasional police car: alternating red-blue flash
      // 0 = normal, 1 = police, 2 = fire truck
      int emergencyType(float seed) {
        if (seed > 0.998) return 1;  // very rare police
        if (seed > 0.994) return 2;  // rare fire truck
        return 0;
      }

      vec3 emergencyLight(int etype, float seed, float t) {
        float flash = sin(t * 14.0 + seed * 100.0);
        if (etype == 1) {
          // Police: blue / blue-white
          return flash > 0.0 ? vec3(0.15, 0.25, 1.0) : vec3(0.6, 0.7, 1.0);
        }
        // Fire: red / white
        return flash > 0.0 ? vec3(1.0, 0.1, 0.0) : vec3(1.0, 0.9, 0.8);
      }

      void main() {
        float x = vWorldXZ.x;
        float z = vWorldXZ.y;
        vec2 maskUv = (vWorldXZ - uMaskMin) / uMaskSize;

        if (
          maskUv.x < 0.0 || maskUv.x > 1.0 ||
          maskUv.y < 0.0 || maskUv.y > 1.0
        ) {
          discard;
        }

        float streetMask = texture2D(uStreetMask, maskUv).r;
        if (streetMask < 0.1) {
          discard;
        }

        float cellX = floor(x / uBlockSpanX + 0.5);
        float cellZ = floor(z / uBlockSpanZ + 0.5);
        float localX = x - cellX * uBlockSpanX;
        float localZ = z - cellZ * uBlockSpanZ;

        float halfFootX = uBlockFootprintX * 0.5 + 5.0;
        float halfFootZ = uBlockFootprintZ * 0.5 + 5.0;
        bool onStreetX = abs(localX) > halfFootX;
        bool onStreetZ = abs(localZ) > halfFootZ;

        if (!onStreetX && !onStreetZ) {
          discard;
        }

        // --- Asphalt ---
        float grain = asphaltNoise(vWorldXZ * 0.8) * 0.4
                    + asphaltNoise(vWorldXZ * 3.0) * 0.3;
        float wetSpot = asphaltNoise(vWorldXZ * 0.06);
        float asphaltBright = 0.025 + grain * 0.018 + wetSpot * 0.008;

        // Dashed yellow center line (NYC style)
        float centerLineX = 1.0 - smoothstep(0.3, 0.8, abs(localZ));
        float centerLineZ = 1.0 - smoothstep(0.3, 0.8, abs(localX));
        float dashX = step(0.5, fract(x * 0.04));
        float dashZ = step(0.5, fract(z * 0.04));
        float marking = 0.0;
        vec3 markingColor = vec3(0.0);
        if (onStreetZ) {
          marking += centerLineX * dashX * 0.04;
          markingColor += vec3(0.9, 0.75, 0.1) * centerLineX * dashX * 0.04;
        }
        if (onStreetX) {
          marking += centerLineZ * dashZ * 0.04;
          markingColor += vec3(0.9, 0.75, 0.1) * centerLineZ * dashZ * 0.04;
        }

        vec3 asphaltColor = vec3(asphaltBright) + markingColor;

        // --- Car lights ---
        float brightness = 0.0;
        vec3 lightColor = vec3(0.0);
        float streetLen;

        if (onStreetZ) {
          streetLen = uBlockSpanX;
          float laneOffset = localZ > 0.0 ? 1.0 : -1.0;
          float direction = laneOffset;

          for (int i = 0; i < 60; i++) {
            float seed = hash(vec2(cellX + float(i) * 13.7, cellZ * 7.3 + laneOffset));
            float typeSeed = hash2(vec2(cellX * 5.3 + float(i), cellZ * 2.1 + laneOffset));
            float speed = 6.0 + seed * 14.0;
            float phase = seed * streetLen * 20.0;
            float carPos = mod((uTime * speed * direction + phase), streetLen * 20.0) - streetLen * 10.0;
            float relPos = x - cellX * uBlockSpanX;

            float d = carDot(relPos, carPos, 3.5);
            if (d > 0.0) {
              vec3 c;
              float intensity = 0.5 + seed * 0.5;
              int etype = emergencyType(typeSeed);
              if (etype > 0) {
                c = emergencyLight(etype, seed, uTime);
                intensity = 1.4;
              } else if (direction > 0.0) {
                c = getHeadlightColor(typeSeed);
              } else {
                c = getTaillightColor(typeSeed);
                intensity *= 0.35;
              }
              brightness += d * intensity;
              lightColor += c * d * intensity;
            }
          }
        }

        if (onStreetX) {
          streetLen = uBlockSpanZ;
          float laneOffset = localX > 0.0 ? 1.0 : -1.0;
          float direction = laneOffset;

          for (int i = 0; i < 60; i++) {
            float seed = hash(vec2(cellX * 3.1 + laneOffset, cellZ + float(i) * 17.3));
            float typeSeed = hash2(vec2(cellX * 7.7 + laneOffset, cellZ * 4.3 + float(i)));
            float speed = 6.0 + seed * 14.0;
            float phase = seed * streetLen * 20.0;
            float carPos = mod((uTime * speed * direction + phase), streetLen * 20.0) - streetLen * 10.0;
            float relPos = z - cellZ * uBlockSpanZ;

            float d = carDot(relPos, carPos, 3.5);
            if (d > 0.0) {
              vec3 c;
              float intensity = 0.5 + seed * 0.5;
              int etype = emergencyType(typeSeed);
              if (etype > 0) {
                c = emergencyLight(etype, seed, uTime);
                intensity = 1.4;
              } else if (direction > 0.0) {
                c = getHeadlightColor(typeSeed);
              } else {
                c = getTaillightColor(typeSeed);
                intensity *= 0.35;
              }
              brightness += d * intensity;
              lightColor += c * d * intensity;
            }
          }
        }

        vec3 finalColor = asphaltColor + lightColor * 0.8;
        float finalAlpha = max(0.85, brightness * 0.8);

        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `,
  });

  const planeWidth = Math.max(cityBounds.maxX - cityBounds.minX, blockSpanX);
  const planeDepth = Math.max(cityBounds.maxZ - cityBounds.minZ, blockSpanZ);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeDepth),
    material,
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(
    (cityBounds.minX + cityBounds.maxX) * 0.5,
    0.5,
    (cityBounds.minZ + cityBounds.maxZ) * 0.5,
  );
  plane.renderOrder = 5;
  scene.add(plane);

  const highways = createCrossHighways(scene, {
    model,
    outerBounds: cityBounds,
    blockFootprintX,
    blockFootprintZ,
    blockSpanX,
    blockSpanZ,
  });

  function update(elapsedSeconds) {
    material.uniforms.uTime.value = elapsedSeconds;
    highways.forEach((highway) => {
      highway.uniforms.uTime.value = elapsedSeconds;
    });
  }

  return { update };
}

function getCityBounds(model, { paddingX, paddingZ }) {
  const blocks = model?.blocks ?? [];
  if (blocks.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    blocks.forEach((block) => {
      minX = Math.min(minX, block.x - paddingX);
      maxX = Math.max(maxX, block.x + paddingX);
      minZ = Math.min(minZ, block.z - paddingZ);
      maxZ = Math.max(maxZ, block.z + paddingZ);
    });

    return { minX, maxX, minZ, maxZ };
  }

  return {
    minX: -600,
    maxX: 600,
    minZ: -600,
    maxZ: 600,
  };
}

function createStreetMaskTexture(
  model,
  bounds,
  {
    blockFootprintX,
    blockFootprintZ,
    blockSpanX,
    blockSpanZ,
    parkMaskWidth,
    parkMaskDepth,
  },
) {
  const textureSize = 1024;
  const canvas = createMaskCanvas(textureSize, textureSize);
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Texture();
  }

  context.fillStyle = "#000";
  context.fillRect(0, 0, textureSize, textureSize);
  context.fillStyle = "#fff";

  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsDepth = Math.max(bounds.maxZ - bounds.minZ, 1);
  const blockHalfX = blockFootprintX * 0.5;
  const blockHalfZ = blockFootprintZ * 0.5;
  const blockSet = new Set(model.blocks.map((block) => `${block.gx},${block.gz}`));

  model.blocks.forEach((block) => {
    const eastAllowed = hasTrafficNeighbor(blockSet, block.gx + 1, block.gz);
    const westAllowed = hasTrafficNeighbor(blockSet, block.gx - 1, block.gz);
    const northAllowed = hasTrafficNeighbor(blockSet, block.gx, block.gz + 1);
    const southAllowed = hasTrafficNeighbor(blockSet, block.gx, block.gz - 1);

    if (eastAllowed) {
      drawMaskRect(
        context,
        bounds,
        textureSize,
        textureSize,
        boundsWidth,
        boundsDepth,
        block.x + blockHalfX,
        block.z - (southAllowed ? blockSpanZ * 0.5 : blockHalfZ),
        block.x + blockSpanX * 0.5,
        block.z + (northAllowed ? blockSpanZ * 0.5 : blockHalfZ),
      );
    }

    if (westAllowed) {
      drawMaskRect(
        context,
        bounds,
        textureSize,
        textureSize,
        boundsWidth,
        boundsDepth,
        block.x - blockSpanX * 0.5,
        block.z - (southAllowed ? blockSpanZ * 0.5 : blockHalfZ),
        block.x - blockHalfX,
        block.z + (northAllowed ? blockSpanZ * 0.5 : blockHalfZ),
      );
    }

    if (northAllowed) {
      drawMaskRect(
        context,
        bounds,
        textureSize,
        textureSize,
        boundsWidth,
        boundsDepth,
        block.x - (westAllowed ? blockSpanX * 0.5 : blockHalfX),
        block.z + blockHalfZ,
        block.x + (eastAllowed ? blockSpanX * 0.5 : blockHalfX),
        block.z + blockSpanZ * 0.5,
      );
    }

    if (southAllowed) {
      drawMaskRect(
        context,
        bounds,
        textureSize,
        textureSize,
        boundsWidth,
        boundsDepth,
        block.x - (westAllowed ? blockSpanX * 0.5 : blockHalfX),
        block.z - blockSpanZ * 0.5,
        block.x + (eastAllowed ? blockSpanX * 0.5 : blockHalfX),
        block.z - blockHalfZ,
      );
    }
  });

  if (parkMaskWidth > 0 && parkMaskDepth > 0) {
    drawMaskRect(
      context,
      bounds,
      textureSize,
      textureSize,
      boundsWidth,
      boundsDepth,
      -parkMaskWidth * 0.5,
      -parkMaskDepth * 0.5,
      parkMaskWidth * 0.5,
      parkMaskDepth * 0.5,
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createMaskCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function drawMaskRect(context, bounds, textureWidth, textureHeight, boundsWidth, boundsDepth, minX, minZ, maxX, maxZ) {
  const minU = (minX - bounds.minX) / boundsWidth;
  const maxU = (maxX - bounds.minX) / boundsWidth;
  const minV = (minZ - bounds.minZ) / boundsDepth;
  const maxV = (maxZ - bounds.minZ) / boundsDepth;

  const left = clamp01(minU) * textureWidth;
  const right = clamp01(maxU) * textureWidth;
  const top = clamp01(1 - maxV) * textureHeight;
  const bottom = clamp01(1 - minV) * textureHeight;

  context.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
}

function hasTrafficNeighbor(blockSet, gx, gz) {
  return blockSet.has(`${gx},${gz}`) || isParkCell(gx, gz);
}

function isParkCell(gx, gz) {
  return Math.abs(gx) <= LAYOUT_CONFIG.parkRadius && Math.abs(gz) <= LAYOUT_CONFIG.parkRadius;
}

function createCrossHighways(
  scene,
  {
    model,
    outerBounds,
    blockFootprintX,
    blockFootprintZ,
    blockSpanX,
    blockSpanZ,
  },
) {
  const width = outerBounds.maxX - outerBounds.minX;
  const depth = outerBounds.maxZ - outerBounds.minZ;
  const highwayWidth = Math.max(LAYOUT_CONFIG.avenueWidth * 1.7, LAYOUT_CONFIG.street * 2.6);
  const outerReachX = Math.max(blockSpanX * 4, width * 0.22);
  const outerReachZ = Math.max(blockSpanZ * 4, depth * 0.22);
  const outerMinX = outerBounds.minX - outerReachX;
  const outerMaxX = outerBounds.maxX + outerReachX;
  const outerMinZ = outerBounds.minZ - outerReachZ;
  const outerMaxZ = outerBounds.maxZ + outerReachZ;
  const edgePaddingX = blockFootprintX * 0.5 + 6;
  const edgePaddingZ = blockFootprintZ * 0.5 + 6;
  const blockSet = new Set(model.blocks.map((block) => `${block.gx},${block.gz}`));

  const descriptors = [
    ...createAlignedFeeders(model.blocks, blockSet, "west", {
      outer: outerMinX,
      edgePaddingX,
      edgePaddingZ,
      width: highwayWidth,
      minCount: 5,
    }),
    ...createAlignedFeeders(model.blocks, blockSet, "east", {
      outer: outerMaxX,
      edgePaddingX,
      edgePaddingZ,
      width: highwayWidth,
      minCount: 5,
    }),
    ...createAlignedFeeders(model.blocks, blockSet, "north", {
      outer: outerMinZ,
      edgePaddingX,
      edgePaddingZ,
      width: highwayWidth,
      minCount: 5,
    }),
    ...createAlignedFeeders(model.blocks, blockSet, "south", {
      outer: outerMaxZ,
      edgePaddingX,
      edgePaddingZ,
      width: highwayWidth,
      minCount: 5,
    }),
  ];

  return descriptors.map((descriptor) =>
    createHighwayBand(scene, descriptor),
  );
}

function createHighwayBand(scene, { axis, start, end, width, cross }) {
  const horizontal = axis === "horizontal";
  const length = Math.max(Math.abs(end - start), width);
  const center = (start + end) * 0.5;
  const geometry = new THREE.PlaneGeometry(
    horizontal ? length : width,
    horizontal ? width : length,
  );
  const uniforms = {
    uTime: { value: 0 },
    uAxis: { value: horizontal ? 0 : 1 },
  };
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec2 vWorldXZ;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldXZ = worldPos.xz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform float uTime;
      uniform int uAxis;

      varying vec2 vUv;
      varying vec2 vWorldXZ;

      float hash(float value) {
        return fract(sin(value) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(dot(i, vec2(127.1, 311.7)));
        float b = hash(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)));
        float c = hash(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)));
        float d = hash(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7)));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float wrappedDistance(float a, float b) {
        float d = abs(a - b);
        return min(d, 1.0 - d);
      }

      float carDot(float pos, float carPos, float size) {
        float d = wrappedDistance(pos, carPos);
        return smoothstep(size, size * 0.18, d);
      }

      vec3 headlightColor(float seed) {
        if (seed < 0.32) return vec3(1.0, 0.84, 0.2);
        if (seed < 0.66) return vec3(0.9, 0.93, 1.0);
        if (seed < 0.9) return vec3(1.0, 0.95, 0.86);
        return vec3(0.82, 0.9, 1.0);
      }

      vec3 taillightColor(float seed) {
        if (seed < 0.88) return vec3(0.55, 0.03, 0.0);
        return vec3(0.7, 0.14, 0.02);
      }

      vec3 trafficColor(float seed) {
        if (seed < 0.18) return taillightColor(seed * 3.7 + 0.11);
        if (seed < 0.31) return vec3(1.0, 0.56, 0.14);
        if (seed < 0.5) return vec3(1.0, 0.84, 0.2);
        if (seed < 0.7) return vec3(0.9, 0.93, 1.0);
        if (seed < 0.88) return vec3(1.0, 0.95, 0.86);
        return vec3(0.82, 0.9, 1.0);
      }

      void main() {
        float travel = uAxis == 0 ? vUv.x : vUv.y;
        float lateral = uAxis == 0 ? vUv.y : vUv.x;
        float edgeFade = smoothstep(0.0, 0.08, lateral) * smoothstep(0.0, 0.08, 1.0 - lateral);
        if (edgeFade <= 0.0) {
          discard;
        }

        float asphaltNoise = noise(vWorldXZ * 0.08) * 0.35 + noise(vWorldXZ * 0.25) * 0.2;
        vec3 color = vec3(0.032 + asphaltNoise * 0.03);

        float shoulder = max(
          1.0 - smoothstep(0.012, 0.03, abs(lateral - 0.08)),
          1.0 - smoothstep(0.012, 0.03, abs(lateral - 0.92))
        );
        color += vec3(0.12, 0.11, 0.08) * shoulder;

        float dashedMedian = (1.0 - smoothstep(0.008, 0.02, abs(lateral - 0.5))) * step(0.45, fract(travel * 24.0));
        color += vec3(0.26, 0.2, 0.06) * dashedMedian;

        float dividerA = (1.0 - smoothstep(0.006, 0.018, abs(lateral - 0.36))) * step(0.52, fract(travel * 28.0 + 0.3));
        float dividerB = (1.0 - smoothstep(0.006, 0.018, abs(lateral - 0.64))) * step(0.52, fract(travel * 28.0 + 0.8));
        color += vec3(0.08, 0.08, 0.08) * (dividerA + dividerB);

        float laneCenters[4];
        laneCenters[0] = 0.18;
        laneCenters[1] = 0.34;
        laneCenters[2] = 0.66;
        laneCenters[3] = 0.82;

        float brightness = 0.0;
        vec3 lightColor = vec3(0.0);

        for (int laneIndex = 0; laneIndex < 4; laneIndex += 1) {
          float laneCenter = laneCenters[laneIndex];
          float laneMask = 1.0 - smoothstep(0.045, 0.085, abs(lateral - laneCenter));
          if (laneMask <= 0.0) {
            continue;
          }

          float direction = laneIndex < 2 ? 1.0 : -1.0;
          for (int i = 0; i < 22; i += 1) {
            float base = float(i) + float(laneIndex) * 17.0 + float(uAxis) * 31.0;
            float seed = hash(base * 1.37);
            float typeSeed = hash(base * 3.11 + 2.7);
            float speed = 0.012 + seed * 0.036;
            float phase = seed;
            float carPos = fract(phase + uTime * speed * direction);
            float carGlow = carDot(travel, carPos, 0.014 + seed * 0.012) * laneMask;

            if (carGlow > 0.0) {
              vec3 laneColor = trafficColor(typeSeed);
              float intensity = 0.62 + seed * 0.7;
              brightness += carGlow * intensity;
              lightColor += laneColor * carGlow * intensity;
            }
          }
        }

        color += lightColor * 0.95;
        float alpha = edgeFade * max(0.84, brightness * 0.9);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(
    horizontal ? center : cross,
    0.56,
    horizontal ? cross : center,
  );
  mesh.renderOrder = 6;
  scene.add(mesh);

  return material;
}

function createAlignedFeeders(blocks, blockSet, side, options) {
  const {
    outer,
    edgePaddingX,
    edgePaddingZ,
    width,
    minCount,
  } = options;
  const candidatesByCross = new Map();

  blocks.forEach((block) => {
    const descriptor = getFeederCandidate(block, blockSet, side, {
      outer,
      edgePaddingX,
      edgePaddingZ,
      width,
    });
    if (!descriptor) {
      return;
    }

    const existing = candidatesByCross.get(descriptor.cross);
    if (!existing) {
      candidatesByCross.set(descriptor.cross, descriptor);
      return;
    }

    if (isBetterFeederCandidate(side, descriptor, existing)) {
      candidatesByCross.set(descriptor.cross, descriptor);
    }
  });

  const candidates = [...candidatesByCross.values()].sort((left, right) => left.cross - right.cross);
  return pickIrregularEntries(candidates, minCount, side);
}

function getFeederCandidate(block, blockSet, side, { outer, edgePaddingX, edgePaddingZ, width }) {
  if (side === "west") {
    if (hasTrafficNeighbor(blockSet, block.gx - 1, block.gz)) {
      return null;
    }
    return {
      axis: "horizontal",
      start: outer,
      end: block.x - edgePaddingX,
      width,
      cross: block.z,
    };
  }

  if (side === "east") {
    if (hasTrafficNeighbor(blockSet, block.gx + 1, block.gz)) {
      return null;
    }
    return {
      axis: "horizontal",
      start: block.x + edgePaddingX,
      end: outer,
      width,
      cross: block.z,
    };
  }

  if (side === "north") {
    if (hasTrafficNeighbor(blockSet, block.gx, block.gz - 1)) {
      return null;
    }
    return {
      axis: "vertical",
      start: outer,
      end: block.z - edgePaddingZ,
      width,
      cross: block.x,
    };
  }

  if (hasTrafficNeighbor(blockSet, block.gx, block.gz + 1)) {
    return null;
  }
  return {
    axis: "vertical",
    start: block.z + edgePaddingZ,
    end: outer,
    width,
    cross: block.x,
  };
}

function isBetterFeederCandidate(side, next, current) {
  if (side === "west" || side === "north") {
    return next.end < current.end;
  }
  return next.start > current.start;
}

function pickIrregularEntries(candidates, minCount, seedLabel) {
  if (candidates.length <= minCount) {
    return candidates;
  }

  const targetCount = minCount;
  const random = createDeterministicRandom(`${seedLabel}:${candidates.length}`);
  const weights = [];
  let totalWeight = 0;

  for (let index = 0; index < targetCount; index += 1) {
    const edgeBias = index === 0 || index === targetCount - 1 ? 0.18 : 0;
    const weight = 0.55 + random() * 1.9 + edgeBias;
    weights.push(weight);
    totalWeight += weight;
  }

  const selected = [];
  let cumulativeWeight = 0;
  let previousIndex = -1;

  for (let selectionIndex = 0; selectionIndex < targetCount; selectionIndex += 1) {
    const segmentStart = cumulativeWeight / totalWeight;
    cumulativeWeight += weights[selectionIndex];
    const segmentEnd = cumulativeWeight / totalWeight;
    const remainingSelections = targetCount - selectionIndex - 1;
    const minIndex = previousIndex + 1;
    const maxIndex = candidates.length - remainingSelections - 1;
    const rawStart = segmentStart * (candidates.length - 1);
    const rawEnd = segmentEnd * (candidates.length - 1);
    const segmentSpan = Math.max(rawEnd - rawStart, 1);
    const innerStart = rawStart + segmentSpan * (0.08 + random() * 0.2);
    const innerEnd = rawEnd - segmentSpan * (0.08 + random() * 0.2);
    const low = Math.max(minIndex, Math.floor(Math.min(innerStart, innerEnd)));
    const high = Math.min(maxIndex, Math.ceil(Math.max(innerStart, innerEnd)));
    const candidateIndex = low >= high
      ? low
      : low + Math.floor(random() * (high - low + 1));

    selected.push(candidates[candidateIndex]);
    previousIndex = candidateIndex;
  }

  return selected.sort((left, right) => left.cross - right.cross);
}

function createDeterministicRandom(seedText) {
  let seed = 2166136261;

  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
