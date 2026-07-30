import { setupCamera } from "./camera.js";
import { createHandsProcessor } from "./mediapipeHands.js";
import { analyzeHands, MotionTracker } from "./gestureDetector.js";
import { BubbleManager } from "./bubbleManager.js";
import { AudioManager } from "./audioManager.js";
import { UIControls } from "./uiControls.js";
import {
  GameStateMachine,
  PROMPTS,
  STATES,
  isRoundComplete,
  isTrailReady,
} from "./gameState.js";

const video = document.querySelector("#cameraVideo");
const canvas = document.querySelector("#threeCanvas");
const bubbles = new BubbleManager(canvas);
const audio = new AudioManager();
const motion = new MotionTracker();

let latestGestures = { hands: [], hasTwoFists: false, hasOpenPalm: false, pinches: [], pinchStarts: [] };
let paused = false;
let lastFingerChangeAt = performance.now();
let lastPalmMotionAt = performance.now();
let lastPinchAt = 0;
let pinchRoundStartCount = 0;
let clearCelebrated = false;
let combo = 0;
let lastSuccessfulPopAt = 0;
let rhythmEnergy = 0.5;
let lastAmbienceUpdateAt = 0;
let touchMode = false;
const seenExtendedFingers = new Set();

const ui = new UIControls({
  onAudioGesture: async () => {
    const enabled = await audio.ensure();
    audio.setMusicVolume(ui.values.musicVolume);
    audio.setPopVolume(ui.values.popVolume);
    return enabled;
  },
  onSoundToggle: async () => {
    const enabled = await audio.toggle();
    if (enabled) audio.pop("bubble");
    return enabled;
  },
  onMusicSwitch: async () => {
    const enabled = await audio.ensure();
    if (enabled) audio.switchMusic();
    return enabled;
  },
  onPause: async (value) => {
    paused = value;
    if (paused) audio.pauseMusic();
    else if (audio.enabled) await audio.ensure();
  },
  onTouchMode: async () => {
    touchMode = !touchMode;
    ui.clearError();
    if (touchMode) {
      await audio.ensure();
      startTouchRound();
    } else {
      bubbles.clear();
      seenExtendedFingers.clear();
      machine.set(STATES.WAIT_FIST);
    }
    return touchMode;
  },
});

const machine = new GameStateMachine((state) => {
  ui.setPrompt(PROMPTS[state]);
  if (state === STATES.WAIT_FIST) {
    seenExtendedFingers.clear();
    motion.reset();
    bubbles.resetRoundDraws();
  }
  if (state === STATES.RESET) {
    bubbles.clear();
    setTimeout(() => {
      if (touchMode) startTouchRound();
      else machine.set(STATES.WAIT_FIST);
    }, 600);
  }
  if (state === STATES.PINCH_POP) {
    pinchRoundStartCount = Math.max(1, bubbles.aliveCount());
    clearCelebrated = false;
    combo = 0;
  }
});

function startTouchRound() {
  bubbles.clear();
  bubbles.resetRoundDraws();
  seenExtendedFingers.clear();
  seenExtendedFingers.add("touch");
  bubbles.seedTouchField(ui.values);
  pinchRoundStartCount = Math.max(1, bubbles.aliveCount());
  clearCelebrated = false;
  combo = 0;
  machine.set(STATES.PINCH_POP);
  ui.setPrompt("点击元素，释放压力");
}

function handlePopped(popped, now) {
  if (!popped.length) return;
  combo = now - lastSuccessfulPopAt < 850 ? combo + popped.length : popped.length;
  lastSuccessfulPopAt = now;
  ui.showCombo(combo, popped.length);
  [...new Set(popped.map((item) => item.audioProfile ?? item.type))].slice(0, 3).forEach((type, index) => {
    window.setTimeout(() => audio.pop(type), index * 35);
  });
  lastPinchAt = now;
}

document.querySelector("#app").addEventListener("pointerdown", (event) => {
  if (!touchMode || paused || event.target.closest("button, input, label, .audio-gate")) return;
  const now = performance.now();
  const popped = bubbles.popNear({ x: event.clientX, y: event.clientY }, 42);
  handlePopped(popped, now);
});

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !audio.enabled || paused) return;
  const enabled = await audio.ensure();
  ui.setSoundEnabled(enabled);
});

