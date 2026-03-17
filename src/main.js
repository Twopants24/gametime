import { ATTACKS, DIFFICULTY, STAGE, createInitialState, stepState } from "./gameLogic.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-button");
const speedDial = document.getElementById("speed-dial");
const speedValue = document.getElementById("speed-value");
const cpuDifficultyDial = document.getElementById("cpu-difficulty");
const cpuDifficultyValue = document.getElementById("cpu-difficulty-value");
const avatarSelect = document.getElementById("avatar-select");
const trainingModeToggle = document.getElementById("training-mode");
const stageCanvas = document.createElement("canvas");
const stageCtx = stageCanvas.getContext("2d");

stageCanvas.width = canvas.width;
stageCanvas.height = canvas.height;

const hud = {
  p1Damage: document.getElementById("p1-damage"),
  p1Stocks: document.getElementById("p1-stocks"),
  p1Charge: document.getElementById("p1-charge"),
  p2Damage: document.getElementById("p2-damage"),
  p2Stocks: document.getElementById("p2-stocks"),
};

let state = createInitialState();
let speedMultiplier = Number(speedDial.value);
let cpuDifficulty = Number(cpuDifficultyDial.value);
let playerAvatar = avatarSelect.value;
let trainingMode = trainingModeToggle.checked;
let speedAccumulator = 0;
let chargeStartedAt = null;
let chargeReady = false;
let blastStartedAt = null;
let blastReady = false;
let cameraEffect = null;
const CHARGE_TIME_MS = 1000;
const BLAST_CHARGE_TIME_MS = 100;
const CHARGE_CAMERA_HOLD_MS = 500;
const CHARGE_CAMERA_RELEASE_MS = 120;
let lastHud = {
  p1Damage: null,
  p1Stocks: null,
  p1Charge: null,
  p2Damage: null,
  p2Stocks: null,
};

speedValue.textContent = `${speedMultiplier.toFixed(2)}x`;
cpuDifficultyValue.textContent = `${cpuDifficulty.toFixed(2)}x`;

const input = {
  left: false,
  right: false,
  arrowLeft: false,
  arrowRight: false,
  arrowUp: false,
  arrowDown: false,
  specialHeld: false,
  specialNeutralPending: false,
  jumpQueued: false,
  jabQueued: false,
  smashQueued: false,
  shotQueued: false,
  chargeQueued: false,
  blastQueued: false,
  specialQueued: null,
  specialFace: null,
  lastSpecialHorizontal: null,
};

function queueDirectionalSpecial() {
  if (!input.specialHeld) return;

  if (input.arrowUp) {
    input.specialQueued = "upSpecial";
    input.specialNeutralPending = false;
    return;
  }

  if (input.arrowDown) {
    input.specialQueued = "blast";
    input.specialNeutralPending = false;
    return;
  }

  if (input.arrowLeft || input.arrowRight) {
    input.specialFace = input.lastSpecialHorizontal ?? (input.arrowLeft ? -1 : 1);
    input.specialQueued = "sideSpecial";
    input.specialNeutralPending = false;
    return;
  }

  input.specialQueued = "shot";
}

function setOverlay(title, message, buttonText) {
  overlay.querySelector("h2").textContent = title;
  overlayMessage.textContent = message;
  startButton.textContent = buttonText;
}

function updateHud() {
  const [p1, p2] = state.fighters;
  const nextHud = {
    p1Damage: `${Math.round(p1.damage)}%`,
    p1Stocks: String(p1.stocks),
    p1Charge: chargeReady ? "CHARGED" : chargeStartedAt !== null ? "Charging" : "Building",
    p2Damage: `${Math.round(p2.damage)}%`,
    p2Stocks: String(p2.stocks),
  };

  if (nextHud.p1Damage !== lastHud.p1Damage) hud.p1Damage.textContent = nextHud.p1Damage;
  if (nextHud.p1Stocks !== lastHud.p1Stocks) hud.p1Stocks.textContent = nextHud.p1Stocks;
  if (nextHud.p1Charge !== lastHud.p1Charge) hud.p1Charge.textContent = nextHud.p1Charge;
  if (nextHud.p2Damage !== lastHud.p2Damage) hud.p2Damage.textContent = nextHud.p2Damage;
  if (nextHud.p2Stocks !== lastHud.p2Stocks) hud.p2Stocks.textContent = nextHud.p2Stocks;
  lastHud = nextHud;
}

function resetMatch() {
  state = createInitialState();
  speedAccumulator = 0;
  chargeStartedAt = null;
  chargeReady = false;
  blastStartedAt = null;
  blastReady = false;
  cameraEffect = null;
  overlay.classList.remove("hidden");
  setOverlay("Enter The Arena", "A/D move, W jump, Space jab, S smash, Shift Charge Shot, E specials: Pulse Shot, Nova Rush, Skybreak, Burst Field. R full reset.", "Start Match");
  updateHud();
}

function startMatch() {
  if (state.winner) {
    state = createInitialState();
  }
  speedAccumulator = 0;
  chargeStartedAt = null;
  chargeReady = false;
  blastStartedAt = null;
  blastReady = false;
  cameraEffect = null;
  state.running = true;
  state.winner = null;
  overlay.classList.add("hidden");
}

function freezeTrainingDummy() {
  const dummy = state.fighters[1];
  if (!dummy) return;

  state.fighters[1] = {
    ...dummy,
    x: dummy.spawnX,
    y: dummy.spawnY,
    vx: 0,
    vy: 0,
    grounded: false,
    hitstun: 0,
    attack: null,
    attackCooldown: 0,
    cpuCooldown: 0,
  };
}

function getPlayerInput() {
  let attack = null;
  if (input.jabQueued) attack = "jab";
  if (input.shotQueued) attack = "shot";
  if (input.smashQueued) attack = "smash";
  if (input.chargeQueued) {
    attack = "charge";
    chargeReady = false;
  }
  if (input.blastQueued) {
    attack = "blast";
    blastReady = false;
  }
  if (input.specialQueued) attack = input.specialQueued;

  const next = {
    left: input.left,
    right: input.right,
    jump: input.jumpQueued,
    attack,
    specialFace: input.specialFace,
  };

  input.jumpQueued = false;
  input.jabQueued = false;
  input.shotQueued = false;
  input.smashQueued = false;
  input.chargeQueued = false;
  input.blastQueued = false;
  input.specialQueued = null;
  input.specialFace = null;
  return next;
}

