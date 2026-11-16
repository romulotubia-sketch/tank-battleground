import {
  CosmeticId,
  DecalPosition,
  TankCosmeticPreset,
  TankCustomization,
  TankDecalDefinition,
  TankDecalId,
  TankDefinition,
  TankId,
  TankVisualConfig,
} from '../types/game';
import { getEffectiveTankVisual } from './progression';

export interface ColorSwatchOption {
  name: string;
  hex: string;
  scrapCost: number;
}

export const CUSTOM_PAINT_STUDIO_COST = 60;

export const PAINT_COLOR_SWATCHES: ColorSwatchOption[] = [
  { name: 'Olive Drab', hex: '#5B7048', scrapCost: 0 },
  { name: 'Dark Sage', hex: '#3E4F30', scrapCost: 0 },
  { name: 'Steel Slate', hex: '#4B5563', scrapCost: 0 },
  { name: 'Gunmetal', hex: '#333B46', scrapCost: 0 },
  { name: 'Obsidian', hex: '#26292E', scrapCost: 0 },
  { name: 'Desert Sand', hex: '#B89B72', scrapCost: 0 },
  { name: 'Forest Moss', hex: '#2E6B4E', scrapCost: 25 },
  { name: 'Cobalt Blue', hex: '#365573', scrapCost: 30 },
  { name: 'Arctic Ice', hex: '#CBD5E1', scrapCost: 35 },
  { name: 'Canyon Rust', hex: '#B86B2B', scrapCost: 25 },
  { name: 'Crimson Red', hex: '#8F2D2D', scrapCost: 35 },
  { name: 'Hazard Amber', hex: '#D97706', scrapCost: 30 },
  { name: 'Phantom Violet', hex: '#4B435E', scrapCost: 35 },
  { name: 'Arc Teal', hex: '#2E5A6B', scrapCost: 40 },
];

export const DECAL_COLOR_SWATCHES: ColorSwatchOption[] = [
  { name: 'Stencil Cream', hex: '#F3EFE6', scrapCost: 0 },
  { name: 'Tactical Amber', hex: '#E08E26', scrapCost: 0 },
  { name: 'Command Gold', hex: '#FACC15', scrapCost: 0 },
  { name: 'Stencil Charcoal', hex: '#161815', scrapCost: 0 },
  { name: 'Signal Red', hex: '#EF4444', scrapCost: 25 },
  { name: 'Glacier Cyan', hex: '#38BDF8', scrapCost: 25 },
  { name: 'Squad Emerald', hex: '#4ADE80', scrapCost: 25 },
  { name: 'Arc Violet', hex: '#C084FC', scrapCost: 25 },
];

export const STARTER_PAINT_COLORS: string[] = Array.from(
  new Set([
    ...PAINT_COLOR_SWATCHES.filter((s) => s.scrapCost === 0).map((s) => s.hex.toUpperCase()),
    ...DECAL_COLOR_SWATCHES.filter((s) => s.scrapCost === 0).map((s) => s.hex.toUpperCase()),
  ])
);

export const DECAL_POSITION_OPTIONS: Array<{
  id: DecalPosition;
  label: string;
  shortLabel: string;
  surface: 'hull' | 'turret';
}> = [
  { id: 'hull_front', label: 'Front Glacis', shortLabel: 'Front', surface: 'hull' },
  { id: 'hull_rear', label: 'Rear Deck', shortLabel: 'Rear', surface: 'hull' },
  { id: 'hull_flanks', label: 'Side Skirts', shortLabel: 'Flanks', surface: 'hull' },
  { id: 'turret_top', label: 'Turret Dome', shortLabel: 'Turret', surface: 'turret' },
];

