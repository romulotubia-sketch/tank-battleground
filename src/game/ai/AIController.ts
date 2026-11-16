import Phaser from 'phaser';
import { MINE_SYSTEM_CONFIG } from '../../data/powerups';
import { ObstacleEntity } from '../entities/ObstacleEntity';
import { TankEntity } from '../entities/TankEntity';
import { ActiveWorldPowerup } from '../powerups/PowerupManager';
import { ProjectilePool } from '../projectiles/ProjectilePool';
import { hasLineOfSightObstacles } from './lineOfSight';
export { hasLineOfSightObstacles, segmentIntersectsAabb } from './lineOfSight';
export type { RectObstacleBounds } from './lineOfSight';

export interface AIDecision {
  moveX: number;
  moveY: number;
  aimAngle: number;
  shouldFire: boolean;
  shouldUseAbility: boolean;
  shouldDeployMine: boolean;
  abilityTargetX?: number;
  abilityTargetY?: number;
}

/**
 * Modular AI Controller
 * Uses periodic decision updates (~150ms) to keep mobile CPU cost low
 * while interacting with the exact same game rules as the human player.
 */
export class AIController {
  private decisionTimer = Math.random() * 0.15;
  private wanderAngle = Math.random() * Math.PI * 2;
  private wanderTimer = 1 + Math.random() * 1.5;
  private strafeSign = Math.random() > 0.5 ? 1 : -1;
  private lastX = 0;
  private lastY = 0;
  private stuckTimer = 0;

  private cachedMoveX = 0;
  private cachedMoveY = 0;
  private cachedAimAngle = 0;
  private cachedFire = false;
  private cachedAbility = false;
  private engageGraceTimer = 1.2 + Math.random() * 0.8;
  private aimJitter = 0;
  private currentTargetId: string | null = null;
  private postShotCooldown = 0;
  private detourTimer = 0;
  private detourAngle = 0;

