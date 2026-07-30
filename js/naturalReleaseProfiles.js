export const NATURAL_RELEASE_PROFILES = {
  petalScatter: release("petal", {
    aspect: 0.38,
    count: 52, size: [0.62, 0.98], speed: [1.1, 4.1], life: [17000, 23000],
    gravity: 0.035, drag: 0.995, flutter: 1.4, flip: [0.026, 0.08],
    shockwave: 0xffefbd, microColor: 0xffdd78, microCount: 18,
  }),
  dandelionRelease: release("rise", {
    aspect: 0.44,
    count: 38, size: [0.56, 0.88], speed: [0.8, 2.45], life: [18000, 25000],
    gravity: -0.014, drag: 0.996, flutter: 1.42, flip: [0.018, 0.05],
    shockwave: 0xfff1bd, microColor: 0xffe8a3, microCount: 22,
  }),
  hydrangeaRelease: release("drift", {
    aspect: 1,
    count: 36, size: [0.5, 0.82], speed: [1.1, 3.8], life: [16500, 22000],
    gravity: 0.032, drag: 0.994, flutter: 1.08, flip: [0.025, 0.07],
    shockwave: 0xdde9ff, microColor: 0xd7e5ff, microCount: 20,
  }),
  pineScaleRelease: release("tumble", {
    aspect: 0.72,
    count: 26, size: [0.58, 0.92], speed: [2.7, 5.8], life: [16000, 22000],
    gravity: 0.135, drag: 0.989, flutter: 0.26, flip: [0.07, 0.16],
    spinZ: [0.05, 0.14], shockwave: 0xe4c49a, microColor: 0xb88955, microCount: 13,
  }),
  samaraRelease: release("helicopter", {
    aspect: 0.72,
    count: 28, size: [0.68, 1.05], speed: [1.45, 3.5], life: [17000, 24000],
    gravity: 0.066, drag: 0.993, flutter: 0.62, flip: [0.02, 0.055],
    spinZ: [0.12, 0.22], shockwave: 0xe8d4a6, microColor: 0xc9ad73, microCount: 14,
  }),
};

function release(mode, values) {
  return {
    mode,
    duration: Math.min(1300, values.life[0] * 0.5),
    aspect: 0.62,
    ...values,
  };
}
