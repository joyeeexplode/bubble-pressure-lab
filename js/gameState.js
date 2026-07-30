export const STATES = Object.freeze({
  WAIT_FIST: "WAIT_FIST",
  FINGER_BUBBLES: "FINGER_BUBBLES",
  PALM_TRAIL: "PALM_TRAIL",
  PINCH_POP: "PINCH_POP",
  RESET: "RESET",
});

export const PROMPTS = Object.freeze({
  [STATES.WAIT_FIST]: "请双手握拳开始",
  [STATES.FINGER_BUBBLES]: "伸出手指召唤随机解压玩具",
  [STATES.PALM_TRAIL]: "挥动手掌铺开随机解压元素",
  [STATES.PINCH_POP]: "捏破 95% 的元素即可通关",
  [STATES.RESET]: "正在清理，准备下一轮",
});

export function isTrailReady({ aliveCount, coverageRatio, viewportWidth, idleMs }) {
  const minimumItems = viewportWidth < 720 ? 10 : 14;
  return (aliveCount >= minimumItems || coverageRatio >= 0.26) && idleMs >= 1600;
}

export function isRoundComplete(aliveCount, roundStartCount) {
  return aliveCount <= Math.floor(Math.max(1, roundStartCount) * 0.05);
}

export class GameStateMachine {
  constructor(onChange) {
    this.state = STATES.WAIT_FIST;
    this.onChange = onChange;
    this.enteredAt = performance.now();
  }

  set(next) {
    if (this.state === next) return;
    this.state = next;
    this.enteredAt = performance.now();
    this.onChange?.(next);
  }

  elapsed() {
    return performance.now() - this.enteredAt;
  }
}