  update(
    dt: number,
    self: TankEntity,
    allTanks: TankEntity[],
    obstacles: ObstacleEntity[],
    powerups: readonly ActiveWorldPowerup[],
    projectiles: ProjectilePool,
    arenaWidth: number,
    arenaHeight: number
  ): AIDecision {
    if (!self.alive) {
      this.currentTargetId = null;
      this.detourTimer = 0;
      return {
        moveX: 0,
        moveY: 0,
        aimAngle: self.turretAngle,
        shouldFire: false,
        shouldUseAbility: false,
        shouldDeployMine: false,
      };
    }

    if (this.engageGraceTimer > 0) {
      this.engageGraceTimer = Math.max(0, this.engageGraceTimer - dt);
    }
    if (this.postShotCooldown > 0) {
      this.postShotCooldown = Math.max(0, this.postShotCooldown - dt);
    }
    if (this.detourTimer > 0) {
      this.detourTimer = Math.max(0, this.detourTimer - dt);
    }

    this.decisionTimer -= dt;
    if (this.decisionTimer > 0) {
      // Never emit continuous fire/ability triggers between decision ticks or while reloading
      return {
        moveX: this.cachedMoveX,
        moveY: this.cachedMoveY,
        aimAngle: this.cachedAimAngle,
        shouldFire: false,
        shouldUseAbility: false,
        shouldDeployMine: false,
      };
    }

    const stepDt = 0.15;
    this.decisionTimer = stepDt + Math.random() * 0.05;
    this.aimJitter = (Math.random() - 0.5) * 0.34;

    // Stuck detection: trigger a committed clear-probe detour instead of pushing into walls/water
    const stuckThreshold =
      self.definition.id === 'scout' || self.definition.id === 'phantom' || self.personality === 'mobile'
        ? 0.34
        : 0.48;
    const attemptingMove = Math.hypot(this.cachedMoveX, this.cachedMoveY) > 0.25;
    if (attemptingMove && Math.hypot(self.x - this.lastX, self.y - this.lastY) < 7) {
      this.stuckTimer += stepDt;
      if (this.stuckTimer >= stuckThreshold) {
        const baseAng = Math.atan2(this.cachedMoveY, this.cachedMoveX);
        this.detourAngle = this.pickClearDetourAngle(
          self,
          baseAng,
          obstacles,
          arenaWidth,
          arenaHeight
        );
        this.wanderAngle = this.detourAngle;
        this.detourTimer = 0.82;
        this.strafeSign *= -1;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    this.lastX = self.x;
    this.lastY = self.y;

    // 1. Evaluate visible targets using fair detection range & anti-dogpile distribution
    const selfRadarRadius = self.effectsManager.getRadarRadius();
    const selfHasRadar = selfRadarRadius > 0;
    const baseDetectRange = selfHasRadar
      ? Math.max(860, selfRadarRadius)
      : self.definition.id === 'artillery'
      ? Math.max(620, self.getEffectiveProjectileRange() * 0.96)
      : 620;
    let bestTarget: TankEntity | null = null;
    let bestHasLos = false;
    let bestTargetDist = Infinity;
    let bestScore = -Infinity;

    for (const other of allTanks) {
      if (!other.alive || other.id === self.id) continue;
      const dist = Math.hypot(other.x - self.x, other.y - self.y);

      // Respect Phantom Ghost Protocol passive & bush concealment unless Radar covers this range or target opened fire
      let effectiveRange = baseDetectRange * other.getEffectiveDetectionMultiplier();
      if (other.recentAttackTimer > 0) {
        effectiveRange = Math.max(effectiveRange, baseDetectRange * 0.92);
      }
      const radarCoversOther = selfHasRadar && dist <= selfRadarRadius;
      if (radarCoversOther) {
        effectiveRange = Math.max(effectiveRange, selfRadarRadius);
      } else {
        if (other.concealed) effectiveRange *= 0.42;
        if (other.phaseCloaked) effectiveRange *= 0.55;
      }

      if (dist > effectiveRange) continue;

      const hasLos = this.hasLineOfSight(self.x, self.y, other.x, other.y, obstacles);
      let score = (750 - dist) * 0.55;
      if (hasLos) score += 260;

      // Duel stickiness: prefer finishing an active target rather than ping-ponging
      if (other.id === this.currentTargetId && hasLos) {
        score += 140;
      }

      // Anti-dogpile: avoid stacking multiple bots onto one already-engaged opponent
      let otherAttackers = 0;
      const peerRangeSq = 460 * 460;
      for (const peer of allTanks) {
        if (!peer.alive || peer.id === self.id || peer.id === other.id || peer.isPlayer) continue;
        const pdx = other.x - peer.x;
        const pdy = other.y - peer.y;
        if (pdx * pdx + pdy * pdy > peerRangeSq) continue;
        const angleToOther = Math.atan2(pdy, pdx);
        if (Math.abs(Phaser.Math.Angle.Wrap(angleToOther - peer.turretAngle)) < 0.5) {
          otherAttackers += 1;
        }
      }
      score -= otherAttackers * 190;

      if (self.personality === 'opportunistic' && other.hp < other.maxHp * 0.45) {
        score += 110;
      }
      if (self.personality === 'aggressive') {
        score += (600 - dist) * 0.25;
      }
      if (score > bestScore) {
        bestScore = score;
        bestTarget = other;
        bestHasLos = hasLos;
        bestTargetDist = dist;
      }
    }
    this.currentTargetId = bestTarget ? bestTarget.id : null;

    // 2. Utility-based powerup evaluation (ignores useless pickups & won't abandon close duels recklessly)
    let targetPowerup: ActiveWorldPowerup | null = null;
    let bestPwrDist = Infinity;
    let bestPwrUtility = 0;
    const maxSearchRadius =
      (self.personality === 'opportunistic' ? 460 : 340) +
      (self.hp < self.maxHp * 0.5 ? 140 : 0);

    for (const pwr of powerups) {
      const d = Math.hypot(pwr.x - self.x, pwr.y - self.y);
      if (d > maxSearchRadius) continue;

      const utility = this.evaluatePowerupUtility(self, pwr, d, obstacles);
      if (utility > bestPwrUtility) {
        bestPwrUtility = utility;
        targetPowerup = pwr;
        bestPwrDist = d;
      }
    }

    const inCloseLosDuel = Boolean(bestTarget && bestHasLos && bestTargetDist < 290);
    const shouldSeekPowerup =
      Boolean(targetPowerup) &&
      (!inCloseLosDuel ||
        bestPwrDist < 145 ||
        (self.hp < self.maxHp * 0.42 &&
          (targetPowerup?.id === 'repair_kit' || targetPowerup?.id === 'shield')));

    // 3. Movement steering vector
    let steerX = 0;
    let steerY = 0;

    // Incoming projectile dodge check (Mobile/Tactical personalities react strongest)
    const threat = projectiles.getActiveThreatNear(self.x, self.y, 130, self.id);
    if (threat) {
      const perpX = -threat.vy;
      const perpY = threat.vx;
      const plen = Math.hypot(perpX, perpY) || 1;
      steerX += (perpX / plen) * 1.4 * this.strafeSign;
      steerY += (perpY / plen) * 1.4 * this.strafeSign;
    }

    if (this.detourTimer > 0) {
      // Follow committed clear detour route around blocking wall or water basin
      steerX += Math.cos(this.detourAngle) * 1.65;
      steerY += Math.sin(this.detourAngle) * 1.65;
    } else if (targetPowerup && shouldSeekPowerup) {
      const ang = Math.atan2(targetPowerup.y - self.y, targetPowerup.x - self.x);
      steerX += Math.cos(ang);
      steerY += Math.sin(ang);
    } else if (bestTarget) {
      const distToTarget = Math.hypot(bestTarget.x - self.x, bestTarget.y - self.y);
      const angToTarget = Math.atan2(bestTarget.y - self.y, bestTarget.x - self.x);
      const desiredRange =
        self.definition.id === 'artillery'
          ? 455
          : self.definition.id === 'tesla'
          ? 275
          : self.definition.id === 'phantom'
          ? 285
          : self.personality === 'aggressive'
          ? 180
          : self.personality === 'defensive'
          ? 360
          : self.definition.id === 'scout'
          ? 250
          : 265;

      // Check if surrounded by multiple close opponents (Tesla & Phantom repositioning)
      let nearbyCount = 0;
      let crowdCenterX = 0;
      let crowdCenterY = 0;
      if (self.definition.id === 'tesla' || self.definition.id === 'phantom') {
        const crowdRangeSq = 275 * 275;
        for (const other of allTanks) {
          if (!other.alive || other.id === self.id) continue;
          const odx = other.x - self.x;
          const ody = other.y - self.y;
          if (odx * odx + ody * ody <= crowdRangeSq) {
            nearbyCount += 1;
            crowdCenterX += other.x;
            crowdCenterY += other.y;
          }
        }
      }

      const hpLow = self.hp < self.maxHp * (self.definition.id === 'scout' || self.definition.id === 'phantom' ? 0.44 : 0.35);
      if (self.definition.id === 'phantom' && self.phaseCloaked) {
        // Actively use Phase Shift mobility to reposition away from danger
        const awayAng =
          nearbyCount > 0
            ? Math.atan2(self.y - crowdCenterY / nearbyCount, self.x - crowdCenterX / nearbyCount)
            : angToTarget + Math.PI;
        steerX += Math.cos(awayAng) * 1.2;
        steerY += Math.sin(awayAng) * 1.2;
      } else if (nearbyCount >= 2) {
        // Reposition away from surrounding opponents
        const avgX = crowdCenterX / nearbyCount;
        const avgY = crowdCenterY / nearbyCount;
        const awayAng = Math.atan2(self.y - avgY, self.x - avgX);
        steerX += Math.cos(awayAng) * 1.25;
        steerY += Math.sin(awayAng) * 1.25;
      } else if (hpLow && self.personality !== 'aggressive') {
        // Kite away
        steerX -= Math.cos(angToTarget);
        steerY -= Math.sin(angToTarget);
      } else if (distToTarget > desiredRange + 45) {
        steerX += Math.cos(angToTarget);
        steerY += Math.sin(angToTarget);
      } else if (
        distToTarget <
        desiredRange - (self.definition.id === 'artillery' ? 95 : 55)
      ) {
        steerX -= Math.cos(angToTarget) * (self.definition.id === 'artillery' ? 1.05 : 0.85);
        steerY -= Math.sin(angToTarget) * (self.definition.id === 'artillery' ? 1.05 : 0.85);
      }

      // Strafe perpendicular for mobile / tactical fighting (Phantom stays mobile)
      const strafeWeight =
        self.definition.id === 'scout' || self.personality === 'mobile'
          ? 1.25
          : self.definition.id === 'phantom'
          ? 1.15
          : self.definition.id === 'artillery'
          ? 0.82
          : self.definition.id === 'tesla'
          ? 0.85
          : 0.72;
      steerX += Math.cos(angToTarget + (Math.PI / 2) * this.strafeSign) * strafeWeight;
      steerY += Math.sin(angToTarget + (Math.PI / 2) * this.strafeSign) * strafeWeight;
    } else {
      // Patrol arena lanes naturally without everyone dogpiling the center simultaneously
      this.wanderTimer -= stepDt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 1.6 + Math.random() * 1.8;
        const nearOuterEdge =
          self.x < 260 || self.x > arenaWidth - 260 || self.y < 200 || self.y > arenaHeight - 200;
        if (nearOuterEdge) {
          const centerAngle = Math.atan2(arenaHeight / 2 - self.y, arenaWidth / 2 - self.x);
          this.wanderAngle = centerAngle + (Math.random() - 0.5) * 1.4;
        } else {
          this.wanderAngle += (Math.random() - 0.5) * 2.2;
        }
      }
      steerX += Math.cos(this.wanderAngle);
      steerY += Math.sin(this.wanderAngle);
    }

    // Arena border repulsion
    const margin = 84;
    if (self.x < margin) steerX += 1.75;
    if (self.x > arenaWidth - margin) steerX -= 1.75;
    if (self.y < margin) steerY += 1.75;
    if (self.y > arenaHeight - margin) steerY -= 1.75;

    // Closest-point AABB obstacle/water avoidance + tangent wall sliding + priming barrel evasion
    const avoidMargin = self.radius + 36;
    const avoidMarginSq = avoidMargin * avoidMargin;
    const dangerRange = 155;
    const dangerRangeSq = dangerRange * dangerRange;
    for (const obs of obstacles) {
      if (!obs.alive) continue;

      if (obs.isPriming) {
        const bx = self.x - obs.x;
        const by = self.y - obs.y;
        const bDistSq = bx * bx + by * by;
        if (bDistSq < dangerRangeSq && bDistSq > 0.0001) {
          const bd = Math.sqrt(bDistSq);
          const flee = ((dangerRange - bd) / dangerRange) * 2.8;
          steerX += (bx / bd) * flee;
          steerY += (by / bd) * flee;
        }
        continue;
      }

      if (!obs.blocksMovement) continue;

      const closestX = Phaser.Math.Clamp(self.x, obs.left, obs.right);
      const closestY = Phaser.Math.Clamp(self.y, obs.top, obs.bottom);
      const dx = self.x - closestX;
      const dy = self.y - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq >= avoidMarginSq) continue;
      const d = Math.sqrt(distSq);

      {
        let nx: number;
        let ny: number;
        if (d > 0.01) {
          nx = dx / d;
          ny = dy / d;
        } else {
          const cdx = self.x - obs.x;
          const cdy = self.y - obs.y;
          const cd = Math.hypot(cdx, cdy) || 1;
          nx = cdx / cd;
          ny = cdy / cd;
        }

        const strength = (avoidMargin - d) / avoidMargin;
        const pushWeight = obs.type === 'water' ? 2.35 : 2.05;
        steerX += nx * strength * pushWeight;
        steerY += ny * strength * pushWeight;

        // If steering directly into the obstacle face, add consistent tangent slide to flank around it
        const dotInto = steerX * nx + steerY * ny;
        if (dotInto < 0) {
          const tx = -ny * this.strafeSign;
          const ty = nx * this.strafeSign;
          steerX += tx * strength * 1.45;
          steerY += ty * strength * 1.45;
        }
      }
    }

    const steerMag = Math.hypot(steerX, steerY);
    if (steerMag > 0.05) {
      this.cachedMoveX = steerX / steerMag;
      this.cachedMoveY = steerY / steerMag;
    } else {
      this.cachedMoveX = 0;
      this.cachedMoveY = 0;
    }

    // 4. Aiming, Firing & Active Ability logic
    this.cachedFire = false;
    this.cachedAbility = false;
    let abilityTargetX: number | undefined;
    let abilityTargetY: number | undefined;

    if (bestTarget) {
      const dist = Math.hypot(bestTarget.x - self.x, bestTarget.y - self.y);
      // Slight lead prediction + human-like angular jitter
      const timeToHit = dist / self.definition.stats.projectileSpeed;
      const leadX = bestTarget.x + bestTarget.vx * timeToHit * 0.2;
      const leadY = bestTarget.y + bestTarget.vy * timeToHit * 0.2;
      this.cachedAimAngle = Math.atan2(leadY - self.y, leadX - self.x) + this.aimJitter;

      const hasLos = bestHasLos;
      const turretAligned =
        Math.abs(Phaser.Math.Angle.Wrap(this.cachedAimAngle - self.turretAngle)) < 0.32;
      const maxFireRange = self.getEffectiveProjectileRange() * 1.01;
      const hasRapidFire =
        (self.abilityActiveTimer > 0 && Boolean(self.definition.activeAbility.fireRateMultiplier)) ||
        self.hasBuff('rapid_fire');

      // Respect fireCooldownTimer, magazine ammo, reload state & reaction spacing before firing
      if (
        this.engageGraceTimer <= 0 &&
        !self.isReloading &&
        self.ammo > 0 &&
        self.fireCooldownTimer <= 0 &&
        this.postShotCooldown <= 0 &&
        hasLos &&
        turretAligned &&
        dist <= maxFireRange &&
        (hasRapidFire || Math.random() < 0.72)
      ) {
        this.cachedFire = true;
        this.postShotCooldown = hasRapidFire
          ? 0.14 + Math.random() * 0.12
          : 0.24 + Math.random() * 0.26;
      }

      // Smart active ability trigger (only after opening grace, never while active or on cooldown)
      if (this.engageGraceTimer <= 0 && self.abilityCooldownTimer <= 0 && self.abilityActiveTimer <= 0) {
        if (self.definition.id === 'fortress') {
          if (
            self.shieldHp <= 0 &&
            (self.hp < self.maxHp * 0.85 || (hasLos && dist < 380))
          ) {
            this.cachedAbility = true;
          }
        } else if (self.definition.id === 'scout') {
          const underThreat = Boolean(threat) || self.hp < self.maxHp * 0.55;
          const flankingMove =
            hasLos && dist > 235 && dist < 490 && self.ammo >= 3 && !self.isReloading;
          if (underThreat || flankingMove) {
            this.cachedAbility = true;
          }
        } else if (self.definition.id === 'artillery') {
          // Only bombard when an enemy is in suitable artillery range and not point-blank
          const maxBarrageRange = self.getEffectiveProjectileRange() * 0.94;
          const targetSpeed = Math.hypot(bestTarget.vx, bestTarget.vy);
          let nearbyCluster = 0;
          const clusterRangeSq = 170 * 170;
          for (const peer of allTanks) {
            if (!peer.alive || peer.id === self.id || peer.id === bestTarget.id) continue;
            const pdx = peer.x - bestTarget.x;
            const pdy = peer.y - bestTarget.y;
            if (pdx * pdx + pdy * pdy <= clusterRangeSq) {
              nearbyCluster += 1;
            }
          }
          const suitableTarget =
            dist >= 165 &&
            dist <= maxBarrageRange &&
            (targetSpeed < 175 || nearbyCluster > 0 || (hasLos && dist >= 250));
          if (suitableTarget) {
            this.cachedAbility = true;
            abilityTargetX = bestTarget.x + bestTarget.vx * 0.35;
            abilityTargetY = bestTarget.y + bestTarget.vy * 0.35;
          }
        } else if (self.definition.id === 'tesla') {
          const empRadius = self.definition.activeAbility.empRadius ?? 220;
          let enemiesInEmp = 0;
          let minEmpDist = Infinity;
          let enemyUsingMoveAbility = false;

          for (const other of allTanks) {
            if (!other.alive || other.id === self.id) continue;
            const d = Math.hypot(other.x - self.x, other.y - self.y);
            if (d <= empRadius + other.radius) {
              enemiesInEmp += 1;
              if (d < minEmpDist) minEmpDist = d;
              if (
                other.abilityActiveTimer > 0 &&
                Boolean(other.definition.activeAbility.speedBoostMultiplier)
              ) {
                enemyUsingMoveAbility = true;
              }
            }
          }

          // Never waste EMP Pulse with 0 enemies in radius; trigger on multi-target clusters or close pressure
          if (
            enemiesInEmp >= 2 ||
            (enemiesInEmp >= 1 &&
              (minEmpDist <= empRadius * 0.72 ||
                enemyUsingMoveAbility ||
                self.hp < self.maxHp * 0.58))
          ) {
            this.cachedAbility = true;
          }
        } else if (self.definition.id === 'phantom') {
          let closeEnemies = 0;
          const closeRangeSq = 340 * 340;
          for (const other of allTanks) {
            if (!other.alive || other.id === self.id) continue;
            const odx = other.x - self.x;
            const ody = other.y - self.y;
            if (odx * odx + ody * ody <= closeRangeSq) {
              closeEnemies += 1;
            }
          }
          const incomingDanger = Boolean(threat) || closeEnemies >= 2;
          const pressuredWhileHurt =
            hasLos &&
            dist <= 380 &&
            (self.hp < self.maxHp * 0.68 || (dist <= 225 && (self.isReloading || self.ammo <= 1)));

          // Only use Phase Shift when escaping a genuine threat; never waste when safe
          if (incomingDanger || pressuredWhileHurt) {
            this.cachedAbility = true;
          }
        } else if (self.definition.id === 'assault') {
          if (hasLos && dist <= 470 && self.ammo >= 4 && !self.isReloading) {
            this.cachedAbility = true;
          }
        } else if (hasLos && dist < 380 && self.ammo > 0 && !self.isReloading && Math.random() < 0.15) {
          this.cachedAbility = true;
        }
      }
    } else {
      // Tactical reload while out of combat if magazine is below 35%
      if (!self.isReloading && self.ammo > 0 && self.ammo <= Math.floor(self.maxAmmo * 0.35)) {
        self.startReload();
      }
      // Look ahead while roaming; occasionally clear destructible crates/bricks blocking path
      this.cachedAimAngle =
        steerMag > 0.1 ? Math.atan2(this.cachedMoveY, this.cachedMoveX) : self.hullAngle;
      if (
        this.engageGraceTimer <= 0 &&
        !self.isReloading &&
        self.ammo > 0 &&
        self.fireCooldownTimer <= 0 &&
        this.postShotCooldown <= 0
      ) {
        const roamClearRangeSq = 120 * 120;
        for (const obs of obstacles) {
          if (!obs.alive || !obs.destructible) continue;
          if (obs.type === 'barrel') continue; // Never self-detonate adjacent barrels while roaming
          const odx = obs.x - self.x;
          const ody = obs.y - self.y;
          if (odx * odx + ody * ody < roamClearRangeSq) {
            this.cachedAimAngle = Math.atan2(ody, odx);
            this.cachedFire = true;
            this.postShotCooldown = 0.3 + Math.random() * 0.25;
            break;
          }
        }
      }
    }

    const shouldDeployMine =
      this.engageGraceTimer <= 0 &&
      self.mineCharges > 0 &&
      self.mineDeployCooldown <= 0 &&
      projectiles.getActiveMineCount(self.id) < MINE_SYSTEM_CONFIG.maxActivePerTank &&
      ((bestTarget !== null && bestTargetDist <= 285) ||
        (Boolean(threat) && projectiles.getActiveMineCount(self.id) === 0));

    return {
      moveX: this.cachedMoveX,
      moveY: this.cachedMoveY,
      aimAngle: this.cachedAimAngle,
      shouldFire: this.cachedFire,
      shouldUseAbility: this.cachedAbility,
      shouldDeployMine,
      abilityTargetX,
      abilityTargetY,
    };
  }

