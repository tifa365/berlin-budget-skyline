import { CAMERA_CONFIG, THEME } from "../config.js";

const { THREE } = window;

export function createScene(stageElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(THEME.background);
  scene.fog = new THREE.Fog(THEME.fog, 900, 6200);

  const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
  camera.position.set(1200, 900, 1200);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
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
  scene.add(new THREE.AmbientLight(0x4166aa, 1.35));

  const keyLight = new THREE.DirectionalLight(0xa5ceff, 1.5);
  keyLight.position.set(900, 1300, 500);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x325f9e, 0.7);
  rimLight.position.set(-1200, 600, -900);
  scene.add(rimLight);

  const skyLight = new THREE.HemisphereLight(0x6a94c8, 0x06111f, 0.85);
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

  const grid = new THREE.GridHelper(12000, 180, THEME.grid, 0x0c1a29);
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  scene.add(grid);
}

function addSky(scene) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#03070d");
  gradient.addColorStop(0.25, "#08111f");
  gradient.addColorStop(0.55, "#10213b");
  gradient.addColorStop(0.75, "#0a1730");
  gradient.addColorStop(1, "#040910");
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
      size: 2.4,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false,
    }),
  );
  scene.add(stars);

  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(3600, 260, 12, 64),
    new THREE.MeshBasicMaterial({
      color: 0x204b74,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.y = 60;
  scene.add(glow);

  return { stars, glow };
}
