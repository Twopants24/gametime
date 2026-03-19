export const STAGE = {
  width: 960,
  height: 540,
  blastPadding: 180,
  platforms: [
    { x: 270, y: 420, width: 420, height: 48, solid: true, topInset: 22 },
    { x: 142, y: 315, width: 142, height: 15 },
    { x: 676, y: 315, width: 142, height: 15 },
    { x: 412, y: 228, width: 135, height: 14 },
  ],
};

export const PHYSICS = {
  gravity: 1.28,
  maxFall: 30,
  runSpeed: 2.5,
  airDrift: 1.55,
  jumpPower: 18.5,
  groundFriction: 0.84,
  airFriction: 0.988,
  maxJumps: 2,
};

export const ATTACKS = {
  jab: {
    startup: 2,
    active: 3,
    recovery: 4,
    damage: 7,
    baseKnockback: 5.5,
    scale: 0.11,
    xReach: 44,
    yReach: 18,
  },
  smash: {
    startup: 6,
    active: 5,
    recovery: 8,
    damage: 16,
    baseKnockback: 8.8,
    scale: 0.18,
    xReach: 72,
    yReach: 24,
  },
  charge: {
    startup: 8,
    active: 6,
    recovery: 12,
    damage: 40,
    baseKnockback: 17.5,
    scale: 0.32,
    xReach: 108,
    yReach: 40,
  },
  sideSpecial: {
    startup: 4,
    active: 8,
    recovery: 12,
    damage: 18,
    baseKnockback: 10.5,
    scale: 0.22,
    xReach: 88,
    yReach: 30,
  },
  upSpecial: {
    startup: 3,
    active: 10,
    recovery: 14,
    damage: 16,
    baseKnockback: 9.6,
    scale: 0.2,
    xReach: 34,
    yReach: 74,
  },
  blast: {
    startup: 5,
    active: 6,
    recovery: 14,
    damage: 24,
    baseKnockback: 13.5,
    scale: 0.26,
    xReach: 360,
    yReach: 280,
  },
  shot: {
    startup: 0,
    active: 1,
    recovery: 1,
    damage: 13,
    baseKnockback: 8.5,
    scale: 0.16,
    xReach: 42,
    yReach: 20,
    projectileSpeed: 32,
    projectileSize: 24,
    projectileLifetime: 56,
  },
};

export const DIFFICULTY = {
  playerStocks: 4,
  cpuStocks: 4,
  playerDamageMultiplier: 1.15,
  cpuDamageMultiplier: 0.78,
  playerKnockbackMultiplier: 1.15,
  cpuKnockbackMultiplier: 0.72,
  playerHitboxBonus: 14,
  cpuReactionFrames: 3,
  playerInfiniteJumps: true,
};

export function createFighter(options) {
  return {
    isPlayer: options.isPlayer ?? false,
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
    shielding: false,
    attack: null,
    cpuCooldown: 0,
    impact: null,
  };
}

export function createInitialState() {
  return {
    running: false,
    winner: null,
    projectiles: [],
    fighters: [
      createFighter({
        isPlayer: true,
        name: "Nova",
        color: "#fb923c",
        accent: "#fed7aa",
        x: 322,
        y: 120,
        face: 1,
        stocks: DIFFICULTY.playerStocks,
      }),
      createFighter({
        isPlayer: false,
        name: "Volt",
        color: "#22d3ee",
        accent: "#a5f3fc",
        x: 638,
        y: 120,
        face: -1,
        stocks: DIFFICULTY.cpuStocks,
      }),
    ],
  };
}

export function getAttackHitbox(fighter, attackData, bonusReach = 0) {
  if (fighter.attack?.type === "blast") {
    const reach = attackData.xReach + bonusReach;
    return {
      x: fighter.x + fighter.width / 2 - reach,
      y: fighter.y + fighter.height / 2 - attackData.yReach,
      width: reach * 2,
      height: attackData.yReach * 2,
    };
  }

  if (fighter.attack?.type === "upSpecial") {
    return {
      x: fighter.x + fighter.width / 2 - (attackData.xReach + bonusReach),
      y: fighter.y - attackData.yReach + 8,
      width: (attackData.xReach + bonusReach) * 2,
      height: attackData.yReach + fighter.height / 2,
    };
  }

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
  const fighterIsPlayer = next.isPlayer;
  const canInfiniteJump = fighterIsPlayer && DIFFICULTY.playerInfiniteJumps;

  if (next.hitstun > 0) {
    next.shielding = false;
    return next;
  }

  next.shielding = Boolean(input.shield) && !next.attack;

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

  if (next.shielding) {
    next.vx *= 0.6;
    return next;
  }

  if (input.attack) {
    if (input.attack === "sideSpecial" && input.specialFace) {
      next.face = input.specialFace;
    }

    const attacked = startAttack(next, input.attack);
    if (attacked === next) {
      return next;
    }

    if (input.attack === "sideSpecial") {
      attacked.vx = attacked.face * 15;
      attacked.vy = Math.min(attacked.vy, -3.5);
      attacked.grounded = false;
    }

    if (input.attack === "upSpecial") {
      attacked.vx *= 0.35;
      attacked.vy = -24;
      attacked.grounded = false;
    }

    return attacked;
  }

  return next;
}

