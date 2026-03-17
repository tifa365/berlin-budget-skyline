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
  let lerpSpeed = 0.12;

  domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  domElement.addEventListener("wheel", onWheel, { passive: true });

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
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
    if (event.pointerId !== activePointerId) {
      return;
    }

    dragging = false;
    activePointerId = null;
    idleSeconds = 0;
  }

  function onWheel(event) {
    targetDistance = clamp(
      targetDistance + event.deltaY * 1.2,
      CAMERA_CONFIG.minDistance,
      CAMERA_CONFIG.maxDistance,
    );
    idleSeconds = 0;
  }

  function update(deltaSeconds) {
    idleSeconds += deltaSeconds;
    if (!dragging && idleSeconds > 4) {
      const rotateSpeed = 0.022 * (CAMERA_CONFIG.distance / distance);
      targetTheta -= deltaSeconds * rotateSpeed;
    }

    theta += (targetTheta - theta) * lerpSpeed;
    phi += (targetPhi - phi) * lerpSpeed;
    distance += (targetDistance - distance) * lerpSpeed;
    target.lerp(targetGoal, lerpSpeed);

    const sinPhi = Math.sin(phi);
    camera.position.set(
      target.x + Math.cos(theta) * sinPhi * distance,
      target.y + Math.cos(phi) * distance,
      target.z + Math.sin(theta) * sinPhi * distance,
    );
    camera.lookAt(target);
  }

  function focusBuilding(building) {
    targetGoal.set(building.x, building.height * 0.35, building.z);
    targetDistance = clamp(
      Math.max(building.height * 1.9, building.width * 9, building.depth * 9),
      220,
      2300,
    );
    targetPhi = 0.96;
    lerpSpeed = 0.12;
    idleSeconds = 0;
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
    focusBuilding,
    reset,
    isDragging: () => dragging,
    movedSinceDown: () => movedSinceDown,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