export const TANK_DECAL_LIST: TankDecalDefinition[] = [
  {
    id: 'none',
    name: 'No Decal',
    category: 'None',
    description: 'Clean painted armor with no surface markings.',
    scrapCost: 0,
  },
  // Military Insignias
  {
    id: 'chevron',
    name: 'Strike Chevron',
    category: 'Insignia',
    description: 'Armored battalion V-chevron insignia.',
    scrapCost: 0,
  },
  {
    id: 'iron_crosshair',
    name: 'Target Crosshair',
    category: 'Insignia',
    description: 'Precision gunnery reticle emblem.',
    scrapCost: 35,
  },
  {
    id: 'shield_crest',
    name: 'Vanguard Crest',
    category: 'Insignia',
    description: 'Armored defense division shield emblem.',
    scrapCost: 40,
  },
  // Stars
  {
    id: 'command_star',
    name: 'Command Star',
    category: 'Star',
    description: 'Classic five-point military command star.',
    scrapCost: 0,
  },
  // Numbers
  {
    id: 'num_01',
    name: 'Unit 01',
    category: 'Number',
    description: 'Lead company tactical stencil number 01.',
    labelText: '01',
    scrapCost: 0,
  },
  {
    id: 'num_07',
    name: 'Unit 07',
    category: 'Number',
    description: 'Reconnaissance unit stencil number 07.',
    labelText: '07',
    scrapCost: 30,
  },
  {
    id: 'num_42',
    name: 'Unit 42',
    category: 'Number',
    description: 'Heavy division stencil number 42.',
    labelText: '42',
    scrapCost: 30,
  },
  {
    id: 'num_99',
    name: 'Unit 99',
    category: 'Number',
    description: 'Veteran squadron stencil number 99.',
    labelText: '99',
    scrapCost: 35,
  },
  // Stripes
  {
    id: 'twin_stripes',
    name: 'Twin Racing Stripes',
    category: 'Stripes',
    description: 'Dual parallel armored rally stripes.',
    scrapCost: 0,
  },
  {
    id: 'hazard_stripes',
    name: 'Hazard Chevrons',
    category: 'Stripes',
    description: 'Diagonal high-visibility caution bands.',
    scrapCost: 45,
  },
  // Geometric Symbols
  {
    id: 'apex_diamond',
    name: 'Apex Diamond',
    category: 'Geometric',
    description: 'Twin-ring tactical diamond prism.',
    scrapCost: 45,
  },
  {
    id: 'hex_core',
    name: 'Hexagon Core',
    category: 'Geometric',
    description: 'Reinforced hexagonal reactor mark.',
    scrapCost: 50,
  },
  {
    id: 'thunder_bolt',
    name: 'Shock Bolt',
    category: 'Geometric',
    description: 'High-voltage lightning strike glyph.',
    scrapCost: 50,
  },
  // Special Decorative Markings
  {
    id: 'apex_crown',
    name: 'Arena Crown',
    category: 'Special',
    description: 'Three-spire championship victory crown.',
    scrapCost: 65,
  },
  {
    id: 'winged_crest',
    name: 'Winged Ace',
    category: 'Special',
    description: 'Spread-wing ace commander emblem.',
    scrapCost: 65,
  },
];

export const STARTER_DECAL_IDS: TankDecalId[] = TANK_DECAL_LIST.filter(
  (d) => (d.scrapCost ?? 0) === 0
).map((d) => d.id);

export const TANK_DECAL_MAP: Record<TankDecalId, TankDecalDefinition> = Object.fromEntries(
  TANK_DECAL_LIST.map((d) => [d.id, d])
) as Record<TankDecalId, TankDecalDefinition>;

