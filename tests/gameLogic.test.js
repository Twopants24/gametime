import test from "node:test";
import assert from "node:assert/strict";
import {
  BEANS,
  QUESTS,
  advanceTime,
  buySeeds,
  buyUpgrade,
  createInitialState,
  deserializeState,
  forageSeaBean,
  harvestPlot,
  plantBean,
  sellBeans,
  unlockParcel,
  waterPlot,
  performMining,
} from "../src/gameLogic.js";

function getFirstPlotId(state) {
  return state.parcels[0].plots[0].id;
}

test("planting and watering a bean allows it to mature and harvest", () => {
  let state = createInitialState();
  const plotId = getFirstPlotId(state);

  state = plantBean(state, plotId, "green");
  state = waterPlot(state, plotId);
  state = advanceTime(state, 6);

  assert.equal(state.parcels[0].plots[0].state, "ready");

  state = harvestPlot(state, plotId);
  assert.equal(state.inventory.beans.green, BEANS.green.yield);
});

test("selling beans advances the sell quest and grants rewards", () => {
  let state = createInitialState();
  const plotIds = state.parcels[0].plots.map((plot) => plot.id);

  for (const plotId of plotIds) {
    state = plantBean(state, plotId, "green");
    state = waterPlot(state, plotId);
  }

  state = advanceTime(state, 6);

  for (const plotId of plotIds) {
    state = harvestPlot(state, plotId);
  }

  state = sellBeans(state);

  assert.ok(state.completedQuestIds.includes(QUESTS[0].id));
  assert.ok((state.inventory.seeds.wax ?? 0) >= 3);
  assert.ok(state.credits > 40);
});

test("unlocking a parcel completes the expansion quest", () => {
  let state = createInitialState();
  state.credits = 200;

  state = unlockParcel(state, "creek");

  assert.equal(state.parcels.find((parcel) => parcel.id === "creek")?.unlocked, true);
  assert.ok(state.completedQuestIds.includes("expand_farm"));
});

test("late-game parcel unlock adds more farm space", () => {
  let state = createInitialState();
  state.credits = 1000;

  state = unlockParcel(state, "lowland");

  const lowland = state.parcels.find((parcel) => parcel.id === "lowland");
  assert.equal(lowland?.unlocked, true);
  assert.equal(lowland?.plots.length, 8);
});

test("final parcel unlock adds the largest farm expansion", () => {
  let state = createInitialState();
  state.credits = 1200;

  state = unlockParcel(state, "orchard");

  const orchard = state.parcels.find((parcel) => parcel.id === "orchard");
  assert.equal(orchard?.unlocked, true);
  assert.equal(orchard?.plots.length, 10);
});

test("parcel unlock failure explains missing credits", () => {
  const state = createInitialState();

  const next = unlockParcel(state, "lowland");

  assert.equal(next.parcels.find((parcel) => parcel.id === "lowland")?.unlocked, false);
  assert.match(next.lastAction, /Need .* credits to unlock Lowland Rows\./);
});

test("common bean yield upgrade increases harvest output", () => {
  let state = createInitialState();
  const plotId = getFirstPlotId(state);
  state.credits = 200;
  state.ore = 10;

  state = buyUpgrade(state, "field_notes");
  state = buySeeds(state, "green", 1);
  state = plantBean(state, plotId, "green");
  state = waterPlot(state, plotId);
  state = advanceTime(state, 6);
  state = harvestPlot(state, plotId);

  assert.equal(state.inventory.beans.green, BEANS.green.yield + 1);
});

test("house upgrades require ore as well as credits", () => {
  let state = createInitialState();
  state.credits = 999;
  state.ore = 0;

  const next = buyUpgrade(state, "watering_can");

  assert.equal(next.upgrades.includes("watering_can"), false);
});

test("mining produces ore and later special seed rewards", () => {
  let state = createInitialState();
  state.clock.day = 3;

  state = performMining(state);

  assert.ok(state.ore >= 3);
  assert.equal(state.inventory.seeds.starlight, 1);
});

test("sea beans can be foraged once per day and become discovered", () => {
  let state = createInitialState();

  state = forageSeaBean(state, "kelp");
  assert.equal(state.inventory.seeds.kelp, 1);
  assert.equal(state.beanIndex.kelp?.discovered, true);

  const sameDay = forageSeaBean(state, "kelp");
  assert.equal(sameDay.inventory.seeds.kelp, 1);

  state = advanceTime(state, 24);
  state = forageSeaBean(state, "kelp");
  assert.equal(state.inventory.seeds.kelp, 2);
});

test("deserializing an old save backfills newly added parcels", () => {
  const oldSave = createInitialState();
  oldSave.parcels = oldSave.parcels.filter((parcel) => parcel.id !== "lowland");

  const loaded = deserializeState(JSON.stringify(oldSave));

  const lowland = loaded.parcels.find((parcel) => parcel.id === "lowland");
  assert.equal(Boolean(lowland), true);
  assert.equal(lowland?.unlocked, false);
  assert.equal(lowland?.plots.length, 8);
});
