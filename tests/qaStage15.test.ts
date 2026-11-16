import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { describe, it } from 'node:test';
import { MINE_SYSTEM_CONFIG, POWERUP_IDS } from '../src/data/powerups.ts';
import {
  getEffectiveTankMaxHp,
  getEffectiveTankMoveSpeed,
  getEffectiveTankProjectileRange,
  getEffectiveTankReloadSec,
  TANK_DEFINITIONS,
  TANK_LIST,
} from '../src/data/tanks.ts';
import {
  hasLineOfSightObstacles,
  RectObstacleBounds,
  segmentIntersectsAabb,
} from '../src/game/ai/lineOfSight.ts';
import { ARENA_LIST } from '../src/game/arenas/arenaLayouts.ts';
import { isValidPickupSpawnPosition } from '../src/game/powerups/pickupPlacement.ts';
import { TemporaryEffectManager } from '../src/game/powerups/TemporaryEffectManager.ts';

function toBounds(arenaObstacles: (typeof ARENA_LIST)[number]['obstacles']): RectObstacleBounds[] {
  return arenaObstacles.map((o) => ({
    alive: true,
    blocksProjectiles:
      o.type === 'brick' || o.type === 'steel' || o.type === 'crate' || o.type === 'barrel',
    left: o.x - o.w / 2,
    right: o.x + o.w / 2,
    top: o.y - o.h / 2,
    bottom: o.y + o.h / 2,
  }));
}

function legacyRayMarchHasLos(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: readonly RectObstacleBounds[],
  padding = 2
): boolean {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(8, Math.ceil(dist / 24));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    for (const obs of obstacles) {
      if (!obs.alive || !obs.blocksProjectiles) continue;
      if (
        px >= obs.left - padding &&
        px <= obs.right + padding &&
        py >= obs.top - padding &&
        py <= obs.bottom + padding
      ) {
        return false;
      }
    }
  }
  return true;
}

