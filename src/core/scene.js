import { CAMERA_CONFIG, THEME } from "../config.js";

const { THREE } = window;

export function createScene(stageElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(THEME.background);
  scene.fog = new THREE.Fog(THEME.fog, 760, 5200);

  const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
  camera.position.set(1200, 900, 1200);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  stageElement.appendChild(renderer.domElement);

  addLights(scene);
  addGround(scene);
  const sky = addSky(scene);

  function resize() {
    const width = stageElement.clientWidth || window.innerWidth;
    const height = stageElement.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function update(elapsedSeconds) {
    sky.stars.rotation.y = elapsedSeconds * 0.01;
    sky.glow.rotation.z = elapsedSeconds * 0.005;
    updateShootingStar(sky.shootingStar, camera, elapsedSeconds);
  }

  resize();
  window.addEventListener("resize", resize);

  return {
    scene,
    camera,
    renderer,
    update,
  };
}

function addLights(scene) {
  scene.add(new THREE.AmbientLight(0x060912, 0.24));

  const keyLight = new THREE.DirectionalLight(0x5d92d0, 0.76);
  keyLight.position.set(900, 1300, 500);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xb13769, 0.2);
  rimLight.position.set(-1200, 680, -900);
  scene.add(rimLight);

  const skyLight = new THREE.HemisphereLight(0x0a1020, 0x000000, 0.12);
  scene.add(skyLight);
}

function addGround(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30000, 30000),
    new THREE.MeshStandardMaterial({
      color: THEME.ground,
      roughness: 0.94,
      metalness: 0.05,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);
}

function addSky(scene) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#000000");
  gradient.addColorStop(0.24, "#010103");
  gradient.addColorStop(0.52, "#04070f");
  gradient.addColorStop(0.72, "#08070d");
  gradient.addColorStop(1, "#010101");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(7000, 32, 32),
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  scene.add(skyDome);

  const starGeometry = new THREE.BufferGeometry();
  const starCount = 3500;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let index = 0; index < starCount; index += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.48;
    const radius = 5200;
    positions[index * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    positions[index * 3 + 1] = Math.cos(phi) * radius;
    positions[index * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;

    const warmth = Math.random();
    if (warmth > 0.92) {
      colors[index * 3] = 1;
      colors[index * 3 + 1] = 0.85;
      colors[index * 3 + 2] = 0.7;
    } else {
      colors[index * 3] = 0.8 + Math.random() * 0.2;
      colors[index * 3 + 1] = 0.85 + Math.random() * 0.15;
      colors[index * 3 + 2] = 1;
    }
  }

  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: 1.9,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      fog: false,
    }),
  );
  scene.add(stars);

  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(3600, 260, 12, 64),
    new THREE.MeshBasicMaterial({
      color: 0x16304b,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.y = 60;
  scene.add(glow);

  const shootingStar = createShootingStar(scene);

  return { stars, glow, shootingStar };
}

function createShootingStar(scene) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(6);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const trail = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xeaf6ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  trail.visible = false;
  trail.renderOrder = 18;
  scene.add(trail);

  const head = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xf6fbff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  head.visible = false;
  head.renderOrder = 19;
  scene.add(head);

  return {
    active: false,
    nextStartTime: 70 + Math.random() * 150,
    startTime: 0,
    duration: 0,
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    headPosition: new THREE.Vector3(),
    tailPosition: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    lateral: new THREE.Vector3(),
    viewCenter: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    trail,
    head,
    positions,
  };
}

function updateShootingStar(state, camera, elapsedSeconds) {
  if (!state.active) {
    if (elapsedSeconds < state.nextStartTime) {
      return;
    }
    startShootingStar(state, camera, elapsedSeconds);
  }

  const progress = (elapsedSeconds - state.startTime) / state.duration;
  if (progress >= 1) {
    state.active = false;
    state.trail.visible = false;
    state.head.visible = false;
    state.nextStartTime = elapsedSeconds + 180 + Math.random() * 360;
    return;
  }

  const tailProgress = Math.max(0, progress - 0.14);
  state.headPosition.lerpVectors(state.start, state.end, progress);
  state.tailPosition.lerpVectors(state.start, state.end, tailProgress);

  state.positions[0] = state.tailPosition.x;
  state.positions[1] = state.tailPosition.y;
  state.positions[2] = state.tailPosition.z;
  state.positions[3] = state.headPosition.x;
  state.positions[4] = state.headPosition.y;
  state.positions[5] = state.headPosition.z;
  state.trail.geometry.attributes.position.needsUpdate = true;

  const opacity = Math.sin(progress * Math.PI);
  state.trail.material.opacity = opacity * 0.42;
  state.head.material.opacity = opacity * 0.75;
  state.head.position.copy(state.headPosition);
  state.head.scale.setScalar(55 + opacity * 45);
}

function startShootingStar(state, camera, elapsedSeconds) {
  const side = Math.random() > 0.5 ? 1 : -1;

  camera.getWorldDirection(state.forward);
  state.lateral.crossVectors(state.forward, state.up);
  if (state.lateral.lengthSq() < 1e-4) {
    state.lateral.set(1, 0, 0);
  } else {
    state.lateral.normalize();
  }

  state.viewCenter
    .copy(camera.position)
    .addScaledVector(state.forward, 3200 + Math.random() * 700)
    .addScaledVector(state.up, 950 + Math.random() * 650);

  state.start
    .copy(state.viewCenter)
    .addScaledVector(state.lateral, side * (850 + Math.random() * 800))
    .addScaledVector(state.up, 250 + Math.random() * 300);

  state.end
    .copy(state.viewCenter)
    .addScaledVector(state.lateral, -side * (550 + Math.random() * 900))
    .addScaledVector(state.up, -180 - Math.random() * 240);

  state.active = true;
  state.startTime = elapsedSeconds;
  state.duration = 0.9 + Math.random() * 0.7;
  state.trail.visible = true;
  state.head.visible = true;
}
