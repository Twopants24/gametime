import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  BEANS,
  PARCELS,
  QUESTS,
  UPGRADES,
  advanceTime,
  buySeeds,
  buyUpgrade,
  createInitialState,
  deserializeState,
  evaluateQuests,
  forageSeaBean,
  getUnlockedBeanIds,
  harvestPlot,
  performMining,
  plantBean,
  sellBeans,
  serializeState,
  unlockParcel,
  waterPlot,
} from "./gameLogic.js?v=20260401-13";

const STORAGE_KEY = "beanfarmer-save-v1";
const ADMIN_KEY = "beanfarmer-admin-v1";
const ADMIN_CREDITS = 99999999;
const ADMIN_CODE = "beanfarmer-dev";
const CAMERA_BOUNDS = {
  minX: -22,
  maxX: 104,
  minZ: -40,
  maxZ: 24,
};
const INTERIOR_CAMERA_BOUNDS = {
  minX: -4.5,
  maxX: 4.5,
  minZ: -5.5,
  maxZ: 5.5,
};
const SEA_CAMERA_BOUNDS = {
  minX: -12,
  maxX: 12,
  minZ: -14,
  maxZ: 14,
};
const PLAYER_BOUNDS = {
  minX: -18,
  maxX: 100,
  minZ: -36,
  maxZ: 20,
};
const INTERIOR_PLAYER_BOUNDS = {
  minX: -5.8,
  maxX: 5.8,
  minZ: -4.8,
  maxZ: 5.8,
};
const INTERACT_DISTANCE = 4.25;
const SEA_PLAYER_BOUNDS = {
  minX: -11.5,
  maxX: 11.5,
  minZ: -13.5,
  maxZ: 13.5,
};
const SEA_BEAN_IDS = ["kelp", "coral", "pearl"];

const PLOT_LAYOUTS = {
  home: { originX: -8, originZ: -2, cols: 3, spacingX: 5.5, spacingZ: 5.5 },
  creek: { originX: 10, originZ: -2, cols: 2, spacingX: 5.5, spacingZ: 5.5 },
  ridge: { originX: -2.5, originZ: 12, cols: 3, spacingX: 5.5, spacingZ: 5.5 },
  lowland: { originX: 10, originZ: -14, cols: 4, spacingX: 5.5, spacingZ: 5.5 },
  orchard: { originX: -8, originZ: -26, cols: 5, spacingX: 5.5, spacingZ: 5.5 },
  admin_city: { originX: 56, originZ: -36, cols: 10, spacingX: 7.4, spacingZ: 7.2 },
};

const creditsValue = document.getElementById("credits-value");
const oreValue = document.getElementById("ore-value");
const clockValue = document.getElementById("clock-value");
const actionValue = document.getElementById("action-value");
const farmView = document.getElementById("farm-view");
const beanSelector = document.getElementById("bean-selector");
const shopActions = document.getElementById("shop-actions");
const landActions = document.getElementById("land-actions");
const questList = document.getElementById("quest-list");
const upgradeList = document.getElementById("upgrade-list");
const upgradePanel = upgradeList.closest(".panel");
const beanIndex = document.getElementById("bean-index");
const beanIndexPanel = beanIndex.closest(".panel");
const inventoryList = document.getElementById("inventory-list");
const viewModeButton = document.getElementById("viewmode-button");
const adminButton = document.getElementById("admin-button");
const fullscreenButton = document.getElementById("fullscreen-button");
const reticle = document.getElementById("reticle");
const saveButton = document.getElementById("save-button");
const resetButton = document.getElementById("reset-button");
const sellButton = document.getElementById("sell-button");
const mineButton = document.getElementById("mine-button");
const selectionText = document.getElementById("selection-text");
const selectionActions = document.getElementById("selection-actions");
const interiorCard = document.getElementById("interior-card");
const canvas = document.getElementById("farm-canvas");
const sceneShell = document.getElementById("scene-shell");
const timeButtons = [...document.querySelectorAll("[data-advance-hours]")];
const movementKeys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
};

function loadState() {
  const serialized = window.localStorage.getItem(STORAGE_KEY);
  if (!serialized) {
    return evaluateQuests(createInitialState());
  }

  try {
    return evaluateQuests(deserializeState(serialized));
  } catch {
    return evaluateQuests(createInitialState());
  }
}

let adminUnlocked = window.localStorage.getItem(ADMIN_KEY) === "1";
let state = applyAdminState(loadState());
let selectedPlotId = null;
let insideHouse = false;
let atSea = false;
let firstPersonMode = false;
let houseDoorMesh = null;
let pondMesh = null;
const interiorInteractiveMeshes = [];
const seaInteractiveMeshes = [];
const playerState = {
  position: new THREE.Vector3(-2, 0.85, 8),
  exteriorPosition: new THREE.Vector3(-2, 0.85, 8),
  seaPosition: new THREE.Vector3(0, 0.85, 7.5),
  heading: 0,
  lookPitch: -0.04,
  moving: false,
  verticalVelocity: 0,
  landingTimer: 0,
};

const FLOOR_HEIGHT = 0.85;
const JUMP_VELOCITY = 6.8;
const GRAVITY = 18;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd7e8d2, 22, 62);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
camera.position.set(-2, 20, 24);

const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.maxPolarAngle = Math.PI * 0.45;
controls.minDistance = 16;
controls.maxDistance = 42;
controls.target.set(4, 0.8, 6);
clampCameraToBounds();
controls.update();

function clampCameraToBounds() {
  if (firstPersonMode) {
    return;
  }
  const offset = camera.position.clone().sub(controls.target);
  const bounds = insideHouse ? INTERIOR_CAMERA_BOUNDS : atSea ? SEA_CAMERA_BOUNDS : CAMERA_BOUNDS;
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, bounds.minX, bounds.maxX);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, bounds.minZ, bounds.maxZ);
  camera.position.copy(controls.target).add(offset);
}

function syncViewModeUi() {
  viewModeButton.textContent = firstPersonMode ? "Third Person" : "First Person";
  playerGroup.visible = !firstPersonMode;
  const showInteriorRoof = insideHouse && firstPersonMode;
  ceiling.visible = showInteriorRoof;
  roofBeam.visible = showInteriorRoof;
  updateReticle();
}

function syncAdminUi() {
  if (!adminButton) {
    return;
  }
  adminButton.textContent = adminUnlocked ? "Admin Logout" : "Admin Login";
}

function applyAdminState(nextState) {
  if (!adminUnlocked) {
    return nextState;
  }
  const adminParcels = nextState.parcels.map((parcel) =>
    parcel.id === "admin_city"
      ? {
          ...parcel,
          unlocked: true,
        }
      : parcel
  );
  return {
    ...nextState,
    credits: ADMIN_CREDITS,
    parcels: adminParcels,
  };
}

function getVisibleParcels() {
  return state.parcels.filter((parcel) => {
    const definition = PARCELS.find((entry) => entry.id === parcel.id);
    return !definition?.adminOnly || adminUnlocked;
  });
}

function updateFirstPersonCamera() {
  if (!firstPersonMode) {
    return;
  }

  const headHeight = insideHouse ? 2.35 : 2.55;
  const eye = playerState.position.clone().add(new THREE.Vector3(0, headHeight, 0));
  const facing = new THREE.Vector3(Math.sin(playerState.heading), 0, Math.cos(playerState.heading));
  const lookTarget = eye.clone().add(facing.multiplyScalar(8));
  lookTarget.y = headHeight + playerState.lookPitch * 8;

  camera.position.copy(eye);
  camera.lookAt(lookTarget);
}

function setViewMode(nextFirstPerson) {
  firstPersonMode = nextFirstPerson;
  controls.enabled = !firstPersonMode;
  syncViewModeUi();

  if (!firstPersonMode) {
    if (insideHouse) {
      controls.target.set(playerState.position.x, 0.8, playerState.position.z - 2);
      camera.position.set(playerState.position.x, 8.5, playerState.position.z + 7.3);
      controls.minDistance = 8;
      controls.maxDistance = 22;
    } else if (atSea) {
      controls.target.set(playerState.position.x, 0.8, playerState.position.z - 1.5);
      camera.position.set(playerState.position.x - 2, 15, playerState.position.z + 13);
      controls.minDistance = 12;
      controls.maxDistance = 28;
    } else {
      controls.target.set(playerState.position.x, 0.8, playerState.position.z - 2);
      camera.position.set(playerState.position.x - 2, 20, playerState.position.z + 16);
      controls.minDistance = 16;
      controls.maxDistance = 42;
    }
    clampCameraToBounds();
    controls.update();
    return;
  }

  updateFirstPersonCamera();
}

