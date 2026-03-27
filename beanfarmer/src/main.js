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
  getUnlockedBeanIds,
  harvestPlot,
  performMining,
  plantBean,
  sellBeans,
  serializeState,
  unlockParcel,
  waterPlot,
} from "./gameLogic.js?v=20260325-3";

const STORAGE_KEY = "beanfarmer-save-v1";
const CAMERA_BOUNDS = {
  minX: -22,
  maxX: 24,
  minZ: -16,
  maxZ: 24,
};
const INTERIOR_CAMERA_BOUNDS = {
  minX: -4.5,
  maxX: 4.5,
  minZ: -5.5,
  maxZ: 5.5,
};
const PLAYER_BOUNDS = {
  minX: -18,
  maxX: 20,
  minZ: -12,
  maxZ: 20,
};
const INTERIOR_PLAYER_BOUNDS = {
  minX: -5.8,
  maxX: 5.8,
  minZ: -4.8,
  maxZ: 5.8,
};
const INTERACT_DISTANCE = 4.25;

const PLOT_LAYOUTS = {
  home: { originX: -8, originZ: -2, cols: 3, spacingX: 5.5, spacingZ: 5.5 },
  creek: { originX: 10, originZ: -2, cols: 2, spacingX: 5.5, spacingZ: 5.5 },
  ridge: { originX: -2.5, originZ: 12, cols: 3, spacingX: 5.5, spacingZ: 5.5 },
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
const saveButton = document.getElementById("save-button");
const resetButton = document.getElementById("reset-button");
const sellButton = document.getElementById("sell-button");
const mineButton = document.getElementById("mine-button");
const selectionText = document.getElementById("selection-text");
const selectionActions = document.getElementById("selection-actions");
const interiorCard = document.getElementById("interior-card");
const exitHouseButton = document.getElementById("exit-house-button");
const canvas = document.getElementById("farm-canvas");
const sceneShell = document.getElementById("scene-shell");
const timeButtons = [...document.querySelectorAll("[data-advance-hours]")];
const movementKeys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
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

let state = loadState();
let selectedPlotId = null;
let insideHouse = false;
let houseDoorMesh = null;
const interiorInteractiveMeshes = [];
const playerState = {
  position: new THREE.Vector3(-2, 0.85, 8),
  exteriorPosition: new THREE.Vector3(-2, 0.85, 8),
  heading: 0,
  moving: false,
};

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
  const offset = camera.position.clone().sub(controls.target);
  const bounds = insideHouse ? INTERIOR_CAMERA_BOUNDS : CAMERA_BOUNDS;
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, bounds.minX, bounds.maxX);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, bounds.minZ, bounds.maxZ);
  camera.position.copy(controls.target).add(offset);
}

function handleTrackpadPan(event) {
  event.preventDefault();

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
  playerState.exteriorPosition.copy(playerState.position);
  playerState.position.set(0, 0.85, 4.2);
  selectedPlotId = null;
  worldGroup.visible = false;
  interiorGroup.visible = true;
  controls.target.set(0, 0.8, 2.2);
  camera.position.set(0, 8.5, 11.5);
  controls.minDistance = 8;
  controls.maxDistance = 22;
  clampCameraToBounds();
  controls.update();
  interiorCard.classList.remove("hidden");
  actionValue.textContent = "Entered the farmhouse.";
  renderSelection();
}

function exitHouse() {
  insideHouse = false;
  worldGroup.visible = true;
  interiorGroup.visible = false;
  playerState.position.copy(playerState.exteriorPosition);
  controls.minDistance = 16;
  controls.maxDistance = 42;
  controls.target.set(playerState.position.x, 0.8, playerState.position.z - 2);
  camera.position.set(playerState.position.x - 2, 20, playerState.position.z + 16);
  clampCameraToBounds();
  controls.update();
  interiorCard.classList.add("hidden");
  actionValue.textContent = "Stepped back outside.";
}