export const TANK_COSMETIC_PRESETS: TankCosmeticPreset[] = [
  // Assault Tank
  {
    id: 'assault_forest_vanguard',
    tankId: 'assault',
    name: 'Forest Vanguard',
    description: 'High-contrast olive camo with twin cream rally stripes.',
    scrapCost: 45,
    customization: {
      primaryColor: '#435C38',
      secondaryColor: '#2B3D24',
      turretColor: '#5B784D',
      barrelColor: '#232920',
      decalId: 'twin_stripes',
      decalPosition: 'hull_front',
      decalColor: '#F3EFE6',
      presetId: 'assault_forest_vanguard',
    },
  },
  {
    id: 'assault_desert_sentinel',
    tankId: 'assault',
    name: 'Desert Sentinel',
    description: 'Arid sandstone armor with bold battalion chevron.',
    scrapCost: 65,
    customization: {
      primaryColor: '#B89B72',
      secondaryColor: '#7D6648',
      turretColor: '#CCB086',
      barrelColor: '#4A3D2B',
      decalId: 'chevron',
      decalPosition: 'turret_top',
      decalColor: '#161815',
      presetId: 'assault_desert_sentinel',
    },
  },
  {
    id: 'assault_midnight_strike',
    tankId: 'assault',
    name: 'Midnight Strike',
    description: 'Stealth charcoal hull paired with amber Unit 01 markings.',
    scrapCost: 85,
    customization: {
      primaryColor: '#2B3038',
      secondaryColor: '#1B1E24',
      turretColor: '#3B424D',
      barrelColor: '#1F2329',
      decalId: 'num_01',
      decalPosition: 'turret_top',
      decalColor: '#E08E26',
      presetId: 'assault_midnight_strike',
    },
  },

  // Fortress Tank
  {
    id: 'fortress_iron_bastion',
    tankId: 'fortress',
    name: 'Iron Bastion',
    description: 'Heavy gunmetal hull anchored by a vanguard shield crest.',
    scrapCost: 45,
    customization: {
      primaryColor: '#3D444E',
      secondaryColor: '#272C33',
      turretColor: '#545D6B',
      barrelColor: '#1F242B',
      decalId: 'shield_crest',
      decalPosition: 'turret_top',
      decalColor: '#38BDF8',
      presetId: 'fortress_iron_bastion',
    },
  },
  {
    id: 'fortress_arctic_aegis',
    tankId: 'fortress',
    name: 'Arctic Aegis',
    description: 'Tundra white composite armor with steel-cobalt cannon.',
    scrapCost: 65,
    customization: {
      primaryColor: '#CBD5E1',
      secondaryColor: '#64748B',
      turretColor: '#E2E8F0',
      barrelColor: '#334155',
      decalId: 'command_star',
      decalPosition: 'hull_front',
      decalColor: '#365573',
      presetId: 'fortress_arctic_aegis',
    },
  },
  {
    id: 'fortress_siege_breaker',
    tankId: 'fortress',
    name: 'Siege Breaker',
    description: 'Charcoal armor with industrial hazard stripes on flanks.',
    scrapCost: 85,
    customization: {
      primaryColor: '#33363B',
      secondaryColor: '#212327',
      turretColor: '#484C54',
      barrelColor: '#D97706',
      decalId: 'hazard_stripes',
      decalPosition: 'hull_flanks',
      decalColor: '#FACC15',
      presetId: 'fortress_siege_breaker',
    },
  },

  // Scout Tank
  {
    id: 'scout_canyon_runner',
    tankId: 'scout',
    name: 'Canyon Runner',
    description: 'Burnt copper chassis marked with lightning speed stripes.',
    scrapCost: 45,
    customization: {
      primaryColor: '#C26327',
      secondaryColor: '#823E14',
      turretColor: '#E07A38',
      barrelColor: '#2A231E',
      decalId: 'num_07',
      decalPosition: 'turret_top',
      decalColor: '#F3EFE6',
      presetId: 'scout_canyon_runner',
    },
  },
  {
    id: 'scout_night_recon',
    tankId: 'scout',
    name: 'Night Recon',
    description: 'Cobalt-night stealth recon hull with glacier wings.',
    scrapCost: 65,
    customization: {
      primaryColor: '#24374D',
      secondaryColor: '#162333',
      turretColor: '#365573',
      barrelColor: '#1A2430',
      decalId: 'winged_crest',
      decalPosition: 'hull_front',
      decalColor: '#38BDF8',
      presetId: 'scout_night_recon',
    },
  },
  {
    id: 'scout_hazard_hornet',
    tankId: 'scout',
    name: 'Hazard Hornet',
    description: 'High-visibility amber chassis with black racing stripes.',
    scrapCost: 85,
    customization: {
      primaryColor: '#D97706',
      secondaryColor: '#92400E',
      turretColor: '#F59E0B',
      barrelColor: '#1C1917',
      decalId: 'twin_stripes',
      decalPosition: 'hull_rear',
      decalColor: '#161815',
      presetId: 'scout_hazard_hornet',
    },
  },

  // Artillery Tank
  {
    id: 'artillery_dune_howitzer',
    tankId: 'artillery',
    name: 'Dune Howitzer',
    description: 'Tan desert camouflage with matte olive siege barrel.',
    scrapCost: 45,
    customization: {
      primaryColor: '#A88E68',
      secondaryColor: '#756044',
      turretColor: '#BEA37A',
      barrelColor: '#3E4F30',
      decalId: 'iron_crosshair',
      decalPosition: 'turret_top',
      decalColor: '#161815',
      presetId: 'artillery_dune_howitzer',
    },
  },
  {
    id: 'artillery_crimson_battery',
    tankId: 'artillery',
    name: 'Crimson Battery',
    description: 'Deep red artillery division hull with gold Unit 42 stencil.',
    scrapCost: 65,
    customization: {
      primaryColor: '#7F2B2B',
      secondaryColor: '#4F1818',
      turretColor: '#9C3636',
      barrelColor: '#26292E',
      decalId: 'num_42',
      decalPosition: 'hull_rear',
      decalColor: '#FACC15',
      presetId: 'artillery_crimson_battery',
    },
  },
  {
    id: 'artillery_steel_tempest',
    tankId: 'artillery',
    name: 'Steel Tempest',
    description: 'Cool titanium slate hull with amber command star.',
    scrapCost: 85,
    customization: {
      primaryColor: '#4B5563',
      secondaryColor: '#2D343E',
      turretColor: '#667385',
      barrelColor: '#1E232A',
      decalId: 'command_star',
      decalPosition: 'turret_top',
      decalColor: '#E08E26',
      presetId: 'artillery_steel_tempest',
    },
  },

  // Tesla Tank
  {
    id: 'tesla_arc_overload',
    tankId: 'tesla',
    name: 'Arc Overload',
    description: 'Deep cobalt coil housing with high-voltage cyan bolt.',
    scrapCost: 45,
    customization: {
      primaryColor: '#224966',
      secondaryColor: '#152E42',
      turretColor: '#31658C',
      barrelColor: '#1F3A52',
      decalId: 'thunder_bolt',
      decalPosition: 'turret_top',
      decalColor: '#38BDF8',
      presetId: 'tesla_arc_overload',
    },
  },
  {
    id: 'tesla_copper_coil',
    tankId: 'tesla',
    name: 'Copper Coil',
    description: 'Obsidian frame with warm bronze-copper induction barrel.',
    scrapCost: 65,
    customization: {
      primaryColor: '#2B2F36',
      secondaryColor: '#1B1E24',
      turretColor: '#404552',
      barrelColor: '#B86B2B',
      decalId: 'hex_core',
      decalPosition: 'hull_front',
      decalColor: '#FACC15',
      presetId: 'tesla_copper_coil',
    },
  },
  {
    id: 'tesla_cryo_surge',
    tankId: 'tesla',
    name: 'Cryo Surge',
    description: 'Glacier frost chassis with emerald capacitor core mark.',
    scrapCost: 85,
    customization: {
      primaryColor: '#B8C7D6',
      secondaryColor: '#6E8296',
      turretColor: '#DCE6F0',
      barrelColor: '#2E5A6B',
      decalId: 'apex_diamond',
      decalPosition: 'turret_top',
      decalColor: '#38BDF8',
      presetId: 'tesla_cryo_surge',
    },
  },

  // Phantom Tank
  {
    id: 'phantom_void_stalker',
    tankId: 'phantom',
    name: 'Void Stalker',
    description: 'Obsidian stealth facets with violet diamond insignia.',
    scrapCost: 45,
    customization: {
      primaryColor: '#25232E',
      secondaryColor: '#16151C',
      turretColor: '#363245',
      barrelColor: '#1E1B26',
      decalId: 'apex_diamond',
      decalPosition: 'hull_front',
      decalColor: '#C084FC',
      presetId: 'phantom_void_stalker',
    },
  },
  {
    id: 'phantom_crimson_wraith',
    tankId: 'phantom',
    name: 'Crimson Wraith',
    description: 'Dark maroon stealth hull crowned with gold Unit 99.',
    scrapCost: 65,
    customization: {
      primaryColor: '#4A222D',
      secondaryColor: '#2E141B',
      turretColor: '#662F3E',
      barrelColor: '#1D181B',
      decalId: 'num_99',
      decalPosition: 'turret_top',
      decalColor: '#FACC15',
      presetId: 'phantom_crimson_wraith',
    },
  },
  {
    id: 'phantom_emerald_specter',
    tankId: 'phantom',
    name: 'Emerald Specter',
    description: 'Deep jungle shadow armor with bright lime ace crown.',
    scrapCost: 85,
    customization: {
      primaryColor: '#214A37',
      secondaryColor: '#153023',
      turretColor: '#2E6B4E',
      barrelColor: '#18241E',
      decalId: 'apex_crown',
      decalPosition: 'turret_top',
      decalColor: '#4ADE80',
      presetId: 'phantom_emerald_specter',
    },
  },
];

