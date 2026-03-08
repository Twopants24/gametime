export const STAGE = {
  width: 1280,
  height: 720,
  blastPadding: 180,
  platforms: [
    { x: 360, y: 560, width: 560, height: 64, solid: true, topInset: 30 },
    { x: 190, y: 420, width: 190, height: 20 },
    { x: 900, y: 420, width: 190, height: 20 },
    { x: 550, y: 304, width: 180, height: 18 },
  ],
};

export const PHYSICS = {
  gravity: 0.68,
  maxFall: 17,
  runSpeed: 1.08,
  airDrift: 0.72,
  jumpPower: 14,
  groundFriction: 0.8,
  airFriction: 0.98,
  maxJumps: 2,
};

export const ATTACKS = {
  jab: {
    startup: 7,
    active: 6,
    recovery: 12,
    damage: 7,
    baseKnockback: 5.5,
    scale: 0.11,
    xReach: 44,
    yReach: 18,
  },
  smash: {
    startup: 18,
    active: 8,
    recovery: 22,
    damage: 16,
    baseKnockback: 8.8,
    scale: 0.18,
    xReach: 72,
    yReach: 24,
  },
};

export const DIFFICULTY = {
  playerStocks: 4,
  cpuStocks: 2,
  playerDamageMultiplier: 1.15,
  cpuDamageMultiplier: 0.78,
  playerKnockbackMultiplier: 1.15,
  cpuKnockbackMultiplier: 0.72,
  playerHitboxBonus: 14,
  cpuReactionFrames: 14,
  playerInfiniteJumps: true,
};

export const SHIELD = {
  max: 100,
  drainPerFrame: 0,
  regenPerFrame: 0.45,
  minToActivate: 8,
  damageMultiplier: 0,
  knockbackMultiplier: 0.08,
  hitstunMultiplier: 0.25,
};

export function createFighter(options) {
  return {
    name: options.name,
    color: options.color,
    accent: options.accent,
    x: options.x,
    y: options.y,
    spawnX: options.x,
    spawnY: options.y,
    vx: 0,
    vy: 0,
    width: 48,
    height: 78,
    face: options.face ?? 1,
    grounded: false,
    jumpsLeft: PHYSICS.maxJumps,
    damage: 0,
    stocks: options.stocks ?? 3,
    attackCooldown: 0,
    hitstun: 0,
    invuln: 0,
    attack: null,
    cpuCooldown: 0,
    shielding: false,
    shield: SHIELD.max,
  };
}

export function createInitialState() {
  return {
    running: false,
    winner: null,
    fighters: [
      createFighter({
        name: "Nova",
        color: "#fb923c",
        accent: "#fed7aa",
        x: 430,
        y: 160,
        face: 1,
        stocks: DIFFICULTY.playerStocks,
      }),
      createFighter({
        name: "Volt",
        color: "#22d3ee",
        accent: "#a5f3fc",
        x: 850,
        y: 160,
        face: -1,
        stocks: DIFFICULTY.cpuStocks,
      }),
    ],
  };
}

export function getAttackHitbox(fighter, attackData, bonusReach = 0) {
  return {
    x:
      fighter.face === 1
        ? fighter.x + fighter.width - 6
        : fighter.x - (attackData.xReach + bonusReach) + 6,
    y: fighter.y + fighter.height / 2 - attackData.yReach,
    width: attackData.xReach + bonusReach,
    height: attackData.yReach * 2,
  };
}

export function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function startAttack(fighter, type) {
  if (fighter.attackCooldown > 0 || fighter.hitstun > 0 || fighter.attack) {
    return fighter;
  }

  return {
    ...fighter,
    attack: {
      type,
      frame: 0,
      didHit: false,
    },
  };
}

export function applyInput(fighter, input) {
  const next = { ...fighter };
  const fighterIsPlayer = next.name === "Nova";
  const canInfiniteJump = fighterIsPlayer && DIFFICULTY.playerInfiniteJumps;

  if (input.shield && next.shield >= SHIELD.minToActivate && !next.attack) {
    next.shielding = true;
    next.vx *= 0.72;
  } else {
    next.shielding = false;
  }

  if (next.hitstun > 0) {
    return next;
  }

  if (input.left) {
    next.vx -= next.grounded ? PHYSICS.runSpeed : PHYSICS.airDrift;
    next.face = -1;
  }

  if (input.right) {
    next.vx += next.grounded ? PHYSICS.runSpeed : PHYSICS.airDrift;
    next.face = 1;
  }

  if (input.jump && (next.jumpsLeft > 0 || canInfiniteJump)) {
    next.vy = -PHYSICS.jumpPower;
    if (!canInfiniteJump) {
      next.jumpsLeft -= 1;
    }
    next.grounded = false;
  }

  if (input.attack) {
    return startAttack(next, input.attack);
  }

  return next;
}