  private evaluatePowerupUtility(
    self: TankEntity,
    pwr: ActiveWorldPowerup,
    dist: number,
    obstacles: ObstacleEntity[]
  ): number {
    // Avoid walking straight onto a priming explosive barrel for a pickup
    const barrelDangerSq = 145 * 145;
    for (const obs of obstacles) {
      if (!obs.alive || !obs.isPriming) continue;
      const dx = obs.x - pwr.x;
      const dy = obs.y - pwr.y;
      if (dx * dx + dy * dy < barrelDangerSq) {
        return -Infinity;
      }
    }

    const hpRatio = self.hp / Math.max(1, self.maxHp);
    let baseValue = 0;

    switch (pwr.id) {
      case 'repair_kit':
        if (hpRatio >= 0.92) return -Infinity;
        baseValue = (1 - hpRatio) * 185;
        break;
      case 'mine_kit':
        if (self.mineCharges >= MINE_SYSTEM_CONFIG.maxCarriedCharges) return -Infinity;
        baseValue = self.mineCharges === 0 ? 78 : 42;
        break;
      case 'shield':
        if (self.shieldHp >= 45) baseValue = 18;
        else baseValue = hpRatio < 0.7 ? 118 : 88;
        break;
      case 'cooldown_boost':
        baseValue = self.abilityCooldownTimer > 2.0 ? 86 : 36;
        break;
      case 'rapid_fire':
        baseValue = self.hasBuff('rapid_fire') ? 24 : 92;
        break;
      case 'heavy_shell':
        baseValue = self.hasBuff('heavy_shell') ? 24 : 90;
        break;
      case 'multi_shot':
        baseValue = self.hasBuff('multi_shot') ? 22 : 84;
        break;
      case 'piercing_shell':
        baseValue = self.hasBuff('piercing_shell') ? 20 : 76;
        break;
      case 'speed_boost':
        baseValue = self.hasBuff('speed_boost') ? 18 : 74;
        break;
      case 'radar':
        baseValue = self.hasBuff('radar') ? 16 : 68;
        break;
    }

    if (self.personality === 'opportunistic') {
      baseValue *= 1.15;
    }
    return baseValue - dist * 0.16;
  }