function handleTrackpadPan(event) {
  event.preventDefault();

  if (firstPersonMode) {
    const turnStep = event.deltaX * 0.0035;
    playerState.heading += turnStep;
    return;
  }

  const zoomIntent = event.ctrlKey || event.metaKey;
  if (zoomIntent) {
    const zoomStep = event.deltaY * 0.012;
    const offset = camera.position.clone().sub(controls.target);
    const distance = offset.length();
    const nextDistance = THREE.MathUtils.clamp(distance + zoomStep, controls.minDistance, controls.maxDistance);
    offset.setLength(nextDistance);
    camera.position.copy(controls.target).add(offset);
    clampCameraToBounds();
    controls.update();
    return;
  }

  const panScale = 0.022;
  const offset = camera.position.clone().sub(controls.target);
  const forward = offset.clone().setY(0).normalize().negate();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const movement = right.multiplyScalar(event.deltaX * panScale).add(forward.multiplyScalar(event.deltaY * panScale));

  camera.position.add(movement);
  controls.target.add(movement);
  clampCameraToBounds();
  controls.update();
}

function enterHouse() {
  insideHouse = true;
  atSea = false;
  playerState.exteriorPosition.copy(playerState.position);
  playerState.position.set(0, 0.85, 4.2);
  playerState.verticalVelocity = 0;
  selectedPlotId = null;
  worldGroup.visible = false;
  interiorGroup.visible = true;
  controls.target.set(0, 0.8, 2.2);
  camera.position.set(0, 8.5, 11.5);
  controls.minDistance = 8;
  controls.maxDistance = 22;
  clampCameraToBounds();
  controls.update();
  updateFirstPersonCamera();
  interiorCard.classList.remove("hidden");
  actionValue.textContent = "Entered the farmhouse.";
  renderSelection();
}

function exitHouse() {
  insideHouse = false;
  worldGroup.visible = true;
  interiorGroup.visible = false;
  playerState.position.copy(playerState.exteriorPosition);
  playerState.verticalVelocity = 0;
  controls.minDistance = 16;
  controls.maxDistance = 42;
  controls.target.set(playerState.position.x, 0.8, playerState.position.z - 2);
  camera.position.set(playerState.position.x - 2, 20, playerState.position.z + 16);
  clampCameraToBounds();
  controls.update();
  updateFirstPersonCamera();
  interiorCard.classList.add("hidden");
  actionValue.textContent = "Stepped back outside.";
}

function enterSea() {
  atSea = true;
  insideHouse = false;
  playerState.exteriorPosition.copy(playerState.position);
  playerState.position.copy(playerState.seaPosition);
  playerState.verticalVelocity = 0;
  selectedPlotId = null;
  worldGroup.visible = false;
  interiorGroup.visible = false;
  seaGroup.visible = true;
  controls.minDistance = 12;
  controls.maxDistance = 28;
  controls.target.set(playerState.position.x, 0.8, playerState.position.z - 1.5);
  camera.position.set(playerState.position.x - 2, 15, playerState.position.z + 13);
  clampCameraToBounds();
  controls.update();
  updateFirstPersonCamera();
  interiorCard.classList.add("hidden");
  actionValue.textContent = "You slipped through the pond into the sea garden.";
  renderSelection();
  renderParcelSummaries();
}

function exitSea() {
  atSea = false;
  seaGroup.visible = false;
  worldGroup.visible = true;
  playerState.position.copy(playerState.exteriorPosition);
  playerState.verticalVelocity = 0;
  controls.minDistance = 16;
  controls.maxDistance = 42;
  controls.target.set(playerState.position.x, 0.8, playerState.position.z - 2);
  camera.position.set(playerState.position.x - 2, 20, playerState.position.z + 16);
  clampCameraToBounds();
  controls.update();
  updateFirstPersonCamera();
  actionValue.textContent = "You climbed back out of the pond.";
  renderSelection();
  renderParcelSummaries();
}

function updatePlayerMovement(deltaSeconds) {
  if (firstPersonMode) {
    const lookHorizontal = (movementKeys.ArrowLeft ? 1 : 0) - (movementKeys.ArrowRight ? 1 : 0);
    const lookVertical = (movementKeys.ArrowUp ? 1 : 0) - (movementKeys.ArrowDown ? 1 : 0);
    if (lookHorizontal) {
      playerState.heading += lookHorizontal * deltaSeconds * 2.2;
    }
    if (lookVertical) {
      playerState.lookPitch = THREE.MathUtils.clamp(playerState.lookPitch + lookVertical * deltaSeconds * 1.2, -0.6, 0.35);
    }
  }

  const horizontal = (movementKeys.KeyD ? 1 : 0) - (movementKeys.KeyA ? 1 : 0);
  const vertical = (movementKeys.KeyW ? 1 : 0) - (movementKeys.KeyS ? 1 : 0);
  const wasGrounded = playerState.position.y <= FLOOR_HEIGHT + 0.001;
  const wantsJump = !insideHouse && !atSea && movementKeys.Space && wasGrounded;
  if (wantsJump) {
    playerState.verticalVelocity = JUMP_VELOCITY;
  }

  let actualMovement = new THREE.Vector3();
  if (horizontal || vertical) {
    const moveScale = deltaSeconds * 9.5;
    const forward = firstPersonMode
      ? new THREE.Vector3(Math.sin(playerState.heading), 0, Math.cos(playerState.heading)).normalize()
      : controls.target.clone().sub(camera.position).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const movement = right.multiplyScalar(horizontal * moveScale).add(forward.multiplyScalar(vertical * moveScale));

    const desiredPosition = playerState.position.clone().add(movement);
    const resolvedPosition = resolvePlayerCollision(desiredPosition, insideHouse ? "interior" : atSea ? "sea" : "farm");
    actualMovement = resolvedPosition.clone().sub(playerState.position);

    if (actualMovement.lengthSq() > 0.0001) {
      playerState.position.copy(resolvedPosition);
      if (!firstPersonMode) {
        playerState.heading = Math.atan2(actualMovement.x, actualMovement.z);
      }
    }
  }

  playerState.verticalVelocity -= GRAVITY * deltaSeconds;
  playerState.position.y += playerState.verticalVelocity * deltaSeconds;
  if (playerState.position.y < FLOOR_HEIGHT) {
    if (!insideHouse && !atSea && !wasGrounded) {
      playerState.landingTimer = 0.35;
    }
    playerState.position.y = FLOOR_HEIGHT;
    playerState.verticalVelocity = 0;
  }

  playerState.moving = actualMovement.lengthSq() > 0.0001;
  if (firstPersonMode) {
    updateFirstPersonCamera();
  } else {
    if (actualMovement.lengthSq() > 0.0001) {
      camera.position.add(actualMovement);
      controls.target.add(actualMovement);
      clampCameraToBounds();
    }
    controls.update();
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const plotMeshes = new Map();
const worldColliders = [];
const interiorColliders = [];
const seaColliders = [];

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const actorGroup = new THREE.Group();
scene.add(actorGroup);

const interiorGroup = new THREE.Group();
interiorGroup.visible = false;
scene.add(interiorGroup);

const seaGroup = new THREE.Group();
seaGroup.visible = false;
scene.add(seaGroup);

const skyLight = new THREE.HemisphereLight(0xf8ffe6, 0x8b6a3f, 1.7);
scene.add(skyLight);

const sun = new THREE.DirectionalLight(0xfff2c9, 1.7);
sun.position.set(18, 28, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

const ambientBounce = new THREE.PointLight(0xc5e59d, 0.5, 80);
ambientBounce.position.set(-10, 8, 12);
scene.add(ambientBounce);

const fillLight = new THREE.PointLight(0xfff5c2, 0.75, 70);
fillLight.position.set(8, 16, 24);
scene.add(fillLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(60, 64),
  new THREE.MeshStandardMaterial({ color: 0x7aa35a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const path = new THREE.Mesh(
  new THREE.RingGeometry(16, 20, 48),
  new THREE.MeshStandardMaterial({ color: 0xbf9b63, roughness: 1 })
);
path.rotation.x = -Math.PI / 2;
path.position.y = 0.01;
scene.add(path);

const centerStone = new THREE.Mesh(
  new THREE.CylinderGeometry(3.4, 4.2, 1.1, 8),
  new THREE.MeshStandardMaterial({ color: 0xc6b189, roughness: 0.95 })
);
centerStone.position.set(4, 0.45, 6);
centerStone.receiveShadow = true;
centerStone.castShadow = true;
scene.add(centerStone);

const playerGroup = new THREE.Group();
const playerBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.65, 1.4, 5, 12),
  new THREE.MeshStandardMaterial({ color: 0xf0c45a, roughness: 0.62 })
);
playerBody.position.y = 1.4;
playerBody.castShadow = true;
playerGroup.add(playerBody);

const playerHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.52, 18, 18),
  new THREE.MeshStandardMaterial({ color: 0x2f2416, roughness: 0.82 })
);
playerHead.position.y = 2.6;
playerHead.castShadow = true;
playerGroup.add(playerHead);

const packMaterial = new THREE.MeshStandardMaterial({
  color: 0x7b4b2a,
  roughness: 0.9,
  metalness: 0.03,
});
const strapMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a2b18,
  roughness: 0.95,
});

