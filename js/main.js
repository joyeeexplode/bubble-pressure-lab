import { setupCamera } from "./camera.js";
import { createHandsProcessor } from "./mediapipeHands.js";
import { analyzeHands, MotionTracker } from "./gestureDetector.js";
import { BubbleManager } from "./bubbleManager.js";
import { AudioManager } from "./audioManager.js";
import { UIControls } from "./uiControls.js";
import { detectPerformanceProfile, detectWebGL } from "./performanceProfile.js";
import {
  GameStateMachine,
  PROMPTS,
  STATES,
  isRoundComplete,
  isTrailReady,
} from "./gameState.js";

const video = document.querySelector("#cameraVideo");
const canvas = document.querySelector("#threeCanvas");
let bubbles = null;
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
let performanceProfile = null;
let handsProcessor = null;
let cameraStream = null;
let booting = false;
let animationFrameId = 0;
let lastRenderAt = 0;
let hiddenCleanupTimer = 0;
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
    if (!touchMode) return activateTouchMode();
    await startHandMode();
    return touchMode;
  },
  onPrimaryStart: () => startHandMode(),
  onRetry: () => startHandMode(),
  onErrorTouch: () => activateTouchMode(),
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
  if (!bubbles) return;
  bubbles.clear();
  bubbles.resetRoundDraws();
  seenExtendedFingers.clear();
  seenExtendedFingers.add("touch");
  const touchSeedAmount = performanceProfile.id === "high" ? 28 : performanceProfile.id === "balanced" ? 22 : 16;
  bubbles.seedTouchField(ui.values, touchSeedAmount);
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
  if (!bubbles || !touchMode || paused || event.target.closest("button, input, label, .audio-gate")) return;
  const now = performance.now();
  const popped = bubbles.popNear({ x: event.clientX, y: event.clientY }, 42);
  handlePopped(popped, now);
});

document.addEventListener("visibilitychange", () => {
  window.clearTimeout(hiddenCleanupTimer);
  if (document.visibilityState === "hidden") {
    hiddenCleanupTimer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") stopCameraSession();
    }, 1200);
    return;
  }
  if (!touchMode && !handsProcessor) {
    ui.showError("摄像头已在页面离开时关闭。点击重试即可重新进入手势模式。", {
      retry: true,
      touch: true,
    });
  }
  if (audio.enabled && !paused) {
    audio.ensure().then((enabled) => ui.setSoundEnabled(enabled));
  }
});

window.addEventListener("pagehide", () => {
  window.cancelAnimationFrame(animationFrameId);
  stopCameraSession();
});

window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  animate();
  if (!touchMode) {
    ui.showError("页面已恢复，摄像头保持关闭。可重试手势模式或继续使用触控。", {
      retry: true,
      touch: true,
    });
  }
});

function processState() {
  if (!bubbles || paused) return;
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

function animate(now = performance.now()) {
  animationFrameId = requestAnimationFrame(animate);
  if (!bubbles || !performanceProfile) return;
  const frameInterval = 1000 / performanceProfile.renderFps;
  if (now - lastRenderAt < frameInterval) return;
  lastRenderAt = now;
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

function initializeRenderer() {
  if (bubbles) return true;
  const webgl = detectWebGL(document);
  if (!webgl.available) {
    ui.setPrompt("此设备无法启动图形模式");
    ui.showError(
      "当前浏览器或设备未提供可用的 WebGL。请开启浏览器硬件加速后重试，或更换 Chrome / Edge。",
      { retry: true, touch: false },
    );
    return false;
  }

  performanceProfile = detectPerformanceProfile(webgl, window);
  try {
    bubbles = new BubbleManager(canvas, performanceProfile);
  } catch (error) {
    ui.setPrompt("图形初始化失败");
    ui.showError(`WebGL 初始化失败：${error.message || "无法创建渲染器"}`, {
      retry: true,
      touch: false,
    });
    return false;
  }

  if (performanceProfile.id !== "high") {
    ui.showPerformanceHint(`已为你的设备开启${performanceProfile.label}`);
  }
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    paused = true;
    ui.setPrompt("图形连接已中断");
    ui.showError("WebGL 运行中断。系统恢复后可点击重试；也可以刷新页面。", {
      retry: false,
      touch: false,
    });
  });
  canvas.addEventListener("webglcontextrestored", () => {
    paused = false;
    bubbles?.resize();
    ui.clearError();
    ui.showPerformanceHint("图形渲染已恢复");
  });
  bubbles.showRenderCheck();
  return true;
}

async function stopCameraSession() {
  const processor = handsProcessor;
  handsProcessor = null;
  if (processor) {
    try {
      await processor.close();
    } catch {
      // Camera utilities may already have released their tracks.
    }
  }
  const streams = [cameraStream, video.srcObject].filter(Boolean);
  cameraStream = null;
  for (const stream of new Set(streams)) {
    for (const track of stream.getTracks?.() ?? []) track.stop();
  }
  video.srcObject = null;
  latestGestures = { hands: [], hasTwoFists: false, hasOpenPalm: false, pinches: [], pinchStarts: [] };
}

async function activateTouchMode({ preserveError = false } = {}) {
  if (!initializeRenderer()) return false;
  await stopCameraSession();
  touchMode = true;
  ui.setTouchMode(true);
  ui.dismissStartGate();
  if (!preserveError) ui.clearError();
  await audio.ensure();
  startTouchRound();
  return true;
}

async function startHandMode() {
  if (booting || !initializeRenderer()) return false;
  booting = true;
  try {
    await stopCameraSession();
    touchMode = false;
    ui.setTouchMode(false);
    ui.clearError();
    ui.setPrompt("正在请求摄像头权限");
    cameraStream = await setupCamera(video, performanceProfile);
    if (document.visibilityState === "hidden") {
      throw new Error("页面已转入后台，摄像头启动已取消。");
    }
    handsProcessor = createHandsProcessor(video, (results) => {
      latestGestures = analyzeHands(results, {
        width: window.innerWidth,
        height: window.innerHeight,
        videoWidth: video.videoWidth || performanceProfile.cameraWidth,
        videoHeight: video.videoHeight || performanceProfile.cameraHeight,
      });
    }, performanceProfile);
    await handsProcessor.start();
    machine.set(STATES.WAIT_FIST);
    ui.dismissStartGate();
    return true;
  } catch (error) {
    await stopCameraSession();
    const message =
      error?.name === "NotAllowedError"
        ? "摄像头权限被拒绝。已为你切换到触控模式。"
        : error.message || "摄像头或手势识别初始化失败，请使用 Chrome / Edge 并通过本地服务器打开。";
    ui.showError(`${message} 你可以直接点击画面继续玩，或稍后重试手势模式。`, {
      retry: true,
      touch: false,
    });
    await activateTouchMode({ preserveError: true });
    return false;
  } finally {
    booting = false;
  }
}

initializeRenderer();
animate();
