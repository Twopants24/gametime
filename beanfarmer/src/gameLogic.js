export const BEANS = {
  green: {
    id: "green",
    name: "Green Bean",
    rarity: "Common",
    seedCost: 4,
    sellValue: 9,
    growthHours: 6,
    waterNeed: 1,
    yield: 2,
    unlockCredits: 0,
    description: "A reliable starter crop with steady returns.",
  },
  wax: {
    id: "wax",
    name: "Wax Bean",
    rarity: "Common",
    seedCost: 9,
    sellValue: 18,
    growthHours: 10,
    waterNeed: 2,
    yield: 2,
    unlockCredits: 50,
    description: "Slower to raise, but worth more at market.",
  },
  scarlet: {
    id: "scarlet",
    name: "Scarlet Runner",
    rarity: "Rare",
    seedCost: 18,
    sellValue: 34,
    growthHours: 14,
    waterNeed: 3,
    yield: 3,
    unlockCredits: 140,
    description: "A vivid climbing bean prized by quest givers.",
  },
  starlight: {
    id: "starlight",
    name: "Starlight Bean",
    rarity: "Special",
    seedCost: 0,
    sellValue: 90,
    growthHours: 18,
    waterNeed: 2,
    yield: 1,
    unlockCredits: 0,
    description: "A special quest and challenge bean with huge value.",
  },
};

export const UPGRADES = {
  watering_can: {
    id: "watering_can",
    name: "Copper Watering Can",
    cost: 70,
    description: "Watering gives +1 extra hydration.",
    apply(modifiers) {
      modifiers.extraWater = 1;
    },
  },
  field_notes: {
    id: "field_notes",
    name: "Field Notes",
    cost: 120,
    description: "Harvests gain +1 yield on common beans.",
    apply(modifiers) {
      modifiers.commonYieldBonus = 1;
    },
  },
  miner_boots: {
    id: "miner_boots",
    name: "Miner Boots",
    cost: 150,
    description: "Mining grants +1 guaranteed ore.",
    apply(modifiers) {
      modifiers.extraOre = 1;
    },
  },
};

export const PARCELS = [
  {
    id: "home",
    name: "Home Patch",
    unlockCost: 0,
    plotCount: 6,
    soilBonus: 1,
  },
  {
    id: "creek",
    name: "Creekside Beds",
    unlockCost: 120,
    plotCount: 4,
    soilBonus: 1.08,
  },
  {
    id: "ridge",
    name: "Sunridge Terrace",
    unlockCost: 320,
    plotCount: 6,
    soilBonus: 1.18,
  },
];

export const QUESTS = [
  {
    id: "first_sale",
    name: "Market Debut",
    description: "Sell 12 beans.",
    type: "sellBeans",
    target: 12,
    rewards: { credits: 35, seeds: { wax: 3 } },
  },
  {
    id: "expand_farm",
    name: "Room To Grow",
    description: "Unlock Creekside Beds.",
    type: "unlockParcel",
    target: "creek",
    rewards: { credits: 60, seeds: { scarlet: 2 } },
  },
  {
    id: "rare_harvest",
    name: "Festival Delivery",
    description: "Harvest 4 Scarlet Runner beans.",
    type: "harvestBean",
    beanId: "scarlet",
    target: 4,
    rewards: { credits: 90, seeds: { starlight: 1 } },
  },
];

export const STARTER_SEEDS = {
  green: 6,
};

const START_HOUR = 8;

function createPlot(parcelId, index) {
  return {
    id: `${parcelId}-${index}`,
    parcelId,
    state: "empty",
    beanId: null,
    plantedAtHour: null,
    hydration: 0,
    growthHours: 0,
    ready: false,
  };
}

function createParcelState(definition) {
  return {
    id: definition.id,
    unlocked: definition.unlockCost === 0,
    plots: Array.from({ length: definition.plotCount }, (_, index) => createPlot(definition.id, index)),
  };
}

export function createInitialState() {
  return {
    clock: {
      day: 1,
      hour: START_HOUR,
      totalHours: 0,
    },
    credits: 40,
    ore: 0,
    soldBeans: 0,
    harvestedByBean: {},
    inventory: {
      beans: {},
      seeds: { ...STARTER_SEEDS },
      specialBeans: {},
    },
    parcels: PARCELS.map(createParcelState),
    upgrades: [],
    beanIndex: {},
    selectedBeanId: "green",
    questProgress: {},
    completedQuestIds: [],
    lastAction: "Welcome to The Bean Farmer.",
  };
}

export function cloneState(state) {
  return structuredClone(state);
}

export function getModifiers(state) {
  const modifiers = {
    extraWater: 0,
    commonYieldBonus: 0,
    extraOre: 0,
  };

  for (const upgradeId of state.upgrades) {
    UPGRADES[upgradeId]?.apply(modifiers);
  }

  return modifiers;
}