const playerPack = new THREE.Group();

const packBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.82, 0.98, 0.46),
  packMaterial
);
packBody.castShadow = true;
playerPack.add(packBody);

const packTop = new THREE.Mesh(
  new THREE.CylinderGeometry(0.28, 0.3, 0.84, 16),
  packMaterial
);
packTop.rotation.z = Math.PI / 2;
packTop.position.set(0, 0.42, -0.02);
packTop.castShadow = true;
playerPack.add(packTop);

const packFlap = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 0.16, 0.5),
  new THREE.MeshStandardMaterial({ color: 0x9a6a3b, roughness: 0.88 })
);
packFlap.position.set(0, 0.3, 0.08);
packFlap.rotation.x = -0.12;
packFlap.castShadow = true;
playerPack.add(packFlap);

const leftStrap = new THREE.Mesh(
  new THREE.BoxGeometry(0.11, 0.95, 0.09),
  strapMaterial
);
leftStrap.position.set(-0.23, -0.02, 0.2);
leftStrap.castShadow = true;
playerPack.add(leftStrap);

const rightStrap = leftStrap.clone();
rightStrap.position.x = 0.23;
playerPack.add(rightStrap);

const bedroll = new THREE.Mesh(
  new THREE.CylinderGeometry(0.11, 0.11, 0.62, 14),
  new THREE.MeshStandardMaterial({ color: 0xc7b28a, roughness: 0.92 })
);
bedroll.rotation.z = Math.PI / 2;
bedroll.position.set(0, -0.48, 0.03);
bedroll.castShadow = true;
playerPack.add(bedroll);

playerPack.position.set(0, 1.5, -0.5);
playerGroup.add(playerPack);

const landingRingMaterial = new THREE.MeshBasicMaterial({
  color: 0xf5dba7,
  transparent: true,
  opacity: 0,
});
const landingRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.82, 28), landingRingMaterial);
landingRing.rotation.x = -Math.PI / 2;
landingRing.position.y = 0.04;
landingRing.visible = false;
actorGroup.add(landingRing);

actorGroup.add(playerGroup);

const interiorFloor = new THREE.Mesh(
  new THREE.BoxGeometry(16, 0.6, 16),
  new THREE.MeshStandardMaterial({ color: 0x9c7b55, roughness: 0.95 })
);
interiorFloor.position.set(0, -0.1, 0);
interiorFloor.receiveShadow = true;
interiorGroup.add(interiorFloor);

const backWall = new THREE.Mesh(
  new THREE.BoxGeometry(16, 7, 0.5),
  new THREE.MeshStandardMaterial({ color: 0xf4ead4, roughness: 0.95 })
);
backWall.position.set(0, 3.2, -8);
interiorGroup.add(backWall);

const leftWall = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 7, 16),
  new THREE.MeshStandardMaterial({ color: 0xead9b6, roughness: 0.95 })
);
leftWall.position.set(-8, 3.2, 0);
interiorGroup.add(leftWall);

const rightWall = leftWall.clone();
rightWall.position.x = 8;
interiorGroup.add(rightWall);

const frontWallLeft = new THREE.Mesh(
  new THREE.BoxGeometry(6.7, 7, 0.5),
  new THREE.MeshStandardMaterial({ color: 0xead9b6, roughness: 0.95 })
);
frontWallLeft.position.set(-4.65, 3.2, 8);
interiorGroup.add(frontWallLeft);

const frontWallRight = frontWallLeft.clone();
frontWallRight.position.x = 4.65;
interiorGroup.add(frontWallRight);

const frontLintel = new THREE.Mesh(
  new THREE.BoxGeometry(2.8, 2.1, 0.5),
  new THREE.MeshStandardMaterial({ color: 0xf4ead4, roughness: 0.95 })
);
frontLintel.position.set(0, 5.45, 8);
interiorGroup.add(frontLintel);

const leftDoorJamb = new THREE.Mesh(
  new THREE.BoxGeometry(0.28, 3.9, 0.4),
  new THREE.MeshStandardMaterial({ color: 0xd3bc96, roughness: 0.9 })
);
leftDoorJamb.position.set(-1.38, 1.95, 7.92);
interiorGroup.add(leftDoorJamb);

const rightDoorJamb = leftDoorJamb.clone();
rightDoorJamb.position.x = 1.38;
interiorGroup.add(rightDoorJamb);

const ceiling = new THREE.Mesh(
  new THREE.BoxGeometry(16, 0.35, 16),
  new THREE.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.92 })
);
ceiling.position.set(0, 6.82, 0);
ceiling.receiveShadow = true;
interiorGroup.add(ceiling);

const roofBeam = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.45, 15.2),
  new THREE.MeshStandardMaterial({ color: 0x8a623f, roughness: 0.88 })
);
roofBeam.position.set(0, 6.45, 0);
interiorGroup.add(roofBeam);

const table = new THREE.Mesh(
  new THREE.CylinderGeometry(1.5, 1.7, 1, 20),
  new THREE.MeshStandardMaterial({ color: 0x7b4d2d, roughness: 0.88 })
);
table.position.set(0, 0.6, -1.2);
table.castShadow = true;
interiorGroup.add(table);

const bed = new THREE.Mesh(
  new THREE.BoxGeometry(4, 1.1, 7),
  new THREE.MeshStandardMaterial({ color: 0x6f57d9, roughness: 0.72 })
);
bed.position.set(4.6, 0.6, 1.6);
bed.castShadow = true;
interiorGroup.add(bed);

const notesBoard = new THREE.Mesh(
  new THREE.BoxGeometry(3.8, 2.6, 0.16),
  new THREE.MeshStandardMaterial({ color: 0xd9bf84, roughness: 0.9 })
);
notesBoard.position.set(-4.4, 3.2, -7.65);
notesBoard.userData.kind = "indexBoard";
interiorGroup.add(notesBoard);

const lantern = new THREE.Mesh(
  new THREE.SphereGeometry(0.45, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xffd878, emissive: 0xa55a10, emissiveIntensity: 0.85 })
);
lantern.position.set(0, 5.4, -1.5);
interiorGroup.add(lantern);

const interiorDoor = new THREE.Mesh(
  new THREE.BoxGeometry(2.2, 3.6, 0.18),
  new THREE.MeshStandardMaterial({ color: 0x5a341f, roughness: 0.84 })
);
interiorDoor.position.set(0, 1.8, 7.72);
interiorDoor.userData.kind = "interiorDoor";
interiorDoor.castShadow = true;
interiorGroup.add(interiorDoor);

table.userData.kind = "upgradeTable";
bed.userData.kind = "bed";
interiorInteractiveMeshes.push(table, bed, notesBoard, interiorDoor);