function getStageAnchor(target) {
  const targetCenterX = target.x + target.width / 2;
  const supportPlatform = STAGE.platforms.find(
    (platform) =>
      targetCenterX >= platform.x &&
      targetCenterX <= platform.x + platform.width &&
      target.y + target.height <= platform.y + 28
  );

  if (supportPlatform) {
    return {
      x: Math.min(
        supportPlatform.x + supportPlatform.width - 28,
        Math.max(supportPlatform.x + 28, targetCenterX)
      ),
      y: supportPlatform.y,
    };
  }

  return {
    x: Math.min(STAGE.width - 70, Math.max(70, targetCenterX)),
    y: STAGE.platforms[0].y,
  };
}

function getCpuInput(cpu, target) {
  const cpuCenterX = cpu.x + cpu.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const anchor = getStageAnchor(target);
  const anchorDeltaX = anchor.x - cpuCenterX;
  const deltaX = targetCenterX - cpuCenterX;
  const deltaY = target.y - cpu.y;
  const horizontalAttackWindow = 52 + cpuDifficulty * 36;
  const verticalAttackWindow = 24 + cpuDifficulty * 18;
  const shouldAttack =
    Math.abs(deltaX) < horizontalAttackWindow &&
    Math.abs(deltaY) < verticalAttackWindow &&
    !cpu.attack &&
    cpu.attackCooldown <= 0;
  const offstage = cpuCenterX < 80 || cpuCenterX > STAGE.width - 80 || cpu.y > STAGE.height - 10;
  const recovering = offstage || cpu.y > 540;
  const driftThreshold = Math.max(8, 52 - cpuDifficulty * 18);
  const recoverThreshold = Math.max(6, 18 - cpuDifficulty * 4);
  const attackType =
    cpuDifficulty > 1.35
      ? (cpu.damage > 70 ? "smash" : "shot")
      : cpuDifficulty > 0.9
      ? (cpu.damage > 90 ? "smash" : "jab")
      : "jab";
  const edgeBuffer = 64;
  const tooCloseToLeftEdge = cpuCenterX < edgeBuffer;
  const tooCloseToRightEdge = cpuCenterX > STAGE.width - edgeBuffer;
  const forcedInwardLeft = tooCloseToLeftEdge && targetCenterX > cpuCenterX;
  const forcedInwardRight = tooCloseToRightEdge && targetCenterX < cpuCenterX;
  const pathDeltaX = recovering ? anchorDeltaX : Math.abs(deltaX) > 120 ? anchorDeltaX : deltaX;
  const wantsJumpToPlatform =
    !recovering &&
    cpu.grounded &&
    target.y + target.height < cpu.y - 34 &&
    Math.abs(anchorDeltaX) < 58 &&
    Math.abs(deltaX) < 92;
  const wantsVerticalChase =
    !recovering &&
    !cpu.grounded &&
    target.y + target.height < cpu.y - 42 &&
    Math.abs(deltaX) < 54;
  const wantsRecoveryJump =
    recovering &&
    (cpu.y > anchor.y - 30 || Math.abs(anchorDeltaX) > 22);
  const safeLeft = forcedInwardRight ? true : pathDeltaX < -(recovering ? recoverThreshold : driftThreshold);
  const safeRight = forcedInwardLeft ? true : pathDeltaX > (recovering ? recoverThreshold : driftThreshold);

  return {
    left: safeLeft && !forcedInwardLeft,
    right: safeRight && !forcedInwardRight,
    jump:
      (wantsRecoveryJump || wantsJumpToPlatform || wantsVerticalChase || cpu.y > 600) &&
      cpu.jumpsLeft > 0 &&
      cpu.hitstun === 0,
    attack: shouldAttack && cpu.cpuCooldown === 0 ? attackType : null,
  };
}

function drawBackground(targetCtx) {
  targetCtx.fillStyle = "#93c5fd";
  targetCtx.beginPath();
  targetCtx.arc(810, 90, 62, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = "rgba(255,255,255,0.18)";
  for (const [x, y, r] of [
    [135, 90, 68],
    [315, 120, 54],
    [585, 72, 84],
  ]) {
    targetCtx.beginPath();
    targetCtx.arc(x, y, r, 0, Math.PI * 2);
    targetCtx.fill();
  }
}

function drawPlatforms(targetCtx) {
  for (const [index, platform] of STAGE.platforms.entries()) {
    if (platform.solid) {
      targetCtx.fillStyle = "#64748b";
      targetCtx.beginPath();
      targetCtx.roundRect(platform.x, platform.y + 12, platform.width, platform.height - 12, 12);
      targetCtx.fill();

      const capGradient = targetCtx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.topInset);
      capGradient.addColorStop(0, "#f8fafc");
      capGradient.addColorStop(1, "#cbd5e1");
      targetCtx.fillStyle = capGradient;
      targetCtx.beginPath();
      targetCtx.roundRect(platform.x, platform.y, platform.width, platform.topInset, 12);
      targetCtx.fill();
    } else {
      const gradient = targetCtx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.height);
      gradient.addColorStop(0, "#bae6fd");
      gradient.addColorStop(1, "#7dd3fc");
      targetCtx.fillStyle = gradient;
      targetCtx.beginPath();
      targetCtx.roundRect(platform.x, platform.y, platform.width, platform.height, 12);
      targetCtx.fill();
    }
  }
}

function renderStaticStage() {
  stageCtx.clearRect(0, 0, stageCanvas.width, stageCanvas.height);
  drawBackground(stageCtx);
  drawPlatforms(stageCtx);
}

