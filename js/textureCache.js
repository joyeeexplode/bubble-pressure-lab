export function collectTexturePaths(catalog) {
  return [
    ...new Set(
      Object.values(catalog)
        .flatMap((definition) => [definition.asset, definition.particleAsset])
        .filter(Boolean),
    ),
  ];
}

export class TextureCache {
  constructor(THREE, catalog, { onProgress } = {}) {
    this.THREE = THREE;
    this.catalog = catalog;
    this.onProgress = onProgress;
    this.cache = new Map();
    this.loader = new THREE.TextureLoader();
    this.allPaths = collectTexturePaths(catalog);
    this.completed = new Set();
    this.failed = new Set();
    this.idleQueue = [];
    this.idleScheduled = false;
  }

  get(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    const texture = this.loader.load(
      path,
      () => this.markComplete(path),
      undefined,
      () => {
        this.failed.add(path);
        const fallback = this.makeFallbackTexture();
        texture.image = fallback.image;
        texture.needsUpdate = true;
        this.markComplete(path);
      },
    );
    texture.colorSpace = this.THREE.SRGBColorSpace;
    texture.minFilter = this.THREE.LinearFilter;
    texture.magFilter = this.THREE.LinearFilter;
    this.cache.set(path, texture);
    this.emitProgress();
    return texture;
  }

  markComplete(path) {
    this.completed.add(path);
    this.emitProgress();
  }

  emitProgress() {
    this.onProgress?.({
      loaded: this.completed.size,
      total: this.allPaths.length,
      failed: this.failed.size,
    });
  }

  preloadTheme(theme) {
    const immediateTypes = theme?.items ?? [];
    for (const type of immediateTypes) {
      const definition = this.catalog[type];
      if (definition?.asset) this.get(definition.asset);
      if (definition?.particleAsset) this.get(definition.particleAsset);
    }
    if (this.idleScheduled) return;
    this.idleScheduled = true;
    const immediate = new Set(immediateTypes);
    this.idleQueue = Object.entries(this.catalog)
      .filter(([type]) => !immediate.has(type))
      .flatMap(([, definition]) => [definition.asset, definition.particleAsset])
      .filter(Boolean);
    this.scheduleIdleBatch();
  }

  scheduleIdleBatch() {
    if (!this.idleQueue.length) return;
    const loadBatch = (deadline) => {
      let loaded = 0;
      while (this.idleQueue.length && loaded < 3 && (deadline.didTimeout || deadline.timeRemaining() > 4)) {
        this.get(this.idleQueue.shift());
        loaded += 1;
      }
      if (this.idleQueue.length) this.scheduleIdleBatch();
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadBatch, { timeout: 1800 });
    } else {
      window.setTimeout(() => loadBatch({ didTimeout: true, timeRemaining: () => 0 }), 240);
    }
  }

  makeFallbackTexture() {
    if (this.fallbackTexture) return this.fallbackTexture;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(98, 82, 12, 128, 128, 112);
    gradient.addColorStop(0, "rgba(255,255,255,0.72)");
    gradient.addColorStop(0.55, "rgba(150,236,255,0.12)");
    gradient.addColorStop(0.84, "rgba(255,160,225,0.26)");
    gradient.addColorStop(1, "rgba(185,245,255,0.78)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(128, 128, 108, 0, Math.PI * 2);
    context.fill();
    this.fallbackTexture = new this.THREE.CanvasTexture(canvas);
    this.fallbackTexture.colorSpace = this.THREE.SRGBColorSpace;
    return this.fallbackTexture;
  }
}
