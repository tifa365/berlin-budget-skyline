import { CAMERA_CONFIG } from "../config.js";

const { THREE } = window;

export function createCameraController({ camera, domElement }) {
  let theta = CAMERA_CONFIG.theta;
  let phi = CAMERA_CONFIG.phi;
  let distance = CAMERA_CONFIG.distance;

  let targetTheta = theta;
  let targetPhi = phi;
  let targetDistance = distance;

  const target = new THREE.Vector3(0, 120, 0);
  const targetGoal = target.clone();

  let dragging = false;
  let movedSinceDown = false;
  let activePointerId = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let idleSeconds = 0;
  let lerpSpeed = 0.07;

  // ═══ CINEMATIC FLYOVER ═══
  let flyoverActive = false;
  let flyoverT = 0;
  const flyoverDelay = 0; // fly and rise simultaneously
  const flyoverDur = 12;

  const flyoverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3000, 900, 3000),
    new THREE.Vector3(1600, 650, 1800),
    new THREE.Vector3(600, 500, 900),
    new THREE.Vector3(-100, 400, 300),
    new THREE.Vector3(-400, 380, -100),
    new THREE.Vector3(-200, 400, -50),
  ]);

  const flyoverLookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 150, 0),
    new THREE.Vector3(0, 100, 0),
    new THREE.Vector3(0, 80, 0),
    new THREE.Vector3(-100, 50, -100),
    new THREE.Vector3(0, 60, 0),
    new THREE.Vector3(0, 80, 0),
  ]);

  let flyoverEndBuilding = null;

  domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  domElement.addEventListener("wheel", onWheel, { passive: true });

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    // Click skips the flyover
    if (flyoverActive) {
      flyoverActive = false;
      settleAfterFlyover();
      return;
    }

    dragging = true;
    movedSinceDown = false;
    activePointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    idleSeconds = 0;

    if (domElement.setPointerCapture) {
      domElement.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event) {
    if (flyoverActive) return;
    if (!dragging || event.pointerId !== activePointerId) {
      return;
    }

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;

    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) {
      movedSinceDown = true;
    }

    targetTheta -= deltaX * 0.0055;
    targetPhi = clamp(
      targetPhi + deltaY * 0.0055,
      CAMERA_CONFIG.minPhi,
      CAMERA_CONFIG.maxPhi,
    );

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    idleSeconds = 0;
  }

  function onPointerUp(event) {
    if (flyoverActive) return;
    if (event.pointerId !== activePointerId) {
      return;
    }

    dragging = false;
    activePointerId = null;
    idleSeconds = 0;
  }

  function onWheel(event) {
    if (flyoverActive) {
      flyoverActive = false;
      settleAfterFlyover();
      return;
    }
    targetDistance = clamp(
      targetDistance + event.deltaY * 1.2,
      CAMERA_CONFIG.minDistance,
      CAMERA_CONFIG.maxDistance,
    );
    idleSeconds = 0;
  }

  function settleAfterFlyover() {
    if (flyoverEndBuilding) {
      const building = flyoverEndBuilding;
      flyoverEndBuilding = null;
      const view = getBuildingView(building);
      target.copy(view.target);
      targetGoal.copy(view.target);
      const dx = camera.position.x - target.x;
      const dy = camera.position.y - target.y;
      const dz = camera.position.z - target.z;
      distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      phi = Math.acos(clamp(dy / distance, -1, 1));
      theta = Math.atan2(dz, dx);
      targetTheta = theta;
      targetPhi = view.phi;
      targetDistance = view.distance;
      lerpSpeed = 0.045;
      idleSeconds = 0;
      return;
    }

    // Derive orbital parameters from current camera position over the park
    target.set(0, 80, 0);
    targetGoal.set(0, 120, 0);
    const dx = camera.position.x - target.x;
    const dy = camera.position.y - target.y;
    const dz = camera.position.z - target.z;
    distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    phi = Math.acos(clamp(dy / distance, -1, 1));
    theta = Math.atan2(dz, dx);
    targetTheta = theta;
    targetPhi = CAMERA_CONFIG.phi;
    targetDistance = CAMERA_CONFIG.distance;
    lerpSpeed = 0.04;
    idleSeconds = 5; // start auto-rotate immediately
  }

  function update(deltaSeconds) {
    // Cinematic flyover — camera follows spline path
    if (flyoverActive) {
      flyoverT += deltaSeconds;
      if (flyoverT < flyoverDelay) return; // hold still while buildings rise
      const progress = Math.min((flyoverT - flyoverDelay) / flyoverDur, 1);
      // easeInOutQuad
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const pos = flyoverCurve.getPoint(eased);
      const look = flyoverLookCurve.getPoint(eased);
      if (flyoverEndBuilding) {
        const view = getBuildingView(flyoverEndBuilding);
        const blend = smoothstep(0.62, 1, eased);
        pos.lerp(view.position, blend);
        look.lerp(view.target, blend);
      }
      camera.position.copy(pos);
      camera.lookAt(look);
      target.copy(look);
      targetGoal.copy(look);

      if (progress >= 1) {
        flyoverActive = false;
        settleAfterFlyover();
      }
      return;
    }

    idleSeconds += deltaSeconds;
    if (!dragging && idleSeconds > 4) {
      const rotateSpeed = Math.min(0.022 * (CAMERA_CONFIG.distance / distance), 0.04);
      targetTheta -= deltaSeconds * rotateSpeed;
    }

    const smoothing = 1 - Math.pow(1 - lerpSpeed, deltaSeconds * 60);
    theta += (targetTheta - theta) * smoothing;
    phi += (targetPhi - phi) * smoothing;
    distance += (targetDistance - distance) * smoothing;
    target.lerp(targetGoal, smoothing);

    const sinPhi = Math.sin(phi);
    camera.position.set(
      target.x + Math.cos(theta) * sinPhi * distance,
      target.y + Math.cos(phi) * distance,
      target.z + Math.sin(theta) * sinPhi * distance,
    );
    camera.lookAt(target);
  }

  function startAtBuilding(building) {
    // Begin cinematic flyover, end at this building
    flyoverActive = true;
    flyoverT = 0;
    flyoverEndBuilding = building;

    // Position camera at the start of the spline
    const startPos = flyoverCurve.getPoint(0);
    const startLook = flyoverLookCurve.getPoint(0);
    camera.position.copy(startPos);
    camera.lookAt(startLook);
    target.copy(startLook);
    targetGoal.copy(startLook);
  }

  function focusBuilding(building) {
    if (flyoverActive) {
      flyoverActive = false;
      settleAfterFlyover();
    }
    targetGoal.set(building.x, building.height * 0.35, building.z);
    targetDistance = clamp(
      Math.max(building.height * 1.9, building.width * 9, building.depth * 9),
      220,
      2300,
    );
    targetPhi = 0.96;
    lerpSpeed = 0.07;
    idleSeconds = 0;
  }

  function focusPark() {
    targetGoal.set(0, 10, 0);
    targetDistance = 350;
    targetPhi = 0.75;
    lerpSpeed = 0.05;
    idleSeconds = 5;
  }

  function viewSkyline() {
    targetGoal.set(0, 90, 0);
    targetDistance = 100;
    targetPhi = 2.0;
    lerpSpeed = 0.03;
    idleSeconds = 5;
  }

  function reset() {
    targetGoal.set(0, 120, 0);
    targetTheta = CAMERA_CONFIG.theta;
    targetPhi = CAMERA_CONFIG.phi;
    targetDistance = CAMERA_CONFIG.distance;
    lerpSpeed = 0.06;
    idleSeconds = 0;
  }

  return {
    update,
    startAtBuilding,
    focusBuilding,
    focusPark,
    viewSkyline,
    reset,
    isDragging: () => dragging,
    movedSinceDown: () => movedSinceDown,
  };
}

function getBuildingView(building) {
  const target = new THREE.Vector3(building.x, building.height * 0.35, building.z);
  const phi = 0.96;
  const distance = clamp(
    Math.max(building.height * 1.9, building.width * 9, building.depth * 9),
    220,
    2300,
  );
  const sinPhi = Math.sin(phi);
  const position = new THREE.Vector3(
    target.x + Math.cos(CAMERA_CONFIG.theta) * sinPhi * distance,
    target.y + Math.cos(phi) * distance,
    target.z + Math.sin(CAMERA_CONFIG.theta) * sinPhi * distance,
  );
  return { target, position, phi, distance };
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