export function getUnlockedBeanIds(state) {
  return Object.values(BEANS)
    .filter((bean) => bean.unlockCredits === 0 || state.credits >= bean.unlockCredits || state.beanIndex[bean.id]?.discovered)
    .map((bean) => bean.id);
}

export function getParcelDefinition(parcelId) {
  return PARCELS.find((parcel) => parcel.id === parcelId) ?? null;
}

export function getPlot(state, plotId) {
  for (const parcel of state.parcels) {
    const plot = parcel.plots.find((entry) => entry.id === plotId);
    if (plot) {
      return plot;
    }
  }
  return null;
}

function markBeanDiscovered(state, beanId) {
  const current = state.beanIndex[beanId] ?? {
    discovered: false,
    planted: 0,
    harvested: 0,
    sold: 0,
  };
  state.beanIndex[beanId] = {
    ...current,
    discovered: true,
  };
}

function addItem(store, itemId, amount) {
  store[itemId] = (store[itemId] ?? 0) + amount;
}

function consumeItem(store, itemId, amount) {
  if ((store[itemId] ?? 0) < amount) {
    return false;
  }
  store[itemId] -= amount;
  if (store[itemId] <= 0) {
    delete store[itemId];
  }
  return true;
}

function applyQuestRewards(state, quest) {
  if (quest.rewards.credits) {
    state.credits += quest.rewards.credits;
  }
  if (quest.rewards.seeds) {
    for (const [beanId, amount] of Object.entries(quest.rewards.seeds)) {
      addItem(state.inventory.seeds, beanId, amount);
      markBeanDiscovered(state, beanId);
    }
  }
}

export function evaluateQuests(state) {
  const next = cloneState(state);

  for (const quest of QUESTS) {
    if (next.completedQuestIds.includes(quest.id)) {
      continue;
    }

    let completed = false;
    let progressValue = 0;

    if (quest.type === "sellBeans") {
      progressValue = next.soldBeans;
      completed = progressValue >= quest.target;
    } else if (quest.type === "unlockParcel") {
      progressValue = next.parcels.find((parcel) => parcel.id === quest.target)?.unlocked ? 1 : 0;
      completed = progressValue >= 1;
    } else if (quest.type === "harvestBean") {
      progressValue = next.harvestedByBean[quest.beanId] ?? 0;
      completed = progressValue >= quest.target;
    }

    next.questProgress[quest.id] = progressValue;

    if (completed) {
      next.completedQuestIds.push(quest.id);
      applyQuestRewards(next, quest);
      next.lastAction = `Quest complete: ${quest.name}.`;
    }
  }

  return next;
}

function updateClock(clock, hours) {
  const totalHours = clock.totalHours + hours;
  const absoluteHours = START_HOUR + totalHours;
  const day = 1 + Math.floor(absoluteHours / 24);
  const hour = absoluteHours % 24;
  return {
    day,
    hour,
    totalHours,
  };
}

export function advanceTime(state, hours) {
  let next = cloneState(state);
  next.clock = updateClock(next.clock, hours);

  for (const parcel of next.parcels) {
    const definition = getParcelDefinition(parcel.id);
    const soilBonus = definition?.soilBonus ?? 1;
    for (const plot of parcel.plots) {
      if (plot.state !== "planted" || !plot.beanId) {
        continue;
      }
      const bean = BEANS[plot.beanId];
      const hydrationBonus = Math.min(plot.hydration, bean.waterNeed) / bean.waterNeed;
      plot.growthHours += hours * (0.35 + 0.65 * hydrationBonus) * soilBonus;
      if (plot.growthHours >= bean.growthHours) {
        plot.state = "ready";
        plot.ready = true;
      }
    }
  }

  next = evaluateQuests(next);
  next.lastAction = `Advanced time by ${hours} hour${hours === 1 ? "" : "s"}.`;
  return next;
}

export function buySeeds(state, beanId, amount = 1) {
  const bean = BEANS[beanId];
  if (!bean) return state;
  const totalCost = bean.seedCost * amount;
  if (state.credits < totalCost) return state;

  const next = cloneState(state);
  next.credits -= totalCost;
  addItem(next.inventory.seeds, beanId, amount);
  markBeanDiscovered(next, beanId);
  next.lastAction = `Bought ${amount} ${bean.name} seed${amount === 1 ? "" : "s"}.`;
  return next;
}

export function plantBean(state, plotId, beanId) {
  const plot = getPlot(state, plotId);
  const bean = BEANS[beanId];
  if (!plot || !bean || plot.state !== "empty" || (state.inventory.seeds[beanId] ?? 0) <= 0) {
    return state;
  }

  const next = cloneState(state);
  const nextPlot = getPlot(next, plotId);
  consumeItem(next.inventory.seeds, beanId, 1);
  nextPlot.state = "planted";
  nextPlot.beanId = beanId;
  nextPlot.plantedAtHour = next.clock.totalHours;
  nextPlot.hydration = 0;
  nextPlot.growthHours = 0;
  nextPlot.ready = false;
  markBeanDiscovered(next, beanId);
  next.beanIndex[beanId].planted += 1;
  next.lastAction = `Planted ${bean.name}.`;
  return evaluateQuests(next);
}