function updatePlayerMovement(deltaSeconds) {
  const horizontal = (movementKeys.KeyD ? 1 : 0) - (movementKeys.KeyA ? 1 : 0);
  const vertical = (movementKeys.KeyW ? 1 : 0) - (movementKeys.KeyS ? 1 : 0);
  if (!horizontal && !vertical) {
    playerState.moving = false;
    return;
  }

  const moveScale = deltaSeconds * 9.5;
  const offset = camera.position.clone().sub(controls.target);
  const forward = controls.target.clone().sub(camera.position).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const movement = right.multiplyScalar(horizontal * moveScale).add(forward.multiplyScalar(vertical * moveScale));

  const desiredPosition = playerState.position.clone().add(movement);
  const resolvedPosition = resolvePlayerCollision(desiredPosition, insideHouse);
  const actualMovement = resolvedPosition.clone().sub(playerState.position);

  if (actualMovement.lengthSq() <= 0.0001) {
    playerState.moving = false;
    return;
  }

  playerState.position.copy(resolvedPosition);
  playerState.heading = Math.atan2(actualMovement.x, actualMovement.z);
  playerState.moving = true;
  camera.position.add(actualMovement);
  controls.target.add(actualMovement);
  clampCameraToBounds();
  controls.update();
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const plotMeshes = new Map();
const worldColliders = [];
const interiorColliders = [];

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const actorGroup = new THREE.Group();
scene.add(actorGroup);

const interiorGroup = new THREE.Group();
interiorGroup.visible = false;
scene.add(interiorGroup);

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

const playerPack = new THREE.Mesh(
  new THREE.BoxGeometry(0.75, 0.9, 0.4),
  new THREE.MeshStandardMaterial({ color: 0x6f57d9, roughness: 0.7 })
);
playerPack.position.set(0, 1.5, -0.5);
playerPack.castShadow = true;
playerGroup.add(playerPack);

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

table.userData.kind = "upgradeTable";
bed.userData.kind = "bed";
interiorInteractiveMeshes.push(table, bed, notesBoard);

function setState(nextState) {
  state = nextState;
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
  creditsValue.textContent = `${state.credits}`;
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
  landActions.innerHTML = PARCELS.filter((parcel) => parcel.unlockCost > 0)
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
      return `
        <article class="stack-item">
          <strong>${upgrade.name}</strong>
          <span>${upgrade.description}</span>
          <span>${owned ? "Owned" : `${upgrade.cost} credits`}</span>
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
    return insideHouse ? "You are inside the farmhouse." : "Choose a plot in the 3D field.";
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
    selectionText.textContent = "Inside the farmhouse. Click the bed to save, the wall board to open the Bean Index, or the round worktable to buy upgrades.";
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
  farmView.innerHTML = state.parcels
    .map((parcel) => {
      const definition = PARCELS.find((entry) => entry.id === parcel.id);
      const readyCount = parcel.plots.filter((plot) => plot.state === "ready").length;
      const plantedCount = parcel.plots.filter((plot) => plot.state === "planted").length;
      return `
        <article class="parcel-summary ${parcel.unlocked ? "" : "locked"}">
          <strong>${definition.name}</strong>
          <span>${parcel.unlocked ? `${plantedCount} growing · ${readyCount} ready · soil x${definition.soilBonus.toFixed(2)}` : `Locked · ${definition.unlockCost} credits`}</span>
        </article>
      `;
    })
    .join("");
}

function beanColor(beanId) {
  if (beanId === "green") return 0x76b84f;
  if (beanId === "wax") return 0xe2c15c;
  if (beanId === "scarlet") return 0xc74339;
  if (beanId === "starlight") return 0x7c68f0;
  return 0x6aa54a;
}

function createCropVisual(plot) {
  const bean = BEANS[plot.beanId];
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, plot.state === "ready" ? 2.2 : 1.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x4f8b2a, roughness: 0.8 })
  );
  stem.position.y = plot.state === "ready" ? 1.1 : 0.75;
  stem.castShadow = true;
  group.add(stem);

  const leafMaterial = new THREE.MeshStandardMaterial({
    color: beanColor(plot.beanId),
    roughness: 0.7,
  });

  const leafScale = plot.state === "ready" ? 1.2 : 0.8;
  for (const offset of [
    [-0.55, 1.1, 0.25],
    [0.45, 1.35, -0.18],
    [0.12, 0.95, 0.52],
  ]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.42 * leafScale, 14, 14), leafMaterial);
    leaf.position.set(offset[0], offset[1], offset[2]);
    leaf.scale.set(1.25, 0.7, 0.9);
    leaf.castShadow = true;
    group.add(leaf);
  }

  if (plot.state === "ready") {
    const podMaterial = new THREE.MeshStandardMaterial({
      color: bean.rarity === "Special" ? 0x8f7fff : bean.rarity === "Rare" ? 0xda5841 : 0xe2d56b,
      roughness: 0.45,
      metalness: bean.rarity === "Special" ? 0.2 : 0.05,
      emissive: bean.rarity === "Special" ? 0x29145b : 0x000000,
      emissiveIntensity: bean.rarity === "Special" ? 0.55 : 0,
    });
    for (const offset of [
      [-0.45, 1.5, 0],
      [0.18, 1.68, -0.26],
      [0.42, 1.22, 0.22],
    ]) {
      const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 4, 10), podMaterial);
      pod.position.set(offset[0], offset[1], offset[2]);
      pod.rotation.z = Math.PI / 2.8;
      pod.castShadow = true;
      group.add(pod);
    }
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

function resolvePlayerCollision(nextPosition, useInterior = false) {
  const resolved = nextPosition.clone();
  const bounds = useInterior ? INTERIOR_PLAYER_BOUNDS : PLAYER_BOUNDS;
  const colliders = useInterior ? interiorColliders : worldColliders;

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
  worldGroup.clear();
  houseDoorMesh = null;

  for (const parcel of state.parcels) {
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
      addCircleCollider(mesh.position.x, mesh.position.z, 2.45);
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
  worldGroup.add(pond);
  addCircleCollider(pond.position.x, pond.position.z, 4.9);

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

function focusPanel(panel) {
  panel?.scrollIntoView({ behavior: "smooth", block: "center" });
  panel?.classList.add("panel-flash");
  window.setTimeout(() => panel?.classList.remove("panel-flash"), 1200);
}

function handleInteriorInteraction(kind) {
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
    const candidate = Object.values(UPGRADES).find((upgrade) => !state.upgrades.includes(upgrade.id) && state.credits >= upgrade.cost);
    if (candidate) {
      setState(buyUpgrade(state, candidate.id));
      focusPanel(upgradePanel);
      return;
    }
    focusPanel(upgradePanel);
    actionValue.textContent = "No affordable upgrades right now. Check the upgrade board.";
  }
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
  const height = Math.max(620, Math.round(sceneShell.clientWidth * 0.56));
  canvas.style.height = `${height}px`;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function handleCanvasPick(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const candidates = insideHouse
    ? interiorInteractiveMeshes
    : houseDoorMesh
    ? [...plotMeshes.values(), houseDoorMesh]
    : [...plotMeshes.values()];
  const hits = raycaster.intersectObjects(candidates, true);
  if (hits.length === 0) {
    return;
  }

  if (insideHouse) {
    const interiorHit = hits.find((hit) => hit.object.userData.kind);
    const kind = interiorHit?.object.userData.kind;
    if (!kind) return;
    const worldPosition = new THREE.Vector3();
    interiorHit.object.getWorldPosition(worldPosition);
    if (worldPosition.distanceTo(playerState.position) > INTERACT_DISTANCE) {
      actionValue.textContent = "Move closer to use that furniture.";
      return;
    }
    handleInteriorInteraction(kind);
    return;
  }

  const doorHit = hits.find((hit) => hit.object.userData.kind === "houseDoor");
  if (doorHit) {
    const worldPosition = new THREE.Vector3();
    doorHit.object.getWorldPosition(worldPosition);
    if (worldPosition.distanceTo(playerState.position) > INTERACT_DISTANCE) {
      actionValue.textContent = "Walk closer to the house door.";
      return;
    }
    enterHouse();
    return;
  }

  const plotHit = hits.find((hit) => hit.object.userData.plotId);
  const plotId = plotHit?.object.userData.plotId;
  if (!plotId) {
    return;
  }

  selectedPlotId = plotId;
  render();
}

canvas.addEventListener("pointerdown", handleCanvasPick);
canvas.addEventListener("wheel", handleTrackpadPan, { passive: false });
window.addEventListener("resize", resizeRenderer);
window.addEventListener("keydown", (event) => {
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
exitHouseButton.addEventListener("click", exitHouse);

resizeRenderer();
render();

const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  updatePlayerMovement(delta);
  worldGroup.rotation.y = Math.sin(elapsed * 0.15) * 0.025;
  playerGroup.position.copy(playerState.position);
  playerGroup.rotation.y = playerState.heading;
  playerBody.position.y = 1.4 + (playerState.moving ? Math.sin(elapsed * 10) * 0.08 : 0);

  for (const [plotId, mesh] of plotMeshes) {
    const plot = findPlotById(plotId);
    if (!plot) continue;

    if (plot.state === "ready") {
      mesh.position.y = 0.55 + Math.sin(elapsed * 2.4 + mesh.position.x) * 0.08;
    } else {
      mesh.position.y = 0.5;
    }
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
