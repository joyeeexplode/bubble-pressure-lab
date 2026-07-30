const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 6, 10, 14, 18];
const FINGER_NAMES = ["thumb", "index", "middle", "ring", "pinky"];

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function handednessLabel(results, index) {
  return results.multiHandedness?.[index]?.label ?? `Hand${index}`;
}

const pinchMemory = new Map();

function normToScreen(lm, viewport) {
  const { width, height, videoWidth = width, videoHeight = height } = viewport;
  const scale = Math.max(width / videoWidth, height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (width - renderedWidth) / 2;
  const offsetY = (height - renderedHeight) / 2;
  return {
    x: offsetX + (1 - lm.x) * renderedWidth,
    y: offsetY + lm.y * renderedHeight,
    z: lm.z ?? 0,
  };
}

export function analyzeHands(results, viewport) {
  const hands = (results.multiHandLandmarks ?? []).map((landmarks, handIndex) => {
    const label = handednessLabel(results, handIndex);
    const screen = landmarks.map((lm) => normToScreen(lm, viewport));
    const palmSize = Math.max(0.001, dist(landmarks[0], landmarks[9]));
    const extended = FINGER_TIPS.map((tipIndex, i) => {
      if (i === 0) {
        return dist(landmarks[4], landmarks[17]) > dist(landmarks[3], landmarks[17]) * 1.08;
      }
      return landmarks[tipIndex].y < landmarks[FINGER_PIPS[i]].y - palmSize * 0.08;
    });
    const extendedCount = extended.filter(Boolean).length;
    const palmCenter = [0, 5, 9, 13, 17].reduce(
      (acc, idx) => ({ x: acc.x + screen[idx].x / 5, y: acc.y + screen[idx].y / 5 }),
      { x: 0, y: 0 },
    );
    const pinchDistance = dist(landmarks[4], landmarks[8]);
    const memoryKey = label;
    const wasPinching = pinchMemory.get(memoryKey) ?? false;
    let isPinching = wasPinching;
    if (!wasPinching && pinchDistance < palmSize * 0.38) isPinching = true;
    if (wasPinching && pinchDistance > palmSize * 0.55) isPinching = false;
    pinchMemory.set(memoryKey, isPinching);

    return {
      id: `${label}-${handIndex}`,
      label,
      landmarks,
      screen,
      palmCenter,
      palmSize: palmSize * Math.min(viewport.width, viewport.height),
      isFist: extendedCount === 0,
      isOpenPalm: extendedCount >= 4,
      isPinching,
      pinchStarted: isPinching && !wasPinching,
      pinchPoint: {
        x: (screen[4].x + screen[8].x) / 2,
        y: (screen[4].y + screen[8].y) / 2,
      },
      extendedFingers: FINGER_NAMES.map((name, i) => ({
        name,
        key: `${label}-${handIndex}-${name}`,
        extended: extended[i],
        tip: screen[FINGER_TIPS[i]],
      })),
    };
  });

  return {
    hands,
    hasTwoFists: hands.length >= 2 && hands.slice(0, 2).every((h) => h.isFist),
    hasOpenPalm: hands.some((h) => h.isOpenPalm),
    pinches: hands.filter((h) => h.isPinching),
    pinchStarts: hands.filter((h) => h.pinchStarted),
  };
}

export class MotionTracker {
  constructor() {
    this.previous = new Map();
  }

  getPalmMotion(hand) {
    const prev = this.previous.get(hand.id);
    this.previous.set(hand.id, hand.palmCenter);
    if (!prev) return { speed: 0, from: hand.palmCenter, to: hand.palmCenter };
    return {
      speed: Math.hypot(hand.palmCenter.x - prev.x, hand.palmCenter.y - prev.y),
      from: prev,
      to: hand.palmCenter,
    };
  }

  reset() {
    this.previous.clear();
  }
}