function setState(nextState) {
  state = applyAdminState(nextState);
  render();
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, serializeState(state));
  actionValue.textContent = "Farm saved locally.";
}

function resetState() {
  window.localStorage.removeItem(STORAGE_KEY);
  selectedPlotId = null;
  setState(evaluateQuests(createInitialState()));
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function renderHeader() {
  creditsValue.textContent = adminUnlocked ? "∞" : `${state.credits}`;
  oreValue.textContent = `${state.ore}`;
  clockValue.textContent = `Day ${state.clock.day}, ${formatHour(state.clock.hour)}`;
  actionValue.textContent = state.lastAction;
}

function renderBeanSelector() {
  const unlockedBeanIds = getUnlockedBeanIds(state);
  beanSelector.innerHTML = unlockedBeanIds
    .map((beanId) => {
      const bean = BEANS[beanId];
      const selectedClass = state.selectedBeanId === beanId ? "bean-chip active" : "bean-chip";
      return `
        <article class="${selectedClass}">
          <strong>${bean.name}</strong>
          <span>${bean.description}</span>
          <span>${bean.rarity} · ${bean.growthHours}h · ${bean.sellValue} credits</span>
          <span>Seeds in bag: ${state.inventory.seeds[beanId] ?? 0}</span>
          <button type="button" data-select-bean="${beanId}">Select Seed</button>
        </article>
      `;
    })
    .join("");

  shopActions.innerHTML = unlockedBeanIds
    .filter((beanId) => BEANS[beanId].seedCost > 0)
    .map((beanId) => {
      const bean = BEANS[beanId];
      return `<button type="button" data-buy-seed="${beanId}">Buy ${bean.name} Seed (${bean.seedCost})</button>`;
    })
    .join("");
}

function renderLandActions() {
  landActions.innerHTML = PARCELS.filter((parcel) => parcel.unlockCost > 0 && (!parcel.adminOnly || adminUnlocked))
    .map((parcel) => {
      const stateParcel = state.parcels.find((entry) => entry.id === parcel.id);
      if (stateParcel?.unlocked) {
        return `<button type="button" disabled>${parcel.name} Unlocked</button>`;
      }
      return `<button type="button" data-unlock-parcel="${parcel.id}">Unlock ${parcel.name} (${parcel.unlockCost})</button>`;
    })
    .join("");
}

function renderQuests() {
  questList.innerHTML = QUESTS.map((quest) => {
    const completed = state.completedQuestIds.includes(quest.id);
    const progress = state.questProgress[quest.id] ?? 0;
    const progressText =
      quest.type === "unlockParcel"
        ? completed
          ? "Unlocked"
          : "Locked"
        : `${progress} / ${quest.target}`;
    return `
      <article class="stack-item ${completed ? "quest-complete" : ""}">
        <strong>${quest.name}</strong>
        <span>${quest.description}</span>
        <span>${progressText}</span>
      </article>
    `;
  }).join("");
}

function renderUpgrades() {
  upgradeList.innerHTML = Object.values(UPGRADES)
    .map((upgrade) => {
      const owned = state.upgrades.includes(upgrade.id);
      const oreCost = upgrade.oreCost ?? 0;
      const costText = oreCost > 0 ? `${upgrade.cost} credits · ${oreCost} ore` : `${upgrade.cost} credits`;
      return `
        <article class="stack-item">
          <strong>${upgrade.name}</strong>
          <span>${upgrade.description}</span>
          <span>${owned ? "Installed in farmhouse" : costText}</span>
          <button type="button" data-buy-upgrade="${upgrade.id}" ${owned ? "disabled" : ""}>${owned ? "Installed" : "Buy Upgrade"}</button>
        </article>
      `;
    })
    .join("");
}

function renderIndex() {
  const entries = Object.entries(state.beanIndex);
  beanIndex.innerHTML =
    entries.length === 0
      ? `<article class="stack-item"><strong>No beans logged yet.</strong><span>Plant or discover a bean to start the index.</span></article>`
      : entries
          .map(([beanId, entry]) => {
            const bean = BEANS[beanId];
            return `
              <article class="stack-item">
                <strong class="${bean.rarity === "Rare" || bean.rarity === "Special" ? "rare" : ""}">${bean.name}</strong>
                <span>${bean.rarity} · ${bean.description}</span>
                <span>Planted ${entry.planted ?? 0} · Harvested ${entry.harvested ?? 0} · Sold ${entry.sold ?? 0}</span>
              </article>
            `;
          })
          .join("");
}

function renderInventory() {
  const sections = [
    { title: "Seeds", items: state.inventory.seeds },
    { title: "Harvest", items: state.inventory.beans },
  ];

  inventoryList.innerHTML = sections
    .map((section) => {
      const items = Object.entries(section.items);
      return `
        <article class="stack-item">
          <strong>${section.title}</strong>
          <span>${items.length === 0 ? "Empty" : items.map(([id, count]) => `${BEANS[id].name}: ${count}`).join(" · ")}</span>
        </article>
      `;
    })
    .join("");
}

function describePlot(plot) {
  if (!plot) {
    if (insideHouse) {
      return "You are inside the farmhouse.";
    }
    if (atSea) {
      return "The sea garden hides underwater-themed beans. Search the reef nodes for seeds.";
    }
    return "Choose a plot in the 3D field.";
  }
  if (plot.state === "empty") {
    return `Open soil in ${plot.parcelId}. Plant ${BEANS[state.selectedBeanId].name} here.`;
  }
  const bean = BEANS[plot.beanId];
  if (plot.state === "planted") {
    return `${bean.name} growing: ${plot.growthHours.toFixed(1)} / ${bean.growthHours}h, hydration ${plot.hydration}/${bean.waterNeed}.`;
  }
  return `${bean.name} is ready. Harvest it now.`;
}

function renderSelection() {
  if (insideHouse) {
    selectionText.textContent = "Inside the farmhouse. Use the bed to save, the wall board to open the Bean Index, the round worktable for house upgrades, and the front door to go back outside.";
    selectionActions.innerHTML = "";
    return;
  }
  if (atSea) {
    selectionText.textContent = "The kelp bed, coral reef, and giant clam each give one sea bean seed per day. Use the glowing ring to go back.";
    selectionActions.innerHTML = "";
    return;
  }
  const plot = selectedPlotId ? findPlotById(selectedPlotId) : null;
  selectionText.textContent = describePlot(plot);
  selectionActions.innerHTML = "";

  if (!plot) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";

  if (plot.state === "empty") {
    button.textContent = `Plant ${BEANS[state.selectedBeanId].name}`;
    button.dataset.selectionAction = "plant";
  } else if (plot.state === "planted") {
    button.textContent = "Water Plot";
    button.dataset.selectionAction = "water";
  } else if (plot.state === "ready") {
    button.textContent = "Harvest Plot";
    button.dataset.selectionAction = "harvest";
  }

  if (button.dataset.selectionAction) {
    selectionActions.appendChild(button);
  }
}

function renderParcelSummaries() {
  if (atSea) {
    farmView.innerHTML = SEA_BEAN_IDS.map((beanId) => {
      const bean = BEANS[beanId];
      const claimedToday = state.seaForageDays?.[beanId] === state.clock.day;
      return `
        <article class="parcel-summary ${claimedToday ? "locked" : ""}">
          <strong>${bean.name}</strong>
          <span>${claimedToday ? "Foraged today" : "Ready to forage"} · ${bean.sellValue} credits · ${bean.growthHours}h grow time</span>
        </article>
      `;
    }).join("");
    return;
  }

  farmView.innerHTML = getVisibleParcels()
    .map((parcel) => {
      const definition = PARCELS.find((entry) => entry.id === parcel.id);
      const readyCount = parcel.plots.filter((plot) => plot.state === "ready").length;
      const plantedCount = parcel.plots.filter((plot) => plot.state === "planted").length;
      const soilText = Number.isFinite(definition.soilBonus) ? definition.soilBonus.toFixed(2) : "∞";
      return `
        <article class="parcel-summary ${parcel.unlocked ? "" : "locked"}">
          <strong>${definition.name}</strong>
          <span>${parcel.unlocked ? `${plantedCount} growing · ${readyCount} ready · soil x${soilText}` : `Locked · ${definition.unlockCost} credits`}</span>
        </article>
      `;
    })
    .join("");
}

function beanColor(beanId) {
  if (beanId === "green") return 0x76b84f;
  if (beanId === "wax") return 0xe2c15c;
  if (beanId === "scarlet") return 0xc74339;
  if (beanId === "dusk") return 0x8a74d8;
  if (beanId === "kelp") return 0x48a78e;
  if (beanId === "coral") return 0xff7d8b;
  if (beanId === "pearl") return 0xe7f4ff;
  if (beanId === "starlight") return 0x7c68f0;
  return 0x6aa54a;
}

function createCropVisual(plot) {
  const bean = BEANS[plot.beanId];
  const group = new THREE.Group();
  const isGiantPod = plot.beanId === "giant";
  const isFrostPod = plot.beanId === "frost";
  const isEmberBean = plot.beanId === "ember";
  const isDuskBean = plot.beanId === "dusk";
  const isStarlightBean = plot.beanId === "starlight";
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(
      isGiantPod ? 0.16 : 0.09,
      isGiantPod ? 0.22 : 0.12,
      plot.state === "ready" ? (isGiantPod ? 3.8 : 2.2) : isGiantPod ? 2.2 : 1.5,
      12
    ),
    new THREE.MeshStandardMaterial({ color: 0x4f8b2a, roughness: 0.8 })
  );
  stem.position.y = plot.state === "ready" ? (isGiantPod ? 1.9 : 1.1) : isGiantPod ? 1.1 : 0.75;
  stem.castShadow = true;
  group.add(stem);

  const leafOffsets = isGiantPod
    ? [
        [-0.9, 1.45, 0.35],
        [0.85, 1.8, -0.3],
        [0.25, 1.2, 0.95],
        [-0.35, 2.15, -0.7],
      ]
    : isFrostPod
    ? [
        [-0.6, 1.15, 0.3],
        [0.55, 1.45, -0.2],
        [0.18, 1.0, 0.62],
      ]
    : isEmberBean
    ? [
        [-0.45, 1.0, 0.1],
        [0.5, 1.4, -0.12],
        [0.08, 1.1, 0.58],
      ]
    : isDuskBean
    ? [
        [-0.42, 1.08, 0.28],
        [0.38, 1.42, -0.2],
        [0.04, 1.72, 0.08],
      ]
    : isStarlightBean
    ? [
        [-0.38, 1.05, 0.32],
        [0.42, 1.32, -0.25],
        [0.02, 1.58, 0.02],
      ]
    : [
        [-0.55, 1.1, 0.25],
        [0.45, 1.35, -0.18],
        [0.12, 0.95, 0.52],
      ];

  const leafMaterial = new THREE.MeshStandardMaterial({
    color: isFrostPod ? 0x89c8ff : isEmberBean ? 0xe87b39 : isDuskBean ? 0xa992f0 : isStarlightBean ? 0xd9c2ff : beanColor(plot.beanId),
    roughness: 0.7,
    emissive: isFrostPod ? 0x17365f : isEmberBean ? 0x57210b : isDuskBean ? 0x24163f : isStarlightBean ? 0x36205d : 0x000000,
    emissiveIntensity: isFrostPod ? 0.28 : isEmberBean ? 0.3 : isDuskBean ? 0.34 : isStarlightBean ? 0.42 : 0,
  });

  const leafScale = plot.state === "ready" ? (isGiantPod ? 1.95 : 1.2) : isGiantPod ? 1.2 : 0.8;
  for (const offset of leafOffsets) {
      const leafGeometry = isStarlightBean
      ? new THREE.OctahedronGeometry(0.34 * leafScale, 0)
      : isEmberBean
      ? new THREE.ConeGeometry(0.28 * leafScale, 0.9 * leafScale, 8)
      : isDuskBean
      ? new THREE.OctahedronGeometry(0.3 * leafScale, 0)
      : new THREE.SphereGeometry(0.42 * leafScale, 14, 14);
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.set(offset[0], offset[1], offset[2]);
    leaf.scale.set(
      isEmberBean ? 1 : 1.25,
      isStarlightBean ? 1 : 0.7,
      isStarlightBean ? 1 : 0.9
    );
    if (isEmberBean) {
      leaf.rotation.x = Math.PI;
    }
    if (isDuskBean) {
      leaf.rotation.set(offset[2] * 2, offset[0] * 2, offset[1] * 0.6);
    }
    leaf.castShadow = true;
    group.add(leaf);
  }

  if (plot.state === "ready") {
    const podMaterial = new THREE.MeshStandardMaterial({
      color:
        isFrostPod ? 0x9fdbff : isEmberBean ? 0xff8748 : isDuskBean ? 0xd1c3ff : isStarlightBean ? 0xc49bff : bean.rarity === "Special" ? 0x8f7fff : bean.rarity === "Rare" ? 0xda5841 : 0xe2d56b,
      roughness: 0.45,
      metalness: isFrostPod ? 0.22 : isDuskBean ? 0.32 : isStarlightBean ? 0.28 : bean.rarity === "Special" ? 0.2 : 0.05,
      emissive: isFrostPod ? 0x215fb0 : isEmberBean ? 0x7a2400 : isDuskBean ? 0x38265f : isStarlightBean ? 0x4b1f8c : bean.rarity === "Special" ? 0x29145b : 0x000000,
      emissiveIntensity: isFrostPod ? 0.48 : isEmberBean ? 0.7 : isDuskBean ? 0.72 : isStarlightBean ? 0.8 : bean.rarity === "Special" ? 0.55 : 0,
    });
    const podOffsets = isGiantPod
      ? [
          [-0.65, 2.25, 0],
          [0.3, 2.55, -0.4],
          [0.68, 1.85, 0.35],
          [-0.12, 2.95, 0.25],
        ]
      : isEmberBean
      ? [
          [-0.3, 1.55, 0.08],
          [0.22, 1.78, -0.2],
          [0.42, 1.3, 0.26],
        ]
      : isDuskBean
      ? [
          [-0.32, 1.42, 0.02],
          [0.18, 1.8, -0.18],
          [0.38, 1.26, 0.22],
        ]
      : isStarlightBean
      ? [
          [-0.4, 1.5, 0],
          [0.16, 1.74, -0.22],
          [0.38, 1.2, 0.18],
        ]
      : [
          [-0.45, 1.5, 0],
          [0.18, 1.68, -0.26],
          [0.42, 1.22, 0.22],
        ];
    for (const offset of podOffsets) {
      const podGeometry = isEmberBean
        ? new THREE.SphereGeometry(0.24, 14, 14)
        : isDuskBean
        ? new THREE.OctahedronGeometry(0.28, 0)
        : isStarlightBean
        ? new THREE.OctahedronGeometry(0.26, 0)
        : new THREE.CapsuleGeometry(isGiantPod ? 0.28 : 0.14, isGiantPod ? 1.1 : 0.5, 4, 10);
      const pod = new THREE.Mesh(
        podGeometry,
        podMaterial
      );
      pod.position.set(
        offset[0] * (isGiantPod ? 1.55 : 1),
        offset[1] * (isGiantPod ? 1.55 : 1),
        offset[2] * (isGiantPod ? 1.55 : 1)
      );
      pod.rotation.z = isEmberBean || isStarlightBean ? 0 : Math.PI / 2.8;
      pod.castShadow = true;
      group.add(pod);
    }

    if (isFrostPod) {
      const frostMaterial = new THREE.MeshStandardMaterial({
        color: 0xc9efff,
        emissive: 0x7cc8ff,
        emissiveIntensity: 0.6,
        roughness: 0.25,
        metalness: 0.15,
      });
      for (const offset of [
        [-0.9, 1.8, 0.4],
        [0.95, 1.6, -0.3],
        [-0.2, 2.1, -0.75],
        [0.35, 1.25, 0.95],
        [0, 2.35, 0.15],
      ]) {
        const flake = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), frostMaterial);
        flake.position.set(offset[0], offset[1], offset[2]);
        flake.rotation.set(offset[1], offset[2] * 2, offset[0] * 2);
        group.add(flake);
      }
    }

    if (isEmberBean) {
      const emberMaterial = new THREE.MeshStandardMaterial({
        color: 0xffbf7a,
        emissive: 0xff5a00,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });
      for (const offset of [
        [-0.65, 1.8, 0.25],
        [0.55, 1.95, -0.12],
        [0, 2.2, 0.45],
        [0.2, 1.45, -0.55],
      ]) {
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), emberMaterial);
        ember.position.set(offset[0], offset[1], offset[2]);
        group.add(ember);
      }
    }

    if (isStarlightBean) {
      const sparkleMaterial = new THREE.MeshStandardMaterial({
        color: 0xf7edff,
        emissive: 0x9f7dff,
        emissiveIntensity: 1,
        roughness: 0.15,
        metalness: 0.2,
      });
      for (const offset of [
        [-0.85, 1.95, 0.15],
        [0.8, 2.05, -0.15],
        [0, 2.45, 0.4],
        [0.28, 1.55, -0.62],
        [-0.35, 1.35, 0.72],
      ]) {
        const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), sparkleMaterial);
        sparkle.position.set(offset[0], offset[1], offset[2]);
        sparkle.rotation.set(offset[2] * 3, offset[0] * 2, offset[1]);
        group.add(sparkle);
      }
    }

    if (isDuskBean) {
      const duskShardMaterial = new THREE.MeshStandardMaterial({
        color: 0xf2dcff,
        emissive: 0x8a63f0,
        emissiveIntensity: 0.9,
        roughness: 0.18,
        metalness: 0.22,
      });
      for (const offset of [
        [-0.78, 1.82, 0.18],
        [0.72, 1.98, -0.14],
        [0, 2.28, 0.36],
        [0.24, 1.48, -0.55],
      ]) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), duskShardMaterial);
        shard.position.set(offset[0], offset[1], offset[2]);
        shard.rotation.set(offset[1] * 0.6, offset[0] * 2, offset[2] * 2);
        group.add(shard);
      }
    }
  }

  if (isGiantPod) {
    group.scale.setScalar(plot.state === "ready" ? 1.38 : 1.1);
  }

  return group;
}