describe('Stage 15: Quality Assurance & Optimization Verification', () => {
  it('1. Verifies all 6 tank roles, passive multipliers, and effective combat stats', () => {
    assert.equal(TANK_LIST.length, 6);
    for (const t of TANK_LIST) {
      assert.equal(t.implemented, true);
      assert.ok(t.stats.maxHp > 0);
      assert.ok(t.stats.moveSpeed > 0);
      assert.ok(t.stats.magazineCapacity >= 3);
      assert.ok(t.stats.projectileDamage > 0);
      assert.ok(t.stats.projectileRange > 0);
      assert.ok(t.activeAbility.cooldownSec > 0);
    }

    // Fortress Reinforced Armor (+50% HP: 160 -> 240)
    assert.equal(getEffectiveTankMaxHp(TANK_DEFINITIONS.fortress), 240);
    // Assault Efficient Reload (-25% reload: 2.5 -> 1.875)
    assert.equal(getEffectiveTankReloadSec(TANK_DEFINITIONS.assault), 1.875);
    // Scout Lightweight Chassis (+25% speed: 216 -> 270)
    assert.equal(getEffectiveTankMoveSpeed(TANK_DEFINITIONS.scout), 270);
    // Artillery Extended Range (+40% range: 560 -> 784)
    assert.equal(getEffectiveTankProjectileRange(TANK_DEFINITIONS.artillery), 784);
    // Tesla Static Charge passive & EMP active
    assert.ok((TANK_DEFINITIONS.tesla.passiveAbility.slowStrength ?? 0) > 0);
    assert.ok((TANK_DEFINITIONS.tesla.activeAbility.empRadius ?? 0) >= 200);
    // Phantom Ghost Protocol stealth detection multiplier
    assert.ok(TANK_DEFINITIONS.phantom.stats.detectionMultiplier < 1.0);
  });

  it('2. Verifies all 3 arenas have 8 obstacle-free spawns and valid obstacle geometry', () => {
    assert.equal(ARENA_LIST.length, 3);
    const maxTankRadius = Math.max(...TANK_LIST.map((t) => t.stats.bodyRadius));

    for (const arena of ARENA_LIST) {
      assert.equal(arena.spawns.length, 8, `${arena.id} must define 8 spawns`);
      assert.ok(arena.obstacles.length >= 20, `${arena.id} should contain tactical obstacles`);

      for (const sp of arena.spawns) {
        assert.ok(sp.x >= maxTankRadius + 20 && sp.x <= arena.width - maxTankRadius - 20);
        assert.ok(sp.y >= maxTankRadius + 20 && sp.y <= arena.height - maxTankRadius - 20);

        for (const obs of arena.obstacles) {
          assert.ok(obs.w > 0 && obs.h > 0);
          if (obs.type === 'bush') continue;
          const left = obs.x - obs.w / 2;
          const right = obs.x + obs.w / 2;
          const top = obs.y - obs.h / 2;
          const bottom = obs.y + obs.h / 2;
          const cx = Math.min(right, Math.max(left, sp.x));
          const cy = Math.min(bottom, Math.max(top, sp.y));
          const dist = Math.hypot(sp.x - cx, sp.y - cy);
          assert.ok(
            dist >= maxTankRadius + 10,
            `${arena.id} spawn (${sp.x},${sp.y}) too close (${dist.toFixed(1)}px) to ${obs.type} at (${obs.x},${obs.y})`
          );
        }
      }
    }
  });

  it('3. Verifies analytical segment-vs-AABB LOS handles edge cases, thin walls, water/bush pass-through, and destroyed cover', () => {
    // Thin 20px wall that 24px ray-march could occasionally step over
    const thinWall: RectObstacleBounds = {
      alive: true,
      blocksProjectiles: true,
      left: 490,
      right: 510,
      top: 200,
      bottom: 400,
    };
    assert.equal(hasLineOfSightObstacles(100, 300, 900, 300, [thinWall], 2), false);

    // Parallel miss above wall
    assert.equal(hasLineOfSightObstacles(100, 190, 900, 190, [thinWall], 2), true);

    // Diagonal hit vs clear corner bypass
    assert.equal(segmentIntersectsAabb(450, 190, 520, 260, 490, 200, 510, 400), true);
    assert.equal(segmentIntersectsAabb(450, 180, 520, 195, 490, 200, 510, 400), false);

    // Water/Bush (`blocksProjectiles: false`) and destroyed walls (`alive: false`) do not block LOS
    assert.equal(
      hasLineOfSightObstacles(100, 300, 900, 300, [{ ...thinWall, blocksProjectiles: false }], 2),
      true
    );
    assert.equal(
      hasLineOfSightObstacles(100, 300, 900, 300, [{ ...thinWall, alive: false }], 2),
      true
    );
  });

  it('4. Verifies power-up effects, shield absorption, mine stacking cap, and pickup spawn validation', () => {
    assert.equal(POWERUP_IDS.length, 10);
    const fx = new TemporaryEffectManager();
    let hp = 100;
    const maxHp = 200;

    // Repair kit restores 45% missing = 45 HP
    const healRes = fx.applyPowerup('repair_kit', true, hp, maxHp, (next) => {
      hp = next;
    });
    assert.equal(healRes.applied, true);
    assert.equal(healRes.healedAmount, 45);
    assert.equal(hp, 145);

    // Mine kit grants 2 charges capped at maxCarriedCharges (3)
    const m1 = fx.applyPowerup('mine_kit', true, hp, maxHp, () => {});
    assert.equal(m1.minesAdded, 2);
    const m2 = fx.applyPowerup('mine_kit', true, hp, maxHp, () => {});
    assert.equal(m2.minesAdded, 1);
    assert.equal(fx.mineCharges, MINE_SYSTEM_CONFIG.maxCarriedCharges);

    // Shield absorbs incoming damage cleanly before breaking
    fx.activateShield(50, 'powerup');
    const hit1 = fx.absorbIncomingDamage(30, 'projectile');
    assert.equal(hit1.absorbed, 30);
    assert.equal(hit1.remainingDamage, 0);
    assert.equal(hit1.broken, false);
    const hit2 = fx.absorbIncomingDamage(35, 'projectile');
    assert.equal(hit2.absorbed, 20);
    assert.equal(hit2.remainingDamage, 15);
    assert.equal(hit2.broken, true);

    // Clear removes all active temporary buffs & shield
    fx.clearAll();
    assert.equal(fx.activeBuffs.size, 0);
    assert.equal(fx.shieldHp, 0);

    // Powerup spawn validation checks obstacles, spawns, and separation
    const arena = ARENA_LIST[0];
    const valid = isValidPickupSpawnPosition(
      arena.width / 2,
      arena.height / 2 + 115,
      arena.width,
      arena.height,
      [],
      arena.obstacles.map((o) => ({
        alive: true,
        containsPoint: (px: number, py: number, pad = 0) =>
          px >= o.x - o.w / 2 - pad &&
          px <= o.x + o.w / 2 + pad &&
          py >= o.y - o.h / 2 - pad &&
          py <= o.y + o.h / 2 + pad,
      })),
      arena.spawns,
      []
    );
    assert.equal(valid, true);
  });

  it('5. Benchmarks analytical slab LOS vs legacy 24px ray-marching across 10,000 queries', () => {
    const arena = ARENA_LIST[1]; // Industrial Zone (42 obstacles)
    const bounds = toBounds(arena.obstacles);
    const queries: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 1000; i++) {
      const a = arena.spawns[i % arena.spawns.length];
      const b = arena.spawns[(i + 3) % arena.spawns.length];
      queries.push([a.x + (i % 7) * 15, a.y + (i % 5) * 12, b.x - (i % 9) * 14, b.y - (i % 6) * 10]);
    }

    let legacyHits = 0;
    const t0 = performance.now();
    for (let rep = 0; rep < 10; rep++) {
      for (let i = 0; i < queries.length; i++) {
        const [x1, y1, x2, y2] = queries[i];
        if (legacyRayMarchHasLos(x1, y1, x2, y2, bounds, 2)) legacyHits += 1;
      }
    }
    const legacyMs = performance.now() - t0;

    let analyticalHits = 0;
    const t1 = performance.now();
    for (let rep = 0; rep < 10; rep++) {
      for (let i = 0; i < queries.length; i++) {
        const [x1, y1, x2, y2] = queries[i];
        if (hasLineOfSightObstacles(x1, y1, x2, y2, bounds, 2)) analyticalHits += 1;
      }
    }
    const analyticalMs = performance.now() - t1;

    const speedup = legacyMs / Math.max(0.001, analyticalMs);
    console.info(
      `[Stage 15 Benchmark] 10,000 Industrial Zone LOS checks: legacy_raymarch=${legacyMs.toFixed(2)}ms (clear=${legacyHits}), analytical_slab=${analyticalMs.toFixed(2)}ms (clear=${analyticalHits}), speedup=${speedup.toFixed(2)}x`
    );

    assert.ok(analyticalMs < legacyMs, 'Analytical slab LOS must outperform 24px ray-marching');
  });
});
