import { ATTACKS, DIFFICULTY, STAGE, createInitialState, stepState } from "./gameLogic.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-button");
const speedDial = document.getElementById("speed-dial");
const speedValue = document.getElementById("speed-value");
const stageCanvas = document.createElement("canvas");
const stageCtx = stageCanvas.getContext("2d");

stageCanvas.width = canvas.width;
stageCanvas.height = canvas.height;

const hud = {
  p1Damage: document.getElementById("p1-damage"),
  p1Stocks: document.getElementById("p1-stocks"),
  p2Damage: document.getElementById("p2-damage"),
  p2Stocks: document.getElementById("p2-stocks"),
};

let state = createInitialState();
let speedMultiplier = Number(speedDial.value);
let speedAccumulator = 0;
let lastHud = {
  p1Damage: null,
  p1Stocks: null,
  p2Damage: null,
  p2Stocks: null,
};

speedValue.textContent = `${speedMultiplier.toFixed(2)}x`;

const input = {
  left: false,
  right: false,
  jumpQueued: false,
  jabQueued: false,
  smashQueued: false,
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
    p2Damage: `${Math.round(p2.damage)}%`,
    p2Stocks: String(p2.stocks),
  };

  if (nextHud.p1Damage !== lastHud.p1Damage) hud.p1Damage.textContent = nextHud.p1Damage;
  if (nextHud.p1Stocks !== lastHud.p1Stocks) hud.p1Stocks.textContent = nextHud.p1Stocks;
  if (nextHud.p2Damage !== lastHud.p2Damage) hud.p2Damage.textContent = nextHud.p2Damage;
  if (nextHud.p2Stocks !== lastHud.p2Stocks) hud.p2Stocks.textContent = nextHud.p2Stocks;
  lastHud = nextHud;
}

function resetMatch() {
  state = createInitialState();
  speedAccumulator = 0;
  overlay.classList.remove("hidden");
  setOverlay("Enter The Arena", "A/D move, W jump, Space jab, S smash, R full reset.", "Start Match");
  updateHud();
}

function startMatch() {
  if (state.winner) {
    state = createInitialState();
  }
  speedAccumulator = 0;
  state.running = true;
  state.winner = null;
  overlay.classList.add("hidden");
}

function getPlayerInput() {
  let attack = null;
  if (input.jabQueued) attack = "jab";
  if (input.smashQueued) attack = "smash";

  const next = {
    left: input.left,
    right: input.right,
    jump: input.jumpQueued,
    attack,
  };

  input.jumpQueued = false;
  input.jabQueued = false;
  input.smashQueued = false;
  return next;
}

function getCpuInput(cpu, target) {
  const deltaX = target.x - cpu.x;
  const deltaY = target.y - cpu.y;
  const shouldAttack = Math.abs(deltaX) < 74 && Math.abs(deltaY) < 38 && !cpu.attack && cpu.attackCooldown <= 0;
  const recovering = cpu.y > 540 || Math.abs(deltaX) > 260;

  return {
    left: deltaX < (recovering ? -12 : -44),
    right: deltaX > (recovering ? 12 : 44),
    jump: (deltaY < -36 || cpu.y > 600) && cpu.jumpsLeft > 0 && cpu.hitstun === 0,
    attack: shouldAttack && cpu.cpuCooldown === 0 ? (cpu.damage > 90 ? "smash" : "jab") : null,
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
  const armLength = fighter.attack.type === "smash" ? 48 : 30;
  const fistRadius = fighter.attack.type === "smash" ? 17 : 11;
  const fistX = armBaseX + fighter.face * armLength;
  const fistY = armBaseY;

  ctx.strokeStyle = fighter.attack.type === "smash" ? "#fb923c" : fighter.accent;
  ctx.lineWidth = fighter.attack.type === "smash" ? 12 : 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(armBaseX, armBaseY);
  ctx.lineTo(fistX, fistY);
  ctx.stroke();

  if (fighter.attack.type === "smash") {
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

  ctx.fillStyle = fighter.attack.type === "smash" ? "#fff7ed" : "#f8fafc";
  ctx.beginPath();
  ctx.arc(fistX, fistY, fistRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
  ctx.beginPath();
  ctx.arc(fistX + fighter.face * 3, fistY + 2, Math.max(5, fistRadius - 4), 0, Math.PI * 2);
  ctx.fill();
}

function drawFighter(fighter) {
  if (fighter.invuln > 0 && Math.floor(fighter.invuln / 6) % 2 === 0) {
    return;
  }

  ctx.save();
  ctx.translate(fighter.x + fighter.width / 2, fighter.y + fighter.height / 2);
  ctx.scale(fighter.face, 1);

  ctx.fillStyle = fighter.color;
  ctx.beginPath();
  ctx.roundRect(-fighter.width / 2, -fighter.height / 2, fighter.width, fighter.height, 14);
  ctx.fill();

  ctx.fillStyle = fighter.accent;
  ctx.beginPath();
  ctx.arc(6, -10, 9, 0, Math.PI * 2);
  ctx.fill();

  if (fighter.attack) {
    const attackData = ATTACKS[fighter.attack.type];
    const activeStart = attackData.startup;
    const totalFrames = attackData.startup + attackData.active + attackData.recovery;
    const extend = Math.min(1, fighter.attack.frame / Math.max(1, activeStart));
    const retract = fighter.attack.frame > activeStart + attackData.active
      ? 1 - (fighter.attack.frame - activeStart - attackData.active) / Math.max(1, totalFrames - activeStart - attackData.active)
      : 1;
    const armReach = Math.max(0, extend * retract);
    const armLength = fighter.attack.type === "smash" ? 22 : 15;

    ctx.strokeStyle = fighter.attack.type === "smash" ? "#fdba74" : fighter.accent;
    ctx.lineWidth = fighter.attack.type === "smash" ? 10 : 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(14, 2);
    ctx.lineTo(14 + armLength * armReach, 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#08111f";
  ctx.fillRect(2, -8, 8, 3);
  ctx.restore();

  ctx.fillStyle = "rgba(8, 17, 31, 0.76)";
  ctx.font = "700 18px Space Grotesk";
  ctx.textAlign = "center";
  ctx.fillText(fighter.name, fighter.x + fighter.width / 2, fighter.y - 14);

  drawAttack(fighter);
}

function drawFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(stageCanvas, 0, 0);
  state.fighters.forEach(drawFighter);
}

function tick() {
  if (state.running) {
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
      if (cpuInput.attack) {
        state.fighters[1].cpuCooldown = DIFFICULTY.cpuReactionFrames;
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
  if (event.code === "Space") {
    event.preventDefault();
    input.jabQueued = true;
  }
  if (key === "a") input.left = true;
  if (key === "d") input.right = true;
  if (key === "w") input.jumpQueued = true;
  if (key === "s") input.smashQueued = true;
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

startButton.addEventListener("click", startMatch);

resetMatch();
renderStaticStage();
drawFrame();
tick();