function createPlotMesh(plot, selected) {
  const baseColor =
    plot.state === "ready" ? 0xe9c35c : plot.state === "planted" ? 0x8d6b3d : 0x6c4a2e;
  const material = new THREE.MeshStandardMaterial({
    color: selected ? 0xf2d982 : baseColor,
    roughness: 0.95,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 4.2), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.plotId = plot.id;

  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(4.55, 0.22, 4.55),
    new THREE.MeshStandardMaterial({ color: 0xcaa36b, roughness: 0.85 })
  );
  rim.position.y = 0.56;
  mesh.add(rim);

  if (plot.state === "planted" || plot.state === "ready") {
    const crop = createCropVisual(plot);
    crop.position.y = 0.45;
    mesh.add(crop);
  }

  if (selected) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.08, 10, 40),
      new THREE.MeshStandardMaterial({ color: 0xffee98, emissive: 0x8a5b11, emissiveIntensity: 0.5 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.72;
    mesh.add(halo);
  }

  return mesh;
}

function addCircleCollider(x, z, radius) {
  worldColliders.push({ x, z, radius });
}

function addInteriorCircleCollider(x, z, radius) {
  interiorColliders.push({ x, z, radius });
}

function addSeaCircleCollider(x, z, radius) {
  seaColliders.push({ x, z, radius });
}

