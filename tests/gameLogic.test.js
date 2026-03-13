import test from "node:test";
import assert from "node:assert/strict";
import { ATTACKS, DIFFICULTY, PHYSICS, STAGE, createInitialState, resolveAttack, stepState, updateFighter } from "../src/gameLogic.js";

test("jab hit increases damage and launches defender", () => {
  const state = createInitialState();
  let [attacker, defender] = state.fighters;
  attacker.x = 400;
  attacker.y = 400;
  attacker.face = 1;
  attacker.attack = { type: "jab", frame: ATTACKS.jab.startup - 1, didHit: false };

  defender.x = 438;
  defender.y = 400;

  const resolved = resolveAttack(attacker, defender);
  assert.equal(resolved.defender.damage, 7 * DIFFICULTY.playerDamageMultiplier);
  assert.ok(resolved.defender.vx > 0);
  assert.ok(resolved.defender.vy < 0);
});

test("charge hit is stronger than smash and creates the zoom impact", () => {
  const state = createInitialState();
  let [attacker, defender] = state.fighters;
  attacker.x = 400;
  attacker.y = 400;
  attacker.face = 1;
  attacker.attack = { type: "charge", frame: ATTACKS.charge.startup - 1, didHit: false };
  defender.x = 448;
  defender.y = 400;

  const resolved = resolveAttack(attacker, defender);
  assert.ok(resolved.defender.damage > ATTACKS.smash.damage * DIFFICULTY.playerDamageMultiplier);
  assert.equal(resolved.defender.impact?.type, "supernova");
  assert.equal(resolved.defender.impact?.timer, 30);
});

test("blast hits enemies around Nova and creates a burst impact", () => {
  const state = createInitialState();
  let [attacker, defender] = state.fighters;
  attacker.x = 400;
  attacker.y = 400;
  attacker.face = 1;
  attacker.attack = { type: "blast", frame: ATTACKS.blast.startup - 1, didHit: false };
  defender.x = 182;
  defender.y = 386;

  const resolved = resolveAttack(attacker, defender);
  assert.ok(resolved.defender.damage > ATTACKS.smash.damage * 0.9 * DIFFICULTY.playerDamageMultiplier);
  assert.equal(resolved.defender.impact?.type, "burst");
  assert.equal(resolved.defender.impact?.timer, 20);
});

test("shot spawns a projectile that damages at range", () => {
  const state = createInitialState();
  state.running = true;
  state.fighters[0].x = 240;
  state.fighters[0].y = 360;
  state.fighters[0].face = 1;
  state.fighters[1].x = 520;
  state.fighters[1].y = 360;

  let next = state;
  next = stepState(next, {
    p1: { left: false, right: false, jump: false, attack: "shot" },
    p2: { left: false, right: false, jump: false, attack: null },
  });

  for (let i = 0; i < 20; i += 1) {
    next = stepState(next, {
      p1: { left: false, right: false, jump: false, attack: null },
      p2: { left: false, right: false, jump: false, attack: null },
    });
  }

  assert.ok(next.fighters[1].damage > 0);
  assert.equal(next.fighters[1].impact?.type, "spark");
});

test("fighter landing on a platform restores jumps", () => {
  let fighter = createInitialState().fighters[0];
  fighter.x = STAGE.platforms[0].x + 40;
  fighter.y = STAGE.platforms[0].y - fighter.height - 2;
  fighter.vy = 5;
  fighter.jumpsLeft = 0;

  fighter = updateFighter(fighter);
  assert.equal(fighter.grounded, true);
  assert.equal(fighter.jumpsLeft, PHYSICS.maxJumps);
});

test("fighter cannot pass upward through the bottom platform", () => {
  let fighter = createInitialState().fighters[0];
  fighter.x = STAGE.platforms[0].x + 80;
  fighter.y = STAGE.platforms[0].y + STAGE.platforms[0].height + 2;
  fighter.vy = -8;

  fighter = updateFighter(fighter);
  assert.ok(fighter.y >= STAGE.platforms[0].y + STAGE.platforms[0].height);
  assert.ok(fighter.vy >= 0);
});

test("fighter overlapping the solid bottom platform gets pushed out", () => {
  let fighter = createInitialState().fighters[0];
  fighter.x = STAGE.platforms[0].x + 120;
  fighter.y = STAGE.platforms[0].y + 10;
  fighter.vy = 4;

  fighter = updateFighter(fighter);
  const stillInsideX = fighter.x + fighter.width > STAGE.platforms[0].x && fighter.x < STAGE.platforms[0].x + STAGE.platforms[0].width;
  const stillInsideY = fighter.y + fighter.height > STAGE.platforms[0].y && fighter.y < STAGE.platforms[0].y + STAGE.platforms[0].height;
  assert.equal(stillInsideX && stillInsideY, false);
});

test("player can still jump with no jumps left", () => {
  const fighter = createInitialState().fighters[0];
  fighter.jumpsLeft = 0;
  fighter.vy = 0;

  const jumped = stepState(
    { running: true, winner: null, fighters: [fighter, createInitialState().fighters[1]] },
    {
      p1: { left: false, right: false, jump: true, attack: null },
      p2: { left: false, right: false, jump: false, attack: null },
    }
  );

  assert.ok(jumped.fighters[0].vy < 0);
});

test("crossing the blast zone removes a stock and respawns the fighter", () => {
  const initial = createInitialState();
  initial.running = true;
  initial.fighters[0].x = -STAGE.blastPadding - 5;

  const next = stepState(initial, {
    p1: { left: false, right: false, jump: false, attack: null },
    p2: { left: false, right: false, jump: false, attack: null },
  });

  assert.equal(next.fighters[0].stocks, DIFFICULTY.playerStocks - 1);
  assert.equal(next.fighters[0].x, next.fighters[0].spawnX);
  assert.equal(next.fighters[0].damage, 0);
  assert.equal(next.fighters[0].invuln, 0);
});

test("losing the final stock ends the match and declares a winner", () => {
  const initial = createInitialState();
  initial.running = true;
  initial.fighters[1].stocks = 1;
  initial.fighters[1].x = STAGE.width + STAGE.blastPadding + 10;

  const next = stepState(initial, {
    p1: { left: false, right: false, jump: false, attack: null },
    p2: { left: false, right: false, jump: false, attack: null },
  });

  assert.equal(next.running, false);
  assert.equal(next.winner, "Nova");
  assert.equal(next.fighters[1].stocks, 0);
});