function drawAttack(fighter) {
  if (!fighter.attack) return;

  try {
    const attackData = ATTACKS[fighter.attack.type];
    if (!attackData) return;
    const activeStart = attackData.startup;
    const activeEnd = attackData.startup + attackData.active;
    if (fighter.attack.frame < activeStart || fighter.attack.frame > activeEnd) return;

    const armBaseX = fighter.x + fighter.width / 2 + fighter.face * 18;
    const armBaseY = fighter.y + fighter.height / 2 - 4;
    const armLength =
      fighter.attack.type === "charge"
        ? 62
        : fighter.attack.type === "sideSpecial"
        ? 54
        : fighter.attack.type === "smash"
        ? 48
        : fighter.attack.type === "shot"
        ? 34
        : fighter.attack.type === "upSpecial" || fighter.attack.type === "blast"
        ? 0
        : 30;
    const fistRadius =
      fighter.attack.type === "charge"
        ? 20
        : fighter.attack.type === "sideSpecial"
        ? 14
        : fighter.attack.type === "smash"
        ? 17
        : fighter.attack.type === "shot"
        ? 10
        : fighter.attack.type === "upSpecial" || fighter.attack.type === "blast"
        ? 0
        : 11;
    const fistX = armBaseX + fighter.face * armLength;
    const fistY = armBaseY;

    if (fighter.attack.type !== "blast" && fighter.attack.type !== "upSpecial") {
      ctx.strokeStyle =
        fighter.attack.type === "charge"
          ? "#67e8f9"
          : fighter.attack.type === "sideSpecial"
          ? "#38bdf8"
          : fighter.attack.type === "smash"
          ? "#fb923c"
          : fighter.accent;
      ctx.lineWidth = fighter.attack.type === "charge" ? 14 : fighter.attack.type === "sideSpecial" ? 11 : fighter.attack.type === "smash" ? 12 : 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(armBaseX, armBaseY);
      ctx.lineTo(fistX, fistY);
      ctx.stroke();
    }

    if (fighter.attack.type === "sideSpecial") {
    const streakX = fistX + fighter.face * 86;
    const flare = ctx.createLinearGradient(fistX, fistY, streakX, fistY);
    flare.addColorStop(0, "rgba(224, 242, 254, 0.95)");
    flare.addColorStop(0.32, "rgba(56, 189, 248, 0.95)");
    flare.addColorStop(1, "rgba(2, 132, 199, 0)");
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.moveTo(fistX - fighter.face * 6, fistY - 18);
    ctx.quadraticCurveTo(streakX - fighter.face * 22, fistY - 24, streakX, fistY - 5);
    ctx.quadraticCurveTo(streakX + fighter.face * 16, fistY, streakX, fistY + 5);
    ctx.quadraticCurveTo(streakX - fighter.face * 22, fistY + 24, fistX - fighter.face * 6, fistY + 18);
    ctx.closePath();
    ctx.fill();
    } else if (fighter.attack.type === "charge") {
    const time = performance.now();
    const pulse = 0.92 + Math.sin(time / 90) * 0.08;
    const wave = Math.sin(time / 65) * 6;
    const length = 138 + Math.sin(time / 110) * 8;
    const tipX = fistX + fighter.face * length;
    const bodyWidth = 22 * pulse;
    const shellWidth = 40 + Math.sin(time / 80) * 4;

    const shellGradient = ctx.createLinearGradient(fistX, fistY, tipX, fistY);
    shellGradient.addColorStop(0, "rgba(224, 242, 254, 0.9)");
    shellGradient.addColorStop(0.25, "rgba(125, 211, 252, 0.95)");
    shellGradient.addColorStop(0.7, "rgba(37, 99, 235, 0.82)");
    shellGradient.addColorStop(1, "rgba(30, 64, 175, 0)");
    ctx.fillStyle = shellGradient;
    ctx.beginPath();
    ctx.moveTo(fistX - fighter.face * 4, fistY - shellWidth * 0.55);
    ctx.quadraticCurveTo(
      fistX + fighter.face * 42,
      fistY - shellWidth - wave,
      tipX,
      fistY - 7
    );
    ctx.quadraticCurveTo(
      tipX + fighter.face * 22,
      fistY,
      tipX,
      fistY + 7
    );
    ctx.quadraticCurveTo(
      fistX + fighter.face * 42,
      fistY + shellWidth + wave,
      fistX - fighter.face * 4,
      fistY + shellWidth * 0.55
    );
    ctx.closePath();
    ctx.fill();

    const coreGradient = ctx.createLinearGradient(fistX, fistY, tipX, fistY);
    coreGradient.addColorStop(0, "rgba(255,255,255,1)");
    coreGradient.addColorStop(0.22, "rgba(191, 219, 254, 0.98)");
    coreGradient.addColorStop(0.6, "rgba(96, 165, 250, 0.94)");
    coreGradient.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.moveTo(fistX, fistY - bodyWidth);
    ctx.quadraticCurveTo(
      fistX + fighter.face * 34,
      fistY - bodyWidth * 0.95 - wave * 0.55,
      tipX,
      fistY - 5
    );
    ctx.quadraticCurveTo(
      tipX + fighter.face * 14,
      fistY,
      tipX,
      fistY + 5
    );
    ctx.quadraticCurveTo(
      fistX + fighter.face * 34,
      fistY + bodyWidth * 0.95 + wave * 0.55,
      fistX,
      fistY + bodyWidth
    );
    ctx.closePath();
    ctx.fill();

    const tipGlow = ctx.createRadialGradient(tipX, fistY, 6, tipX, fistY, 30 * pulse);
    tipGlow.addColorStop(0, "rgba(255,255,255,1)");
    tipGlow.addColorStop(0.3, "rgba(186, 230, 253, 0.98)");
    tipGlow.addColorStop(0.68, "rgba(56, 189, 248, 0.9)");
    tipGlow.addColorStop(1, "rgba(37, 99, 235, 0)");
    ctx.fillStyle = tipGlow;
    ctx.beginPath();
    ctx.arc(tipX, fistY, 30 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.beginPath();
    ctx.ellipse(tipX, fistY, 12 * pulse, 9 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();

    const muzzleGlow = ctx.createRadialGradient(fistX, fistY, 4, fistX, fistY, 28);
    muzzleGlow.addColorStop(0, "rgba(255,255,255,1)");
    muzzleGlow.addColorStop(0.4, "rgba(147, 197, 253, 0.95)");
    muzzleGlow.addColorStop(1, "rgba(37, 99, 235, 0)");
    ctx.fillStyle = muzzleGlow;
    ctx.beginPath();
    ctx.arc(fistX, fistY, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(fistX + fighter.face * 10, fistY - 10);
    ctx.quadraticCurveTo(
      fistX + fighter.face * 62,
      fistY - 16 - wave * 0.45,
      tipX - fighter.face * 8,
      fistY - 3
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(fistX + fighter.face * 10, fistY + 10);
    ctx.quadraticCurveTo(
      fistX + fighter.face * 62,
      fistY + 16 + wave * 0.45,
      tipX - fighter.face * 8,
      fistY + 3
    );
    ctx.stroke();

    for (let i = 0; i < 3; i += 1) {
      const sparkX = fistX + fighter.face * (28 + i * 26 + ((time / 10) % 18));
      const sparkY = fistY + Math.sin(time / 70 + i * 1.7) * (8 + i * 3);
      ctx.fillStyle = `rgba(191, 219, 254, ${0.55 - i * 0.12})`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 3 - i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    } else if (fighter.attack.type === "shot") {
    const muzzleX = fistX + fighter.face * 10;
    const shotGradient = ctx.createRadialGradient(muzzleX, fistY, 3, muzzleX, fistY, 34);
    shotGradient.addColorStop(0, "rgba(255,255,255,0.98)");
    shotGradient.addColorStop(0.35, "rgba(167, 243, 208, 0.96)");
    shotGradient.addColorStop(0.75, "rgba(16, 185, 129, 0.7)");
    shotGradient.addColorStop(1, "rgba(16, 185, 129, 0)");
    ctx.fillStyle = shotGradient;
    ctx.beginPath();
    ctx.arc(muzzleX, fistY, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(220, 252, 231, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(muzzleX - fighter.face * 10, fistY);
    ctx.lineTo(muzzleX + fighter.face * 24, fistY);
    ctx.stroke();
    } else if (fighter.attack.type === "blast") {
    const centerX = fighter.x + fighter.width / 2;
    const centerY = fighter.y + fighter.height / 2;
    const time = performance.now();
    const pulse = 1 + Math.sin(time / 45) * 0.08;
    const outerRadius = 360 * pulse;
    const innerRadius = 170 * pulse;
    const blastGradient = ctx.createRadialGradient(centerX, centerY, 8, centerX, centerY, outerRadius);
    blastGradient.addColorStop(0, "rgba(255,255,255,0.98)");
    blastGradient.addColorStop(0.18, "rgba(254, 215, 170, 0.98)");
    blastGradient.addColorStop(0.48, "rgba(251, 146, 60, 0.9)");
    blastGradient.addColorStop(0.8, "rgba(239, 68, 68, 0.62)");
    blastGradient.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = blastGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 247, 237, 0.9)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius * 1.06, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    } else if (fighter.attack.type === "upSpecial") {
    const centerX = fighter.x + fighter.width / 2;
    const centerY = fighter.y + fighter.height / 2 - 20;
    const time = performance.now();
    ctx.strokeStyle = "rgba(125, 211, 252, 0.95)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(centerX - 14, centerY + 34);
    ctx.quadraticCurveTo(centerX - 30, centerY - 6, centerX - 6, centerY - 52);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX + 14, centerY + 34);
    ctx.quadraticCurveTo(centerX + 30, centerY - 6, centerX + 6, centerY - 52);
    ctx.stroke();

    ctx.strokeStyle = "rgba(224, 242, 254, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 12, 22 + Math.sin(time / 55) * 3, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    } else if (fighter.attack.type === "smash") {
    const flameGradient = ctx.createRadialGradient(fistX, fistY, 4, fistX, fistY, 30);
    flameGradient.addColorStop(0, "rgba(255, 245, 157, 0.95)");
    flameGradient.addColorStop(0.45, "rgba(251, 146, 60, 0.85)");
    flameGradient.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = flameGradient;
    ctx.beginPath();
    ctx.arc(fistX, fistY, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.moveTo(fistX + fighter.face * 26, fistY);
    ctx.lineTo(fistX + fighter.face * 10, fistY - 13);
    ctx.lineTo(fistX + fighter.face * 8, fistY + 13);
    ctx.closePath();
    ctx.fill();
  }

    if (fighter.attack.type !== "blast" && fighter.attack.type !== "upSpecial") {
      ctx.fillStyle = fighter.attack.type === "charge" ? "#e0f2fe" : fighter.attack.type === "smash" ? "#fff7ed" : fighter.attack.type === "shot" ? "#dcfce7" : "#f8fafc";
      ctx.beginPath();
      ctx.arc(fistX, fistY, fistRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
      ctx.beginPath();
      ctx.arc(fistX + fighter.face * 3, fistY + 2, Math.max(5, fistRadius - 4), 0, Math.PI * 2);
      ctx.fill();
    }
  } catch (error) {
    console.error("drawAttack failed", error);
  }
}

function drawChargingEffect(fighter) {
  if (fighter.name !== "Nova" || state.running === false) return;

  if (blastStartedAt !== null || blastReady) {
    const elapsed = blastReady
      ? BLAST_CHARGE_TIME_MS
      : Math.min(BLAST_CHARGE_TIME_MS, performance.now() - blastStartedAt);
    const charge = elapsed / BLAST_CHARGE_TIME_MS;
    const centerX = fighter.x + fighter.width / 2;
    const centerY = fighter.y + fighter.height / 2;
    const radius = 32 + charge * 44;
    const pulse = 1 + Math.sin(performance.now() / 40) * 0.08;
    const glow = ctx.createRadialGradient(centerX, centerY, 8, centerX, centerY, radius * 1.02);
    glow.addColorStop(0, `rgba(255,255,255,${0.12 + charge * 0.18})`);
    glow.addColorStop(0.28, `rgba(254, 215, 170, ${0.18 + charge * 0.38})`);
    glow.addColorStop(0.65, `rgba(251, 146, 60, ${0.14 + charge * 0.4})`);
    glow.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.02 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(251, 146, 60, ${0.55 + charge * 0.34})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 247, 237, ${0.45 + charge * 0.36})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i += 1) {
      const angle = performance.now() / 160 + (Math.PI * 2 * i) / 10;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * (radius - 10), centerY + Math.sin(angle) * (radius - 10));
      ctx.lineTo(centerX + Math.cos(angle) * (radius + 14), centerY + Math.sin(angle) * (radius + 14));
      ctx.stroke();
    }

    if (blastReady) {
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 18 + Math.sin(performance.now() / 36) * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (!chargeReady && chargeStartedAt === null) return;

  const elapsed = chargeReady ? CHARGE_TIME_MS : Math.min(CHARGE_TIME_MS, performance.now() - chargeStartedAt);
  const charge = elapsed / CHARGE_TIME_MS;
  const centerX = fighter.x + fighter.width / 2;
  const centerY = fighter.y + fighter.height / 2;
  const auraRadius = 34 + charge * 34;
  const pulse = 0.92 + Math.sin(performance.now() / 55) * 0.14;
  const fullyCharged = chargeReady || charge > 0.96;
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    6,
    centerX,
    centerY,
    auraRadius
  );
  gradient.addColorStop(0, `rgba(255,255,255,${0.24 + charge * 0.28})`);
  gradient.addColorStop(0.25, `rgba(186, 230, 253, ${0.2 + charge * 0.4})`);
  gradient.addColorStop(0.5, `rgba(103, 232, 249, ${0.24 + charge * 0.48})`);
  gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, auraRadius * pulse, 0, Math.PI * 2);
  ctx.fill();

  for (let ring = 0; ring < 2; ring += 1) {
    ctx.strokeStyle = `rgba(186, 230, 253, ${0.28 + charge * 0.48 - ring * 0.1})`;
    ctx.lineWidth = 2 + charge * 2.5 - ring * 0.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, (auraRadius + 6 + ring * 10) * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  const sparkCount = 6 + Math.floor(charge * 8);
  ctx.strokeStyle = `rgba(255,255,255,${0.35 + charge * 0.5})`;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < sparkCount; i += 1) {
    const angle = performance.now() / 260 + (Math.PI * 2 * i) / sparkCount;
    const inner = auraRadius * 0.78;
    const outer = auraRadius + 10 + charge * 12;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
    ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
    ctx.stroke();
  }

  if (fullyCharged) {
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, auraRadius + 20 + Math.sin(performance.now() / 40) * 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, auraRadius * 1.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMasterHand(fighter) {
  ctx.save();
  ctx.scale(fighter.face, 1);

  ctx.fillStyle = "rgba(15, 23, 42, 0.2)";
  ctx.beginPath();
  ctx.ellipse(1, 34, 28, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  const gloveGradient = ctx.createLinearGradient(-34, -52, 28, 64);
  gloveGradient.addColorStop(0, "#ffffff");
  gloveGradient.addColorStop(0.5, "#f3f6fb");
  gloveGradient.addColorStop(1, "#d8dee8");

  const drawFinger = (x, y, width, height, radius, rotation) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = gloveGradient;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, radius);
    ctx.fill();

    ctx.fillStyle = "rgba(148, 163, 184, 0.22)";
    ctx.beginPath();
    ctx.roundRect(-width * 0.18, -height * 0.36, width * 0.22, height * 0.58, Math.max(3, radius * 0.55));
    ctx.fill();
    ctx.restore();
  };

  drawFinger(-11, 7, 16, 44, 7, -0.58);
  drawFinger(-1, -12, 13, 58, 6, -0.1);
  drawFinger(12, -17, 12, 66, 6, 0.04);
  drawFinger(25, -10, 11, 57, 6, 0.12);
  drawFinger(37, 5, 10, 39, 5, 0.2);

  ctx.fillStyle = gloveGradient;
  ctx.beginPath();
  ctx.moveTo(-15, 8);
  ctx.bezierCurveTo(-15, -1, -8, -10, 3, -11);
  ctx.bezierCurveTo(15, -11, 23, -4, 26, 9);
  ctx.bezierCurveTo(28, 24, 21, 34, 9, 37);
  ctx.bezierCurveTo(-1, 39, -11, 36, -16, 25);
  ctx.bezierCurveTo(-19, 18, -19, 12, -15, 8);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-15, 33);
  ctx.bezierCurveTo(-10, 21, -8, 12, -5, 9);
  ctx.bezierCurveTo(1, 18, 6, 30, 7, 42);
  ctx.bezierCurveTo(0, 48, -10, 45, -15, 33);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(148, 163, 184, 0.24)";
  ctx.beginPath();
  ctx.moveTo(-8, 9);
  ctx.bezierCurveTo(-4, 4, 2, 2, 9, 4);
  ctx.bezierCurveTo(15, 7, 17, 15, 15, 22);
  ctx.bezierCurveTo(8, 22, 1, 21, -6, 19);
  ctx.bezierCurveTo(-9, 16, -10, 12, -8, 9);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(148, 163, 184, 0.54)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (const [startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY] of [
    [-4, -7, -3, -18, -2, -29, 0, -39],
    [9, -8, 10, -23, 12, -35, 13, -48],
    [21, -3, 23, -16, 25, -27, 27, -39],
    [32, 10, 36, 9, 41, 10, 45, 12],
  ]) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-10, 10);
  ctx.bezierCurveTo(-7, 1, 0, -6, 10, -8);
  ctx.stroke();

  ctx.fillStyle = "#eef2f7";
  ctx.beginPath();
  ctx.roundRect(-11, 41, 20, 12, 5);
  ctx.fill();

  ctx.strokeStyle = "rgba(148, 163, 184, 0.74)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 52);
  ctx.lineTo(4, 52);
  ctx.moveTo(-7, 57);
  ctx.lineTo(3, 57);
  ctx.stroke();

  ctx.restore();
}

function drawFighter(fighter) {
  if (fighter.invuln > 0 && Math.floor(fighter.invuln / 6) % 2 === 0) {
    return;
  }

  drawChargingEffect(fighter);

  ctx.save();
  ctx.translate(fighter.x + fighter.width / 2, fighter.y + fighter.height / 2);

  const useMasterHand = fighter.name === "Nova" && playerAvatar === "master-hand";

  if (useMasterHand) {
    drawMasterHand(fighter);
  } else {
    ctx.scale(fighter.face, 1);
    ctx.fillStyle = fighter.color;
    ctx.beginPath();
    ctx.roundRect(-fighter.width / 2, -fighter.height / 2, fighter.width, fighter.height, 14);
    ctx.fill();

    ctx.fillStyle = fighter.accent;
    ctx.beginPath();
    ctx.arc(6, -10, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fighter.attack) {
    const attackData = ATTACKS[fighter.attack.type];
    const activeStart = attackData.startup;
    const totalFrames = attackData.startup + attackData.active + attackData.recovery;
    const extend = Math.min(1, fighter.attack.frame / Math.max(1, activeStart));
    const retract = fighter.attack.frame > activeStart + attackData.active
      ? 1 - (fighter.attack.frame - activeStart - attackData.active) / Math.max(1, totalFrames - activeStart - attackData.active)
      : 1;
    const armReach = Math.max(0, extend * retract);
    const armLength =
      fighter.attack.type === "charge"
        ? 28
        : fighter.attack.type === "sideSpecial"
        ? 24
        : fighter.attack.type === "smash"
        ? 22
        : fighter.attack.type === "shot"
        ? 18
        : fighter.attack.type === "upSpecial" || fighter.attack.type === "blast"
        ? 0
        : 15;

    if (fighter.attack.type !== "blast" && fighter.attack.type !== "upSpecial") {
      if (useMasterHand) {
        ctx.scale(fighter.face, 1);
      }
      ctx.strokeStyle =
        fighter.attack.type === "charge"
          ? "#67e8f9"
          : fighter.attack.type === "sideSpecial"
          ? "#38bdf8"
          : fighter.attack.type === "smash"
          ? "#fdba74"
          : fighter.attack.type === "shot"
          ? "#34d399"
          : fighter.accent;
      ctx.lineWidth =
        fighter.attack.type === "charge"
          ? 12
          : fighter.attack.type === "sideSpecial"
          ? 10
          : fighter.attack.type === "smash"
          ? 10
          : fighter.attack.type === "shot"
          ? 8
          : 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(14, 2);
      ctx.lineTo(14 + armLength * armReach, 2);
      ctx.stroke();
    }
  }

  if (!useMasterHand) {
    ctx.fillStyle = "#08111f";
    ctx.fillRect(2, -8, 8, 3);
  }
  ctx.restore();

  ctx.fillStyle = "rgba(8, 17, 31, 0.76)";
  ctx.font = "700 18px Space Grotesk";
  ctx.textAlign = "center";
  ctx.fillText(fighter.name, fighter.x + fighter.width / 2, fighter.y - 14);

  drawAttack(fighter);
}

function drawImpact(fighter) {
  if (!fighter.impact) return;

  if (fighter.impact.type === "supernova") {
    const maxTimer = 30;
    const life = fighter.impact.timer / maxTimer;
    const outerRadius = 132 * (1 - life) + 54;
    const coreRadius = outerRadius * 0.34;
    const shockRadius = outerRadius * (1.12 + (1 - life) * 0.35);
    const gradient = ctx.createRadialGradient(
      fighter.impact.x,
      fighter.impact.y,
      coreRadius * 0.08,
      fighter.impact.x,
      fighter.impact.y,
      outerRadius
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${1 * life})`);
    gradient.addColorStop(0.16, `rgba(224, 242, 254, ${1 * life})`);
    gradient.addColorStop(0.38, `rgba(125, 211, 252, ${0.96 * life})`);
    gradient.addColorStop(0.68, `rgba(59, 130, 246, ${0.82 * life})`);
    gradient.addColorStop(1, "rgba(30, 64, 175, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.96 * life})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, shockRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(186, 230, 253, ${0.92 * life})`;
    ctx.lineWidth = 5;
    for (let i = 0; i < 14; i += 1) {
      const angle = (Math.PI * 2 * i) / 14;
      const inner = outerRadius * 0.42;
      const outer = outerRadius + 42 * life;
      ctx.beginPath();
      ctx.moveTo(
        fighter.impact.x + Math.cos(angle) * inner,
        fighter.impact.y + Math.sin(angle) * inner
      );
      ctx.lineTo(
        fighter.impact.x + Math.cos(angle) * outer,
        fighter.impact.y + Math.sin(angle) * outer
      );
      ctx.stroke();
    }

    ctx.fillStyle = `rgba(255,255,255,${0.98 * life})`;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (fighter.impact.type === "nova") {
    const maxTimer = 22;
    const life = fighter.impact.timer / maxTimer;
    const outerRadius = 78 * (1 - life) + 28;
    const coreRadius = outerRadius * 0.28;
    const gradient = ctx.createRadialGradient(
      fighter.impact.x,
      fighter.impact.y,
      coreRadius * 0.15,
      fighter.impact.x,
      fighter.impact.y,
      outerRadius
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.98 * life})`);
    gradient.addColorStop(0.22, `rgba(186, 230, 253, ${0.95 * life})`);
    gradient.addColorStop(0.48, `rgba(103, 232, 249, ${0.88 * life})`);
    gradient.addColorStop(0.78, `rgba(59, 130, 246, ${0.62 * life})`);
    gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(224, 242, 254, ${0.95 * life})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, outerRadius * (1.02 + (1 - life) * 0.22), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(103, 232, 249, ${0.85 * life})`;
    ctx.lineWidth = 4;
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const inner = outerRadius * 0.5;
      const outer = outerRadius + 26 * life;
      ctx.beginPath();
      ctx.moveTo(
        fighter.impact.x + Math.cos(angle) * inner,
        fighter.impact.y + Math.sin(angle) * inner
      );
      ctx.lineTo(
        fighter.impact.x + Math.cos(angle) * outer,
        fighter.impact.y + Math.sin(angle) * outer
      );
      ctx.stroke();
    }

    ctx.fillStyle = `rgba(255,255,255,${0.95 * life})`;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (fighter.impact.type === "smoke") {
    const maxTimer = 14;
    const life = fighter.impact.timer / maxTimer;
    const puffRadius = 28 * (1 - life) + 10;
    const puffs = [
      [-16, -6, 0.95],
      [14, -10, 0.82],
      [2, 10, 1.08],
      [20, 2, 0.7],
    ];

    for (const [dx, dy, scale] of puffs) {
      ctx.fillStyle = `rgba(226, 232, 240, ${0.46 * life})`;
      ctx.beginPath();
      ctx.arc(
        fighter.impact.x + fighter.impact.face * 8 * (1 - life) + dx * (1 - life * 0.35),
        fighter.impact.y + dy * (1 - life * 0.22),
        puffRadius * scale,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${0.28 * life})`;
    ctx.beginPath();
    ctx.arc(
      fighter.impact.x + fighter.impact.face * 6,
      fighter.impact.y,
      puffRadius * 0.62,
      0,
      Math.PI * 2
    );
    ctx.fill();
    return;
  }

  if (fighter.impact.type === "spark") {
    const maxTimer = 14;
    const life = fighter.impact.timer / maxTimer;
    const outerRadius = 52 * (1 - life) + 16;
    ctx.strokeStyle = `rgba(167, 243, 208, ${0.9 * life})`;
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(
        fighter.impact.x + Math.cos(angle) * outerRadius * 0.3,
        fighter.impact.y + Math.sin(angle) * outerRadius * 0.3
      );
      ctx.lineTo(
        fighter.impact.x + Math.cos(angle) * outerRadius,
        fighter.impact.y + Math.sin(angle) * outerRadius
      );
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,255,255,${0.92 * life})`;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, outerRadius * 0.34, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (fighter.impact.type === "burst") {
    const maxTimer = 20;
    const life = fighter.impact.timer / maxTimer;
    const outerRadius = 360 * (1 - life) + 130;
    const innerRadius = outerRadius * 0.34;
    const gradient = ctx.createRadialGradient(
      fighter.impact.x,
      fighter.impact.y,
      innerRadius * 0.15,
      fighter.impact.x,
      fighter.impact.y,
      outerRadius
    );
    gradient.addColorStop(0, `rgba(255,255,255,${0.98 * life})`);
    gradient.addColorStop(0.2, `rgba(255, 237, 213, ${0.98 * life})`);
    gradient.addColorStop(0.46, `rgba(251, 146, 60, ${0.92 * life})`);
    gradient.addColorStop(0.78, `rgba(239, 68, 68, ${0.7 * life})`);
    gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 247, 237, ${0.95 * life})`;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, outerRadius * (1.08 + (1 - life) * 0.2), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 245, 157, ${0.86 * life})`;
    ctx.lineWidth = 10;
    for (let i = 0; i < 20; i += 1) {
      const angle = (Math.PI * 2 * i) / 20;
      const inner = outerRadius * 0.46;
      const outer = outerRadius + 120 * life;
      ctx.beginPath();
      ctx.moveTo(
        fighter.impact.x + Math.cos(angle) * inner,
        fighter.impact.y + Math.sin(angle) * inner
      );
      ctx.lineTo(
        fighter.impact.x + Math.cos(angle) * outer,
        fighter.impact.y + Math.sin(angle) * outer
      );
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(255,255,255,${0.6 * life})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, outerRadius * 1.24, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255,255,255,${0.92 * life})`;
    ctx.beginPath();
    ctx.arc(fighter.impact.x, fighter.impact.y, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const maxTimer = 16;
  const life = fighter.impact.timer / maxTimer;
  const outerRadius = 54 * (1 - life) + 18;
  const innerRadius = outerRadius * 0.35;
  const gradient = ctx.createRadialGradient(
    fighter.impact.x,
    fighter.impact.y,
    innerRadius * 0.2,
    fighter.impact.x,
    fighter.impact.y,
    outerRadius
  );
  gradient.addColorStop(0, `rgba(255, 251, 235, ${0.95 * life})`);
  gradient.addColorStop(0.25, `rgba(254, 215, 170, ${0.95 * life})`);
  gradient.addColorStop(0.5, `rgba(251, 146, 60, ${0.9 * life})`);
  gradient.addColorStop(0.78, `rgba(239, 68, 68, ${0.7 * life})`);
  gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(fighter.impact.x, fighter.impact.y, outerRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 247, 237, ${0.85 * life})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(fighter.impact.x, fighter.impact.y, outerRadius * (1.08 + (1 - life) * 0.18), 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 245, 157, ${0.9 * life})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    const inner = outerRadius * 0.58;
    const outer = outerRadius + 18 * life;
    ctx.beginPath();
    ctx.moveTo(
      fighter.impact.x + Math.cos(angle) * inner,
      fighter.impact.y + Math.sin(angle) * inner
    );
    ctx.lineTo(
      fighter.impact.x + Math.cos(angle) * outer,
      fighter.impact.y + Math.sin(angle) * outer
    );
    ctx.stroke();
  }

  ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * life})`;
  ctx.beginPath();
  ctx.arc(fighter.impact.x, fighter.impact.y, innerRadius * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawProjectiles() {
  for (const projectile of state.projectiles ?? []) {
    const centerX = projectile.x + projectile.width / 2;
    const centerY = projectile.y + projectile.height / 2;
    const glow = ctx.createRadialGradient(centerX, centerY, 3, centerX, centerY, projectile.width * 2.1);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.3, "rgba(167, 243, 208, 0.98)");
    glow.addColorStop(0.7, "rgba(16, 185, 129, 0.82)");
    glow.addColorStop(1, "rgba(16, 185, 129, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, projectile.width * 1.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f0fdf4";
    ctx.beginPath();
    ctx.arc(centerX, centerY, projectile.width * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(110, 231, 183, 0.75)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX - projectile.face * projectile.width * 1.8, centerY);
    ctx.lineTo(centerX - projectile.face * projectile.width * 0.25, centerY);
    ctx.stroke();
  }
}

function drawFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (cameraEffect) {
    const elapsed = performance.now() - cameraEffect.startedAt;
    const activeWindow = CHARGE_CAMERA_HOLD_MS + CHARGE_CAMERA_RELEASE_MS;
    if (elapsed >= activeWindow) {
      cameraEffect = null;
    }
  }

  if (cameraEffect) {
    const elapsed = performance.now() - cameraEffect.startedAt;
    const releaseProgress = elapsed <= CHARGE_CAMERA_HOLD_MS
      ? 0
      : Math.min(1, (elapsed - CHARGE_CAMERA_HOLD_MS) / CHARGE_CAMERA_RELEASE_MS);
    const tilt = (cameraEffect.tilt ?? 0.095) * (1 - releaseProgress);
    const shudder = (1 - releaseProgress) * 7;
    const shudderX = Math.sin(performance.now() / 18) * shudder;
    const shudderY = Math.cos(performance.now() / 23) * shudder * 0.7;
    ctx.save();
    ctx.translate(canvas.width / 2 + shudderX, canvas.height / 2 + shudderY);
    ctx.rotate(tilt);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
  }

  ctx.drawImage(stageCanvas, 0, 0);
  drawProjectiles();
  state.fighters.forEach(drawFighter);
  state.fighters.forEach(drawImpact);

  if (cameraEffect) {
    ctx.restore();
    const elapsed = performance.now() - cameraEffect.startedAt;
    const activeWindow = CHARGE_CAMERA_HOLD_MS + CHARGE_CAMERA_RELEASE_MS;
    const normalized = 1 - Math.min(1, elapsed / activeWindow);
    const flash = normalized * 0.22;
    ctx.fillStyle = `rgba(255,255,255,${flash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(96,165,250,${flash * 0.8})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function tick() {
  if (state.running) {
    if (!chargeReady && chargeStartedAt !== null && performance.now() - chargeStartedAt >= CHARGE_TIME_MS) {
      chargeReady = true;
      chargeStartedAt = null;
    }

    if (!blastReady && blastStartedAt !== null && performance.now() - blastStartedAt >= BLAST_CHARGE_TIME_MS) {
      blastReady = true;
      blastStartedAt = null;
    }

    speedAccumulator += speedMultiplier;
    const stepCount = Math.floor(speedAccumulator);
    speedAccumulator -= stepCount;

    for (let i = 0; i < stepCount && state.running; i += 1) {
      const [p1, p2] = state.fighters;
      const cpuInput = trainingMode
        ? { left: false, right: false, jump: false, attack: null }
        : getCpuInput(p2, p1);
      state = stepState(state, {
        p1: getPlayerInput(),
        p2: cpuInput,
      });
      if (trainingMode) {
        freezeTrainingDummy();
      }
      const cinematicHit = state.fighters.find(
        (fighter) =>
          (fighter.impact?.type === "supernova" && fighter.impact.timer === 30) ||
          (fighter.impact?.type === "burst" && fighter.impact.timer === 20)
      );
      if (cinematicHit) {
        const isBlastBurst = cinematicHit.impact.type === "burst";
        cameraEffect = {
          startedAt: performance.now(),
          x: cinematicHit.impact.x,
          y: cinematicHit.impact.y,
          tilt: cinematicHit.name === "Volt" ? (isBlastBurst ? -0.06 : -0.095) : isBlastBurst ? 0.06 : 0.095,
        };
      }
      if (cpuInput.attack) {
        state.fighters[1].cpuCooldown = Math.max(0, Math.round(DIFFICULTY.cpuReactionFrames / cpuDifficulty));
      }
    }
    updateHud();

    if (state.winner) {
      overlay.classList.remove("hidden");
      setOverlay(`${state.winner} Wins`, "Press Start Match for an immediate rematch or R for a full reset.", "Rematch");
    }
  }

  drawFrame();
  window.requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const isShift = event.key === "Shift" || event.code === "ShiftLeft" || event.code === "ShiftRight";
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
  }
  if (event.code === "Space") {
    event.preventDefault();
    input.jabQueued = true;
  }
  if (key === "a") input.left = true;
  if (key === "d") input.right = true;
  if (event.key === "ArrowLeft") {
    input.arrowLeft = true;
    input.lastSpecialHorizontal = -1;
  }
  if (event.key === "ArrowRight") {
    input.arrowRight = true;
    input.lastSpecialHorizontal = 1;
  }
  if (event.key === "ArrowUp") input.arrowUp = true;
  if (event.key === "ArrowDown") input.arrowDown = true;
  if (key === "w") input.jumpQueued = true;
  if (key === "s") input.smashQueued = true;
  if (key === "e") {
    event.preventDefault();
    input.specialHeld = true;
    input.specialNeutralPending = true;
    queueDirectionalSpecial();
  }
  if (input.specialHeld && event.key.startsWith("Arrow")) {
    event.preventDefault();
    queueDirectionalSpecial();
  }
  if (isShift && chargeReady) {
    event.preventDefault();
    input.chargeQueued = true;
  } else if (isShift && chargeStartedAt === null) {
    event.preventDefault();
    chargeStartedAt = performance.now();
  }
  if (key === "r") resetMatch();
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "a") input.left = false;
  if (key === "d") input.right = false;
  if (event.key === "ArrowLeft") input.arrowLeft = false;
  if (event.key === "ArrowRight") input.arrowRight = false;
  if (event.key === "ArrowUp") input.arrowUp = false;
  if (event.key === "ArrowDown") input.arrowDown = false;
  if (key === "e") {
    if (input.specialNeutralPending) {
      input.specialQueued = "shot";
    }
    input.specialHeld = false;
    input.specialNeutralPending = false;
  }
});

speedDial.addEventListener("input", () => {
  speedMultiplier = Number(speedDial.value);
  speedAccumulator = 0;
  speedValue.textContent = `${speedMultiplier.toFixed(2)}x`;
});

cpuDifficultyDial.addEventListener("input", () => {
  cpuDifficulty = Number(cpuDifficultyDial.value);
  cpuDifficultyValue.textContent = `${cpuDifficulty.toFixed(2)}x`;
});

avatarSelect.addEventListener("input", () => {
  playerAvatar = avatarSelect.value;
});

trainingModeToggle.addEventListener("input", () => {
  trainingMode = trainingModeToggle.checked;
  if (trainingMode) {
    freezeTrainingDummy();
    updateHud();
  }
});

startButton.addEventListener("click", startMatch);

resetMatch();
renderStaticStage();
drawFrame();
tick();
