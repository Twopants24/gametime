const boardElement = document.getElementById("board");
const shuffleButton = document.getElementById("shuffle-button");
const shuffleCount = document.getElementById("shuffle-count");
const restartButton = document.getElementById("restart-button");
const playAgainButton = document.getElementById("play-again-button");
const scoreValue = document.getElementById("score-value");
const streakValue = document.getElementById("streak-value");
const timeValue = document.getElementById("time-value");
const remainingValue = document.getElementById("remaining-value");
const messageElement = document.getElementById("message");
const gameOverElement = document.getElementById("game-over");
const gameOverTitle = document.getElementById("game-over-title");
const gameOverText = document.getElementById("game-over-text");

const COLORS = [
  { id: "amber", fill: "#db8a52" },
  { id: "sage", fill: "#7ea174" },
  { id: "ocean", fill: "#5b8eaa" },
  { id: "plum", fill: "#8a6aa8" },
  { id: "sand", fill: "#d1ac58" },
  { id: "coral", fill: "#d46f62" },
];

const ICONS = ["✦", "●", "▲", "■", "✿", "☽"];
const PATTERNS = ["dots", "diagonal", "grid", "arc"];
const BOARD_SIZE = 36;
const ROUND_TIME = 90;
const SHUFFLES_PER_ROUND = 3;
const CLEAR_DELAY_MS = 180;

let tiles = [];
let selectedIds = [];
let score = 0;
let streak = 0;
let bestStreak = 0;
let shufflesLeft = SHUFFLES_PER_ROUND;
let timeLeft = ROUND_TIME;
let timerId = null;
let isResolving = false;
let gameEnded = false;

function buildDeck() {
  const nextTiles = [];

  for (let index = 0; index < BOARD_SIZE; index += 1) {
    const color = COLORS[index % COLORS.length];
    const icon = ICONS[Math.floor(index / COLORS.length) % ICONS.length];
    const pattern = PATTERNS[Math.floor(index / (COLORS.length * 2)) % PATTERNS.length];

    nextTiles.push({
      id: `tile-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      colorId: color.id,
      fill: color.fill,
      icon,
      pattern,
      cleared: false,
    });
  }

  return shuffle(nextTiles);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function startRound() {
  tiles = buildDeck();
  selectedIds = [];
  score = 0;
  streak = 0;
  bestStreak = 0;
  shufflesLeft = SHUFFLES_PER_ROUND;
  timeLeft = ROUND_TIME;
  isResolving = false;
  gameEnded = false;
  gameOverElement.classList.remove("is-visible");
  setMessage("Pick any two tiles with one trait in common.");
  syncStats();
  renderBoard();
  startTimer();
}

function startTimer() {
  window.clearInterval(timerId);
  timerId = window.setInterval(() => {
    timeLeft -= 1;
    syncStats();

    if (timeLeft <= 0) {
      finishRound(false);
    }
  }, 1000);
}

function finishRound(clearedBoard) {
  if (gameEnded) {
    return;
  }

  gameEnded = true;
  window.clearInterval(timerId);
  gameOverTitle.textContent = clearedBoard ? "Board Cleared" : "Time Up";
  gameOverText.textContent = clearedBoard
    ? `You finished with ${score} points and ${Math.max(bestStreak, 1)} as your best streak.`
    : `You ended on ${score} points with ${getRemainingCount()} tiles left on the board.`;
  gameOverElement.classList.add("is-visible");
  setMessage(clearedBoard ? "Clean sweep." : "Round over. Start a new one.");
}

function getRemainingCount() {
  return tiles.filter((tile) => !tile.cleared).length;
}

function syncStats() {
  scoreValue.textContent = String(score);
  streakValue.textContent = String(streak);
  timeValue.textContent = String(Math.max(timeLeft, 0));
  remainingValue.textContent = String(getRemainingCount());
  shuffleCount.textContent = String(shufflesLeft);
  shuffleButton.disabled = shufflesLeft === 0 || gameEnded;
}

function setMessage(message) {
  messageElement.textContent = message;
}

function renderBoard() {
  boardElement.textContent = "";

  tiles.filter((tile) => !tile.cleared).forEach((tile) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tile ${selectedIds.includes(tile.id) ? "is-selected" : ""}`;
    button.dataset.id = tile.id;
    button.setAttribute("aria-label", `Tile ${tile.icon}, ${tile.colorId}, ${tile.pattern}`);
    button.innerHTML = `
      <span class="tile-face tile-pattern-${tile.pattern}" style="background:${tile.fill}">
        <span class="tile-icon">${tile.icon}</span>
      </span>
    `;
    boardElement.append(button);
  });

  syncStats();
}

function pickTile(tileId) {
  if (gameEnded || isResolving) {
    return;
  }

  if (selectedIds.includes(tileId)) {
    selectedIds = selectedIds.filter((selectedId) => selectedId !== tileId);
    renderBoard();
    return;
  }

  if (selectedIds.length === 2) {
    selectedIds = [];
  }

  selectedIds = [...selectedIds, tileId];
  renderBoard();

  if (selectedIds.length === 2) {
    resolveSelection();
  }
}

function resolveSelection() {
  const [first, second] = selectedIds.map((id) => tiles.find((tile) => tile.id === id));
  if (!first || !second) {
    selectedIds = [];
    renderBoard();
    return;
  }

  const sharedTraits = [];
  if (first.colorId === second.colorId) {
    sharedTraits.push("color");
  }
  if (first.icon === second.icon) {
    sharedTraits.push("icon");
  }
  if (first.pattern === second.pattern) {
    sharedTraits.push("pattern");
  }

  if (sharedTraits.length === 0) {
    streak = 0;
    setMessage("No shared trait there. Try another pair.");
    selectedIds = [];
    renderBoard();
    return;
  }

  isResolving = true;
  streak += 1;
  bestStreak = Math.max(bestStreak, streak);
  score += 100 + (streak - 1) * 25 + (sharedTraits.length - 1) * 40;
  setMessage(`Match on ${sharedTraits.join(", ")}. Keep the streak alive.`);

  const selectedElements = selectedIds
    .map((id) => boardElement.querySelector(`[data-id="${id}"]`))
    .filter(Boolean);

  selectedElements.forEach((element) => {
    element.classList.add("is-clearing");
  });

  window.setTimeout(() => {
    tiles = tiles.map((tile) =>
      selectedIds.includes(tile.id)
        ? {
            ...tile,
            cleared: true,
          }
        : tile
    );
    selectedIds = [];
    isResolving = false;
    renderBoard();

    if (getRemainingCount() === 0) {
      finishRound(true);
    }
  }, CLEAR_DELAY_MS);
}

function shuffleBoard() {
  if (shufflesLeft === 0 || gameEnded) {
    return;
  }

  const activeTiles = shuffle(tiles.filter((tile) => !tile.cleared));
  let activeIndex = 0;
  tiles = tiles.map((tile) =>
    tile.cleared
      ? tile
      : {
          ...activeTiles[activeIndex++],
          cleared: false,
        }
  );
  shufflesLeft -= 1;
  selectedIds = [];
  streak = 0;
  setMessage("Board shuffled. Streak reset.");
  renderBoard();
}

boardElement.addEventListener("click", (event) => {
  const target = event.target.closest(".tile");
  if (!target) {
    return;
  }

  pickTile(target.dataset.id);
});

shuffleButton.addEventListener("click", shuffleBoard);
restartButton.addEventListener("click", startRound);
playAgainButton.addEventListener("click", startRound);

startRound();