export function resolveAttack(attacker, defender) {
  if (!attacker.attack) {
    return { attacker, defender, spawnedProjectile: null };
  }

  const nextAttacker = {
    ...attacker,
    attack: {
      ...attacker.attack,
      frame: attacker.attack.frame + 1,
    },
  };
  let nextDefender = { ...defender };
  let spawnedProjectile = null;

  const attackData = ATTACKS[nextAttacker.attack.type];
  const activeStart = attackData.startup;
  const activeEnd = attackData.startup + attackData.active;

  const attackerIsPlayer = attacker.isPlayer;
  const hitboxBonus = attackerIsPlayer ? DIFFICULTY.playerHitboxBonus : 0;
  const damageMultiplier = attackerIsPlayer ? DIFFICULTY.playerDamageMultiplier : DIFFICULTY.cpuDamageMultiplier;
  const knockbackMultiplier = attackerIsPlayer ? DIFFICULTY.playerKnockbackMultiplier : DIFFICULTY.cpuKnockbackMultiplier;

  if (
    nextAttacker.attack.frame >= activeStart &&
    nextAttacker.attack.frame <= activeEnd &&
    !nextAttacker.attack.didHit &&
    nextAttacker.attack.type === "shot"
  ) {
    spawnedProjectile = {
      owner: attacker.name,
      x: attacker.x + attacker.width / 2 + attacker.face * (attacker.width / 2 + 10),
      y: attacker.y + attacker.height / 2 - 10,
      vx: attacker.face * ATTACKS.shot.projectileSpeed,
      vy: 0,
      width: ATTACKS.shot.projectileSize,
      height: ATTACKS.shot.projectileSize,
      damage: ATTACKS.shot.damage * damageMultiplier,
      baseKnockback: ATTACKS.shot.baseKnockback * knockbackMultiplier,
      scale: ATTACKS.shot.scale * knockbackMultiplier,
      face: attacker.face,
      timer: ATTACKS.shot.projectileLifetime,
    };
    nextAttacker.attack = {
      ...nextAttacker.attack,
      didHit: true,
    };
  } else if (
    nextAttacker.attack.frame >= activeStart &&
    nextAttacker.attack.frame <= activeEnd &&
    !nextAttacker.attack.didHit &&
    nextDefender.invuln <= 0 &&
    intersects(getAttackHitbox(nextAttacker, attackData, hitboxBonus), nextDefender)
  ) {
    if (nextDefender.shielding) {
      nextDefender = {
        ...nextDefender,
        vx: nextAttacker.face * 1.4,
        vy: Math.min(nextDefender.vy, -1.5),
        impact: {
          type: "spark",
          timer: 10,
          x: nextDefender.x + nextDefender.width / 2,
          y: nextDefender.y + nextDefender.height / 2,
          face: nextAttacker.face,
        },
      };
      nextAttacker.attack = {
        ...nextAttacker.attack,
        didHit: true,
      };
      return { attacker: nextAttacker, defender: nextDefender, spawnedProjectile };
    }
    const scaledDamage = attackData.damage * damageMultiplier;
    const knockback = (attackData.baseKnockback + nextDefender.damage * attackData.scale) * knockbackMultiplier;
    nextDefender = {
      ...nextDefender,
      damage: nextDefender.damage + scaledDamage,
      vx: nextAttacker.face * knockback,
      vy: -Math.max(5, knockback * 0.72),
      hitstun: Math.round(scaledDamage * 1.4),
      grounded: false,
      impact:
        nextAttacker.attack.type === "charge"
          ? {
              type: "supernova",
              timer: 30,
              x: nextDefender.x + nextDefender.width / 2,
              y: nextDefender.y + nextDefender.height / 2,
            }
          : nextAttacker.attack.type === "blast"
          ? {
              type: "burst",
              timer: 20,
              x: nextAttacker.x + nextAttacker.width / 2,
              y: nextAttacker.y + nextAttacker.height / 2,
            }
          : nextAttacker.attack.type === "upSpecial" || nextAttacker.attack.type === "sideSpecial"
          ? {
              type: "nova",
              timer: 22,
              x: nextDefender.x + nextDefender.width / 2,
              y: nextDefender.y + nextDefender.height / 2,
            }
          : nextAttacker.attack.type === "smash"
          ? {
              type: "explosion",
              timer: 16,
              x: nextDefender.x + nextDefender.width / 2,
              y: nextDefender.y + nextDefender.height / 2,
            }
          : {
              type: "smoke",
              timer: 14,
              x: nextDefender.x + nextDefender.width / 2,
              y: nextDefender.y + nextDefender.height / 2,
              face: nextAttacker.face,
            },
    };
    nextAttacker.attack = {
      ...nextAttacker.attack,
      didHit: true,
    };
  }

  const totalFrames = attackData.startup + attackData.active + attackData.recovery;
  if (nextAttacker.attack.frame >= totalFrames) {
    const cooldownFrames = nextAttacker.attack.type === "shot" ? 1 : 8;
    nextAttacker.attack = null;
    nextAttacker.attackCooldown = cooldownFrames;
  }

  return { attacker: nextAttacker, defender: nextDefender, spawnedProjectile };
}

