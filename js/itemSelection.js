export const ITEM_DRAW_WEIGHTS = Object.freeze({
  cyberChicken: 3,
});

const SCENE_MATERIALS = Object.freeze({
  morning: new Set(["naturalRelease", "botanical", "waterGel", "water"]),
  afternoon: new Set(["gummy", "candy", "nut", "shell", "softVinyl"]),
  neon: new Set(["inflatableVinyl", "crystal", "waterGel", "silicone"]),
  moonlight: new Set(["ice", "ceramic", "cloud", "siliconeFoam", "naturalRelease"]),
});

const CRISP_MATERIALS = new Set(["ice", "candy", "ceramic", "bubblewrap", "crystal", "nut"]);
const SOFT_MATERIALS = new Set([
  "gummy",
  "cloud",
  "siliconeFoam",
  "waterGel",
  "naturalRelease",
  "inflatableVinyl",
]);
const HEAVY_MATERIALS = new Set(["ice", "candy", "ceramic", "nut", "shell", "space", "paper"]);
const FLOATING_MATERIALS = new Set([
  "cloud",
  "air",
  "inflatableVinyl",
  "naturalRelease",
  "botanical",
  "siliconeFoam",
]);
const VISUAL_TONE_BY_MATERIAL = Object.freeze({
  ice: "cool",
  crystal: "cool",
  waterGel: "cool",
  water: "cool",
  inflatableVinyl: "bright",
  softVinyl: "warm",
  gummy: "warm",
  candy: "warm",
  nut: "earth",
  shell: "earth",
  paper: "earth",
  naturalRelease: "green",
  botanical: "green",
  plant: "green",
  ceramic: "neutral",
  cloud: "neutral",
  foam: "neutral",
  siliconeFoam: "neutral",
  silicone: "bright",
  space: "dark",
  bubblewrap: "cool",
  air: "neutral",
});

export function getMaterialVisualTone(material) {
  return VISUAL_TONE_BY_MATERIAL[material] ?? "bright";
}

export function pickWeightedItem(items, weights = ITEM_DRAW_WEIGHTS, random = Math.random) {
  const total = items.reduce((sum, item) => sum + (weights[item] ?? 1), 0);
  if (total <= 0) return null;
  let cursor = random() * total;

  for (const item of items) {
    cursor -= weights[item] ?? 1;
    if (cursor < 0) return item;
  }

  return items.at(-1);
}

export function buildDynamicWeights({
  items,
  materialByType = {},
  recentTypes = [],
  recentMaterials = [],
  sceneId = "moonlight",
  interactionEnergy = 0.5,
  focusType = null,
  focusPending = false,
  cyberEligible = true,
  drawsSinceCyber = 0,
  verticalRatio = 0.5,
  materialCounts = {},
  visualToneCounts = {},
  roundPhase = "flow",
  baseWeights = ITEM_DRAW_WEIGHTS,
}) {
  const recentTypeWindow = recentTypes.slice(-7);
  const recentMaterialWindow = recentMaterials.slice(-3);
  const sceneMaterials = SCENE_MATERIALS[sceneId] ?? SCENE_MATERIALS.moonlight;

  return Object.fromEntries(
    items.map((type) => {
      const material = materialByType[type];
      const visualTone = getMaterialVisualTone(material);
      let weight = baseWeights[type] ?? 1;
      const recentIndex = recentTypeWindow.lastIndexOf(type);
      if (recentIndex >= 0) {
        const age = recentTypeWindow.length - 1 - recentIndex;
        weight *= age <= 1 ? 0.04 : age <= 3 ? 0.16 : 0.42;
      }
      const materialIndex = recentMaterialWindow.lastIndexOf(material);
      if (material && materialIndex >= 0) {
        const age = recentMaterialWindow.length - 1 - materialIndex;
        weight *= age === 0 ? 0.32 : age === 1 ? 0.52 : 0.72;
      }
      if (sceneMaterials.has(material)) weight *= 1.55;
      if (interactionEnergy > 0.65 && CRISP_MATERIALS.has(material)) weight *= 1.65;
      if (interactionEnergy < 0.35 && SOFT_MATERIALS.has(material)) weight *= 1.65;
      if (verticalRatio < 0.36 && FLOATING_MATERIALS.has(material)) weight *= 1.65;
      if (verticalRatio < 0.36 && HEAVY_MATERIALS.has(material)) weight *= 0.58;
      if (verticalRatio > 0.64 && HEAVY_MATERIALS.has(material)) weight *= 1.55;
      if (verticalRatio > 0.64 && FLOATING_MATERIALS.has(material)) weight *= 0.68;
      weight /= 1 + (materialCounts[material] ?? 0) * 0.34;
      weight /= 1 + (visualToneCounts[visualTone] ?? 0) * 0.14;
      if (roundPhase === "opening" && SOFT_MATERIALS.has(material)) weight *= 1.5;
      if (roundPhase === "contrast" && material !== recentMaterialWindow.at(-1)) weight *= 1.45;
      if (roundPhase === "settle" && (SOFT_MATERIALS.has(material) || material === "naturalRelease")) {
        weight *= 1.55;
      }
      if (focusPending && type === focusType) weight *= 4.8;
      if (type === "cyberChicken") {
        if (!cyberEligible) weight = 0;
        else if (drawsSinceCyber >= 18) weight *= Math.min(4, 1 + (drawsSinceCyber - 17) * 0.3);
      }
      return [type, Math.max(0, weight)];
    }),
  );
}

export function buildTrailReuseWeights(options) {
  const weights = buildDynamicWeights({ ...options, cyberEligible: true });
  if (options.items?.includes("cyberChicken")) {
    weights.cyberChicken = Math.max(weights.cyberChicken ?? 0, ITEM_DRAW_WEIGHTS.cyberChicken);
  }
  return weights;
}

export function pickRandomItemType({
  theme,
  activeTypes,
  weights = ITEM_DRAW_WEIGHTS,
  random = Math.random,
  forcedType = null,
}) {
  if (random() < 1 / 3) return "bubble";

  const pool = theme?.items?.filter((type) => activeTypes.includes(type)) ?? activeTypes;
  if (forcedType && pool.includes(forcedType)) return forcedType;
  return pickWeightedItem(pool, weights, random);
}

export function pickTrailItemType(draws, random = Math.random, weights = null) {
  if (random() < 1 / 3) return "bubble";

  const drawnToys = [...new Set(draws.filter((type) => type !== "bubble"))];
  if (!drawnToys.length) return null;
  if (weights) return pickWeightedItem(drawnToys, weights, random);
  return drawnToys[Math.floor(random() * drawnToys.length)];
}

export function pickRandomTheme(themes, random = Math.random) {
  return themes[Math.floor(random() * themes.length)];
}
