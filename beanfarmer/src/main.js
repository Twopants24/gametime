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
} from "./gameLogic.js?v=20260325-1";

const STORAGE_KEY = "beanfarmer-save-v1";

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
const beanIndex = document.getElementById("bean-index");
const inventoryList = document.getElementById("inventory-list");
const saveButton = document.getElementById("save-button");
const resetButton = document.getElementById("reset-button");
const sellButton = document.getElementById("sell-button");
const mineButton = document.getElementById("mine-button");
const timeButtons = [...document.querySelectorAll("[data-advance-hours]")];

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
          <button type="button" data-select-bean="${beanId}">Use Seed</button>
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

function getPlotActionButtons(plot) {
  if (plot.state === "empty") {
    return `<button type="button" data-plant="${plot.id}">Plant ${BEANS[state.selectedBeanId].name}</button>`;
  }
  if (plot.state === "planted") {
    return `<button type="button" data-water="${plot.id}">Water</button>`;
  }
  if (plot.state === "ready") {
    return `<button type="button" data-harvest="${plot.id}">Harvest</button>`;
  }
  return "";
}

function getPlotMeta(plot) {
  if (plot.state === "empty") {
    return "Fresh soil. Ready for planting.";
  }

  const bean = BEANS[plot.beanId];
  if (plot.state === "planted") {
    return `${bean.name} · ${plot.growthHours.toFixed(1)} / ${bean.growthHours}h · hydration ${plot.hydration}/${bean.waterNeed}`;
  }

  return `${bean.name} is ready to harvest.`;
}

function renderFarm() {
  farmView.innerHTML = state.parcels
    .map((parcel) => {
      const definition = PARCELS.find((entry) => entry.id === parcel.id);
      const parcelClass = parcel.unlocked ? "parcel" : "parcel locked";
      return `
        <section class="${parcelClass}">
          <div class="parcel-header">
            <div>
              <div class="parcel-title">${definition.name}</div>
              <div class="mini-copy">${parcel.unlocked ? `${definition.plotCount} plots · soil bonus x${definition.soilBonus.toFixed(2)}` : `Locked · ${definition.unlockCost} credits`}</div>
            </div>
          </div>
          <div class="plot-grid">
            ${
              parcel.unlocked
                ? parcel.plots
                    .map(
                      (plot) => `
                  <article class="plot-card ${plot.state}">
                    <div class="plot-title">${plot.state === "empty" ? "Open Plot" : BEANS[plot.beanId].name}</div>
                    <div class="plot-meta">${getPlotMeta(plot)}</div>
                    <div class="plot-actions">${getPlotActionButtons(plot)}</div>
                  </article>
                `
                    )
                    .join("")
                : `<article class="plot-card empty"><div class="plot-title">Locked Parcel</div><div class="plot-meta">Buy this land from the operations panel to add more bean beds.</div></article>`
            }
          </div>
        </section>
      `;
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
    {
      title: "Seeds",
      items: state.inventory.seeds,
    },
    {
      title: "Harvest",
      items: state.inventory.beans,
    },
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

function render() {
  renderHeader();
  renderBeanSelector();
  renderFarm();
  renderLandActions();
  renderQuests();
  renderUpgrades();
  renderIndex();
  renderInventory();
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const selectBeanId = target.dataset.selectBean;
  if (selectBeanId) {
    setState({ ...state, selectedBeanId: selectBeanId, lastAction: `Selected ${BEANS[selectBeanId].name}.` });
    return;
  }

  const buySeedId = target.dataset.buySeed;
  if (buySeedId) {
    setState(buySeeds(state, buySeedId, 1));
    return;
  }

  const plantPlotId = target.dataset.plant;
  if (plantPlotId) {
    setState(plantBean(state, plantPlotId, state.selectedBeanId));
    return;
  }

  const waterPlotId = target.dataset.water;
  if (waterPlotId) {
    setState(waterPlot(state, waterPlotId));
    return;
  }

  const harvestPlotId = target.dataset.harvest;
  if (harvestPlotId) {
    setState(harvestPlot(state, harvestPlotId));
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

saveButton.addEventListener("click", () => {
  saveState();
});

resetButton.addEventListener("click", () => {
  resetState();
});

render();