export function updateProjectiles(projectiles, fighters) {
  const nextProjectiles = [];
  const nextFighters = fighters.map((fighter) => ({ ...fighter }));

  for (const projectile of projectiles) {
    const nextProjectile = {
      ...projectile,
      x: projectile.x + projectile.vx,
      y: projectile.y + projectile.vy,
      timer: projectile.timer - 1,
    };

    if (
      nextProjectile.timer <= 0 ||
      nextProjectile.x + nextProjectile.width < -STAGE.blastPadding ||
      nextProjectile.x > STAGE.width + STAGE.blastPadding ||
      nextProjectile.y + nextProjectile.height < -STAGE.blastPadding ||
      nextProjectile.y > STAGE.height + STAGE.blastPadding
    ) {
      continue;
    }

    let hit = false;
    for (let i = 0; i < nextFighters.length; i += 1) {
      const fighter = nextFighters[i];
      if (fighter.name === nextProjectile.owner || fighter.invuln > 0) continue;
      if (!intersects(nextProjectile, fighter)) continue;

      if (fighter.shielding) {
        nextFighters[i] = {
          ...fighter,
          vx: nextProjectile.face * 1.2,
          impact: {
            type: "spark",
            timer: 10,
            x: fighter.x + fighter.width / 2,
            y: fighter.y + fighter.height / 2,
            face: nextProjectile.face,
          },
        };
        hit = true;
        break;
      }

      const knockback = nextProjectile.baseKnockback + fighter.damage * nextProjectile.scale;
      nextFighters[i] = {
        ...fighter,
        damage: fighter.damage + nextProjectile.damage,
        vx: nextProjectile.face * knockback,
        vy: -Math.max(4, knockback * 0.55),
        hitstun: Math.round(nextProjectile.damage * 1.2),
        grounded: false,
        impact: {
          type: "spark",
          timer: 14,
          x: fighter.x + fighter.width / 2,
          y: fighter.y + fighter.height / 2,
          face: nextProjectile.face,
        },
      };
      hit = true;
      break;
    }

    if (!hit) {
      nextProjectiles.push(nextProjectile);
    }
  }

  return {
    fighters: nextFighters,
    projectiles: nextProjectiles,
  };
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
    impact:
      fighter.impact && fighter.impact.timer > 1
        ? { ...fighter.impact, timer: fighter.impact.timer - 1 }
        : null,
    grounded: false,
    shielding: fighter.hitstun > 0 ? false : fighter.shielding,
  };

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
      invuln: 0,
      shielding: false,
      jumpsLeft: PHYSICS.maxJumps,
      grounded: false,
      impact: null,
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
  const spawnedProjectiles = [];
  p1 = applyInput(p1, inputs.p1);
  p2 = applyInput(p2, inputs.p2);

  {
    const resolved = resolveAttack(p1, p2);
    p1 = resolved.attacker;
    p2 = resolved.defender;
    if (resolved.spawnedProjectile) spawnedProjectiles.push(resolved.spawnedProjectile);
  }
  {
    const resolved = resolveAttack(p2, p1);
    p2 = resolved.attacker;
    p1 = resolved.defender;
    if (resolved.spawnedProjectile) spawnedProjectiles.push(resolved.spawnedProjectile);
  }

  p1 = updateFighter(p1);
  p2 = updateFighter(p2);
  const projectileState = updateProjectiles([...(state.projectiles ?? []), ...spawnedProjectiles], [p1, p2]);
  [p1, p2] = projectileState.fighters;

  let nextState = {
    ...state,
    fighters: [p1, p2],
    projectiles: projectileState.projectiles,
  };

  nextState = handleBlastZone(nextState, 0);
  nextState = handleBlastZone(nextState, 1);
  return nextState;
}
