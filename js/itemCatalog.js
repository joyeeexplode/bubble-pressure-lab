import { CRUSHABLE_DEFINITIONS, FOCUSED_CRUSHABLE_ITEM_TYPES } from "./crushableCatalog.js";

export const TOY_ITEM_TYPES = [
  "duck",
  "mouse",
  "burger",
  "pufferfish",
  "frog",
  "jellyfish",
  "seal",
  "octopus",
  "waterStarfish",
  "puddingGhost",
  "waterCactus",
  "gummySlipper",
  "softCloud",
  "jellyOrange",
  "waterPeach",
  "unicornFloat",
  "pressureHippo",
  "creamMochi",
  "doubleDaisy",
  "dandelion",
  "hydrangea",
  "pinecone",
  "mapleSamara",
  "cyberChicken",
  "caramel_glass",
  "meteor_jelly_core",
  "sealed_air_bag",
  "gummy_cube",
  "marshmallow_cloud",
  "light_cracking_ceramic",
  "frozen_pressure_block",
  "clear_candy_shell",
  "star_sugar_crystal",
  "color_crunch_tablet",
  "pistachio_clamp",
  "hazelnut_hard_orb",
  "pearl_seal_shell",
  "glass_bead_light_orb",
  "asteroid_soft_candy",
  "chain_pop_grid",
  "bulging_pressure_pouch",
  "cloud_pressure_puff",
  "sponge_foam_block",
  "bubble_foam_brick",
  "dry_leaf_chip",
  "crumpled_paper_ball",
  ...FOCUSED_CRUSHABLE_ITEM_TYPES,
];

export const THEME_POOLS = [
  {
    id: "garden",
    label: "花园自然",
    items: [
      "doubleDaisy", "dandelion", "hydrangea", "marshmallow_cloud",
      "mapleSamara", "pearl_seal_shell", "dry_leaf_chip", "unicornFloat",
    ],
  },
  {
    id: "iceCrystal",
    label: "冰晶舒裂",
    items: [
      "ice_bubble", "cracked_ice_cube", "frozen_pressure_block",
      "glass_bead_light_orb", "caramel_glass", "clear_candy_shell",
      "star_sugar_crystal", "waterStarfish", "waterPeach",
    ],
  },
  {
    id: "softGel",
    label: "软弹治愈",
    items: [
      "jelly_bubble", "frog", "jellyfish", "octopus", "gummySlipper",
      "jellyOrange", "creamMochi", "softCloud", "gummy_cube", "marshmallow_cloud",
      "pufferfish", "pressureHippo", "bulging_pressure_pouch",
      "cloud_pressure_puff", "sponge_foam_block",
    ],
  },
  {
    id: "asmrShell",
    label: "壳片 ASMR",
    items: [
      "walnut_pressure_shell", "porcelain_emotion_mask", "pinecone",
      "mapleSamara", "light_cracking_ceramic", "pistachio_clamp",
      "hazelnut_hard_orb", "dry_leaf_chip", "crumpled_paper_ball",
    ],
  },
  {
    id: "popPlay",
    label: "轻快连破",
    items: [
      "bubble_wrap_tile", "duck", "burger", "seal", "puddingGhost",
      "waterCactus", "waterStarfish", "sealed_air_bag", "meteor_jelly_core",
      "cyberChicken", "mouse", "unicornFloat", "asteroid_soft_candy",
      "chain_pop_grid", "color_crunch_tablet", "bubble_foam_brick",
    ],
  },
];

export const ITEM_CATALOG = {
  duck: item("duck.png", "inflatableVinyl", "deflate", 1, "common"),
  mouse: item("mouse-host.png", "softVinyl", "glitter", 1, "uncommon"),
  burger: item("gummy-burger.png", "gummy", "gummyChunks", 1, "common"),
  pufferfish: item("pufferfish.png", "inflatableVinyl", "deflate", 1, "common"),
  frog: item("gummy-frog.png?v=20260730-candy1", "gummy", "squash", 1.5, "common"),
  jellyfish: item("jellyfish.png", "gummy", "squash", 1, "uncommon"),
  seal: item("seal.png", "inflatableVinyl", "deflate", 1, "common"),
  octopus: item("octopus.png", "silicone", "squash", 1, "common"),
  waterStarfish: item("water-starfish.png", "waterGel", "splash", 1, "uncommon"),
  puddingGhost: item("pudding-ghost.png", "gummy", "gummyChunks", 1, "uncommon"),
  unicornFloat: item("unicorn-float.png", "inflatableVinyl", "deflate", 1, "uncommon"),
  waterCactus: item("water-cactus.png", "waterGel", "splash", 1, "uncommon"),
  gummySlipper: item("gummy-slipper.png", "gummy", "gummyChunks", 1.5, "uncommon"),
  softCloud: item("soft-cloud.png?v=20260730-candy1", "siliconeFoam", "softDissolve", 1.5, "uncommon"),
  pressureHippo: item("pressure-hippo.png", "inflatableVinyl", "deflate", 1, "uncommon"),
  jellyOrange: item("jelly-orange.png", "gummy", "gummyChunks", 1.5, "uncommon"),
  waterPeach: item("water-peach.png", "waterGel", "splash", 1, "uncommon"),
  cyberChicken: item("cyber-chicken.png", "inflatableVinyl", "scream", 0.82, "rare"),
  creamMochi: item("cream-mochi.png", "gummy", "softSplit", 1, "uncommon"),
  doubleDaisy: item("double-daisy.png", "botanical", "petalScatter", 1, "uncommon", {
    particleAsset: "./assets/pop-items/daisy-petal.png",
  }),
  dandelion: naturalItem("dandelion.png", "dandelionRelease", "dandelion-seed.png", 1),
  hydrangea: naturalItem("hydrangea.png", "hydrangeaRelease", "hydrangea-floret.png", 1),
  pinecone: naturalItem("pinecone.png", "pineScaleRelease", "pine-scale.png", 0.82),
  mapleSamara: naturalItem("maple-samara-cluster.png", "samaraRelease", "maple-samara.png", 1),
};

Object.assign(ITEM_CATALOG, CRUSHABLE_DEFINITIONS);

for (const [type, definition] of Object.entries(ITEM_CATALOG)) {
  definition.audioProfile = type;
}

function item(file, materialFamily, effectProfile, aspect, rarity, extras = {}) {
  return {
    asset: `./assets/pop-items/${file}`,
    materialFamily,
    effectProfile,
    audioProfile: "",
    aspect,
    rarity,
    ...extras,
  };
}

function naturalItem(file, effectProfile, particleFile, aspect) {
  return item(file, "naturalRelease", effectProfile, aspect, "uncommon", {
    particleAsset: `./assets/pop-items/${particleFile}`,
  });
}