export function waterPlot(state, plotId) {
  const plot = getPlot(state, plotId);
  if (!plot || plot.state !== "planted") {
    return state;
  }

  const next = cloneState(state);
  const modifiers = getModifiers(next);
  const nextPlot = getPlot(next, plotId);
  nextPlot.hydration += 1 + modifiers.extraWater;
  next.lastAction = "Watered plot.";
  return next;
}

export function harvestPlot(state, plotId) {
  const plot = getPlot(state, plotId);
  if (!plot || plot.state !== "ready" || !plot.beanId) {
    return state;
  }

  const next = cloneState(state);
  const modifiers = getModifiers(next);
  const nextPlot = getPlot(next, plotId);
  const bean = BEANS[nextPlot.beanId];
  let yieldAmount = bean.yield;
  if (bean.rarity === "Common") {
    yieldAmount += modifiers.commonYieldBonus;
  }

  addItem(next.inventory.beans, bean.id, yieldAmount);
  next.harvestedByBean[bean.id] = (next.harvestedByBean[bean.id] ?? 0) + yieldAmount;
  markBeanDiscovered(next, bean.id);
  next.beanIndex[bean.id].harvested += yieldAmount;

  nextPlot.state = "empty";
  nextPlot.beanId = null;
  nextPlot.plantedAtHour = null;
  nextPlot.hydration = 0;
  nextPlot.growthHours = 0;
  nextPlot.ready = false;

  next.lastAction = `Harvested ${yieldAmount} ${bean.name}${yieldAmount === 1 ? "" : "s"}.`;
  return evaluateQuests(next);
}

export function sellBeans(state) {
  const beanInventory = state.inventory.beans;
  const beanIds = Object.keys(beanInventory);
  if (beanIds.length === 0) {
    return state;
  }

  const next = cloneState(state);
  let creditsEarned = 0;
  let beansSold = 0;

  for (const beanId of Object.keys(next.inventory.beans)) {
    const count = next.inventory.beans[beanId];
    const bean = BEANS[beanId];
    creditsEarned += count * bean.sellValue;
    beansSold += count;
    next.beanIndex[beanId] = next.beanIndex[beanId] ?? { discovered: true, planted: 0, harvested: 0, sold: 0 };
    next.beanIndex[beanId].sold = (next.beanIndex[beanId].sold ?? 0) + count;
  }

  next.inventory.beans = {};
  next.credits += creditsEarned;
  next.soldBeans += beansSold;
  next.lastAction = `Sold ${beansSold} beans for ${creditsEarned} credits.`;
  return evaluateQuests(next);
}

export function buyUpgrade(state, upgradeId) {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade || state.upgrades.includes(upgradeId) || state.credits < upgrade.cost) {
    return state;
  }

  const next = cloneState(state);
  next.credits -= upgrade.cost;
  next.upgrades.push(upgradeId);
  next.lastAction = `Purchased upgrade: ${upgrade.name}.`;
  return next;
}

export function unlockParcel(state, parcelId) {
  const definition = getParcelDefinition(parcelId);
  const parcel = state.parcels.find((entry) => entry.id === parcelId);
  if (!definition || !parcel || parcel.unlocked || state.credits < definition.unlockCost) {
    return state;
  }

  const next = cloneState(state);
  const nextParcel = next.parcels.find((entry) => entry.id === parcelId);
  next.credits -= definition.unlockCost;
  nextParcel.unlocked = true;
  next.lastAction = `Unlocked ${definition.name}.`;
  return evaluateQuests(next);
}

export function performMining(state) {
  const next = cloneState(state);
  const modifiers = getModifiers(next);
  const oreFound = 2 + modifiers.extraOre + (next.clock.day % 2);
  next.ore += oreFound;

  if (next.clock.day >= 3 && !next.inventory.seeds.starlight) {
    addItem(next.inventory.seeds, "starlight", 1);
    markBeanDiscovered(next, "starlight");
    next.lastAction = `Mining found ${oreFound} ore and a Starlight Bean seed.`;
  } else {
    const beanReward = next.clock.day >= 2 ? "scarlet" : "green";
    addItem(next.inventory.seeds, beanReward, 1);
    markBeanDiscovered(next, beanReward);
    next.lastAction = `Mining found ${oreFound} ore and a ${BEANS[beanReward].name} seed.`;
  }

  return evaluateQuests(next);
}

export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(serialized) {
  const parsed = JSON.parse(serialized);
  return parsed;
}