export const TANK_PRESET_MAP: Record<string, TankCosmeticPreset> = Object.fromEntries(
  TANK_COSMETIC_PRESETS.map((p) => [p.id, p])
);

export function getTankPresets(tankId: TankId): TankCosmeticPreset[] {
  return TANK_COSMETIC_PRESETS.filter((p) => p.tankId === tankId);
}

export function getPaintColorCost(hex: string): number {
  const upper = hex.trim().toUpperCase();
  const paintMatch = PAINT_COLOR_SWATCHES.find((s) => s.hex.toUpperCase() === upper);
  if (paintMatch) return paintMatch.scrapCost;
  const decalMatch = DECAL_COLOR_SWATCHES.find((s) => s.hex.toUpperCase() === upper);
  if (decalMatch) return decalMatch.scrapCost;
  return 0;
}

export function getDecalCost(decalId: TankDecalId): number {
  return TANK_DECAL_MAP[decalId]?.scrapCost ?? 0;
}

export function getPresetCost(presetId: string): number {
  return TANK_PRESET_MAP[presetId]?.scrapCost ?? 0;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (typeof value === 'string' && HEX_COLOR_RE.test(value.trim())) {
    return value.trim().toUpperCase();
  }
  return fallback.toUpperCase();
}

export function createDefaultTankCustomization(
  tank: TankDefinition,
  cosmeticId: CosmeticId = 'default'
): TankCustomization {
  const visual = getEffectiveTankVisual(tank, cosmeticId);
  return {
    primaryColor: normalizeHexColor(visual.hullPrimary, tank.visual.hullPrimary),
    secondaryColor: normalizeHexColor(visual.hullSecondary, tank.visual.hullSecondary),
    turretColor: normalizeHexColor(visual.turretColor, tank.visual.turretColor),
    barrelColor: normalizeHexColor(visual.barrelColor ?? visual.hullSecondary, tank.visual.hullSecondary),
    decalId: 'none',
    decalPosition: 'turret_top',
    decalColor: normalizeHexColor(visual.accentColor, '#F3EFE6'),
    presetId: null,
  };
}

