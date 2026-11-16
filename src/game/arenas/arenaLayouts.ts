import { ArenaDefinition, ArenaId } from '../../types/game';

export const ARENA_WIDTH = 2080;
export const ARENA_HEIGHT = 1200;

const CX = ARENA_WIDTH / 2;
const CY = ARENA_HEIGHT / 2;

const STANDARD_SPAWNS = [
  { x: 260, y: 155, angle: Math.atan2(CY - 155, CX - 260) },
  { x: 1040, y: 140, angle: Math.PI / 2 },
  { x: 1820, y: 155, angle: Math.atan2(CY - 155, CX - 1820) },
  { x: 1935, y: 600, angle: Math.PI },
  { x: 1820, y: 1045, angle: Math.atan2(CY - 1045, CX - 1820) },
  { x: 1040, y: 1060, angle: -Math.PI / 2 },
  { x: 260, y: 1045, angle: Math.atan2(CY - 1045, CX - 260) },
  { x: 145, y: 600, angle: 0 },
];

export const ARENA_DEFINITIONS: Record<ArenaId, ArenaDefinition> = {
  training_grounds: {
    id: 'training_grounds',
    name: 'Training Grounds',
    subtitle: 'Proving Yard',
    description:
      'Expansive proving yard with wide flanking lanes, destructible brick bunkers, crate depots, water basins, and concealment brush.',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    groundColor: '#C8B894',
    groundGridColor: '#B5A37E',
    borderColor: '#4A4336',
    spawns: STANDARD_SPAWNS,
    obstacles: [
      // Central steel pillars framing a wide open mid-field arena
      { type: 'steel', x: 840, y: 440, w: 72, h: 72 },
      { type: 'steel', x: 1240, y: 440, w: 72, h: 72 },
      { type: 'steel', x: 840, y: 760, w: 72, h: 72 },
      { type: 'steel', x: 1240, y: 760, w: 72, h: 72 },

      // Scattered brick cover walls around the center ring
      { type: 'brick', x: 1040, y: 375, w: 140, h: 44 },
      { type: 'brick', x: 1040, y: 825, w: 140, h: 44 },
      { type: 'brick', x: 675, y: 600, w: 46, h: 136 },
      { type: 'brick', x: 1405, y: 600, w: 46, h: 136 },

      // Outer quadrant brick bunkers with wide routes on every side
      { type: 'brick', x: 470, y: 320, w: 118, h: 46 },
      { type: 'brick', x: 1610, y: 320, w: 118, h: 46 },
      { type: 'brick', x: 470, y: 880, w: 118, h: 46 },
      { type: 'brick', x: 1610, y: 880, w: 118, h: 46 },

      // Outer lane tactical brick pillars
      { type: 'brick', x: 660, y: 195, w: 92, h: 40 },
      { type: 'brick', x: 1420, y: 195, w: 92, h: 40 },
      { type: 'brick', x: 660, y: 1005, w: 92, h: 40 },
      { type: 'brick', x: 1420, y: 1005, w: 92, h: 40 },

      // Wooden crate clusters
      { type: 'crate', x: 525, y: 465, w: 50, h: 50 },
      { type: 'crate', x: 582, y: 465, w: 50, h: 50 },
      { type: 'crate', x: 1555, y: 465, w: 50, h: 50 },
      { type: 'crate', x: 1498, y: 465, w: 50, h: 50 },
      { type: 'crate', x: 525, y: 735, w: 50, h: 50 },
      { type: 'crate', x: 1555, y: 735, w: 50, h: 50 },
      { type: 'crate', x: 935, y: 600, w: 48, h: 48 },
      { type: 'crate', x: 1145, y: 600, w: 48, h: 48 },
      { type: 'crate', x: 320, y: 450, w: 48, h: 48 },
      { type: 'crate', x: 1760, y: 750, w: 48, h: 48 },

      // Water pools (pass projectiles over, block tanks)
      { type: 'water', x: 840, y: 235, w: 150, h: 74 },
      { type: 'water', x: 1240, y: 965, w: 150, h: 74 },

      // Concealment bushes
      { type: 'bush', x: 375, y: 600, w: 96, h: 96 },
      { type: 'bush', x: 1705, y: 600, w: 96, h: 96 },
      { type: 'bush', x: 1040, y: 600, w: 104, h: 82 },
      { type: 'bush', x: 840, y: 965, w: 104, h: 78 },
      { type: 'bush', x: 1240, y: 235, w: 104, h: 78 },
      { type: 'bush', x: 480, y: 170, w: 86, h: 68 },
      { type: 'bush', x: 1600, y: 1030, w: 86, h: 68 },

      // Explosive barrels
      { type: 'barrel', x: 680, y: 445, w: 40, h: 40 },
      { type: 'barrel', x: 1400, y: 445, w: 40, h: 40 },
      { type: 'barrel', x: 680, y: 755, w: 40, h: 40 },
      { type: 'barrel', x: 1400, y: 755, w: 40, h: 40 },
      { type: 'barrel', x: 435, y: 230, w: 40, h: 40 },
      { type: 'barrel', x: 1645, y: 970, w: 40, h: 40 },
      { type: 'barrel', x: 955, y: 315, w: 40, h: 40 },
      { type: 'barrel', x: 1125, y: 885, w: 40, h: 40 },
    ],
  },

  industrial_zone: {
    id: 'industrial_zone',
    name: 'Industrial Zone',
    subtitle: 'Foundry Depot',
    description:
      'Expanded foundry yard with heavy steel bulkheads, open cargo lanes, coolant trenches, and volatile fuel drums for multi-angle flanks.',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    groundColor: '#9DA3A6',
    groundGridColor: '#868D91',
    borderColor: '#363C40',
    spawns: STANDARD_SPAWNS,
    obstacles: [
      // Heavy steel foundry bulkheads (well spaced for wide passes)
      { type: 'steel', x: 500, y: 340, w: 124, h: 48 },
      { type: 'steel', x: 1580, y: 340, w: 124, h: 48 },
      { type: 'steel', x: 500, y: 860, w: 124, h: 48 },
      { type: 'steel', x: 1580, y: 860, w: 124, h: 48 },
      { type: 'steel', x: 1040, y: 600, w: 92, h: 92 },
      { type: 'steel', x: 350, y: 600, w: 56, h: 90 },
      { type: 'steel', x: 1730, y: 600, w: 56, h: 90 },

      // Brick loading bay dividers
      { type: 'brick', x: 785, y: 295, w: 48, h: 122 },
      { type: 'brick', x: 1295, y: 295, w: 48, h: 122 },
      { type: 'brick', x: 785, y: 905, w: 48, h: 122 },
      { type: 'brick', x: 1295, y: 905, w: 48, h: 122 },
      { type: 'brick', x: 785, y: 600, w: 48, h: 110 },
      { type: 'brick', x: 1295, y: 600, w: 48, h: 110 },

      // Crate stacks
      { type: 'crate', x: 380, y: 470, w: 50, h: 50 },
      { type: 'crate', x: 380, y: 528, w: 50, h: 50 },
      { type: 'crate', x: 1700, y: 672, w: 50, h: 50 },
      { type: 'crate', x: 1700, y: 730, w: 50, h: 50 },
      { type: 'crate', x: 935, y: 400, w: 50, h: 50 },
      { type: 'crate', x: 1145, y: 800, w: 50, h: 50 },
      { type: 'crate', x: 560, y: 175, w: 50, h: 50 },
      { type: 'crate', x: 1520, y: 1025, w: 50, h: 50 },

      // Coolant water trenches
      { type: 'water', x: 1040, y: 300, w: 155, h: 70 },
      { type: 'water', x: 1040, y: 900, w: 155, h: 70 },

      // Overgrown depot brush
      { type: 'bush', x: 565, y: 600, w: 94, h: 94 },
      { type: 'bush', x: 1515, y: 600, w: 94, h: 94 },
      { type: 'bush', x: 635, y: 245, w: 88, h: 72 },
      { type: 'bush', x: 1445, y: 955, w: 88, h: 72 },
      { type: 'bush', x: 1445, y: 245, w: 88, h: 72 },
      { type: 'bush', x: 635, y: 955, w: 88, h: 72 },

      // Explosive barrels
      { type: 'barrel', x: 925, y: 505, w: 40, h: 40 },
      { type: 'barrel', x: 1155, y: 695, w: 40, h: 40 },
      { type: 'barrel', x: 625, y: 445, w: 40, h: 40 },
      { type: 'barrel', x: 1455, y: 755, w: 40, h: 40 },
      { type: 'barrel', x: 455, y: 705, w: 40, h: 40 },
      { type: 'barrel', x: 1625, y: 495, w: 40, h: 40 },
      { type: 'barrel', x: 925, y: 695, w: 40, h: 40 },
      { type: 'barrel', x: 1155, y: 505, w: 40, h: 40 },
    ],
  },

  wasteland: {
    id: 'wasteland',
    name: 'Wasteland',
    subtitle: 'Scorched Flats',
    description:
      'Vast sun-baked badlands with oasis pools, ambush scrub, ruined outposts, and open desert maneuvering space.',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    groundColor: '#C59B6D',
    groundGridColor: '#AE8456',
    borderColor: '#4E3724',
    spawns: STANDARD_SPAWNS,
    obstacles: [
      // Ruined brick outposts
      { type: 'brick', x: 590, y: 355, w: 130, h: 44 },
      { type: 'brick', x: 1490, y: 355, w: 130, h: 44 },
      { type: 'brick', x: 590, y: 845, w: 130, h: 44 },
      { type: 'brick', x: 1490, y: 845, w: 130, h: 44 },
      { type: 'brick', x: 1040, y: 475, w: 110, h: 44 },
      { type: 'brick', x: 1040, y: 725, w: 110, h: 44 },

      // Steel rock outcrops
      { type: 'steel', x: 390, y: 600, w: 76, h: 76 },
      { type: 'steel', x: 1690, y: 600, w: 76, h: 76 },
      { type: 'steel', x: 810, y: 600, w: 66, h: 66 },
      { type: 'steel', x: 1270, y: 600, w: 66, h: 66 },
      { type: 'steel', x: 1040, y: 260, w: 64, h: 64 },
      { type: 'steel', x: 1040, y: 940, w: 64, h: 64 },

      // Oasis water hazards
      { type: 'water', x: 565, y: 600, w: 104, h: 126 },
      { type: 'water', x: 1515, y: 600, w: 104, h: 126 },

      // Ambush scrub bushes
      { type: 'bush', x: 1040, y: 600, w: 116, h: 86 },
      { type: 'bush', x: 790, y: 280, w: 102, h: 80 },
      { type: 'bush', x: 1290, y: 280, w: 102, h: 80 },
      { type: 'bush', x: 790, y: 920, w: 102, h: 80 },
      { type: 'bush', x: 1290, y: 920, w: 102, h: 80 },
      { type: 'bush', x: 365, y: 375, w: 86, h: 74 },
      { type: 'bush', x: 1715, y: 825, w: 86, h: 74 },

      // Supply crates
      { type: 'crate', x: 435, y: 300, w: 50, h: 50 },
      { type: 'crate', x: 1645, y: 300, w: 50, h: 50 },
      { type: 'crate', x: 435, y: 900, w: 50, h: 50 },
      { type: 'crate', x: 1645, y: 900, w: 50, h: 50 },
      { type: 'crate', x: 720, y: 185, w: 48, h: 48 },
      { type: 'crate', x: 1360, y: 1015, w: 48, h: 48 },

      // Explosive barrels
      { type: 'barrel', x: 700, y: 460, w: 40, h: 40 },
      { type: 'barrel', x: 1380, y: 460, w: 40, h: 40 },
      { type: 'barrel', x: 700, y: 740, w: 40, h: 40 },
      { type: 'barrel', x: 1380, y: 740, w: 40, h: 40 },
      { type: 'barrel', x: 930, y: 600, w: 40, h: 40 },
      { type: 'barrel', x: 1150, y: 600, w: 40, h: 40 },
      { type: 'barrel', x: 470, y: 455, w: 40, h: 40 },
      { type: 'barrel', x: 1610, y: 745, w: 40, h: 40 },
    ],
  },
};

export const ARENA_LIST: ArenaDefinition[] = [
  ARENA_DEFINITIONS.training_grounds,
  ARENA_DEFINITIONS.industrial_zone,
  ARENA_DEFINITIONS.wasteland,
];