function processState() {
  if (paused) return;
  const now = performance.now();
  const settings = ui.values;

  switch (machine.state) {
    case STATES.WAIT_FIST:
      if (latestGestures.hasTwoFists) {
        seenExtendedFingers.clear();
        lastFingerChangeAt = now;
        machine.set(STATES.FINGER_BUBBLES);
      }
      break;

    case STATES.FINGER_BUBBLES: {
      let changed = false;
      for (const hand of latestGestures.hands) {
        for (const finger of hand.extendedFingers) {
          if (!finger.extended) continue;
          bubbles.attachOrCreateFingerItem(finger, settings);
          if (!seenExtendedFingers.has(finger.key)) {
            seenExtendedFingers.add(finger.key);
            changed = true;
          }
        }
      }
      if (changed) lastFingerChangeAt = now;
      if (seenExtendedFingers.size > 0 && now - lastFingerChangeAt > 1600) {
        lastPalmMotionAt = now;
        machine.set(STATES.PALM_TRAIL);
      }
      break;
    }

    case STATES.PALM_TRAIL: {
      let moving = false;
      for (const hand of latestGestures.hands) {
        if (!hand.isOpenPalm) continue;
        const palmMotion = motion.getPalmMotion(hand);
        if (palmMotion.speed > 9) {
          moving = true;
          lastPalmMotionAt = now;
          const amount = Math.min(10, Math.max(3, Math.round(palmMotion.speed / 12)));
          bubbles.addTrail(palmMotion.from, palmMotion.to, settings, amount);
        }
      }
      if (!moving && latestGestures.hasOpenPalm) {
        for (const hand of latestGestures.hands.filter((h) => h.isOpenPalm)) motion.getPalmMotion(hand);
      }
      if (isTrailReady({
        aliveCount: bubbles.aliveCount(),
        coverageRatio: bubbles.coverageRatio(),
        viewportWidth: window.innerWidth,
        idleMs: now - lastPalmMotionAt,
      })) {
        machine.set(STATES.PINCH_POP);
      }
      break;
    }

    case STATES.PINCH_POP:
      bubbles.reactToHands(latestGestures.hands.map((hand) => hand.pinchPoint).filter(Boolean));
      for (const hand of latestGestures.pinchStarts) {
        if (now - lastPinchAt < 180) continue;
        const pinchInterval = lastSuccessfulPopAt ? now - lastSuccessfulPopAt : 700;
        const cadence = 1 - Math.min(1, Math.max(0, (pinchInterval - 180) / 1050));
        rhythmEnergy += (cadence - rhythmEnergy) * 0.48;
        bubbles.setInteractionEnergy(rhythmEnergy);
        audio.setInteractionEnergy(rhythmEnergy);
        const popped = bubbles.popNear(hand.pinchPoint, 90);
        if (popped.length) {
          handlePopped(popped, now);
        }
      }
      if (
        seenExtendedFingers.size > 0 &&
        isRoundComplete(bubbles.aliveCount(), pinchRoundStartCount)
      ) {
        if (!clearCelebrated) {
          clearCelebrated = true;
          bubbles.celebrateClear();
          audio.complete();
          ui.showCombo(combo, 0, true);
          window.setTimeout(() => machine.set(STATES.RESET), 850);
        }
      }
      break;

    default:
      break;
  }
}

function animate() {
  requestAnimationFrame(animate);
  processState();
  bubbles.update();
  bubbles.render();
  const cursorHand = machine.state === STATES.PINCH_POP ? latestGestures.hands[0] : null;
  ui.setPinchCursor(cursorHand?.pinchPoint, cursorHand?.isPinching);
  const ambienceNow = performance.now();
  if (ambienceNow - lastAmbienceUpdateAt > 300) {
    const ambience = bubbles.getAmbienceState();
    ui.setAmbience(ambience.sceneLabel, ambience.rhythmLabel);
    lastAmbienceUpdateAt = ambienceNow;
  }
  ui.setDebug(
    `检测到 ${latestGestures.hands.length} 只手 · 可捏元素 ${bubbles.aliveCount()} · 主题 ${bubbles.getCurrentThemeLabel()} · 阶段 ${machine.state} · 声音 ${audio.enabled ? "开" : "关"}`,
  );
}

async function boot() {
  try {
    ui.setPrompt("正在请求摄像头权限");
    await setupCamera(video);
    const processor = createHandsProcessor(video, (results) => {
      latestGestures = analyzeHands(results, {
        width: window.innerWidth,
        height: window.innerHeight,
        videoWidth: video.videoWidth || 1280,
        videoHeight: video.videoHeight || 720,
      });
    });
    await processor.start();
    if (!touchMode) machine.set(STATES.WAIT_FIST);
    bubbles.showRenderCheck();
  } catch (error) {
    const message =
      error?.name === "NotAllowedError"
        ? "摄像头权限被拒绝。请在浏览器地址栏允许摄像头后刷新页面。"
        : error.message || "摄像头或手势识别初始化失败，请使用 Chrome / Edge 并通过本地服务器打开。";
    ui.showError(message);
    ui.setPrompt("初始化失败");
  }
}

animate();
boot();
