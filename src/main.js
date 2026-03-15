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
const stageCanvas = document.createElement("canvas");
const stageCtx = stageCanvas.getContext("2d");
const masterHandImage = new Image();
let masterHandLoaded = false;
let masterHandSprite = null;

stageCanvas.width = canvas.width;
stageCanvas.height = canvas.height;
masterHandImage.addEventListener("load", () => {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = masterHandImage.naturalWidth;
  sourceCanvas.height = masterHandImage.naturalHeight;
  const sourceCtx = sourceCanvas.getContext("2d");
  sourceCtx.drawImage(masterHandImage, 0, 0);

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const isBackground = a > 0 && r < 24 && g < 24 && b < 24;

    if (isBackground) {
      data[i + 3] = 0;
      continue;
    }

    if (data[i + 3] > 18) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  sourceCtx.putImageData(imageData, 0, 0);

  const cropWidth = Math.max(1, maxX - minX + 1);
  const cropHeight = Math.max(1, maxY - minY + 1);
  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedCtx = croppedCanvas.getContext("2d");
  croppedCtx.imageSmoothingEnabled = false;
  croppedCtx.drawImage(sourceCanvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  masterHandSprite = croppedCanvas;
  masterHandLoaded = true;
});
masterHandImage.addEventListener("error", () => {
  masterHandLoaded = false;
  masterHandSprite = null;
});
masterHandImage.src = "data:image/png;base64,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";

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
let speedAccumulator = 0;
let chargeStartedAt = null;
let chargeReady = false;
let blastStartedAt = null;
let blastReady = false;
let cameraEffect = null;
const CHARGE_TIME_MS = 1000;
const BLAST_CHARGE_TIME_MS = 1000;
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
  jumpQueued: false,
  jabQueued: false,
  smashQueued: false,
  shotQueued: false,
  chargeQueued: false,
  blastQueued: false,
};

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
  setOverlay("Enter The Arena", "A/D move, W jump, C shot, Space jab, S smash, hold Shift 1s to store Charge Shot, tap Shift to fire, tap E to start Blast charge, tap E again to fire, R full reset.", "Start Match");
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

  const next = {
    left: input.left,
    right: input.right,
    jump: input.jumpQueued,
    attack,
  };

  input.jumpQueued = false;
  input.jabQueued = false;
  input.shotQueued = false;
  input.smashQueued = false;
  input.chargeQueued = false;
  input.blastQueued = false;
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
  const attackData = ATTACKS[fighter.attack.type];
  const activeStart = attackData.startup;
  const activeEnd = attackData.startup + attackData.active;
  if (fighter.attack.frame < activeStart || fighter.attack.frame > activeEnd) return;

  const armBaseX = fighter.x + fighter.width / 2 + fighter.face * 18;
  const armBaseY = fighter.y + fighter.height / 2 - 4;
  const armLength = fighter.attack.type === "charge" ? 62 : fighter.attack.type === "smash" ? 48 : fighter.attack.type === "shot" ? 34 : fighter.attack.type === "blast" ? 0 : 30;
  const fistRadius = fighter.attack.type === "charge" ? 20 : fighter.attack.type === "smash" ? 17 : fighter.attack.type === "shot" ? 10 : fighter.attack.type === "blast" ? 0 : 11;
  const fistX = armBaseX + fighter.face * armLength;
  const fistY = armBaseY;

  if (fighter.attack.type !== "blast") {
    ctx.strokeStyle = fighter.attack.type === "charge" ? "#67e8f9" : fighter.attack.type === "smash" ? "#fb923c" : fighter.accent;
    ctx.lineWidth = fighter.attack.type === "charge" ? 14 : fighter.attack.type === "smash" ? 12 : 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(armBaseX, armBaseY);
    ctx.lineTo(fistX, fistY);
    ctx.stroke();
  }

  if (fighter.attack.type === "charge") {
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

  if (fighter.attack.type !== "blast") {
    ctx.fillStyle = fighter.attack.type === "charge" ? "#e0f2fe" : fighter.attack.type === "smash" ? "#fff7ed" : fighter.attack.type === "shot" ? "#dcfce7" : "#f8fafc";
    ctx.beginPath();
    ctx.arc(fistX, fistY, fistRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
    ctx.beginPath();
    ctx.arc(fistX + fighter.face * 3, fistY + 2, Math.max(5, fistRadius - 4), 0, Math.PI * 2);
    ctx.fill();
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

function drawFighter(fighter) {
  if (fighter.invuln > 0 && Math.floor(fighter.invuln / 6) % 2 === 0) {
    return;
  }

  drawChargingEffect(fighter);

  ctx.save();
  ctx.translate(fighter.x + fighter.width / 2, fighter.y + fighter.height / 2);

  const useMasterHand = fighter.name === "Nova" && playerAvatar === "master-hand";

  if (useMasterHand) {
    if (masterHandLoaded) {
      ctx.fillStyle = "rgba(14, 23, 42, 0.24)";
      ctx.beginPath();
      ctx.ellipse(0, 30, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.imageSmoothingEnabled = false;
      const sprite = masterHandSprite ?? masterHandImage;
      ctx.drawImage(sprite, -54, -64, 108, 108);
    } else {
      ctx.fillStyle = "rgba(14, 23, 42, 0.22)";
      ctx.beginPath();
      ctx.ellipse(0, 24, 26, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.roundRect(-16, -6, 32, 54, 14);
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(-28, -14, 18, 26, 12);
      ctx.roundRect(-10, -20, 18, 32, 12);
      ctx.roundRect(8, -18, 18, 30, 12);
      ctx.roundRect(22, -10, 16, 24, 10);
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(-14, 40, 12, 26, 10);
      ctx.roundRect(2, 40, 12, 26, 10);
      ctx.fill();

      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.arc(-6, 8, 3.5, 0, Math.PI * 2);
      ctx.arc(8, 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
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
    const armLength = fighter.attack.type === "charge" ? 28 : fighter.attack.type === "smash" ? 22 : fighter.attack.type === "shot" ? 18 : fighter.attack.type === "blast" ? 0 : 15;

    if (fighter.attack.type !== "blast") {
      if (useMasterHand) {
        ctx.scale(fighter.face, 1);
      }
      ctx.strokeStyle = fighter.attack.type === "charge" ? "#67e8f9" : fighter.attack.type === "smash" ? "#fdba74" : fighter.attack.type === "shot" ? "#34d399" : fighter.accent;
      ctx.lineWidth = fighter.attack.type === "charge" ? 12 : fighter.attack.type === "smash" ? 10 : fighter.attack.type === "shot" ? 8 : 7;
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
      const cpuInput = getCpuInput(p2, p1);
      state = stepState(state, {
        p1: getPlayerInput(),
        p2: cpuInput,
      });
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
  if (event.code === "Space") {
    event.preventDefault();
    input.jabQueued = true;
  }
  if (key === "a") input.left = true;
  if (key === "d") input.right = true;
  if (key === "w") input.jumpQueued = true;
  if (key === "c") input.shotQueued = true;
  if (key === "s") input.smashQueued = true;
  if (key === "e" && blastReady) {
    event.preventDefault();
    input.blastQueued = true;
  } else if (key === "e" && blastStartedAt === null) {
    event.preventDefault();
    blastStartedAt = performance.now();
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

startButton.addEventListener("click", startMatch);

resetMatch();
renderStaticStage();
drawFrame();
tick();
