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

  const planeSize = 12000;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeSize, planeSize),
    material,
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.5;
  plane.renderOrder = 5;
  scene.add(plane);

  function update(elapsedSeconds) {
    material.uniforms.uTime.value = elapsedSeconds;
  }

  return { update };
}
