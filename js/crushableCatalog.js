const GROUPS = {
  ice: ["ice_bubble", "cracked_ice_cube", "frozen_pressure_block"],
  candy: ["clear_candy_shell", "caramel_glass", "star_sugar_crystal", "color_crunch_tablet"],
  nut: ["walnut_pressure_shell", "pistachio_clamp", "hazelnut_hard_orb"],
  shell: ["pearl_seal_shell"],
  crystal: ["glass_bead_light_orb"],
  space: ["asteroid_soft_candy", "meteor_jelly_core"],
  bubblewrap: ["bubble_wrap_tile", "chain_pop_grid"],
  air: ["sealed_air_bag", "bulging_pressure_pouch"],
  jelly: ["jelly_bubble", "gummy_cube"],
  cloud: ["marshmallow_cloud", "cloud_pressure_puff"],
  foam: ["sponge_foam_block", "bubble_foam_brick"],
  paper: ["dry_leaf_chip", "crumpled_paper_ball"],
  ceramic: ["porcelain_emotion_mask", "light_cracking_ceramic"],
};

const EFFECT_BY_GROUP = {
  ice: "iceShatter",
  candy: "sugarCrack",
  nut: "shellCrack",
  shell: "pearlRelease",
  crystal: "prismDissolve",
  space: "meteorSplit",
  bubblewrap: "cascadePop",
  air: "airRelease",
  jelly: "jellySplit",
  cloud: "cloudDissolve",
  foam: "foamRelease",
  paper: "paperScatter",
  ceramic: "lightShard",
};

const FOCUSED_EFFECTS = {
  ice_bubble: "iceMistBloom",
  cracked_ice_cube: "icePlateSlide",
  walnut_pressure_shell: "walnutThresholdCrack",
  bubble_wrap_tile: "bubbleWrapSweep",
  jelly_bubble: "jellyWobblePlop",
  porcelain_emotion_mask: "porcelainLightPetals",
};

export const CRUSHABLE_ITEM_TYPES = Object.values(GROUPS).flat();
export const FOCUSED_CRUSHABLE_ITEM_TYPES = Object.keys(FOCUSED_EFFECTS);

export const CRUSHABLE_DEFINITIONS = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([group, ids]) =>
    ids.map((id) => [
      id,
      {
        asset: `./assets/pop-items/crushables/${id}.png?v=20260730-candy1`,
        materialFamily: group,
        effectProfile: FOCUSED_EFFECTS[id] ?? EFFECT_BY_GROUP[group],
        audioProfile: id,
        aspect: 1,
        rarity: "uncommon",
        crushableGroup: group,
        focused: Boolean(FOCUSED_EFFECTS[id]),
      },
    ]),
  ),
);

export const CRUSHABLE_AUDIO_GROUPS = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([group, ids]) => ids.map((id) => [id, group])),
);

export const CRUSHABLE_EFFECTS = new Set(Object.values(EFFECT_BY_GROUP));
Object.values(FOCUSED_EFFECTS).forEach((effect) => CRUSHABLE_EFFECTS.add(effect));
