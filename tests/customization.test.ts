import assert from 'node:assert/strict';
import test from 'node:test';
import { getDecalPlacements } from '../src/components/TankDecalRenderer';
import {
  areCustomizationsEqual,
  createDefaultTankCustomization,
  DECAL_POSITION_OPTIONS,
  getCustomizationSignature,
  getTankPresets,
  PAINT_COLOR_SWATCHES,
  resolveEffectiveTankVisual,
  TANK_COSMETIC_PRESETS,
  TANK_DECAL_LIST,
} from '../src/data/customization';
import { TANK_DEFINITIONS, TANK_LIST } from '../src/data/tanks';
import { DecalPosition, TankCustomization } from '../src/types/game';

test('all 6 tanks support paint customization across primary, secondary, turret, and barrel without mutating base definitions', () => {
  assert.equal(TANK_LIST.length, 6);

  for (const tank of TANK_LIST) {
    const beforeStats = JSON.stringify(tank.stats);
    const beforeVisual = JSON.stringify(tank.visual);

    const custom: TankCustomization = {
      primaryColor: '#112233',
      secondaryColor: '#445566',
      turretColor: '#778899',
      barrelColor: '#AABBCC',
      decalId: 'command_star',
      decalPosition: 'turret_top',
      decalColor: '#FACC15',
      presetId: null,
    };

    const resolved = resolveEffectiveTankVisual(tank, 'default', custom);
    assert.equal(resolved.hullPrimary, '#112233');
    assert.equal(resolved.hullSecondary, '#445566');
    assert.equal(resolved.turretColor, '#778899');
    assert.equal(resolved.barrelColor, '#AABBCC');
    assert.equal(resolved.silhouette, tank.visual.silhouette);

    // Base tank definition & stats remain untouched
    assert.equal(JSON.stringify(tank.stats), beforeStats);
    assert.equal(JSON.stringify(tank.visual), beforeVisual);
  }
});

test('all 6 tanks have at least 3 distinct cosmetic presets covering unique color identities', () => {
  assert.ok(PAINT_COLOR_SWATCHES.length >= 10);

  for (const tank of TANK_LIST) {
    const presets = getTankPresets(tank.id);
    assert.ok(presets.length >= 3, `Expected at least 3 presets for ${tank.id}`);

    const names = new Set(presets.map((p) => p.name));
    assert.equal(names.size, presets.length, `Preset names should be unique for ${tank.id}`);

    for (let i = 0; i < presets.length; i++) {
      for (let j = i + 1; j < presets.length; j++) {
        assert.equal(
          areCustomizationsEqual(presets[i].customization, presets[j].customization),
          false,
          `Presets ${presets[i].id} and ${presets[j].id} should be visually distinct`
        );
      }
    }
  }

  assert.ok(TANK_COSMETIC_PRESETS.length >= 18);
});

test('decal catalog includes military insignias, stars, numbers, stripes, geometric symbols, and special markings', () => {
  const categories = new Set(TANK_DECAL_LIST.map((d) => d.category));
  assert.ok(categories.has('None'));
  assert.ok(categories.has('Insignia'));
  assert.ok(categories.has('Star'));
  assert.ok(categories.has('Number'));
  assert.ok(categories.has('Stripes'));
  assert.ok(categories.has('Geometric'));
  assert.ok(categories.has('Special'));
});

test('decal placement solver places hull decals on hull layer and turret decals on turret layer for all silhouettes', () => {
  const positions: DecalPosition[] = DECAL_POSITION_OPTIONS.map((p) => p.id);

  for (const tank of TANK_LIST) {
    const sil = tank.visual.silhouette;

    for (const pos of positions) {
      const hullSpecs = getDecalPlacements(pos, sil, 'hull', 1);
      const turretSpecs = getDecalPlacements(pos, sil, 'turret', 1);

      if (pos === 'turret_top') {
        assert.equal(hullSpecs.length, 0, `${sil} turret_top should not draw on hull layer`);
        assert.equal(turretSpecs.length, 1, `${sil} turret_top should draw on turret layer`);
      } else {
        assert.ok(hullSpecs.length >= 1, `${sil} ${pos} should draw on hull layer`);
        assert.equal(turretSpecs.length, 0, `${sil} ${pos} should not draw on turret layer`);
      }

      // Scaled canvas coordinates preserve count & scale ratio
      const canvasHull = getDecalPlacements(pos, sil, 'hull', 0.92);
      const canvasTurret = getDecalPlacements(pos, sil, 'turret', 0.92);
      assert.equal(canvasHull.length, hullSpecs.length);
      assert.equal(canvasTurret.length, turretSpecs.length);
    }
  }
});

test('customization signature distinguishes edits across zones, decals, and tanks for Phaser texture caching', () => {
  const assault = TANK_DEFINITIONS.assault;
  const base = createDefaultTankCustomization(assault, 'default');
  const sigBase = getCustomizationSignature('assault', 'default', null);
  const sigDefaultCustom = getCustomizationSignature('assault', 'default', base);
  const sigBarrelEdit = getCustomizationSignature('assault', 'default', {
    ...base,
    barrelColor: '#EF4444',
  });
  const sigDecalEdit = getCustomizationSignature('assault', 'default', {
    ...base,
    decalId: 'apex_crown',
    decalPosition: 'hull_flanks',
  });
  const sigOtherTank = getCustomizationSignature('fortress', 'default', base);

  assert.notEqual(sigBase, sigDefaultCustom);
  assert.notEqual(sigDefaultCustom, sigBarrelEdit);
  assert.notEqual(sigDefaultCustom, sigDecalEdit);
  assert.notEqual(sigDefaultCustom, sigOtherTank);
});