export function resolveAttack(attacker, defender) {
  if (!attacker.attack) {
    return { attacker, defender };
  }

  const nextAttacker = {
    ...attacker,
    attack: {
      ...attacker.attack,
      frame: attacker.attack.frame + 1,
    },
  };
  let nextDefender = { ...defender };

  const attackData = ATTACKS[nextAttacker.attack.type];
  const activeStart = attackData.startup;
  const activeEnd = attackData.startup + attackData.active;

  const attackerIsPlayer = attacker.name === "Nova";
  const hitboxBonus = attackerIsPlayer ? DIFFICULTY.playerHitboxBonus : 0;
  const damageMultiplier = attackerIsPlayer ? DIFFICULTY.playerDamageMultiplier : DIFFICULTY.cpuDamageMultiplier;
  const knockbackMultiplier = attackerIsPlayer ? DIFFICULTY.playerKnockbackMultiplier : DIFFICULTY.cpuKnockbackMultiplier;

  if (
    nextAttacker.attack.frame >= activeStart &&
    nextAttacker.attack.frame <= activeEnd &&
    !nextAttacker.attack.didHit &&
    nextDefender.invuln <= 0 &&
    intersects(getAttackHitbox(nextAttacker, attackData, hitboxBonus), nextDefender)
  ) {
    const scaledDamage = attackData.damage * damageMultiplier;
    const defenderShielding = nextDefender.shielding && nextDefender.shield > 0;
    const damageToPercent = defenderShielding ? scaledDamage * SHIELD.damageMultiplier : scaledDamage;
    const knockback =
      (attackData.baseKnockback + nextDefender.damage * attackData.scale) *
      knockbackMultiplier *
      (defenderShielding ? SHIELD.knockbackMultiplier : 1);
    nextDefender = {
      ...nextDefender,
      damage: nextDefender.damage + damageToPercent,
      vx: nextAttacker.face * knockback,
      vy: -Math.max(2, knockback * 0.72),
      hitstun: Math.round(scaledDamage * 1.4 * (defenderShielding ? SHIELD.hitstunMultiplier : 1)),
      grounded: false,
      shield: defenderShielding ? Math.max(0, nextDefender.shield - scaledDamage * 2.4) : nextDefender.shield,
      shielding: defenderShielding ? nextDefender.shield - scaledDamage * 2.4 > 0 : nextDefender.shielding,
    };
    nextAttacker.attack = {
      ...nextAttacker.attack,
      didHit: true,
    };
  }

  const totalFrames = attackData.startup + attackData.active + attackData.recovery;
  if (nextAttacker.attack.frame >= totalFrames) {
    nextAttacker.attack = null;
    nextAttacker.attackCooldown = 8;
  }

  return { attacker: nextAttacker, defender: nextDefender };
}

