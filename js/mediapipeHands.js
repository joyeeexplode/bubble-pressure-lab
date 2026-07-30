export function createHandsProcessor(videoEl, onResults, profile) {
  if (!window.Hands || !window.Camera) {
    throw new Error("MediaPipe Hands 加载失败，请检查网络或 CDN 是否可访问。");
  }

  const hands = new window.Hands({
    locateFile: (file) => `./assets/vendor/mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: profile.modelComplexity,
    minDetectionConfidence: 0.68,
    minTrackingConfidence: 0.62,
  });

  hands.onResults(onResults);

  let lastFrameAt = 0;
  let processing = false;
  const minimumFrameMs = 1000 / profile.gestureFps;
  const camera = new window.Camera(videoEl, {
    onFrame: async () => {
      const now = performance.now();
      if (processing || now - lastFrameAt < minimumFrameMs) return;
      processing = true;
      lastFrameAt = now;
      try {
        await hands.send({ image: videoEl });
      } finally {
        processing = false;
      }
    },
    width: profile.cameraWidth,
    height: profile.cameraHeight,
  });

  return {
    start: () => camera.start(),
    stop: () => camera.stop(),
    close: async () => {
      await camera.stop();
      await hands.close?.();
    },
  };
}
