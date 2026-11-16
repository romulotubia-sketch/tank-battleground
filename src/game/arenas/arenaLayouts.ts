import { ArenaDefinition, ArenaId } from '../../types/game';

export const ARENA_WIDTH = 2080;
export const ARENA_HEIGHT = 1200;

const CX = ARENA_WIDTH / 2;
const CY = ARENA_HEIGHT / 2;

const STANDARD_SPAWNS = [
  { x: 230, y: 160, angle: Math.atan2(CY - 160, CX - 230) },
  { x: 1040, y: 135, angle: Math.PI / 2 },
  { x: 1850, y: 160, angle: Math.atan2(CY - 160, CX - 1850) },
  { x: 1945, y: 600, angle: Math.PI },
  { x: 1850, y: 1040, angle: Math.atan2(CY - 1040, CX - 1850) },
  { x: 1040, y: 1065, angle: -Math.PI / 2 },
  { x: 230, y: 1040, angle: Math.atan2(CY - 1040, CX - 230) },
  { x: 135, y: 600, angle: 0 },
];

export const ARENA_DEFINITIONS: Record<ArenaId, ArenaDefinition> = {
  training_grounds: {
    id: 'training_grounds',
    name: 'Training Grounds',
    subtitle: 'Proving Yard',
    identity: 'Beginner-friendly and balanced',
    description:
      'Open military proving yard with wide flanking lanes, scattered training cover, destructible wooden structures, and clear multi-angle routes.',
    features: [
      'Large open combat spaces',
      'Destructible wooden crates',
      'Balanced brick & steel cover',
      'Multiple flanking routes',
    ],
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    groundColor: '#C8B894',
    groundGridColor: '#B5A37E',
    borderColor: '#4A4336',
    themeAccent: '#E08E26',
    spawns: STANDARD_SPAWNS,
    obstacles: [
      // Central steel pillars framing a wide open mid-field proving ring
      { type: 'steel', x: 840, y: 440, w: 68, h: 68 },
      { type: 'steel', x: 1240, y: 440, w: 68, h: 68 },
      { type: 'steel', x: 840, y: 760, w: 68, h: 68 },
      { type: 'steel', x: 1240, y: 760, w: 68, h: 68 },

      // Balanced brick training cover walls around the center & lanes
      { type: 'brick', x: 1040, y: 365, w: 136, h: 42 },
      { type: 'brick', x: 1040, y: 835, w: 136, h: 42 },
      { type: 'brick', x: 660, y: 600, w: 44, h: 132 },
      { type: 'brick', x: 1420, y: 600, w: 44, h: 132 },

      // Outer quadrant brick bunkers with wide routes on every side
      { type: 'brick', x: 465, y: 315, w: 116, h: 44 },
      { type: 'brick', x: 1615, y: 315, w: 116, h: 44 },
      { type: 'brick', x: 465, y: 885, w: 116, h: 44 },
      { type: 'brick', x: 1615, y: 885, w: 116, h: 44 },

      // Outer lane tactical brick pillars
      { type: 'brick', x: 660, y: 195, w: 88, h: 40 },
      { type: 'brick', x: 1420, y: 195, w: 88, h: 40 },
      { type: 'brick', x: 660, y: 1005, w: 88, h: 40 },
      { type: 'brick', x: 1420, y: 1005, w: 88, h: 40 },

      // Destructible wooden training crate structures
      { type: 'crate', x: 500, y: 450, w: 50, h: 50 },
      { type: 'crate', x: 557, y: 450, w: 50, h: 50 },
      { type: 'crate', x: 1580, y: 450, w: 50, h: 50 },
      { type: 'crate', x: 1523, y: 450, w: 50, h: 50 },
      { type: 'crate', x: 500, y: 750, w: 50, h: 50 },
      { type: 'crate', x: 557, y: 750, w: 50, h: 50 },
      { type: 'crate', x: 1580, y: 750, w: 50, h: 50 },
      { type: 'crate', x: 1523, y: 750, w: 50, h: 50 },
      { type: 'crate', x: 935, y: 600, w: 48, h: 48 },
      { type: 'crate', x: 1145, y: 600, w: 48, h: 48 },
      { type: 'crate', x: 325, y: 455, w: 48, h: 48 },
      { type: 'crate', x: 1755, y: 745, w: 48, h: 48 },

      // Training water basins (pass projectiles over, block movement)
      { type: 'water', x: 840, y: 245, w: 144, h: 70 },
      { type: 'water', x: 1240, y: 955, w: 144, h: 70 },

      // Concealment training bushes
      { type: 'bush', x: 375, y: 600, w: 94, h: 94 },
      { type: 'bush', x: 1705, y: 600, w: 94, h: 94 },
      { type: 'bush', x: 1040, y: 600, w: 104, h: 82 },
      { type: 'bush', x: 840, y: 960, w: 102, h: 76 },
      { type: 'bush', x: 1240, y: 240, w: 102, h: 76 },
      { type: 'bush', x: 475, y: 175, w: 84, h: 68 },
      { type: 'bush', x: 1605, y: 1025, w: 84, h: 68 },

      // Explosive range barrels (safely spaced away from spawns)
      { type: 'barrel', x: 685, y: 445, w: 40, h: 40 },
      { type: 'barrel', x: 1395, y: 445, w: 40, h: 40 },
      { type: 'barrel', x: 685, y: 755, w: 40, h: 40 },
      { type: 'barrel', x: 1395, y: 755, w: 40, h: 40 },
      { type: 'barrel', x: 685, y: 330, w: 40, h: 40 },
      { type: 'barrel', x: 1395, y: 870, w: 40, h: 40 },
    ],
  },

  industrial_zone: {
    id: 'industrial_zone',
    name: 'Industrial Zone',
    subtitle: 'Foundry Depot',
    identity: 'Tactical positioning and obstacle management',
    description:
      'Abandoned heavy foundry with steel warehouse bays, narrow tactical corridors mixed with open yards, cargo crates, and volatile fuel drums.',
    features: [
      'Steel warehouse structures',
      'Narrow choke & flank passages',
      'Destructible cargo crates',
      'Explosive barrel traps',
    ],
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    groundColor: '#99A0A4',
    groundGridColor: '#828A8E',
    borderColor: '#363C40',
    themeAccent: '#38BDF8',
    spawns: STANDARD_SPAWNS,
    obstacles: [
      // West Warehouse structure (multi-entrance steel perimeter + crate cargo doors)
      { type: 'steel', x: 470, y: 310, w: 170, h: 44 },
      { type: 'steel', x: 470, y: 890, w: 170, h: 44 },
      { type: 'steel', x: 350, y: 455, w: 44, h: 120 },
      { type: 'steel', x: 350, y: 745, w: 44, h: 120 },
      { type: 'brick', x: 615, y: 445, w: 44, h: 100 },
      { type: 'brick', x: 615, y: 755, w: 44, h: 100 },

      // East Warehouse structure (mirrored multi-entrance loading bay)
      { type: 'steel', x: 1610, y: 310, w: 170, h: 44 },
      { type: 'steel', x: 1610, y: 890, w: 170, h: 44 },
      { type: 'steel', x: 1730, y: 455, w: 44, h: 120 },
      { type: 'steel', x: 1730, y: 745, w: 44, h: 120 },
      { type: 'brick', x: 1465, y: 445, w: 44, h: 100 },
      { type: 'brick', x: 1465, y: 755, w: 44, h: 100 },

      // Central steel refinery core & choke dividers (120px+ passable flank lanes)
      { type: 'steel', x: 1040, y: 600, w: 96, h: 96 },
      { type: 'brick', x: 825, y: 310, w: 46, h: 112 },
      { type: 'brick', x: 1255, y: 310, w: 46, h: 112 },
      { type: 'brick', x: 825, y: 890, w: 46, h: 112 },
      { type: 'brick', x: 1255, y: 890, w: 46, h: 112 },

      // Destructible cargo crate blockades inside warehouse bays & mid-lanes
      { type: 'crate', x: 485, y: 565, w: 50, h: 50 },
      { type: 'crate', x: 485, y: 635, w: 50, h: 50 },
      { type: 'crate', x: 1595, y: 565, w: 50, h: 50 },
      { type: 'crate', x: 1595, y: 635, w: 50, h: 50 },
      { type: 'crate', x: 825, y: 550, w: 48, h: 48 },
      { type: 'crate', x: 825, y: 650, w: 48, h: 48 },
      { type: 'crate', x: 1255, y: 550, w: 48, h: 48 },
      { type: 'crate', x: 1255, y: 650, w: 48, h: 48 },
      { type: 'crate', x: 635, y: 185, w: 50, h: 50 },
      { type: 'crate', x: 1445, y: 1015, w: 50, h: 50 },

      // Coolant water basins creating tactical lane splits
      { type: 'water', x: 1040, y: 310, w: 152, h: 72 },
      { type: 'water', x: 1040, y: 890, w: 152, h: 72 },

      // Overgrown depot brush
      { type: 'bush', x: 645, y: 600, w: 92, h: 92 },
      { type: 'bush', x: 1435, y: 600, w: 92, h: 92 },
      { type: 'bush', x: 690, y: 270, w: 86, h: 72 },
      { type: 'bush', x: 1390, y: 930, w: 86, h: 72 },
      { type: 'bush', x: 1390, y: 270, w: 86, h: 72 },
      { type: 'bush', x: 690, y: 930, w: 86, h: 72 },

      // Tactical explosive fuel barrels near warehouse approaches & central foundry
      { type: 'barrel', x: 925, y: 465, w: 40, h: 40 },
      { type: 'barrel', x: 1155, y: 735, w: 40, h: 40 },
      { type: 'barrel', x: 725, y: 460, w: 40, h: 40 },
      { type: 'barrel', x: 1355, y: 740, w: 40, h: 40 },
      { type: 'barrel', x: 925, y: 735, w: 40, h: 40 },
      { type: 'barrel', x: 1155, y: 465, w: 40, h: 40 },
    ],
  },

  wasteland: {
    id: 'wasteland',
    name: 'Wasteland',
    subtitle: 'Scorched Flats',
    identity: 'Open combat with limited cover',
    description:
      'Dry sun-baked battlefield with open sightlines, sparse ruined outpost walls, oasis hazards, ambush scrub, and weathered terrain.',
    features: [
      'Wide open combat flats',
      'Sparse abandoned ruins',
      'Oasis water hazards',
      'Desert terrain decoration',
    ],
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    groundColor: '#C59B6D',
    groundGridColor: '#AE8456',
    borderColor: '#4E3724',
    themeAccent: '#F97316',
    spawns: STANDARD_SPAWNS,
    obstacles: [
      // Scattered ruined brick outposts (limited cover favoring open positioning)
      { type: 'brick', x: 625, y: 345, w: 120, h: 42 },
      { type: 'brick', x: 1455, y: 345, w: 120, h: 42 },
      { type: 'brick', x: 625, y: 855, w: 120, h: 42 },
      { type: 'brick', x: 1455, y: 855, w: 120, h: 42 },
      { type: 'brick', x: 1040, y: 440, w: 96, h: 40 },
      { type: 'brick', x: 1040, y: 760, w: 96, h: 40 },

      // Sparse steel rock outcrops (small footprint so cover stays limited)
      { type: 'steel', x: 375, y: 600, w: 66, h: 66 },
      { type: 'steel', x: 1705, y: 600, w: 66, h: 66 },
      { type: 'steel', x: 825, y: 600, w: 60, h: 60 },
      { type: 'steel', x: 1255, y: 600, w: 60, h: 60 },

      // Desert oasis water hazards (block movement, projectiles pass over)
      { type: 'water', x: 560, y: 600, w: 108, h: 132 },
      { type: 'water', x: 1520, y: 600, w: 108, h: 132 },

      // Ambush desert scrub bushes
      { type: 'bush', x: 1040, y: 600, w: 118, h: 88 },
      { type: 'bush', x: 790, y: 265, w: 102, h: 80 },
      { type: 'bush', x: 1290, y: 265, w: 102, h: 80 },
      { type: 'bush', x: 790, y: 935, w: 102, h: 80 },
      { type: 'bush', x: 1290, y: 935, w: 102, h: 80 },
      { type: 'bush', x: 370, y: 365, w: 86, h: 74 },
      { type: 'bush', x: 1710, y: 835, w: 86, h: 74 },

      // Scattered destructible supply crates
      { type: 'crate', x: 435, y: 285, w: 48, h: 48 },
      { type: 'crate', x: 1645, y: 285, w: 48, h: 48 },
      { type: 'crate', x: 435, y: 915, w: 48, h: 48 },
      { type: 'crate', x: 1645, y: 915, w: 48, h: 48 },
      { type: 'crate', x: 1040, y: 270, w: 48, h: 48 },
      { type: 'crate', x: 1040, y: 930, w: 48, h: 48 },

      // Abandoned explosive fuel barrels (safely distanced from spawns)
      { type: 'barrel', x: 720, y: 480, w: 40, h: 40 },
      { type: 'barrel', x: 1360, y: 480, w: 40, h: 40 },
      { type: 'barrel', x: 720, y: 720, w: 40, h: 40 },
      { type: 'barrel', x: 1360, y: 720, w: 40, h: 40 },
      { type: 'barrel', x: 940, y: 600, w: 40, h: 40 },
      { type: 'barrel', x: 1140, y: 600, w: 40, h: 40 },
    ],
  },
};

export const ARENA_LIST: ArenaDefinition[] = [
  ARENA_DEFINITIONS.training_grounds,
  ARENA_DEFINITIONS.industrial_zone,
  ARENA_DEFINITIONS.wasteland,
];