export function resolvePlatformCollision(fighter, platform) {
  const next = { ...fighter };
  const previousLeft = next.x - next.vx;
  const previousRight = previousLeft + next.width;
  const previousTop = next.y - next.vy;
  const previousBottom = previousTop + next.height;
  const nextLeft = next.x;
  const nextRight = next.x + next.width;
  const nextTop = next.y;
  const nextBottom = next.y + next.height;

  const overlaps =
    nextRight > platform.x &&
    nextLeft < platform.x + platform.width &&
    nextBottom > platform.y &&
    nextTop < platform.y + platform.height;

  if (platform.solid && overlaps) {
    const topPenetration = nextBottom - platform.y;
    const bottomPenetration = platform.y + platform.height - nextTop;
    const leftPenetration = nextRight - platform.x;
    const rightPenetration = platform.x + platform.width - nextLeft;

    const resolveOnTop = () => {
      next.y = platform.y - next.height;
      next.vy = 0;
      next.grounded = true;
      next.jumpsLeft = PHYSICS.maxJumps;
      return next;
    };

    if (previousBottom <= platform.y) {
      return resolveOnTop();
    }

    if (previousTop >= platform.y + platform.height) {
      next.y = platform.y + platform.height;
      next.vy = Math.max(0, next.vy);
      return next;
    }

    if (previousRight <= platform.x) {
      next.x = platform.x - next.width;
      next.vx = 0;
      return next;
    }

    if (previousLeft >= platform.x + platform.width) {
      next.x = platform.x + platform.width;
      next.vx = 0;
      return next;
    }

    const minPenetration = Math.min(topPenetration, bottomPenetration, leftPenetration, rightPenetration);
    if (minPenetration === topPenetration) {
      return resolveOnTop();
    }

    if (minPenetration === bottomPenetration) {
      next.y = platform.y + platform.height;
      next.vy = Math.max(0, next.vy);
      return next;
    }

    if (minPenetration === leftPenetration) {
      next.x = platform.x - next.width;
      next.vx = 0;
      return next;
    }

    next.x = platform.x + platform.width;
    next.vx = 0;
    return next;
  }

  if (
    next.vy >= 0 &&
    nextRight > platform.x &&
    nextLeft < platform.x + platform.width &&
    previousBottom <= platform.y &&
    nextBottom >= platform.y
  ) {
    next.y = platform.y - next.height;
    next.vy = 0;
    next.grounded = true;
    next.jumpsLeft = PHYSICS.maxJumps;
  }

  return next;
}

export function updateFighter(fighter) {
  let next = {
    ...fighter,
    attackCooldown: Math.max(0, fighter.attackCooldown - 1),
    hitstun: Math.max(0, fighter.hitstun - 1),
    invuln: Math.max(0, fighter.invuln - 1),
    cpuCooldown: Math.max(0, fighter.cpuCooldown - 1),
    shield: fighter.shielding
      ? Math.max(0, fighter.shield - SHIELD.drainPerFrame)
      : Math.min(SHIELD.max, fighter.shield + SHIELD.regenPerFrame),
    grounded: false,
  };

  if (next.shield <= 0) {
    next.shielding = false;
  }

  next.vy = Math.min(next.vy + PHYSICS.gravity, PHYSICS.maxFall);
  next.x += next.vx;
  next.y += next.vy;

  for (const platform of STAGE.platforms) {
    next = resolvePlatformCollision(next, platform);
  }

  next.vx *= next.grounded ? PHYSICS.groundFriction : PHYSICS.airFriction;
  next.vx = Math.max(-11, Math.min(11, next.vx));

  return next;
}

export function handleBlastZone(state, fighterIndex) {
  const fighter = state.fighters[fighterIndex];
  const outOfBounds =
    fighter.x < -STAGE.blastPadding ||
    fighter.x > STAGE.width + STAGE.blastPadding ||
    fighter.y < -STAGE.blastPadding ||
    fighter.y > STAGE.height + STAGE.blastPadding;

  if (!outOfBounds) {
    return state;
  }

  const fighters = state.fighters.map((entry, index) => {
    if (index !== fighterIndex) {
      return entry;
    }

    const stocks = entry.stocks - 1;
    if (stocks <= 0) {
      return {
        ...entry,
        stocks: 0,
      };
    }

    return {
      ...entry,
      stocks,
      x: entry.spawnX,
      y: entry.spawnY,
      vx: 0,
      vy: 0,
      damage: 0,
      hitstun: 0,
      attack: null,
      invuln: 120,
      jumpsLeft: PHYSICS.maxJumps,
      grounded: false,
    };
  });

  const loser = fighters[fighterIndex];
  if (loser.stocks > 0) {
    return { ...state, fighters };
  }

  return {
    ...state,
    running: false,
    winner: fighters[fighterIndex === 0 ? 1 : 0].name,
    fighters,
  };
}

export function stepState(state, inputs) {
  let [p1, p2] = state.fighters;
  p1 = applyInput(p1, inputs.p1);
  p2 = applyInput(p2, inputs.p2);

  ({ attacker: p1, defender: p2 } = resolveAttack(p1, p2));
  ({ attacker: p2, defender: p1 } = resolveAttack(p2, p1));

  p1 = updateFighter(p1);
  p2 = updateFighter(p2);

  let nextState = {
    ...state,
    fighters: [p1, p2],
  };

  nextState = handleBlastZone(nextState, 0);
  nextState = handleBlastZone(nextState, 1);
  return nextState;
}