function resolvePlayerCollision(nextPosition, zone = "farm") {
  const resolved = nextPosition.clone();
  const bounds = zone === "interior" ? INTERIOR_PLAYER_BOUNDS : zone === "sea" ? SEA_PLAYER_BOUNDS : PLAYER_BOUNDS;
  const colliders = zone === "interior" ? interiorColliders : zone === "sea" ? seaColliders : worldColliders;

  resolved.x = THREE.MathUtils.clamp(resolved.x, bounds.minX, bounds.maxX);
  resolved.z = THREE.MathUtils.clamp(resolved.z, bounds.minZ, bounds.maxZ);

  for (const collider of colliders) {
    const dx = resolved.x - collider.x;
    const dz = resolved.z - collider.z;
    const distanceSq = dx * dx + dz * dz;
    const minDistance = collider.radius;

    if (distanceSq === 0) {
      resolved.x += minDistance;
      continue;
    }

    if (distanceSq < minDistance * minDistance) {
      const distance = Math.sqrt(distanceSq);
      const push = (minDistance - distance) / distance;
      resolved.x += dx * push;
      resolved.z += dz * push;
    }
  }

  resolved.x = THREE.MathUtils.clamp(resolved.x, bounds.minX, bounds.maxX);
  resolved.z = THREE.MathUtils.clamp(resolved.z, bounds.minZ, bounds.maxZ);
  return resolved;
}

function parcelWorldPosition(parcelId, plotIndex) {
  const layout = PLOT_LAYOUTS[parcelId];
  const col = plotIndex % layout.cols;
  const row = Math.floor(plotIndex / layout.cols);
  return new THREE.Vector3(layout.originX + col * layout.spacingX, 0.5, layout.originZ + row * layout.spacingZ);
}

