export function createHandsProcessor(videoEl, onResults) {
  if (!window.Hands || !window.Camera) {
    throw new Error("MediaPipe Hands 加载失败，请检查网络或 CDN 是否可访问。");
  }

  const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.68,
    minTrackingConfidence: 0.62,
  });

  hands.onResults(onResults);

  const camera = new window.Camera(videoEl, {
    onFrame: async () => {
      await hands.send({ image: videoEl });
    },
    width: 1280,
    height: 720,
  });

  return {
    start: () => camera.start(),
    stop: () => camera.stop(),
  };
}