export function resolveEffectiveTankVisual(
  tank: TankDefinition,
  cosmeticId: CosmeticId = 'default',
  customization?: TankCustomization | null
): TankVisualConfig {
  const base = getEffectiveTankVisual(tank, cosmeticId);
  if (!customization) {
    return {
      ...base,
      barrelColor: base.barrelColor ?? base.hullSecondary,
    };
  }
  return {
    ...base,
    hullPrimary: normalizeHexColor(customization.primaryColor, base.hullPrimary),
    hullSecondary: normalizeHexColor(customization.secondaryColor, base.hullSecondary),
    turretColor: normalizeHexColor(customization.turretColor, base.turretColor),
    barrelColor: normalizeHexColor(
      customization.barrelColor,
      base.barrelColor ?? base.hullSecondary
    ),
  };
}

export function areCustomizationsEqual(
  a?: TankCustomization | null,
  b?: TankCustomization | null
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    normalizeHexColor(a.primaryColor, '#000000') ===
      normalizeHexColor(b.primaryColor, '#000000') &&
    normalizeHexColor(a.secondaryColor, '#000000') ===
      normalizeHexColor(b.secondaryColor, '#000000') &&
    normalizeHexColor(a.turretColor, '#000000') ===
      normalizeHexColor(b.turretColor, '#000000') &&
    normalizeHexColor(a.barrelColor, '#000000') ===
      normalizeHexColor(b.barrelColor, '#000000') &&
    a.decalId === b.decalId &&
    a.decalPosition === b.decalPosition &&
    normalizeHexColor(a.decalColor, '#000000') === normalizeHexColor(b.decalColor, '#000000')
  );
}

export function getCustomizationSignature(
  tankId: TankId,
  cosmeticId: CosmeticId = 'default',
  customization?: TankCustomization | null
): string {
  if (!customization) {
    return `${tankId}_${cosmeticId}`;
  }
  const raw = [
    tankId,
    cosmeticId,
    normalizeHexColor(customization.primaryColor, ''),
    normalizeHexColor(customization.secondaryColor, ''),
    normalizeHexColor(customization.turretColor, ''),
    normalizeHexColor(customization.barrelColor, ''),
    customization.decalId,
    customization.decalPosition,
    normalizeHexColor(customization.decalColor, ''),
  ].join('|');

  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${tankId}_c_${(h >>> 0).toString(36)}`;
}