function rebuildScene() {
  plotMeshes.clear();
  worldColliders.length = 0;
  interiorColliders.length = 0;
  seaColliders.length = 0;
  worldGroup.clear();
  seaGroup.clear();
  seaInteractiveMeshes.length = 0;
  houseDoorMesh = null;
  pondMesh = null;

  for (const parcel of getVisibleParcels()) {
    const definition = PARCELS.find((entry) => entry.id === parcel.id);
    const layout = PLOT_LAYOUTS[parcel.id];
    const width = Math.min(layout.cols, parcel.plots.length) * layout.spacingX + 3;
    const depth = Math.ceil(parcel.plots.length / layout.cols) * layout.spacingZ + 3;

    const parcelPad = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.6, depth),
      new THREE.MeshStandardMaterial({
        color: parcel.unlocked ? 0x739856 : 0x837461,
        roughness: 1,
      })
    );
    parcelPad.position.set(layout.originX + (width - layout.spacingX) / 2 - 1.5, -0.1, layout.originZ + (depth - layout.spacingZ) / 2 - 1.5);
    parcelPad.receiveShadow = true;
    worldGroup.add(parcelPad);

    if (!parcel.unlocked) {
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.5, 4, 6),
        new THREE.MeshStandardMaterial({ color: 0xd7bc8b, roughness: 0.8 })
      );
      beacon.position.copy(parcelPad.position);
      beacon.position.y = 2;
      beacon.castShadow = true;
      worldGroup.add(beacon);
      addCircleCollider(beacon.position.x, beacon.position.z, 2.4);
      continue;
    }

    parcel.plots.forEach((plot, index) => {
      const selected = plot.id === selectedPlotId;
      const mesh = createPlotMesh(plot, selected);
      mesh.position.copy(parcelWorldPosition(parcel.id, index));
      worldGroup.add(mesh);
      plotMeshes.set(plot.id, mesh);
      addCircleCollider(mesh.position.x, mesh.position.z, parcel.id === "admin_city" ? 1.55 : 2.45);
    });

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.2, 0.2),
      new THREE.MeshStandardMaterial({ color: definition.id === "ridge" ? 0xdba65e : 0xf1e5c2, roughness: 0.9 })
    );
    sign.position.set(layout.originX - 3.6, 1.2, layout.originZ + 2);
    sign.castShadow = true;
    worldGroup.add(sign);
  }

  const barn = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7, 4.4, 5.5),
    new THREE.MeshStandardMaterial({ color: 0xb5543c, roughness: 0.9 })
  );
  base.position.set(-18, 2.2, -10);
  base.castShadow = true;
  barn.add(base);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(5.5, 3.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x6f4029, roughness: 0.85 })
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.set(-18, 6.1, -10);
  roof.castShadow = true;
  barn.add(roof);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.8, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x4f2f1d, roughness: 0.78 })
  );
  door.position.set(-18, 1.55, -7.16);
  door.userData.kind = "houseDoor";
  door.castShadow = true;
  barn.add(door);
  houseDoorMesh = door;
  worldGroup.add(barn);
  addCircleCollider(base.position.x, base.position.z, 4.8);

  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 36),
    new THREE.MeshStandardMaterial({ color: 0x73b8db, roughness: 0.25, metalness: 0.15 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(18, 0.02, 14);
  pond.userData.kind = "seaPortal";
  worldGroup.add(pond);
  pondMesh = pond;
  addCircleCollider(pond.position.x, pond.position.z, 4.9);

  const seaFloor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 48),
    new THREE.MeshStandardMaterial({ color: 0x355f6b, roughness: 1 })
  );
  seaFloor.rotation.x = -Math.PI / 2;
  seaFloor.position.y = -0.1;
  seaGroup.add(seaFloor);

  const seaHaze = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 16, 14, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x6dc7d7, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
  seaHaze.position.y = 6;
  seaGroup.add(seaHaze);

  const returnPool = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.35, 16, 42),
    new THREE.MeshStandardMaterial({ color: 0x91e3ff, emissive: 0x3f9fcf, emissiveIntensity: 0.65, roughness: 0.22 })
  );
  returnPool.rotation.x = Math.PI / 2;
  returnPool.position.set(0, 0.18, 10.5);
  returnPool.userData.kind = "returnPond";
  seaGroup.add(returnPool);
  seaInteractiveMeshes.push(returnPool);

  const kelpNode = new THREE.Group();
  kelpNode.position.set(-6.5, 0, 0.5);
  const kelpRock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.8, 0),
    new THREE.MeshStandardMaterial({ color: 0x557780, roughness: 0.95 })
  );
  kelpRock.position.set(0, 1, 0);
  kelpNode.add(kelpRock);
  for (const xOffset of [-0.5, 0, 0.55]) {
    const frond = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 2.8, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x4ec5ad, roughness: 0.7, emissive: 0x11413f, emissiveIntensity: 0.25 })
    );
    frond.position.set(xOffset, 2.2, -0.1 + xOffset * 0.2);
    frond.rotation.z = xOffset * 0.35;
    kelpNode.add(frond);
  }
  kelpNode.userData.kind = "seaBean";
  kelpNode.userData.beanId = "kelp";
  seaGroup.add(kelpNode);
  seaInteractiveMeshes.push(kelpNode);
  addSeaCircleCollider(-6.5, 0.5, 1.45);

  const coralNode = new THREE.Group();
  coralNode.position.set(6.2, 0, 1.5);
  const coralBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.9, 1.3, 10),
    new THREE.MeshStandardMaterial({ color: 0x6b7d8e, roughness: 0.9 })
  );
  coralBase.position.set(0, 0.7, 0);
  coralNode.add(coralBase);
  for (const offset of [
    [0, 2.2, 0],
    [-0.45, 1.8, 0.18],
    [0.52, 1.7, -0.12],
    [0.24, 2.4, 0.26],
  ]) {
    const branch = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.48, 0),
      new THREE.MeshStandardMaterial({ color: 0xff8da2, roughness: 0.55, emissive: 0x612a37, emissiveIntensity: 0.35 })
    );
    branch.position.set(offset[0], offset[1], offset[2]);
    coralNode.add(branch);
  }
  coralNode.userData.kind = "seaBean";
  coralNode.userData.beanId = "coral";
  seaGroup.add(coralNode);
  seaInteractiveMeshes.push(coralNode);
  addSeaCircleCollider(6.2, 1.5, 1.4);

  const pearlNode = new THREE.Group();
  pearlNode.position.set(0.2, 0, -5.5);
  const clamBase = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xdcc3db, roughness: 0.55, metalness: 0.08 })
  );
  clamBase.position.set(0, 0.65, 0);
  clamBase.rotation.x = Math.PI;
  pearlNode.add(clamBase);
  const clamTop = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf1deec, roughness: 0.45, metalness: 0.08 })
  );
  clamTop.position.set(0, 1.15, 0.3);
  clamTop.rotation.x = Math.PI * 0.55;
  pearlNode.add(clamTop);
  const pearlCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8bb3cc, emissiveIntensity: 0.75, roughness: 0.15, metalness: 0.25 })
  );
  pearlCore.position.set(0, 1.2, 0.58);
  pearlNode.add(pearlCore);
  pearlNode.userData.kind = "seaBean";
  pearlNode.userData.beanId = "pearl";
  seaGroup.add(pearlNode);
  seaInteractiveMeshes.push(pearlNode);
  addSeaCircleCollider(0.2, -5.5, 1.25);

  addInteriorCircleCollider(0, -1.2, 2.2);
  addInteriorCircleCollider(4.6, 1.6, 3.2);
}

function findPlotById(plotId) {
  for (const parcel of state.parcels) {
    const plot = parcel.plots.find((entry) => entry.id === plotId);
    if (plot) {
      return plot;
    }
  }
  return null;
}

function performSelectedPlotAction(action) {
  if (!selectedPlotId) {
    return;
  }

  if (action === "plant") {
    setState(plantBean(state, selectedPlotId, state.selectedBeanId));
  } else if (action === "water") {
    setState(waterPlot(state, selectedPlotId));
  } else if (action === "harvest") {
    setState(harvestPlot(state, selectedPlotId));
  }
}

function getPlotInteractionAction(plot) {
  if (!plot) {
    return null;
  }

  if (plot.state === "empty") {
    return "plant";
  }
  if (plot.state === "planted") {
    return "water";
  }
  if (plot.state === "ready") {
    return "harvest";
  }
  return null;
}

function focusPanel(panel) {
  panel?.scrollIntoView({ behavior: "smooth", block: "center" });
  panel?.classList.add("panel-flash");
  window.setTimeout(() => panel?.classList.remove("panel-flash"), 1200);
}

function handleInteriorInteraction(kind) {
  if (kind === "interiorDoor") {
    exitHouse();
    return;
  }

  if (kind === "bed") {
    saveState();
    actionValue.textContent = "You rested for a moment and saved the farmhouse.";
    return;
  }

  if (kind === "indexBoard") {
    focusPanel(beanIndexPanel);
    actionValue.textContent = "Opened your Bean Index notes.";
    return;
  }

  if (kind === "upgradeTable") {
    const candidate = Object.values(UPGRADES).find(
      (upgrade) => !state.upgrades.includes(upgrade.id) && state.credits >= upgrade.cost && state.ore >= (upgrade.oreCost ?? 0)
    );
    if (candidate) {
      setState(buyUpgrade(state, candidate.id));
      focusPanel(upgradePanel);
      return;
    }
    focusPanel(upgradePanel);
    actionValue.textContent = "You need more credits or ore for the next farmhouse upgrade.";
  }
}

function handleSeaInteraction(beanId) {
  if (!beanId) {
    return;
  }
  setState(forageSeaBean(state, beanId));
}

function render() {
  renderHeader();
  renderBeanSelector();
  renderLandActions();
  renderQuests();
  renderUpgrades();
  renderIndex();
  renderInventory();
  renderSelection();
  renderParcelSummaries();
  rebuildScene();
}

