export const PERFORMANCE_PROFILES = Object.freeze({
  high: Object.freeze({
    id: "high",
    label: "完整模式",
    cameraWidth: 1280,
    cameraHeight: 720,
    modelComplexity: 1,
    gestureFps: 30,
    renderFps: 60,
    pixelRatio: 2,
    particleScale: 1,
  }),
  balanced: Object.freeze({
    id: "balanced",
    label: "流畅模式",
    cameraWidth: 640,
    cameraHeight: 480,
    modelComplexity: 0,
    gestureFps: 24,
    renderFps: 30,
    pixelRatio: 1.25,
    particleScale: 0.68,
  }),
  low: Object.freeze({
    id: "low",
    label: "轻量模式",
    cameraWidth: 640,
    cameraHeight: 360,
    modelComplexity: 0,
    gestureFps: 18,
    renderFps: 24,
    pixelRatio: 1,
    particleScale: 0.42,
  }),
});

export function detectWebGL(documentRef = document) {
  try {
    const probe = documentRef.createElement("canvas");
    const context =
      probe.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
      probe.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    if (context) return { available: true, constrained: false };

    const fallback = probe.getContext("webgl2") ?? probe.getContext("webgl");
    return { available: Boolean(fallback), constrained: Boolean(fallback) };
  } catch {
    return { available: false, constrained: false };
  }
}

export function choosePerformanceProfile({
  userAgent = "",
  hardwareConcurrency = 8,
  deviceMemory = 8,
  maxTouchPoints = 0,
  viewportWidth = 1280,
  reducedMotion = false,
  webglConstrained = false,
} = {}) {
  const mobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || (maxTouchPoints > 1 && viewportWidth < 1024);
  const lowMemory = Number.isFinite(deviceMemory) && deviceMemory <= 4;
  const lowCpu = Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 4;

  if (reducedMotion || webglConstrained || (mobile && lowMemory && lowCpu)) {
    return PERFORMANCE_PROFILES.low;
  }
  if (mobile || lowMemory || lowCpu) return PERFORMANCE_PROFILES.balanced;
  return PERFORMANCE_PROFILES.high;
}

export function detectPerformanceProfile(webgl = { constrained: false }, environment = globalThis) {
  const navigatorRef = environment.navigator ?? {};
  const matchMedia = environment.matchMedia?.bind(environment);
  return choosePerformanceProfile({
    userAgent: navigatorRef.userAgent,
    hardwareConcurrency: navigatorRef.hardwareConcurrency,
    deviceMemory: navigatorRef.deviceMemory,
    maxTouchPoints: navigatorRef.maxTouchPoints,
    viewportWidth: environment.innerWidth,
    reducedMotion: matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    webglConstrained: webgl.constrained,
  });
}