  private pickClearDetourAngle(
    self: TankEntity,
    blockedAngle: number,
    obstacles: ObstacleEntity[],
    arenaWidth: number,
    arenaHeight: number
  ): number {
    const sign = this.strafeSign;
    const offsets = [
      sign * 1.05,
      -sign * 1.05,
      sign * 1.75,
      -sign * 1.75,
      sign * 2.45,
      -sign * 2.45,
      Math.PI,
    ];
    const probeDist = self.radius + 54;
    let bestAngle = blockedAngle + sign * 1.57;
    let bestClearScore = -Infinity;

    for (const off of offsets) {
      const cand = blockedAngle + off;
      const px = self.x + Math.cos(cand) * probeDist;
      const py = self.y + Math.sin(cand) * probeDist;
      if (px < 52 || px > arenaWidth - 52 || py < 52 || py > arenaHeight - 52) continue;

      let minClear = Infinity;
      for (const obs of obstacles) {
        if (!obs.alive || !obs.blocksMovement) continue;
        const cx = Phaser.Math.Clamp(px, obs.left, obs.right);
        const cy = Phaser.Math.Clamp(py, obs.top, obs.bottom);
        const d = Math.hypot(px - cx, py - cy);
        if (d < minClear) minClear = d;
      }

      if (minClear >= self.radius + 14) {
        return cand;
      }
      if (minClear > bestClearScore) {
        bestClearScore = minClear;
        bestAngle = cand;
      }
    }
    return bestAngle;
  }

  private hasLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    obstacles: ObstacleEntity[]
  ): boolean {
    return hasLineOfSightObstacles(x1, y1, x2, y2, obstacles, 2);
  }
}
