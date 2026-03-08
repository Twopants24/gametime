import { ATTACKS, DIFFICULTY, STAGE, createInitialState, stepState } from "./gameLogic.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-button");

const hud = {
  p1Damage: document.getElementById("p1-damage"),
  p1Stocks: document.getElementById("p1-stocks"),
  p2Damage: document.getElementById("p2-damage"),
  p2Stocks: document.getElementById("p2-stocks"),
};

let state = createInitialState();

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
  hud.p1Damage.textContent = `${Math.round(p1.damage)}%`;
  hud.p1Stocks.textContent = String(p1.stocks);
  hud.p2Damage.textContent = `${Math.round(p2.damage)}%`;
  hud.p2Stocks.textContent = String(p2.stocks);
}

function resetMatch() {
  state = createInitialState();
  overlay.classList.remove("hidden");
  setOverlay("Enter The Arena", "A/D move, W jump, Space jab, S smash, R full reset.", "Start Match");
  updateHud();
}

function startMatch() {
  if (state.winner) {
    state = createInitialState();
  }
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

function drawBackground() {
  ctx.fillStyle = "#93c5fd";
  ctx.beginPath();
  ctx.arc(1080, 120, 82, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (const [x, y, r] of [
    [180, 120, 90],
    [420, 160, 72],
    [780, 96, 110],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlatforms() {
  for (const [index, platform] of STAGE.platforms.entries()) {
    if (platform.solid) {
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.roundRect(platform.x, platform.y + 12, platform.width, platform.height - 12, 12);
      ctx.fill();

      const capGradient = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.topInset);
      capGradient.addColorStop(0, "#f8fafc");
      capGradient.addColorStop(1, "#cbd5e1");
      ctx.fillStyle = capGradient;
      ctx.beginPath();
      ctx.roundRect(platform.x, platform.y, platform.width, platform.topInset, 12);
      ctx.fill();
    } else {
      const gradient = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.height);
      gradient.addColorStop(0, "#bae6fd");
      gradient.addColorStop(1, "#7dd3fc");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(platform.x, platform.y, platform.width, platform.height, 12);
      ctx.fill();
    }
  }
}

function drawAttack(fighter) {
  if (!fighter.attack) return;
  const attackData = ATTACKS[fighter.attack.type];
  const activeStart = attackData.startup;
  const activeEnd = attackData.startup + attackData.active;
  if (fighter.attack.frame < activeStart || fighter.attack.frame > activeEnd) return;

  const hitbox = {
    x: fighter.face === 1 ? fighter.x + fighter.width - 6 : fighter.x - attackData.xReach + 6,
    y: fighter.y + fighter.height / 2 - attackData.yReach,
    width: attackData.xReach,
    height: attackData.yReach * 2,
  };

  ctx.fillStyle = fighter.attack.type === "smash" ? "rgba(251, 113, 133, 0.3)" : "rgba(255, 255, 255, 0.22)";
  ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
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
  drawBackground();
  drawPlatforms();
  state.fighters.forEach(drawFighter);
}

function tick() {
  if (state.running) {
    const [p1, p2] = state.fighters;
    const cpuInput = getCpuInput(p2, p1);
    state = stepState(state, {
      p1: getPlayerInput(),
      p2: cpuInput,
    });
    if (cpuInput.attack) {
      state.fighters[1].cpuCooldown = DIFFICULTY.cpuReactionFrames;
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

startButton.addEventListener("click", startMatch);

resetMatch();
drawFrame();
tick();
