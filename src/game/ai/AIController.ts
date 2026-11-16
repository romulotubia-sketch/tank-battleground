import Phaser from 'phaser';
import { ObstacleEntity } from '../entities/ObstacleEntity';
import { TankEntity } from '../entities/TankEntity';
import { ActiveWorldPowerup } from '../powerups/PowerupManager';
import { ProjectilePool } from '../projectiles/ProjectilePool';

export interface AIDecision {
  moveX: number;
  moveY: number;
  aimAngle: number;
  shouldFire: boolean;
  shouldUseAbility: boolean;
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
      return {
        moveX: 0,
        moveY: 0,
        aimAngle: self.turretAngle,
        shouldFire: false,
        shouldUseAbility: false,
      };
    }

    if (this.engageGraceTimer > 0) {
      this.engageGraceTimer = Math.max(0, this.engageGraceTimer - dt);
    }
    if (this.postShotCooldown > 0) {
      this.postShotCooldown = Math.max(0, this.postShotCooldown - dt);
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
      };
    }

    const stepDt = 0.15;
    this.decisionTimer = stepDt + Math.random() * 0.05;
    this.aimJitter = (Math.random() - 0.5) * 0.34;

    // Stuck detection (Scout/mobile AI pivots faster so it avoids sitting idle against obstacles)
    const stuckThreshold = self.definition.id === 'scout' || self.personality === 'mobile' ? 0.36 : 0.55;
    if (Math.hypot(self.x - this.lastX, self.y - this.lastY) < 6) {
      this.stuckTimer += stepDt;
      if (this.stuckTimer > stuckThreshold) {
        this.wanderAngle += Math.PI * 0.72 * this.strafeSign;
        this.strafeSign *= -1;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    this.lastX = self.x;
    this.lastY = self.y;

    // 1. Evaluate visible targets using fair detection range & anti-dogpile distribution
    const baseDetectRange = self.hasBuff('radar')
      ? 860
      : self.definition.id === 'artillery'
      ? Math.max(620, self.getEffectiveProjectileRange() * 0.96)
      : 620;
    let bestTarget: TankEntity | null = null;
    let bestScore = -Infinity;

    for (const other of allTanks) {
      if (!other.alive || other.id === self.id) continue;
      const dist = Math.hypot(other.x - self.x, other.y - self.y);

      // Respect Phantom passive & bush concealment unless Radar is active
      let effectiveRange = baseDetectRange * other.definition.stats.detectionMultiplier;
      if (other.concealed && !self.hasBuff('radar')) effectiveRange *= 0.42;
      if (other.phaseCloaked && !self.hasBuff('radar')) effectiveRange *= 0.48;

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
      for (const peer of allTanks) {
        if (!peer.alive || peer.id === self.id || peer.id === other.id || peer.isPlayer) continue;
        const peerDist = Math.hypot(other.x - peer.x, other.y - peer.y);
        if (peerDist > 460) continue;
        const angleToOther = Math.atan2(other.y - peer.y, other.x - peer.x);
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
      }
    }
    this.currentTargetId = bestTarget ? bestTarget.id : null;

    // 2. Check nearby powerups
    let targetPowerup: ActiveWorldPowerup | null = null;
    let nearestPwrDist = self.personality === 'opportunistic' ? 420 : 270;
    if (self.hp < self.maxHp * 0.55) nearestPwrDist += 140;
    for (const pwr of powerups) {
      const d = Math.hypot(pwr.x - self.x, pwr.y - self.y);
      if (d < nearestPwrDist) {
        nearestPwrDist = d;
        targetPowerup = pwr;
      }
    }

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

    if (targetPowerup && (!bestTarget || self.hp < self.maxHp * 0.65 || nearestPwrDist < 190)) {
      const ang = Math.atan2(targetPowerup.y - self.y, targetPowerup.x - self.x);
      steerX += Math.cos(ang);
      steerY += Math.sin(ang);
    } else if (bestTarget) {
      const distToTarget = Math.hypot(bestTarget.x - self.x, bestTarget.y - self.y);
      const angToTarget = Math.atan2(bestTarget.y - self.y, bestTarget.x - self.x);
      const desiredRange =
        self.definition.id === 'artillery'
          ? 455
          : self.personality === 'aggressive'
          ? 180
          : self.personality === 'defensive'
          ? 360
          : self.definition.id === 'scout'
          ? 250
          : 265;

      const hpLow = self.hp < self.maxHp * (self.definition.id === 'scout' ? 0.42 : 0.35);
      if (hpLow && self.personality !== 'aggressive') {
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
        steerX -= Math.cos(angToTarget) * (self.definition.id === 'artillery' ? 1.05 : 0.8);
        steerY -= Math.sin(angToTarget) * (self.definition.id === 'artillery' ? 1.05 : 0.8);
      }

      // Strafe perpendicular for mobile / tactical fighting
      const strafeWeight =
        self.definition.id === 'scout' || self.personality === 'mobile'
          ? 1.25
          : self.definition.id === 'artillery'
          ? 0.82
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

    // Wall & obstacle repulsion feelers
    const margin = 80;
    if (self.x < margin) steerX += 1.6;
    if (self.x > arenaWidth - margin) steerX -= 1.6;
    if (self.y < margin) steerY += 1.6;
    if (self.y > arenaHeight - margin) steerY -= 1.6;

    for (const obs of obstacles) {
      if (!obs.alive || !obs.blocksMovement) continue;
      const dx = self.x - obs.x;
      const dy = self.y - obs.y;
      const avoidDist = Math.max(obs.width, obs.height) * 0.65 + 48;
      const d = Math.hypot(dx, dy);
      if (d < avoidDist && d > 0.01) {
        const push = ((avoidDist - d) / avoidDist) * 1.9;
        steerX += (dx / d) * push;
        steerY += (dy / d) * push;
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

      const hasLos = this.hasLineOfSight(self.x, self.y, bestTarget.x, bestTarget.y, obstacles);
      const turretAligned =
        Math.abs(Phaser.Math.Angle.Wrap(this.cachedAimAngle - self.turretAngle)) < 0.32;
      const maxFireRange = self.getEffectiveProjectileRange() * 1.01;

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
        Math.random() < 0.72
      ) {
        this.cachedFire = true;
        this.postShotCooldown = 0.24 + Math.random() * 0.26;
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
          for (const peer of allTanks) {
            if (!peer.alive || peer.id === self.id || peer.id === bestTarget.id) continue;
            if (Math.hypot(peer.x - bestTarget.x, peer.y - bestTarget.y) <= 170) {
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
        } else if (self.definition.id === 'tesla' && dist < 190) {
          this.cachedAbility = true;
        } else if (self.definition.id === 'phantom' && self.hp < self.maxHp * 0.6) {
          this.cachedAbility = true;
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
        for (const obs of obstacles) {
          if (!obs.alive || !obs.destructible) continue;
          if (obs.type === 'barrel') continue; // Never self-detonate adjacent barrels while roaming
          const d = Math.hypot(obs.x - self.x, obs.y - self.y);
          if (d < 120) {
            this.cachedAimAngle = Math.atan2(obs.y - self.y, obs.x - self.x);
            this.cachedFire = true;
            this.postShotCooldown = 0.3 + Math.random() * 0.25;
            break;
          }
        }
      }
    }

    return {
      moveX: this.cachedMoveX,
      moveY: this.cachedMoveY,
      aimAngle: this.cachedAimAngle,
      shouldFire: this.cachedFire,
      shouldUseAbility: this.cachedAbility,
      abilityTargetX,
      abilityTargetY,
    };
  }

  private hasLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    obstacles: ObstacleEntity[]
  ): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(8, Math.ceil(dist / 24));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      for (const obs of obstacles) {
        if (!obs.alive || !obs.blocksProjectiles) continue;
        if (obs.containsPoint(px, py, 2)) return false;
      }
    }
    return true;
  }
}