function resizeRenderer() {
  const width = sceneShell.clientWidth;
  const fullscreenHeight = window.innerHeight - 170;
  const height = document.fullscreenElement === sceneShell.closest(".viewport-panel")
    ? Math.max(520, fullscreenHeight)
    : Math.max(620, Math.round(sceneShell.clientWidth * 0.56));
  canvas.style.height = `${height}px`;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function getTaggedInteractive(object) {
  let current = object;
  while (current && current !== scene) {
    if (current.userData?.kind || current.userData?.plotId) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function getReticleTarget() {
  if (!firstPersonMode) {
    return null;
  }

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const candidates = insideHouse
    ? interiorInteractiveMeshes
    : atSea
    ? seaInteractiveMeshes
    : pondMesh && houseDoorMesh
    ? [...plotMeshes.values(), houseDoorMesh, pondMesh]
    : houseDoorMesh
    ? [...plotMeshes.values(), houseDoorMesh]
    : pondMesh
    ? [...plotMeshes.values(), pondMesh]
    : [...plotMeshes.values()];
  const hits = raycaster.intersectObjects(candidates, true);

  for (const hit of hits) {
    const tagged = getTaggedInteractive(hit.object);
    if (!tagged) {
      continue;
    }

    if (tagged.userData.kind) {
      const worldPosition = new THREE.Vector3();
      tagged.getWorldPosition(worldPosition);
      if (worldPosition.distanceTo(playerState.position) <= getInteractionDistance(tagged.userData.kind)) {
        return tagged;
      }
      continue;
    }

    if (tagged.userData.plotId) {
      return tagged;
    }
  }

  return null;
}

function updateReticle() {
  if (!reticle) {
    return;
  }

  reticle.classList.toggle("hidden", !firstPersonMode);
  reticle.classList.toggle("active", Boolean(getReticleTarget()));
}

function getInteractionDistance(kind) {
  if (kind === "seaPortal") {
    return Number.POSITIVE_INFINITY;
  }
  if (kind === "returnPond") {
    return Number.POSITIVE_INFINITY;
  }
  if (kind === "seaBean") {
    return 5.25;
  }
  return INTERACT_DISTANCE;
}

function interactWithTarget(target) {
  if (!target) {
    actionValue.textContent = firstPersonMode ? "Nothing to interact with." : actionValue.textContent;
    return;
  }

  if (target.userData.kind) {
    const worldPosition = new THREE.Vector3();
    target.getWorldPosition(worldPosition);
    if (worldPosition.distanceTo(playerState.position) > getInteractionDistance(target.userData.kind)) {
      actionValue.textContent = insideHouse
        ? "Move closer to use that furniture."
        : atSea
        ? "Swim closer to the sea node."
        : "Walk closer to the house door or pond.";
      return;
    }

    if (target.userData.kind === "houseDoor") {
      enterHouse();
      return;
    }

    if (target.userData.kind === "seaPortal") {
      enterSea();
      return;
    }

    if (target.userData.kind === "returnPond") {
      exitSea();
      return;
    }

    if (target.userData.kind === "seaBean") {
      handleSeaInteraction(target.userData.beanId);
      return;
    }

    handleInteriorInteraction(target.userData.kind);
    return;
  }

  if (target.userData.plotId) {
    selectedPlotId = target.userData.plotId;
    const plot = findPlotById(selectedPlotId);
    const action = getPlotInteractionAction(plot);
    if (action) {
      performSelectedPlotAction(action);
    } else {
      render();
    }
  }
}

function getPointerTarget(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const candidates = insideHouse
    ? interiorInteractiveMeshes
    : atSea
    ? seaInteractiveMeshes
    : pondMesh && houseDoorMesh
    ? [...plotMeshes.values(), houseDoorMesh, pondMesh]
    : houseDoorMesh
    ? [...plotMeshes.values(), houseDoorMesh]
    : pondMesh
    ? [...plotMeshes.values(), pondMesh]
    : [...plotMeshes.values()];
  const hits = raycaster.intersectObjects(candidates, true);
  if (hits.length === 0) {
    return null;
  }

  return hits.map((hit) => getTaggedInteractive(hit.object)).find(Boolean) ?? null;
}

function handleCanvasPick(event) {
  if (firstPersonMode) {
    return;
  }

  interactWithTarget(getPointerTarget(event));
}

canvas.addEventListener("pointerdown", handleCanvasPick);
canvas.addEventListener("wheel", handleTrackpadPan, { passive: false });
window.addEventListener("resize", resizeRenderer);
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyE") {
    event.preventDefault();
    if (!event.repeat) {
      interactWithTarget(getReticleTarget());
    }
    return;
  }
  if (event.code in movementKeys) {
    event.preventDefault();
    movementKeys[event.code] = true;
  }
});
window.addEventListener("keyup", (event) => {
  if (event.code in movementKeys) {
    event.preventDefault();
    movementKeys[event.code] = false;
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const selectBeanId = target.dataset.selectBean;
  if (selectBeanId) {
    state = { ...state, selectedBeanId: selectBeanId, lastAction: `Selected ${BEANS[selectBeanId].name}.` };
    render();
    return;
  }

  const buySeedId = target.dataset.buySeed;
  if (buySeedId) {
    setState(buySeeds(state, buySeedId, 1));
    return;
  }

  const upgradeId = target.dataset.buyUpgrade;
  if (upgradeId) {
    setState(buyUpgrade(state, upgradeId));
    return;
  }

  const parcelId = target.dataset.unlockParcel;
  if (parcelId) {
    setState(unlockParcel(state, parcelId));
    return;
  }

  const selectionAction = target.dataset.selectionAction;
  if (selectionAction) {
    performSelectedPlotAction(selectionAction);
  }
});

for (const button of timeButtons) {
  button.addEventListener("click", () => {
    setState(advanceTime(state, Number(button.dataset.advanceHours)));
  });
}

sellButton.addEventListener("click", () => {
  setState(sellBeans(state));
});

mineButton.addEventListener("click", () => {
  setState(performMining(state));
});

saveButton.addEventListener("click", saveState);
resetButton.addEventListener("click", resetState);
adminButton.addEventListener("click", () => {
  if (adminUnlocked) {
    adminUnlocked = false;
    window.localStorage.removeItem(ADMIN_KEY);
    state = {
      ...state,
      lastAction: "Admin credits disabled.",
    };
    syncAdminUi();
    render();
    return;
  }

  const code = window.prompt("Enter admin code");
  if (code !== ADMIN_CODE) {
    window.alert("Wrong admin code.");
    return;
  }

  adminUnlocked = true;
  window.localStorage.setItem(ADMIN_KEY, "1");
  state = applyAdminState({
    ...state,
    lastAction: "Admin credits enabled.",
  });
  syncAdminUi();
  render();
});
fullscreenButton.addEventListener("click", async () => {
  const viewportPanel = sceneShell.closest(".viewport-panel");
  if (!viewportPanel) return;

  if (document.fullscreenElement === viewportPanel) {
    await document.exitFullscreen();
  } else {
    await viewportPanel.requestFullscreen();
  }
});
document.addEventListener("fullscreenchange", () => {
  const viewportPanel = sceneShell.closest(".viewport-panel");
  fullscreenButton.textContent = document.fullscreenElement === viewportPanel ? "Exit Fullscreen" : "Fullscreen";
  resizeRenderer();
});
viewModeButton.addEventListener("click", () => {
  setViewMode(!firstPersonMode);
});

resizeRenderer();
render();
syncAdminUi();
syncViewModeUi();

const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  updatePlayerMovement(delta);
  worldGroup.rotation.y = Math.sin(elapsed * 0.15) * 0.025;
  playerGroup.position.copy(playerState.position);
  playerGroup.rotation.y = playerState.heading;
  const walkBob = playerState.moving && playerState.position.y <= FLOOR_HEIGHT + 0.001 ? Math.sin(elapsed * 10) * 0.08 : 0;
  playerBody.position.y = 1.4 + walkBob;
  if (playerState.position.y > FLOOR_HEIGHT + 0.02) {
    if (playerState.verticalVelocity > 0) {
      playerGroup.scale.set(0.92, 1.1, 0.92);
    } else {
      playerGroup.scale.set(1.08, 0.9, 1.08);
    }
  } else {
    const squash = playerState.landingTimer > 0 ? 1 + playerState.landingTimer * 0.25 : 1;
    playerGroup.scale.set(1 / squash, squash, 1 / squash);
  }

  if (playerState.landingTimer > 0 && !insideHouse && !firstPersonMode) {
    playerState.landingTimer = Math.max(0, playerState.landingTimer - delta);
    landingRing.visible = true;
    landingRing.position.set(playerState.position.x, 0.05, playerState.position.z);
    const pulse = 1 + (0.35 - playerState.landingTimer) * 4.2;
    landingRing.scale.setScalar(pulse);
    landingRingMaterial.opacity = playerState.landingTimer / 0.35;
  } else {
    landingRing.visible = false;
    landingRingMaterial.opacity = 0;
    if (playerState.landingTimer > 0) {
      playerState.landingTimer = Math.max(0, playerState.landingTimer - delta);
    }
  }

  if (firstPersonMode) {
    updateFirstPersonCamera();
  }

  updateReticle();

  for (const [plotId, mesh] of plotMeshes) {
    const plot = findPlotById(plotId);
    if (!plot) continue;

    if (plot.state === "ready") {
      mesh.position.y = 0.55 + Math.sin(elapsed * 2.4 + mesh.position.x) * 0.08;
    } else {
      mesh.position.y = 0.5;
    }
  }

  if (!firstPersonMode) {
    controls.update();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
