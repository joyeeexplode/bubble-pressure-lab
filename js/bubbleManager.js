import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
import { ITEM_CATALOG, THEME_POOLS, TOY_ITEM_TYPES } from "./itemCatalog.js";
import { NATURAL_RELEASE_PROFILES } from "./naturalReleaseProfiles.js";
import { CRUSHABLE_EFFECTS } from "./crushableCatalog.js";
import {
  buildDynamicWeights,
  getMaterialVisualTone,
  pickRandomItemType,
  pickRandomTheme,
  pickTrailItemType,
} from "./itemSelection.js";

const SIGNATURE_RELEASES = {
  cracked_ice_cube: { behavior: "iceSlabs", duration: 1120, colors: [0xd9fbff, 0x8ee8f5, 0xffffff] },
  caramel_glass: { behavior: "caramelSnap", duration: 1050, colors: [0xffc15c, 0xd98a32, 0xffe6a6] },
  walnut_pressure_shell: { behavior: "shellHalves", duration: 1080, colors: [0xc08a53, 0x7d4d2d, 0xf0c993] },
  meteor_jelly_core: { behavior: "meteorPeel", duration: 1180, colors: [0x9b9a91, 0xffa784, 0x74e6de] },
  bubble_wrap_tile: { behavior: "chainCells", duration: 1160, colors: [0xb9f7ff, 0x8ddde9, 0xffffff] },
  sealed_air_bag: { behavior: "airJet", duration: 1280, colors: [0xeaffff, 0xa9f1ec, 0xffffff] },
  gummy_cube: { behavior: "gummyDice", duration: 1240, colors: [0xffb794, 0x9ee8cc, 0xffe5a5] },
  marshmallow_cloud: { behavior: "cloudPuffs", duration: 1420, colors: [0xfff8ed, 0xdff5f2, 0xf5dbe2] },
  light_cracking_ceramic: { behavior: "ceramicPetals", duration: 1260, colors: [0xf7f2df, 0xc4eee3, 0xffffff] },
};

export class BubbleManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, window.innerWidth, window.innerHeight, 0, -1000, 1000);
    this.camera.position.z = 100;
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.bubbles = new Map();
    this.nextId = 1;
    this.textureCache = new Map();
    this.textureLoader = new THREE.TextureLoader();
    this.roundFingerDraws = [];
    this.recentItemTypes = [];
    this.recentMaterials = [];
    this.roundToyDraws = 0;
    this.roundFocusType = null;
    this.roundFocusDrawn = false;
    this.roundsSinceCyber = 2;
    this.drawsSinceCyber = 12;
    this.currentRoundHadCyber = false;
    this.currentTheme = THEME_POOLS[0];
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.atmosphereLayer = document.querySelector("#atmosphereLayer");
    this.releaseEnergy = 0;
    this.weatherMix = 0;
    this.glowPulse = {
      strength: 0,
      color: new THREE.Color(0xa7f3ff),
      warmth: 0,
    };
    this.edgeFlash = 0;
    this.cyberScan = 0;
    this.interactionEnergy = 0.5;
    this.sceneCycleMs = 72000;
    this.sceneLabels = ["晨雾", "午后", "霓虹夜", "月光"];
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = h;
    this.camera.updateProjectionMatrix();
  }

  makeBubbleTexture(rainbow = false) {
    const key = rainbow ? "rainbow" : "clear";
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const c = size / 2;

    ctx.clearRect(0, 0, size, size);

    const film = ctx.createRadialGradient(c * 0.7, c * 0.66, size * 0.08, c, c, size * 0.48);
    film.addColorStop(0, "rgba(255,255,255,0.32)");
    film.addColorStop(0.55, "rgba(177,242,255,0.10)");
    film.addColorStop(0.78, "rgba(255,255,255,0.20)");
    film.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = film;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.47, 0, Math.PI * 2);
    ctx.fill();

    const edge = ctx.createRadialGradient(c, c, size * 0.38, c, c, size * 0.49);
    edge.addColorStop(0, "rgba(255,255,255,0)");
    edge.addColorStop(0.78, "rgba(210,252,255,0.58)");
    edge.addColorStop(1, "rgba(255,255,255,0.98)");
    ctx.strokeStyle = edge;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(c, c, size * 0.32, Math.PI * 1.05, Math.PI * 1.42);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.beginPath();
    ctx.ellipse(size * 0.36, size * 0.32, size * 0.06, size * 0.025, -0.6, 0, Math.PI * 2);
    ctx.fill();

    if (rainbow) {
      const arcs = [
        ["rgba(255,132,205,0.55)", 0.4],
        ["rgba(134,228,255,0.5)", 0.48],
        ["rgba(255,246,151,0.45)", 0.56],
      ];
      arcs.forEach(([color, r], i) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(c, c, size * r, Math.PI * (0.1 + i * 0.035), Math.PI * (0.44 + i * 0.025));
        ctx.stroke();
      });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.textureCache.set(key, texture);
    return texture;
  }

  addBubble({ x, y, radius = 42, opacity = 0.55, attachedFinger = null, color = null }) {
    const id = this.nextId++;
    const group = new THREE.Group();
    const rainbow = Math.random() < 0.18;
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uOpacity: { value: Math.max(0.32, Math.min(0.72, opacity)) },
        uRainbow: { value: rainbow ? 1 : 0.28 },
        uTime: { value: Math.random() * 20 },
        uHue: { value: Math.random() },
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vNormal;
        void main() {
          vec3 p = position;
          float wobble = sin(uTime * 2.1 + position.y * 0.12 + position.x * 0.09) * 0.012;
          p += normal * wobble;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vNormal;
        uniform float uOpacity;
        uniform float uRainbow;
        uniform float uTime;
        uniform float uHue;

        void main() {
          vec3 n = normalize(vNormal);
          float facing = clamp(abs(n.z), 0.0, 1.0);
          float fresnel = pow(1.0 - facing, 2.35);
          float hue = fract(uHue + fresnel * 0.55 + n.x * 0.16 + n.y * 0.1 + uTime * 0.018);
          vec3 rainbow = 0.58 + 0.42 * cos(6.28318 * (hue + vec3(0.0, 0.33, 0.67)));
          vec3 clearFilm = vec3(0.78, 0.96, 1.0);
          vec3 color = mix(clearFilm, rainbow, uRainbow * (0.12 + fresnel * 0.58));
          float highlight = pow(max(dot(n, normalize(vec3(-0.48, 0.62, 0.72))), 0.0), 72.0);
          float secondary = pow(max(dot(n, normalize(vec3(0.55, -0.3, 0.78))), 0.0), 110.0);
          color += vec3(1.0) * (highlight * 0.95 + secondary * 0.55);
          float alpha = uOpacity * (0.045 + fresnel * 0.78) + highlight * 0.82 + secondary * 0.42;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.9));
        }
      `,
    });
    const membrane = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 24),
      material,
    );
    group.add(membrane);

    group.position.set(x, y, 10);
    group.userData.baseRadius = radius;
    this.scene.add(group);

    const bubble = {
      id,
      type: "bubble",
      effect: "burst",
      position: { x, y },
      radius,
      opacity,
      color,
      attachedFinger,
      isImage: false,
      state: "alive",
      group,
      material,
      bornAt: performance.now(),
      floatPhase: Math.random() * Math.PI * 2,
      floatAmplitude: 2.5 + Math.random() * 4,
      velocity: {
        x: (Math.random() - 0.5) * 0.12,
        y: -(0.025 + Math.random() * 0.045),
      },
      reaction: 0,
    };
    this.bubbles.set(id, bubble);
    return bubble;
  }

  getItemTexture(path) {
    if (this.textureCache.has(path)) return this.textureCache.get(path);
    const texture = this.textureLoader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.textureCache.set(path, texture);
    return texture;
  }

  getMaterialCounts() {
    const counts = {};
    for (const bubble of this.bubbles.values()) {
      if (bubble.state !== "alive" || !bubble.materialFamily) continue;
      counts[bubble.materialFamily] = (counts[bubble.materialFamily] ?? 0) + 1;
    }
    return counts;
  }

  getVisualToneCounts() {
    const counts = {};
    for (const bubble of this.bubbles.values()) {
      if (bubble.state !== "alive" || !bubble.materialFamily) continue;
      const tone = getMaterialVisualTone(bubble.materialFamily);
      counts[tone] = (counts[tone] ?? 0) + 1;
    }
    return counts;
  }

  getRoundPhase() {
    if (this.roundToyDraws < 2) return "opening";
    if (this.roundToyDraws < 5) return "contrast";
    if (this.roundFocusDrawn && this.roundToyDraws >= 6) return "settle";
    return "spotlight";
  }

  pickRandomItemType(position = null) {
    const pool = this.currentTheme?.items?.filter((type) => TOY_ITEM_TYPES.includes(type))
      ?? TOY_ITEM_TYPES;
    const materialByType = Object.fromEntries(
      pool.map((type) => [type, ITEM_CATALOG[type]?.materialFamily]),
    );
    const sceneIndex = Math.floor(
      (performance.now() % this.sceneCycleMs) / this.sceneCycleMs * 4,
    ) % 4;
    const weights = buildDynamicWeights({
      items: pool,
      materialByType,
      recentTypes: this.recentItemTypes,
      recentMaterials: this.recentMaterials,
      sceneId: ["morning", "afternoon", "neon", "moonlight"][sceneIndex],
      interactionEnergy: this.interactionEnergy,
      focusType: this.roundFocusType,
      focusPending: !this.roundFocusDrawn,
      cyberEligible: this.roundsSinceCyber >= 1 && !this.currentRoundHadCyber,
      drawsSinceCyber: this.drawsSinceCyber,
      verticalRatio: position ? position.y / Math.max(1, window.innerHeight) : 0.5,
      materialCounts: this.getMaterialCounts(),
      visualToneCounts: this.getVisualToneCounts(),
      roundPhase: this.getRoundPhase(),
    });
    const type = pickRandomItemType({
      theme: this.currentTheme,
      activeTypes: TOY_ITEM_TYPES,
      weights,
      forcedType: !this.roundFocusDrawn && this.roundToyDraws >= 5
        ? this.roundFocusType
        : null,
    });
    if (type !== "bubble") this.recordItemDraw(type);
    return type;
  }

  recordItemDraw(type) {
    const material = ITEM_CATALOG[type]?.materialFamily;
    this.roundToyDraws += 1;
    this.recentItemTypes.push(type);
    if (material) this.recentMaterials.push(material);
    this.recentItemTypes.splice(0, Math.max(0, this.recentItemTypes.length - 7));
    this.recentMaterials.splice(0, Math.max(0, this.recentMaterials.length - 3));
    if (type === this.roundFocusType) this.roundFocusDrawn = true;
    if (type === "cyberChicken") {
      this.currentRoundHadCyber = true;
      this.drawsSinceCyber = 0;
    } else {
      this.drawsSinceCyber += 1;
    }
  }

  pickTrailItemType(targetY = window.innerHeight * 0.5) {
    const pool = [...new Set(this.roundFingerDraws.filter((type) => type !== "bubble"))];
    if (!pool.length) return pickTrailItemType(this.roundFingerDraws);
    const materialByType = Object.fromEntries(
      pool.map((type) => [type, ITEM_CATALOG[type]?.materialFamily]),
    );
    const weights = buildDynamicWeights({
      items: pool,
      materialByType,
      recentTypes: this.recentItemTypes,
      recentMaterials: this.recentMaterials,
      interactionEnergy: this.interactionEnergy,
      verticalRatio: targetY / Math.max(1, window.innerHeight),
      materialCounts: this.getMaterialCounts(),
      visualToneCounts: this.getVisualToneCounts(),
      roundPhase: this.getRoundPhase(),
      cyberEligible: !this.currentRoundHadCyber,
    });
    return pickTrailItemType(this.roundFingerDraws, Math.random, weights) ?? "bubble";
  }

  getBalancedRadius(type, baseRadius, y) {
    const material = ITEM_CATALOG[type]?.materialFamily;
    const verticalRatio = y / Math.max(1, window.innerHeight);
    const heavy = ["ice", "candy", "ceramic", "nut", "shell", "space", "paper"].includes(material);
    const floating = [
      "cloud", "air", "inflatableVinyl", "naturalRelease", "botanical", "siliconeFoam",
    ].includes(material);
    let scale = heavy ? THREE.MathUtils.lerp(0.88, 1.1, verticalRatio) : 1;
    if (floating) scale *= THREE.MathUtils.lerp(1.08, 0.9, verticalRatio);
    const aliveRadii = [...this.bubbles.values()]
      .filter((bubble) => bubble.state === "alive")
      .map((bubble) => bubble.radius);
    if (aliveRadii.length >= 3) {
      const largeRatio = aliveRadii.filter((radius) => radius > 54).length / aliveRadii.length;
      scale *= largeRatio > 0.58 ? 0.84 : largeRatio < 0.24 ? 1.1 : 1;
    }
    if (y > window.innerHeight - 100) scale *= 0.8;
    return baseRadius * THREE.MathUtils.clamp(scale, 0.74, 1.14);
  }

  resetRoundDraws() {
    this.roundsSinceCyber = this.currentRoundHadCyber ? 0 : this.roundsSinceCyber + 1;
    this.currentRoundHadCyber = false;
    this.roundFingerDraws.length = 0;
    this.roundToyDraws = 0;
    this.roundFocusDrawn = false;
    this.currentTheme = pickRandomTheme(THEME_POOLS);
    const focusPool = this.currentTheme.items.filter((type) =>
      TOY_ITEM_TYPES.includes(type) && type !== "cyberChicken",
    );
    this.roundFocusType = focusPool[Math.floor(Math.random() * focusPool.length)] ?? null;
  }

  getCurrentThemeLabel() {
    return this.currentTheme?.label ?? "混合";
  }

  addImageItem({ type, x, y, radius, opacity, attachedFinger }) {
    const definition = ITEM_CATALOG[type];
    const id = this.nextId++;
    const group = new THREE.Group();
    const texture = this.getItemTexture(definition.asset);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: texture },
        uOpacity: { value: Math.max(0.58, Math.min(0.78, opacity + 0.12)) },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uMap;
        uniform float uOpacity;
        void main() {
          vec4 texel = texture2D(uMap, vUv);
          float alpha = texel.a * uOpacity;
          if (alpha < 0.025) discard;
          float luminance = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
          vec3 softened = mix(vec3(luminance), texel.rgb, 0.72);
          softened = mix(softened, vec3(0.78, 0.95, 1.0), 0.11);
          vec2 p = vUv - 0.5;
          float edgeFilm = smoothstep(0.25, 0.7, length(p));
          softened += vec3(0.16, 0.32, 0.36) * edgeFilm * 0.16;
          alpha *= 0.9;
          gl_FragColor = vec4(softened, alpha);
        }
      `,
    });
    const width = radius * 2 * definition.aspect;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, radius * 2), material);
    group.add(mesh);
    group.position.set(x, y - radius * 0.35, 14);
    this.scene.add(group);

    const item = {
      id,
      type,
      effect: definition.effectProfile,
      materialFamily: definition.materialFamily,
      audioProfile: definition.audioProfile,
      position: { x, y: y - radius * 0.35 },
      radius: radius * Math.max(1, definition.aspect * 0.72),
      opacity,
      attachedFinger,
      isImage: true,
      state: "alive",
      group,
      material,
      bornAt: performance.now(),
      floatPhase: Math.random() * Math.PI * 2,
      floatAmplitude: 2 + Math.random() * 3,
      velocity: { x: (Math.random() - 0.5) * 0.08, y: -0.025 },
      reaction: 0,
      dodgedOnce: false,
    };
    this.bubbles.set(id, item);
    return item;
  }

  attachOrCreateFingerItem(finger, settings) {
    const existing = [...this.bubbles.values()].find((b) => b.attachedFinger === finger.key && b.state === "alive");
    if (existing) {
      existing.position.x += (finger.tip.x - existing.position.x) * 0.32;
      existing.position.y += (finger.tip.y - existing.position.y) * 0.32;
      return existing;
    }
    const type = this.pickRandomItemType(finger.tip);
    this.roundFingerDraws.push(type);
    if (type !== "bubble") {
      return this.addImageItem({
        type,
        x: finger.tip.x,
        y: finger.tip.y,
        radius: this.getBalancedRadius(
          type,
          (34 + Math.random() * 12) * settings.bubbleSize,
          finger.tip.y,
        ),
        opacity: settings.bubbleOpacity,
        attachedFinger: finger.key,
      });
    }
    return this.addBubble({
      x: finger.tip.x,
      y: finger.tip.y,
      radius: (25 + Math.random() * 14) * settings.bubbleSize,
      opacity: Math.min(settings.bubbleOpacity, 0.58),
      attachedFinger: finger.key,
    });
  }

  attachOrCreateFingerBubble(finger, settings) {
    return this.attachOrCreateFingerItem(finger, settings);
  }

  addTrail(from, to, settings, amount = 5) {
    if (this.aliveCount() >= 150) return;
    for (let i = 0; i < amount; i += 1) {
      const t = amount === 1 ? 1 : i / (amount - 1);
      const softSpread = 58;
      const targetY = from.y + (to.y - from.y) * t;
      const type = this.pickTrailItemType(targetY);
      if (!type) continue;
      const baseRadius =
        type === "bubble"
          ? 18 + Math.random() * 16
          : 34 + Math.random() * 12;
      const radius = type === "bubble"
        ? baseRadius * settings.bubbleSize
        : this.getBalancedRadius(type, baseRadius * settings.bubbleSize, targetY);
      const definition = ITEM_CATALOG[type];
      const collisionRadius =
        type === "bubble" ? radius : radius * Math.max(1, definition.aspect * 0.72);
      let position = null;

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const spread = softSpread * (1 + attempt * 0.16);
        const candidate = {
          x: THREE.MathUtils.clamp(
            from.x + (to.x - from.x) * t + (Math.random() - 0.5) * spread,
            collisionRadius,
            window.innerWidth - collisionRadius,
          ),
          y: THREE.MathUtils.clamp(
            from.y + (to.y - from.y) * t + (Math.random() - 0.5) * spread,
            collisionRadius,
            window.innerHeight - collisionRadius,
          ),
        };
        const overlaps = [...this.bubbles.values()].some((bubble) => {
          if (bubble.state !== "alive") return false;
          const distance = Math.hypot(
            bubble.position.x - candidate.x,
            bubble.position.y - candidate.y,
          );
          return distance < (bubble.radius + collisionRadius) * 0.84;
        });
        if (!overlaps) {
          position = candidate;
          break;
        }
      }

      if (!position) continue;
      if (type === "bubble") {
        this.addBubble({
          x: position.x,
          y: position.y,
          radius,
          opacity: Math.min(settings.bubbleOpacity, 0.56),
        });
      } else {
        this.addImageItem({
          type,
          x: position.x,
          y: position.y,
          radius,
          opacity: settings.bubbleOpacity,
          attachedFinger: null,
        });
      }
    }
  }

  seedTouchField(settings, amount = 28) {
    const top = Math.max(92, window.innerHeight * 0.12);
    const bottom = Math.max(top + 180, window.innerHeight - 118);
    for (let index = 0; index < amount && this.aliveCount() < 90; index += 1) {
      const target = {
        x: 36 + Math.random() * Math.max(1, window.innerWidth - 72),
        y: top + Math.random() * Math.max(1, bottom - top),
      };
      const type = this.pickRandomItemType(target);
      if (!type) continue;
      this.roundFingerDraws.push(type);
      const baseRadius = type === "bubble" ? 20 + Math.random() * 14 : 31 + Math.random() * 12;
      const radius = type === "bubble"
        ? baseRadius * settings.bubbleSize
        : this.getBalancedRadius(type, baseRadius * settings.bubbleSize, target.y);
      const definition = ITEM_CATALOG[type];
      const collisionRadius = type === "bubble"
        ? radius
        : radius * Math.max(1, definition.aspect * 0.72);
      const overlaps = [...this.bubbles.values()].some((bubble) =>
        bubble.state === "alive" &&
        Math.hypot(bubble.position.x - target.x, bubble.position.y - target.y) <
          (bubble.radius + collisionRadius) * 0.72,
      );
      if (overlaps) continue;
      if (type === "bubble") {
        this.addBubble({
          ...target,
          radius,
          opacity: Math.min(settings.bubbleOpacity, 0.56),
        });
      } else {
        this.addImageItem({
          type,
          ...target,
          radius,
          opacity: settings.bubbleOpacity,
          attachedFinger: null,
        });
      }
    }
  }

  popNear(point, radius = 95) {
    const popped = [];
    for (const bubble of this.bubbles.values()) {
      if (bubble.state !== "alive") continue;
      const d = Math.hypot(bubble.position.x - point.x, bubble.position.y - point.y);
      if (d < radius + bubble.radius) {
        popped.push(this.startPopping(bubble, point));
      }
    }
    return popped;
  }

  startPopping(bubble, impactPoint = bubble?.position) {
    if (!bubble || bubble.state !== "alive") return bubble;
    bubble.state = "popping";
    bubble.popStarted = performance.now();
    const impactDx = bubble.position.x - (impactPoint?.x ?? bubble.position.x);
    const impactDy = bubble.position.y - (impactPoint?.y ?? bubble.position.y);
    const impactLength = Math.hypot(impactDx, impactDy) || 1;
    bubble.impact = {
      x: impactDx / impactLength,
      y: impactDy / impactLength,
      pointX: impactPoint?.x ?? bubble.position.x,
      pointY: impactPoint?.y ?? bubble.position.y,
    };
    const durationByType = {
      duck: 520, pufferfish: 760, seal: 680, unicornFloat: 840, pressureHippo: 920,
      frog: 460, jellyfish: 620, octopus: 560,
      waterStarfish: 620, softCloud: 760, jellyOrange: 520,
      waterPeach: 620, creamMochi: 680,
      doubleDaisy: 980, cyberChicken: 720,
    };
    bubble.popDuration = SIGNATURE_RELEASES[bubble.type]?.duration ?? durationByType[bubble.type] ??
      NATURAL_RELEASE_PROFILES[bubble.effect]?.duration ??
      (CRUSHABLE_EFFECTS.has(bubble.effect) ? 680 : null) ??
      (bubble.effect === "deflate" ? 620 : bubble.effect === "squash" ? 540 : 400);
    if (NATURAL_RELEASE_PROFILES[bubble.effect]) {
      bubble.group.visible = false;
    }
    this.registerReleaseMood(bubble);
    this.spawnImpactCracks(bubble);
    this.spawnSoftChainReaction(bubble);
    this.spawnBurst(bubble);
    return bubble;
  }

  setInteractionEnergy(value) {
    this.interactionEnergy += (THREE.MathUtils.clamp(value, 0, 1) - this.interactionEnergy) * 0.42;
  }

  getAmbienceState() {
    const scenePosition = (performance.now() % this.sceneCycleMs) / this.sceneCycleMs * 4;
    const sceneIndex = Math.floor(scenePosition) % 4;
    return {
      sceneLabel: this.sceneLabels[sceneIndex],
      rhythmLabel: this.interactionEnergy > 0.68 ? "清脆" : this.interactionEnergy < 0.34 ? "柔和" : "流动",
    };
  }

  spawnImpactCracks(bubble) {
    if (!bubble.isImage || NATURAL_RELEASE_PROFILES[bubble.effect] || this.reducedMotion) return;
    const definition = ITEM_CATALOG[bubble.type];
    const brittle = ["ice", "candy", "ceramic", "nut", "shell", "crystal", "space"]
      .includes(definition?.materialFamily);
    const branchCount = brittle ? 8 : 5;
    const points = [];
    const startX = bubble.impact?.pointX ?? bubble.position.x;
    const startY = bubble.impact?.pointY ?? bubble.position.y;
    const baseAngle = Math.atan2(bubble.position.y - startY, bubble.position.x - startX);
    for (let index = 0; index < branchCount; index += 1) {
      const angle = baseAngle + (index - (branchCount - 1) / 2) * (brittle ? 0.22 : 0.3)
        + (Math.random() - 0.5) * 0.2;
      const length = bubble.radius * (0.42 + Math.random() * 0.72);
      const bendX = startX + Math.cos(angle) * length * 0.52 + (Math.random() - 0.5) * 7;
      const bendY = startY + Math.sin(angle) * length * 0.52 + (Math.random() - 0.5) * 7;
      const endX = startX + Math.cos(angle) * length;
      const endY = startY + Math.sin(angle) * length;
      points.push(
        new THREE.Vector3(startX, startY, 26),
        new THREE.Vector3(bendX, bendY, 26),
        new THREE.Vector3(bendX, bendY, 26),
        new THREE.Vector3(endX, endY, 26),
      );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const cracks = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: brittle ? 0xeaffff : 0xfff1cf,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    cracks.userData = {
      burst: true,
      impactCracks: true,
      bornAt: performance.now(),
      life: brittle ? 460 : 380,
    };
    this.scene.add(cracks);
  }

  registerReleaseMood(bubble) {
    const natural = NATURAL_RELEASE_PROFILES[bubble.effect];
    const materialColor = {
      botanical: 0xffefd1,
      naturalRelease: 0xd7f0b8,
      inflatableVinyl: 0xbdf7ff,
      softVinyl: 0xffdca8,
      gummy: 0xffb9a6,
      silicone: 0xd9dcff,
      siliconeFoam: 0xf4f6ff,
      waterGel: 0x9eefff,
      plant: 0xcff2b7,
      water: 0xa7f3ff,
      jelly: 0xffc0a8,
      candy: 0xffd66f,
      ceramic: 0xf6f0de,
      ice: 0xcdf9ff,
      nut: 0xcfa06e,
      shell: 0xe6bd8d,
      air: 0xeafcff,
      bubblewrap: 0xb9f7ff,
      cloud: 0xf5f3ff,
      foam: 0xd9fbff,
      crystal: 0xdde8ff,
      space: 0xffa784,
      light: 0xdde8ff,
      paper: 0xd9c28a,
      cyber: 0xffd65c,
      bubble: 0xbdf7ff,
    };
    const family = bubble.materialFamily;
    const color = materialColor[family] ?? materialColor[bubble.type] ?? 0xeefcff;
    this.releaseEnergy = THREE.MathUtils.clamp(this.releaseEnergy + (natural ? 0.16 : 0.09), 0, 1);
    this.glowPulse.color.setHex(color);
    this.glowPulse.strength = Math.min(1, this.glowPulse.strength + (natural ? 0.54 : 0.34));
    this.edgeFlash = Math.min(1, this.edgeFlash + (natural ? 0.32 : 0.18));
    if (bubble.type === "cyberChicken") {
      this.cyberScan = 1;
      this.edgeFlash = 1;
    }
    this.glowPulse.warmth = Math.max(
      this.glowPulse.warmth,
      ["botanical", "naturalRelease", "gummy", "candy", "nut", "shell", "paper"].includes(family) ? 0.42 : 0.16,
    );
  }

  spawnSoftChainReaction(source) {
    const natural = NATURAL_RELEASE_PROFILES[source.effect];
    const waveColor = natural
      ? NATURAL_RELEASE_PROFILES[source.effect].shockwave
      : {
          ice: 0xcdf9ff,
          candy: 0xffd66f,
          nut: 0xcfa06e,
          shell: 0xe6bd8d,
          waterGel: 0x9eefff,
          gummy: 0xffb9a6,
          bubblewrap: 0xb9f7ff,
          cyber: 0xffd65c,
        }[source.materialFamily] ?? 0xeefcff;
    const wave = new THREE.Mesh(
      new THREE.RingGeometry(source.radius * 0.48, source.radius * 0.54, 80),
      new THREE.MeshBasicMaterial({
        color: waveColor,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    wave.position.set(source.position.x, source.position.y, 15);
    wave.userData = {
      burst: true,
      chainWave: true,
      bornAt: performance.now(),
      life: source.type === "cyberChicken" ? 920 : 680,
      maxScale: source.type === "cyberChicken" ? 7.6 : natural ? 5.4 : 4.2,
    };
    this.scene.add(wave);

    const range = source.type === "cyberChicken" ? 260 : natural ? 210 : 165;
    this.disturbLandedFragments(source.position, range, source.type === "cyberChicken" ? 1.5 : 1);
    for (const target of this.bubbles.values()) {
      if (target.id === source.id || target.state !== "alive") continue;
      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance > range + target.radius) continue;
      const strength = 1 - THREE.MathUtils.clamp(distance / (range + target.radius), 0, 1);
      target.reaction = Math.min(1, (target.reaction ?? 0) + strength * 0.9);
      if (!target.attachedFinger) {
        const angle = Math.atan2(dy, dx);
        target.velocity.x += Math.cos(angle) * strength * 0.42;
        target.velocity.y += Math.sin(angle) * strength * 0.24 - strength * 0.18;
      }
      this.spawnChainSpark(target, waveColor, strength, source.type === "cyberChicken");
    }
  }

  disturbLandedFragments(position, range, force = 1) {
    const now = performance.now();
    for (const fragment of this.scene.children) {
      if (!fragment.userData?.imageFragment || !fragment.userData.landed) continue;
      const dx = fragment.position.x - position.x;
      const dy = fragment.position.y - position.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= range) continue;
      const strength = (1 - distance / range) * force;
      const angle = Math.atan2(dy, dx);
      fragment.userData.landed = false;
      fragment.userData.bounceCount = 1;
      fragment.userData.vx = Math.cos(angle) * (0.8 + strength * 2.6);
      fragment.userData.vy = -0.9 - strength * 2.8;
      fragment.userData.bornAt = now - fragment.userData.life * 0.38;
      fragment.userData.life = Math.max(fragment.userData.life, 3600);
      fragment.position.z = 20;
    }
  }

  spawnChainSpark(target, color, strength, cyber = false) {
    const count = this.reducedMotion ? 1 : Math.max(2, Math.round(2 + strength * 4));
    for (let i = 0; i < count; i += 1) {
      const geometry = cyber
        ? new THREE.BoxGeometry(3 + Math.random() * 5, 1.2 + Math.random() * 2.4, 1)
        : new THREE.SphereGeometry(1.5 + Math.random() * 2.8, 7, 5);
      const spark = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const angle = Math.random() * Math.PI * 2;
      spark.position.set(
        target.position.x + Math.cos(angle) * target.radius * 0.45,
        target.position.y + Math.sin(angle) * target.radius * 0.45,
        25,
      );
      spark.userData = {
        burst: true,
        chainSpark: true,
        bornAt: performance.now() + Math.random() * 120,
        life: cyber ? 680 : 520,
        vx: Math.cos(angle) * (0.4 + strength * 1.3),
        vy: Math.sin(angle) * (0.3 + strength * 0.9) - 0.25,
        spin: (Math.random() - 0.5) * (cyber ? 0.32 : 0.12),
        driftPhase: Math.random() * Math.PI * 2,
      };
      this.scene.add(spark);
    }
  }

  spawnBurst(bubble) {
    if (bubble.isImage && !NATURAL_RELEASE_PROFILES[bubble.effect]) {
      this.spawnImageFragments(bubble);
    }
    this.spawnSignatureRelease(bubble);
    const naturalProfile = NATURAL_RELEASE_PROFILES[bubble.effect];
    if (naturalProfile) {
      this.spawnNaturalRelease(bubble, naturalProfile);
      if (bubble.type === "doubleDaisy") this.spawnDaisyPollen(bubble);
      this.spawnShockwave(bubble.position, naturalProfile.shockwave);
    }
    const baseConfig = {
      burst: { count: 14, color: 0xcff9ff, size: [2, 6], speed: [1.8, 5.2] },
      deflate: { count: 8, color: 0xe9fdff, size: [2, 5], speed: [0.8, 2.8] },
      glitter: { count: 24, color: 0xffe994, size: [1.5, 4], speed: [2.6, 6.2] },
      gummyChunks: { count: 16, color: 0xff8a52, size: [4, 9], speed: [2.2, 5.5] },
      squash: { count: 10, color: 0xc9ff5e, size: [3, 7], speed: [1.5, 4] },
      splash: { count: 20, color: 0x9ff5ff, size: [2, 6], speed: [2.4, 6] },
      glitch: { count: 28, color: 0x55eaff, size: [2, 7], speed: [3, 7] },
      implode: { count: 12, color: 0x6f8cff, size: [2, 5], speed: [0.5, 2] },
      scream: { count: 18, color: 0xffd65c, size: [3, 7], speed: [3, 6] },
      rage: { count: 24, color: 0xff726d, size: [3, 8], speed: [3, 7] },
      signal: { count: 20, color: 0x62e9ff, size: [2, 6], speed: [2, 6] },
      softDissolve: { count: 16, color: 0xe9f7ff, size: [4, 9], speed: [0.8, 3] },
      slowSquash: { count: 10, color: 0xa9c2d2, size: [3, 7], speed: [0.7, 2.4] },
      softSplit: { count: 14, color: 0xffedcf, size: [4, 9], speed: [1.2, 3.6] },
      petalScatter: { count: 24, color: 0xffd469, size: [1.2, 3.8], speed: [1.8, 5.2] },
      iceShatter: { count: 24, color: 0xb9f7ff, size: [2, 7], speed: [2.8, 6.5] },
      iceMistBloom: { count: 34, color: 0xd7f7ff, size: [1.2, 5], speed: [1.1, 4.2], life: 980 },
      icePlateSlide: { count: 18, color: 0xb9f7ff, size: [4, 11], speed: [2.1, 5.4], life: 920 },
      sugarCrack: { count: 22, color: 0xffe66d, size: [2, 6], speed: [2.2, 5.8] },
      shellCrack: { count: 16, color: 0xd3a26d, size: [3, 8], speed: [1.8, 4.8] },
      walnutThresholdCrack: { count: 22, color: 0xb9824c, size: [3, 9], speed: [1.5, 4.2], life: 760 },
      pearlRelease: { count: 20, color: 0xf4cdeb, size: [3, 7], speed: [1.1, 3.8] },
      prismDissolve: { count: 28, color: 0xb9f7ff, size: [1.5, 5], speed: [2.4, 6.2] },
      meteorSplit: { count: 18, color: 0xff9c86, size: [3, 8], speed: [2.4, 5.6] },
      cascadePop: { count: 26, color: 0x9ae7ff, size: [2, 5], speed: [1.8, 5.2] },
      bubbleWrapSweep: { count: 42, color: 0x9ae7ff, size: [1.2, 4.2], speed: [1.3, 4.8], life: 720 },
      airRelease: { count: 14, color: 0xeafcff, size: [3, 8], speed: [0.7, 2.8] },
      jellySplit: { count: 18, color: 0xffb3c7, size: [4, 9], speed: [1.6, 4.5] },
      jellyWobblePlop: { count: 26, color: 0xffb3c7, size: [3, 10], speed: [1, 4.4], life: 940 },
      cloudDissolve: { count: 20, color: 0xf5f3ff, size: [4, 10], speed: [0.6, 2.5] },
      foamRelease: { count: 24, color: 0xd9fbff, size: [2, 6], speed: [1.2, 3.8] },
      paperScatter: { count: 22, color: 0xd9b66f, size: [2, 7], speed: [1.7, 4.6] },
      lightShard: { count: 24, color: 0xe8eeff, size: [2, 7], speed: [2.2, 5.8] },
      porcelainLightPetals: { count: 30, color: 0xf4f8ff, size: [2, 8], speed: [1.5, 4.7], life: 1180 },
    }[bubble.effect] ?? (naturalProfile
      ? {
          count: naturalProfile.microCount,
          color: naturalProfile.microColor,
          size: [1.1, 3.4],
          speed: [1.4, 4.2],
        }
      : { count: 12, color: 0xffffff, size: [2, 5], speed: [2, 5] });
    const typeColors = {
      duck: 0xffe56b, mouse: 0xffd98e, burger: 0xff8a52, pufferfish: 0xa7f4ff,
      frog: 0xc9ff5e, jellyfish: 0xc5fbff, seal: 0xe6f7ff, octopus: 0xb9b4ff,
      waterStarfish: 0x9eeeff, puddingGhost: 0xffefbd, unicornFloat: 0xd8ecff,
      waterCactus: 0xa8f5d1, gummySlipper: 0xffbd65, softCloud: 0xe9f7ff,
      pressureHippo: 0x9fb4cb, jellyOrange: 0xffb454, waterPeach: 0xffb8aa,
      cyberChicken: 0xffd65c, creamMochi: 0xffedcf,
      doubleDaisy: 0xffd469,
    };
    const config = { ...baseConfig, color: typeColors[bubble.type] ?? baseConfig.color };

    const rhythmCount = Math.round(config.count * THREE.MathUtils.lerp(0.72, 1.35, this.interactionEnergy));
    const particleCount = this.reducedMotion ? Math.max(5, Math.ceil(rhythmCount * 0.4)) : rhythmCount;
    for (let i = 0; i < particleCount; i += 1) {
      const size = config.size[0] + Math.random() * (config.size[1] - config.size[0]);
      const geometry =
        [
          "gummyChunks", "jellySplit", "meteorSplit", "shellCrack", "lightShard",
          "icePlateSlide", "walnutThresholdCrack", "porcelainLightPetals",
        ].includes(bubble.effect)
          ? new THREE.BoxGeometry(size, size, size)
          : new THREE.SphereGeometry(size, 7, 5);
      const tint =
        bubble.effect === "gummyChunks"
          ? [0xffb13b, 0xff574d, 0x85dc4b, 0x8a3f22][i % 4]
          : config.color;
      const dot = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: tint,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: ["glitter", "prismDissolve", "lightShard"].includes(bubble.effect)
            ? THREE.AdditiveBlending
            : THREE.NormalBlending,
        }),
      );
      dot.position.set(bubble.position.x, bubble.position.y, 12);
      const radialAngle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.3;
      const impactAngle = Math.atan2(bubble.impact?.y ?? 0, bubble.impact?.x ?? 1);
      const directionalMix = 0.38 + Math.random() * 0.32;
      const angle = THREE.MathUtils.lerp(radialAngle, impactAngle + (Math.random() - 0.5) * 1.25, directionalMix);
      const speed = (config.speed[0] + Math.random() * (config.speed[1] - config.speed[0]))
        * THREE.MathUtils.lerp(0.68, 1.22, this.interactionEnergy);
      dot.userData = {
        burst: true,
        effect: bubble.effect,
        bornAt: performance.now(),
        life: (config.life ?? (bubble.effect === "glitter" ? 760 : 560))
          * THREE.MathUtils.lerp(1.55, 0.88, this.interactionEnergy),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 0.25,
        driftPhase: Math.random() * Math.PI * 2,
      };
      this.scene.add(dot);
    }
    this.spawnCrushableAccent(bubble);
  }

  spawnImageFragments(bubble) {
    const definition = ITEM_CATALOG[bubble.type];
    if (!definition) return;
    const signature = SIGNATURE_RELEASES[bubble.type];
    const columns = signature && !this.reducedMotion ? 4 : 3;
    const rows = signature && !this.reducedMotion ? 3 : 2;
    const width = bubble.radius * 2 * definition.aspect;
    const height = bubble.radius * 2;
    const fragmentWidth = width / columns;
    const fragmentHeight = height / rows;
    const texture = this.getItemTexture(definition.asset);
    const baseBornAt = performance.now() + 110;
    const heavyFamilies = ["ice", "candy", "ceramic", "nut", "shell", "space", "paper"];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const geometry = new THREE.PlaneGeometry(fragmentWidth * 1.035, fragmentHeight * 1.035);
        const uv = geometry.attributes.uv;
        const u0 = column / columns;
        const u1 = (column + 1) / columns;
        const v0 = row / rows;
        const v1 = (row + 1) / rows;
        for (let index = 0; index < uv.count; index += 1) {
          uv.setXY(
            index,
            THREE.MathUtils.lerp(u0, u1, uv.getX(index)),
            THREE.MathUtils.lerp(v0, v1, uv.getY(index)),
          );
        }
        uv.needsUpdate = true;
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.94,
          alphaTest: 0.025,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const fragment = new THREE.Mesh(geometry, material);
        const localX = (column + 0.5 - columns / 2) * fragmentWidth;
        const localY = (row + 0.5 - rows / 2) * fragmentHeight;
        fragment.position.set(
          bubble.position.x + localX,
          bubble.position.y + localY,
          20 + ((row + column) % 3),
        );
        const fromImpactX = fragment.position.x - (bubble.impact?.pointX ?? bubble.position.x);
        const fromImpactY = fragment.position.y - (bubble.impact?.pointY ?? bubble.position.y);
        const impactDistance = Math.hypot(fromImpactX, fromImpactY);
        const angle = Math.atan2(fromImpactY, fromImpactX) + (Math.random() - 0.5) * 0.34;
        const proximity = 1 - THREE.MathUtils.clamp(impactDistance / (bubble.radius * 2.2), 0, 1);
        const speed = (signature ? 1.5 + Math.random() * 3.2 : 1 + Math.random() * 2.3)
          * (0.72 + proximity * 0.72);
        const heavy = heavyFamilies.includes(definition.materialFamily);
        fragment.userData = {
          burst: true,
          imageFragment: true,
          releaseBehavior: signature?.behavior ?? definition.effectProfile,
          materialFamily: definition.materialFamily,
          bornAt: baseBornAt + (1 - proximity) * 170 + Math.random() * 55,
          life: heavy ? 5200 + Math.random() * 1800 : (signature?.duration ?? 900) + 420 + Math.random() * 320,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          spin: (Math.random() - 0.5) * 0.13,
          flipX: (Math.random() - 0.5) * 0.16,
          flipY: (Math.random() - 0.5) * 0.2,
          driftPhase: Math.random() * Math.PI * 2,
          heavy,
          floorY: window.innerHeight - 22 - Math.random() * 48,
          bounceCount: 0,
          landed: false,
          baseOpacity: 0.94,
        };
        this.scene.add(fragment);
      }
    }
  }

  spawnSignatureRelease(bubble) {
    const profile = SIGNATURE_RELEASES[bubble.type];
    if (!profile) return;
    const countByBehavior = {
      iceSlabs: 13,
      caramelSnap: 12,
      shellHalves: 9,
      pearlOpen: 11,
      meteorPeel: 14,
      chainCells: 9,
      airJet: 18,
      gummyDice: 12,
      cloudPuffs: 18,
      ceramicPetals: 14,
    };
    const count = this.reducedMotion
      ? Math.max(5, Math.ceil(countByBehavior[profile.behavior] * 0.5))
      : countByBehavior[profile.behavior];
    for (let i = 0; i < count; i += 1) {
      const progress = count === 1 ? 0 : i / (count - 1);
      let geometry;
      if (profile.behavior === "chainCells") {
        geometry = new THREE.TorusGeometry(5.5, 1.6, 8, 22);
      } else if (["shellHalves", "pearlOpen"].includes(profile.behavior) && i < 2) {
        geometry = new THREE.CircleGeometry(bubble.radius * 0.42, 28, i * Math.PI, Math.PI);
      } else if (["airJet", "cloudPuffs"].includes(profile.behavior)) {
        geometry = new THREE.SphereGeometry(2.8 + Math.random() * 5.4, 10, 7);
      } else if (profile.behavior === "meteorPeel" && i < 7) {
        geometry = new THREE.IcosahedronGeometry(3.5 + Math.random() * 4.8, 0);
      } else if (profile.behavior === "ceramicPetals") {
        geometry = new THREE.CircleGeometry(3.5 + Math.random() * 6, 3);
      } else {
        geometry = new THREE.BoxGeometry(
          3.5 + Math.random() * 8,
          2.2 + Math.random() * 6,
          1.2 + Math.random() * 2.5,
        );
      }
      const material = new THREE.MeshBasicMaterial({
        color: profile.colors[i % profile.colors.length],
        transparent: true,
        opacity: ["airJet", "cloudPuffs"].includes(profile.behavior) ? 0.58 : 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: ["pearlOpen", "airJet", "ceramicPetals"].includes(profile.behavior)
          ? THREE.AdditiveBlending
          : THREE.NormalBlending,
      });
      const piece = new THREE.Mesh(geometry, material);
      const angle = progress * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
      const speed = 0.8 + Math.random() * 3.5;
      const delay =
        profile.behavior === "chainCells" ? i * 54 :
        profile.behavior === "airJet" ? i * 18 :
        Math.random() * 120;
      piece.position.set(
        bubble.position.x + Math.cos(angle) * bubble.radius * 0.12,
        bubble.position.y + Math.sin(angle) * bubble.radius * 0.1,
        18 + (i % 4),
      );
      if (profile.behavior === "chainCells") {
        const column = i % 3;
        const row = Math.floor(i / 3);
        piece.position.x = bubble.position.x + (column - 1) * bubble.radius * 0.42;
        piece.position.y = bubble.position.y + (row - 1) * bubble.radius * 0.42;
      }
      piece.userData = {
        burst: true,
        signatureRelease: true,
        releaseBehavior: profile.behavior,
        bornAt: performance.now() + delay,
        life: profile.duration - delay + 320,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 0.16,
        driftPhase: Math.random() * Math.PI * 2,
        index: i,
      };
      this.scene.add(piece);
    }
  }

  spawnCrushableAccent(bubble) {
    if (!CRUSHABLE_EFFECTS.has(bubble.effect)) return;
    const accents = {
      iceMistBloom: { rings: 2, color: 0xd7f7ff, motes: 22 },
      icePlateSlide: { rings: 1, color: 0xb9f7ff, motes: 10 },
      walnutThresholdCrack: { rings: 0, color: 0xd3a26d, motes: 12 },
      bubbleWrapSweep: { rings: 3, color: 0x9ae7ff, motes: 18 },
      jellyWobblePlop: { rings: 2, color: 0xffb3c7, motes: 12 },
      porcelainLightPetals: { rings: 2, color: 0xf4f8ff, motes: 20 },
    }[bubble.effect];
    if (!accents) return;
    for (let i = 0; i < accents.rings; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(14 + i * 11, 16 + i * 11, 48),
        new THREE.MeshBasicMaterial({
          color: accents.color,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ring.position.set(bubble.position.x, bubble.position.y, 17 + i);
      ring.userData = {
        burst: true,
        shockwave: true,
        bornAt: performance.now() + i * 90,
        life: 620 + i * 120,
      };
      this.scene.add(ring);
    }
    const count = this.reducedMotion ? Math.ceil(accents.motes * 0.45) : accents.motes;
    for (let i = 0; i < count; i += 1) {
      const mote = new THREE.Mesh(
        new THREE.SphereGeometry(1.2 + Math.random() * 2.6, 8, 5),
        new THREE.MeshBasicMaterial({
          color: accents.color,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.35 + Math.random() * 1.8;
      mote.position.set(bubble.position.x, bubble.position.y, 24);
      mote.userData = {
        burst: true,
        effect: `${bubble.effect}Accent`,
        bornAt: performance.now() + Math.random() * 180,
        life: 1100 + Math.random() * 900,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.55,
        spin: (Math.random() - 0.5) * 0.06,
        driftPhase: Math.random() * Math.PI * 2,
      };
      this.scene.add(mote);
    }
  }

  spawnDaisyPollen(bubble) {
    const count = this.reducedMotion ? 22 : 54;
    for (let i = 0; i < count; i += 1) {
      const size = 1.4 + Math.random() * 3.2;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 6),
        new THREE.MeshBasicMaterial({
          color: [0xffef9a, 0xffd86f, 0xffffff][i % 3],
          transparent: true,
          opacity: 0.86,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const angle = Math.random() * Math.PI * 2;
      const ring = bubble.radius * (0.04 + Math.random() * 0.2);
      dot.position.set(
        bubble.position.x + Math.cos(angle) * ring,
        bubble.position.y + Math.sin(angle) * ring,
        22 + Math.random() * 8,
      );
      const speed = 0.55 + Math.random() * 2.6;
      dot.userData = {
        burst: true,
        effect: "daisyPollen",
        bornAt: performance.now() + Math.random() * 80,
        life: 1450 + Math.random() * 1050,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 0.55,
        vy: Math.sin(angle) * speed - 0.95 - Math.random() * 1.1,
        spin: (Math.random() - 0.5) * 0.08,
        driftPhase: Math.random() * Math.PI * 2,
      };
      this.scene.add(dot);
    }
  }

  spawnNaturalRelease(bubble, profile) {
    const definition = ITEM_CATALOG[bubble.type];
    const texture = this.getItemTexture(definition.particleAsset);
    const count = this.reducedMotion ? Math.max(8, Math.ceil(profile.count * 0.42)) : profile.count;
    for (let i = 0; i < count; i += 1) {
      const length = bubble.radius * randomBetween(profile.size);
      const width = length * profile.aspect;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        side: THREE.DoubleSide,
        color: 0xffffff,
        blending: profile.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const fragment = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.34;
      const ring = bubble.radius * (0.18 + Math.random() * 0.32);
      fragment.position.set(
        bubble.position.x + Math.cos(angle) * ring,
        bubble.position.y + Math.sin(angle) * ring,
        18 + Math.random() * 4,
      );
      fragment.rotation.z = angle - Math.PI / 2 + (Math.random() - 0.5) * 0.45;
      const speed = randomBetween(profile.speed);
      fragment.userData = {
        burst: true,
        naturalRelease: true,
        effect: bubble.effect,
        releaseMode: profile.mode,
        bornAt: performance.now() + Math.random() * 160,
        life: randomBetween(profile.life),
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 0.5,
        vy: Math.sin(angle) * speed - 0.9 - Math.random() * 0.8,
        spin: (Math.random() - 0.5) * 0.08,
        spinZ: signedRandomBetween(profile.spinZ ?? [0.01, 0.055]),
        flip: signedRandomBetween(profile.flip),
        flutterPhase: Math.random() * Math.PI * 2,
        flutter: profile.flutter,
        gravity: profile.gravity,
        drag: profile.drag,
        floorY: window.innerHeight - 22 - Math.random() * 58,
        floorSpread: (Math.random() - 0.5) * bubble.radius * 1.6,
        settleScale: 0.84 + Math.random() * 0.24,
        landed: false,
        bounceCount: 0,
      };
      this.scene.add(fragment);
    }
  }

  spawnShockwave(position, color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(22, 25, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.position.set(position.x, position.y, 16);
    ring.userData = {
      burst: true,
      shockwave: true,
      bornAt: performance.now(),
      life: 560,
    };
    this.scene.add(ring);
  }

  update() {
    const now = performance.now();
    this.updateAtmosphere();
    for (const bubble of [...this.bubbles.values()]) {
      if (bubble.state === "alive") {
        const age = (now - bubble.bornAt) / 1000;
        if (!bubble.attachedFinger) {
          bubble.position.x += bubble.velocity.x;
          bubble.position.y += bubble.velocity.y;
          const margin = bubble.radius;
          if (bubble.position.x < margin || bubble.position.x > window.innerWidth - margin) {
            bubble.velocity.x *= -1;
            bubble.position.x = THREE.MathUtils.clamp(
              bubble.position.x,
              margin,
              window.innerWidth - margin,
            );
          }
          if (bubble.position.y < margin) {
            bubble.position.y = margin;
            bubble.velocity.y = Math.abs(bubble.velocity.y) * 0.45;
          }
        }
        const floatX = bubble.attachedFinger
          ? 0
          : Math.sin(age * 0.85 + bubble.floatPhase) * bubble.floatAmplitude;
        const floatY = bubble.attachedFinger
          ? Math.sin(age * 2.2) * 2.2
          : Math.cos(age * 0.68 + bubble.floatPhase) * bubble.floatAmplitude * 0.55;
        bubble.group.position.set(
          bubble.position.x + floatX,
          bubble.position.y + floatY,
          0,
        );
        const tension = bubble.reaction ?? 0;
        const s = 1 + Math.sin(age * 2.8 + bubble.id) * 0.025;
        const pressPulse = Math.sin(age * 4.2 + bubble.id) * tension * 0.025;
        bubble.group.scale.set(
          s + tension * 0.1 + pressPulse,
          s - tension * 0.07 - pressPulse * 0.35,
          1,
        );
        if (bubble.isImage && !this.reducedMotion) {
          bubble.group.rotation.y = Math.sin(age * 0.72 + bubble.floatPhase) * 0.13;
          bubble.group.rotation.x = Math.cos(age * 0.58 + bubble.floatPhase) * 0.035;
          bubble.group.rotation.z = Math.sin(age * 0.46 + bubble.floatPhase) * 0.025;
        } else {
          bubble.group.rotation.z += 0.002;
        }
        bubble.material.uniforms.uTime.value = age;
      } else if (bubble.state === "popping") {
        const t = Math.min(1, (now - bubble.popStarted) / bubble.popDuration);
        const signature = SIGNATURE_RELEASES[bubble.type]?.behavior;
        if (signature === "iceSlabs") {
          const crack = Math.sin(Math.min(1, t * 2.8) * Math.PI) * 0.1;
          bubble.group.scale.set(1 + crack, 1 - crack * 0.5, 1);
          bubble.group.rotation.z += t > 0.28 ? 0.075 : 0.008;
          if (t > 0.46) bubble.group.position.y += (t - 0.46) * 2.4;
        } else if (signature === "caramelSnap") {
          const bend = Math.sin(Math.min(1, t * 2.5) * Math.PI) * 0.2;
          bubble.group.scale.set(1 + bend * 0.24, 1 - bend, 1);
          bubble.group.rotation.y += t > 0.36 ? 0.11 : 0.018;
          bubble.group.rotation.z += t > 0.42 ? 0.052 : -0.006;
        } else if (signature === "shellHalves") {
          const strain = Math.sin(Math.min(1, t * 2.6) * Math.PI) * 0.12;
          bubble.group.scale.set(1 + strain, 1 - strain * 0.65, 1);
          bubble.group.rotation.z += t > 0.38 ? 0.07 : Math.sin(t * 34) * 0.006;
          if (t > 0.52) bubble.group.position.y += (t - 0.52) * 1.7;
        } else if (signature === "pearlOpen") {
          const open = Math.sin(Math.min(1, t * 1.8) * Math.PI * 0.5);
          bubble.group.scale.set(1 + open * 0.24, 1 - open * 0.35, 1);
          bubble.group.rotation.x = open * 0.42;
          bubble.group.position.y -= t > 0.36 ? 0.7 : 0;
        } else if (signature === "meteorPeel") {
          const tremor = Math.sin(t * 42) * (1 - t) * 0.06;
          bubble.group.scale.set(1 + t * 0.28 + tremor, 1 + t * 0.12 - tremor, 1);
          bubble.group.rotation.z += 0.035 + t * 0.045;
        } else if (signature === "chainCells") {
          const cellPulse = Math.sin(t * Math.PI * 9) * (1 - t) * 0.11;
          bubble.group.scale.set(1 + cellPulse, 1 - cellPulse, 1);
          if (t > 0.48) bubble.group.scale.y *= Math.max(0.08, 1 - (t - 0.48) * 1.8);
        } else if (signature === "airJet") {
          const squeeze = Math.sin(Math.min(1, t * 2.2) * Math.PI) * 0.18;
          bubble.group.scale.set(1 + squeeze, Math.max(0.06, 1 - t * 0.88 - squeeze * 0.4), 1);
          bubble.group.position.x += t > 0.28 ? Math.sin(t * 38) * 1.2 : 0;
          bubble.group.rotation.z += t * 0.012;
        } else if (signature === "gummyDice") {
          const bounce = Math.sin(t * Math.PI * 5) * (1 - t) * 0.3;
          bubble.group.scale.set(1 + t * 0.36 - bounce * 0.35, Math.max(0.08, 1 - t * 0.72 + bounce), 1);
          bubble.group.rotation.z += 0.026;
        } else if (signature === "cloudPuffs") {
          const breatheOut = Math.sin(Math.min(1, t * 1.65) * Math.PI * 0.5);
          bubble.group.scale.set(1 + breatheOut * 0.42, 1 + breatheOut * 0.12, 1);
          bubble.group.position.y -= t * 0.55;
        } else if (signature === "ceramicPetals") {
          const lightPulse = Math.sin(Math.min(1, t * 2.4) * Math.PI) * 0.13;
          bubble.group.scale.set(1 + lightPulse, 1 + lightPulse, 1);
          bubble.group.rotation.z += t > 0.42 ? 0.045 : 0.006;
          if (t > 0.52) bubble.group.scale.y *= Math.max(0.06, 1 - (t - 0.52) * 1.9);
        } else if (bubble.effect === "deflate") {
          bubble.group.scale.set(
            Math.max(0.12, 1 - t * 0.68),
            Math.max(0.06, 1 - t * 0.94),
            1,
          );
          bubble.group.rotation.z += 0.045 + t * 0.06;
          bubble.group.position.y += 0.7 + t * 1.8;
        } else if (bubble.effect === "gummyChunks") {
          const pulse = 1 + Math.sin(t * Math.PI) * 0.42;
          bubble.group.scale.set(pulse, Math.max(0.08, 1 - t * 0.8), 1);
          bubble.group.rotation.z += 0.025;
        } else if (bubble.effect === "glitter") {
          bubble.group.scale.setScalar(Math.max(0.03, 1 - t * 0.92));
          bubble.group.rotation.z += 0.09;
        } else if (bubble.effect === "squash") {
          const bounce = Math.sin(t * Math.PI * 3) * (1 - t) * 0.22;
          bubble.group.scale.set(1 + t * 0.72 - bounce, Math.max(0.08, 1 - t * 0.82 + bounce), 1);
        } else if (bubble.effect === "splash") {
          bubble.group.scale.set(1 + t * 0.34, Math.max(0.05, 1 - t * 0.92), 1);
          bubble.group.position.y += t * 0.8;
        } else if (bubble.effect === "glitch") {
          const jitter = (1 - t) * 8;
          bubble.group.position.x = bubble.position.x + (Math.random() - 0.5) * jitter;
          bubble.group.position.y = bubble.position.y + (Math.random() - 0.5) * jitter;
          bubble.group.scale.set(1 + Math.sin(t * 45) * 0.12, Math.max(0.04, 1 - t), 1);
        } else if (bubble.effect === "implode") {
          bubble.group.scale.setScalar(Math.max(0.02, 1 - t * 0.98));
          bubble.group.rotation.z += 0.16;
        } else if (bubble.effect === "scream") {
          bubble.group.scale.set(1 - t * 0.4, 1 + t * 1.35, 1);
          bubble.group.position.y -= t * 2.2;
        } else if (bubble.effect === "rage") {
          bubble.group.rotation.z += 0.22;
          bubble.group.scale.set(1 + Math.sin(t * 36) * 0.2, 1 - t * 0.85, 1);
        } else if (bubble.effect === "signal") {
          bubble.group.scale.set(1 + t * 0.8, 1 + t * 0.8, 1);
          bubble.group.rotation.y += 0.18;
        } else if (bubble.effect === "softDissolve") {
          bubble.group.scale.set(1 + t * 0.28, Math.max(0.05, 1 - t * 0.9), 1);
          bubble.group.position.y -= t * 0.8;
        } else if (bubble.effect === "slowSquash") {
          const settle = Math.sin(t * Math.PI * 2.5) * (1 - t) * 0.14;
          bubble.group.scale.set(1 + t * 0.48 - settle, Math.max(0.06, 1 - t * 0.84 + settle), 1);
        } else if (bubble.effect === "softSplit") {
          bubble.group.scale.set(1 + t * 0.58, Math.max(0.06, 1 - t * 0.86), 1);
        } else if (NATURAL_RELEASE_PROFILES[bubble.effect]) {
          const release = Math.sin(Math.min(1, t * 2) * Math.PI) * 0.12;
          bubble.group.scale.set(1 + release, Math.max(0.04, 1 - t * 0.95), 1);
          bubble.group.rotation.z += bubble.effect === "samaraRelease" ? 0.08 : 0.012;
        } else if (CRUSHABLE_EFFECTS.has(bubble.effect)) {
          const rebound = Math.sin(t * Math.PI * 3) * (1 - t) * 0.18;
          if (bubble.effect === "iceMistBloom") {
            bubble.group.scale.set(1 + t * 0.24, Math.max(0.02, 1 - t * 0.98), 1);
            bubble.group.position.y -= t * 0.9;
            bubble.group.rotation.z += 0.018;
          } else if (bubble.effect === "icePlateSlide") {
            bubble.group.scale.set(1 + t * 0.42, Math.max(0.02, 1 - t * 0.92), 1);
            bubble.group.position.x += Math.sin(t * Math.PI) * 2.4;
            bubble.group.rotation.z += 0.055;
          } else if (bubble.effect === "walnutThresholdCrack") {
            const strain = t < 0.38 ? Math.sin(t * Math.PI * 9) * 0.08 : 0;
            bubble.group.scale.set(1 + strain + t * 0.16, Math.max(0.05, 1 - t * 0.78), 1);
            bubble.group.rotation.z += t < 0.42 ? 0.006 : 0.05;
          } else if (bubble.effect === "bubbleWrapSweep") {
            const pulse = Math.sin(t * Math.PI * 8) * (1 - t) * 0.12;
            bubble.group.scale.set(1 + t * 0.2 + pulse, Math.max(0.06, 1 - t * 0.86 - pulse), 1);
          } else if (bubble.effect === "jellyWobblePlop") {
            const wobble = Math.sin(t * Math.PI * 5) * (1 - t) * 0.34;
            bubble.group.scale.set(1 + t * 0.5 - wobble * 0.35, Math.max(0.05, 1 - t * 0.82 + wobble), 1);
          } else if (bubble.effect === "porcelainLightPetals") {
            bubble.group.scale.set(1 + t * 0.2, Math.max(0.03, 1 - t * 0.92), 1);
            bubble.group.rotation.z += 0.026;
          } else {
            const brittle = ["iceShatter", "sugarCrack", "shellCrack", "lightShard"].includes(bubble.effect);
            if (brittle) {
            bubble.group.scale.set(1 + t * 0.18, Math.max(0.03, 1 - t * 0.9), 1);
            bubble.group.rotation.z += 0.035;
            } else {
            bubble.group.scale.set(1 + t * 0.45 - rebound, Math.max(0.04, 1 - t * 0.84 + rebound), 1);
            }
          }
        } else {
          bubble.group.scale.setScalar(1 + t * 1.2);
        }
        if (bubble.isImage && !NATURAL_RELEASE_PROFILES[bubble.effect]) {
          const pressure = Math.sin(THREE.MathUtils.clamp(t / 0.24, 0, 1) * Math.PI) * 0.13;
          const fractureTremor = t > 0.2 && t < 0.42
            ? Math.sin((t - 0.2) * 95) * (0.42 - t) * 0.16
            : 0;
          const impactX = bubble.impact?.x ?? 0;
          const impactY = bubble.impact?.y ?? 0;
          bubble.group.scale.x *= 1 + pressure * (0.45 + Math.abs(impactY) * 0.45);
          bubble.group.scale.y *= 1 - pressure * (0.42 + Math.abs(impactX) * 0.4);
          bubble.group.rotation.z += fractureTremor + impactX * pressure * 0.035;
        }
        bubble.group.children.forEach((child) => {
          const fragmentsReplaceBody = bubble.isImage && !NATURAL_RELEASE_PROFILES[bubble.effect];
          const fadeStart = fragmentsReplaceBody ? 0.18 : 0;
          const fadeEnd = fragmentsReplaceBody ? 0.32 : 1;
          const fade = THREE.MathUtils.clamp((t - fadeStart) / (fadeEnd - fadeStart), 0, 1);
          const nextOpacity = Math.max(0, Math.min(0.72, bubble.opacity) * (1 - fade));
          if (child.material.uniforms?.uOpacity) child.material.uniforms.uOpacity.value = nextOpacity;
          else child.material.opacity = nextOpacity;
        });
        if (t >= 1) {
          this.scene.remove(bubble.group);
          bubble.state = "popped";
          this.bubbles.delete(bubble.id);
        }
      }
    }

    for (const obj of [...this.scene.children]) {
      if (!obj.userData?.burst) continue;
      const t = (now - obj.userData.bornAt) / obj.userData.life;
      if (t < 0) continue;
      if (obj.userData.impactCracks) {
        const reveal = THREE.MathUtils.smoothstep(t, 0.02, 0.32);
        const vanish = 1 - THREE.MathUtils.smoothstep(t, 0.55, 1);
        obj.material.opacity = reveal * vanish * 0.88;
        if (t >= 1) {
          this.scene.remove(obj);
          obj.geometry.dispose();
          obj.material.dispose();
        }
        continue;
      }
      if (obj.userData.shockwave) {
        obj.scale.setScalar(1 + t * 7);
        obj.material.opacity = Math.max(0, 0.5 * (1 - t));
        if (t >= 1) {
          this.scene.remove(obj);
          obj.geometry.dispose();
          obj.material.dispose();
        }
        continue;
      }
      if (obj.userData.chainWave) {
        obj.scale.setScalar(1 + t * obj.userData.maxScale);
        obj.material.opacity = Math.max(0, 0.34 * (1 - t) * (1 - t));
        if (t >= 1) {
          this.scene.remove(obj);
          obj.geometry.dispose();
          obj.material.dispose();
        }
        continue;
      }
      if (!obj.userData.landed) {
        obj.position.x += obj.userData.vx;
        obj.position.y += obj.userData.vy;
      }
      if (obj.userData.imageFragment) {
        const behavior = obj.userData.releaseBehavior;
        const brittle = [
          "iceSlabs", "caramelSnap", "ceramicPetals", "iceShatter",
          "sugarCrack", "lightShard", "prismDissolve",
        ].includes(behavior);
        const buoyant = [
          "airJet", "cloudPuffs", "airRelease", "cloudDissolve", "deflate",
        ].includes(behavior);
        const elastic = [
          "gummyDice", "meteorPeel", "jellySplit", "jellyWobblePlop",
          "gummyChunks", "squash", "softSplit",
        ].includes(behavior);
        if (obj.userData.landed) {
          obj.userData.vx = 0;
          obj.userData.vy = 0;
          obj.position.y = obj.userData.floorY;
          obj.rotation.x *= 0.92;
          obj.rotation.y *= 0.92;
        } else if (brittle) {
          obj.userData.vx *= 0.993;
          obj.userData.vy += 0.085;
        } else if (buoyant) {
          obj.userData.vx *= 0.985;
          obj.userData.vy = obj.userData.vy * 0.986 - 0.028;
          obj.position.x += Math.sin(t * Math.PI * 6 + obj.userData.driftPhase) * 0.24;
        } else if (elastic) {
          obj.userData.vx *= 0.987;
          obj.userData.vy += 0.11;
          const squash = Math.sin(t * Math.PI * 6) * 0.12 * (1 - t);
          obj.scale.set(1 + squash, 1 - squash, 1);
        } else {
          obj.userData.vx *= 0.99;
          obj.userData.vy += 0.055;
        }
        if (!obj.userData.landed) {
          obj.rotation.x += obj.userData.flipX;
          obj.rotation.y += obj.userData.flipY;
        }
        if (
          obj.userData.heavy &&
          !obj.userData.landed &&
          obj.position.y >= obj.userData.floorY &&
          obj.userData.vy > 0
        ) {
          obj.position.y = obj.userData.floorY;
          if (obj.userData.bounceCount < 1) {
            obj.userData.bounceCount += 1;
            obj.userData.vy = -Math.min(1.45, Math.abs(obj.userData.vy) * 0.28);
            obj.userData.vx *= 0.62;
          } else {
            obj.userData.landed = true;
            obj.userData.landedAt = now;
            obj.userData.vx = 0;
            obj.userData.vy = 0;
            obj.position.z = 5 + Math.random() * 3;
            obj.rotation.x = 0;
            obj.rotation.y *= 0.16;
            obj.rotation.z += (Math.random() - 0.5) * 0.22;
          }
        }
      }
      if (obj.userData.signatureRelease) {
        const behavior = obj.userData.releaseBehavior;
        if (behavior === "iceSlabs") {
          obj.userData.vx *= 0.992;
          obj.userData.vy += 0.085;
          obj.rotation.y += obj.userData.spin * 1.5;
        } else if (behavior === "caramelSnap") {
          obj.userData.vx *= 0.987;
          obj.userData.vy += 0.12;
          obj.rotation.y += 0.09 + Math.abs(obj.userData.spin);
        } else if (behavior === "shellHalves") {
          obj.userData.vy += 0.09;
          obj.userData.vx *= 0.992;
          obj.rotation.y += obj.userData.index < 2
            ? (obj.userData.index ? 0.075 : -0.075)
            : obj.userData.spin;
        } else if (behavior === "pearlOpen") {
          if (obj.userData.index < 2) {
            obj.userData.vx += obj.userData.index ? 0.045 : -0.045;
            obj.userData.vy += 0.035;
            obj.rotation.y += obj.userData.index ? 0.055 : -0.055;
          } else {
            obj.userData.vx *= 0.982;
            obj.userData.vy = obj.userData.vy * 0.986 - 0.065;
            obj.position.x += Math.sin(t * Math.PI * 5 + obj.userData.driftPhase) * 0.35;
          }
        } else if (behavior === "meteorPeel") {
          obj.userData.vx *= 0.991;
          obj.userData.vy += obj.userData.index < 7 ? 0.13 : 0.045;
          obj.scale.setScalar(obj.userData.index < 7
            ? 1
            : 1 + Math.sin(t * Math.PI * 5) * 0.18 * (1 - t));
        } else if (behavior === "chainCells") {
          const pop = Math.sin(Math.min(1, t * 2.7) * Math.PI);
          obj.scale.setScalar(Math.max(0.04, 1 + pop * 0.85 - t * 0.92));
          obj.userData.vx *= 0.91;
          obj.userData.vy *= 0.91;
        } else if (behavior === "airJet") {
          obj.userData.vx = obj.userData.vx * 0.985 + 0.055;
          obj.userData.vy = obj.userData.vy * 0.982 - 0.035;
          obj.position.y += Math.sin(t * Math.PI * 8 + obj.userData.driftPhase) * 0.32;
          obj.scale.setScalar(1 + t * 1.25);
        } else if (behavior === "gummyDice") {
          obj.userData.vx *= 0.987;
          obj.userData.vy += 0.14;
          obj.scale.set(
            1 + Math.sin(t * Math.PI * 6) * 0.15,
            1 - Math.sin(t * Math.PI * 6) * 0.12,
            1,
          );
        } else if (behavior === "cloudPuffs") {
          obj.userData.vx *= 0.988;
          obj.userData.vy = obj.userData.vy * 0.984 - 0.025;
          obj.position.x += Math.sin(t * Math.PI * 4 + obj.userData.driftPhase) * 0.28;
          obj.scale.setScalar(1 + t * 1.7);
        } else if (behavior === "ceramicPetals") {
          obj.userData.vx *= 0.994;
          obj.userData.vy += 0.065;
          obj.rotation.y += 0.08 + Math.abs(obj.userData.spin);
          obj.scale.setScalar(0.86 + Math.abs(Math.sin(t * Math.PI * 8)) * 0.28);
        }
      }
      if (obj.userData.naturalRelease) {
        const elapsed = now - obj.userData.bornAt;
        if (!obj.userData.landed) {
          const gravity =
            obj.userData.releaseMode === "rise" && elapsed > 1800
              ? 0.045
              : obj.userData.gravity;
          obj.userData.vx *= obj.userData.drag;
          obj.userData.vy = obj.userData.vy * obj.userData.drag + gravity;
          const flutterRate = obj.userData.releaseMode === "helicopter" ? 13 : 9;
          obj.position.x +=
            Math.sin(t * Math.PI * flutterRate + obj.userData.flutterPhase) * obj.userData.flutter;
          obj.rotation.y += obj.userData.flip;
          obj.rotation.z += obj.userData.spinZ;
          if (obj.position.y >= obj.userData.floorY && obj.userData.vy > 0) {
            obj.position.y = obj.userData.floorY;
            if (obj.userData.bounceCount < 1) {
              obj.userData.bounceCount += 1;
              obj.userData.vy = -Math.min(1.1, Math.abs(obj.userData.vy) * 0.2);
              obj.userData.vx *= 0.56;
            } else {
              obj.userData.landed = true;
              obj.userData.landedAt = now;
              obj.userData.life = Math.max(obj.userData.life, now - obj.userData.bornAt + 14500 + Math.random() * 8000);
              obj.userData.vx = 0;
              obj.userData.vy = 0;
              obj.position.x = THREE.MathUtils.clamp(
                obj.position.x + obj.userData.floorSpread * 0.18,
                12,
                window.innerWidth - 12,
              );
              obj.position.z = 4 + Math.random() * 3;
              obj.rotation.x = 0;
              obj.rotation.y *= 0.2;
              obj.rotation.z += (Math.random() - 0.5) * 0.16;
              obj.scale.setScalar(obj.userData.settleScale);
            }
          }
        } else {
          const settledAge = now - obj.userData.landedAt;
          obj.position.y += Math.sin(settledAge * 0.0015 + obj.userData.flutterPhase) * 0.015;
          obj.scale.setScalar(obj.userData.settleScale * (1 + Math.sin(settledAge * 0.002) * 0.012));
        }
      }
      if (obj.userData.effect === "gummyChunks") obj.userData.vy += 0.16;
      if (["jellySplit", "meteorSplit", "shellCrack", "lightShard", "paperScatter", "icePlateSlide", "walnutThresholdCrack", "porcelainLightPetals"].includes(obj.userData.effect)) {
        obj.userData.vy += obj.userData.effect === "paperScatter" ? 0.045 : 0.12;
      }
      if (["airRelease", "cloudDissolve", "pearlRelease", "iceMistBloom"].includes(obj.userData.effect)) {
        obj.userData.vy -= 0.035;
        obj.userData.vx *= 0.985;
      }
      if (obj.userData.effect === "bubbleWrapSweep") {
        obj.position.x += Math.sin(t * Math.PI * 11 + obj.userData.driftPhase) * 0.72;
        obj.userData.vx *= 0.978;
        obj.userData.vy *= 0.978;
      }
      if (obj.userData.effect === "jellyWobblePlop") {
        obj.userData.vy += 0.075;
        obj.scale.setScalar(1 + Math.sin(t * Math.PI * 6) * 0.16 * (1 - t));
      }
      if (obj.userData.effect?.endsWith("Accent")) {
        obj.userData.vx *= 0.99;
        obj.userData.vy = obj.userData.vy * 0.992 - 0.006;
        obj.position.x += Math.sin(t * Math.PI * 6 + obj.userData.driftPhase) * 0.28;
      }
      if (obj.userData.effect === "daisyPollen") {
        obj.userData.vx *= 0.986;
        obj.userData.vy = obj.userData.vy * 0.988 + 0.018;
        obj.position.x += Math.sin(t * Math.PI * 8 + obj.userData.driftPhase) * 0.42;
        obj.scale.setScalar(1 + Math.sin(t * Math.PI * 5) * 0.18);
      }
      if (obj.userData.chainSpark) {
        obj.userData.vx *= 0.972;
        obj.userData.vy = obj.userData.vy * 0.982 - 0.012;
        obj.position.x += Math.sin(t * Math.PI * 5 + obj.userData.driftPhase) * 0.18;
      }
      if (obj.userData.effect === "splash") obj.userData.vy += 0.11;
      if (obj.userData.effect === "deflate") {
        obj.userData.vx *= 0.96;
        obj.userData.vy -= 0.04;
      }
      if (!obj.userData.landed) {
        obj.rotation.x += obj.userData.spin;
        obj.rotation.z += obj.userData.spin;
      }
      const glint = obj.userData.releaseMode === "glintFall"
        ? 0.62 + Math.abs(Math.sin(t * Math.PI * 12)) * 0.38
        : 1;
      if (obj.userData.naturalRelease) {
        const remaining = obj.userData.life - (now - obj.userData.bornAt);
        const fade = remaining < 3200 ? THREE.MathUtils.clamp(remaining / 3200, 0, 1) : 1;
        obj.material.opacity = obj.userData.landed ? 0.78 * fade : 0.95 * fade;
      } else if (obj.userData.imageFragment && obj.userData.landed) {
        const landedAge = now - obj.userData.landedAt;
        const residueFade = landedAge > 3200 ? THREE.MathUtils.clamp(1 - (landedAge - 3200) / 1800, 0, 1) : 1;
        obj.material.opacity = obj.userData.baseOpacity * 0.72 * residueFade;
      } else {
        obj.material.opacity = Math.max(0, 0.9 * (1 - t) * glint);
      }
      const landedResidueDone = obj.userData.imageFragment && obj.userData.landed &&
        now - obj.userData.landedAt >= 5000;
      if ((t >= 1 && !obj.userData.landed) || landedResidueDone) {
        this.scene.remove(obj);
        obj.geometry.dispose();
        obj.material.dispose();
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  updateAtmosphere() {
    this.releaseEnergy *= 0.992;
    this.glowPulse.strength *= 0.93;
    this.glowPulse.warmth *= 0.965;
    this.edgeFlash *= 0.91;
    this.cyberScan *= 0.88;
    this.interactionEnergy += (0.5 - this.interactionEnergy) * 0.0009;
    const target = THREE.MathUtils.clamp(this.releaseEnergy, 0, 1);
    this.weatherMix += (target - this.weatherMix) * 0.035;
    if (!this.atmosphereLayer) return;
    const glow = this.glowPulse.color.clone().multiplyScalar(this.glowPulse.strength);
    const glowCss = `rgba(${Math.round(glow.r * 255)}, ${Math.round(glow.g * 255)}, ${Math.round(glow.b * 255)}, ${Math.min(0.28, this.glowPulse.strength * 0.2).toFixed(3)})`;
    const heatCss = `rgba(255, 220, 166, ${Math.min(0.16, this.glowPulse.warmth * 0.14).toFixed(3)})`;
    this.atmosphereLayer.style.setProperty("--weather-mix", this.weatherMix.toFixed(3));
    this.atmosphereLayer.style.setProperty("--edge-flash", this.edgeFlash.toFixed(3));
    this.atmosphereLayer.style.setProperty("--cyber-scan", this.cyberScan.toFixed(3));
    this.atmosphereLayer.style.setProperty("--release-glow", glowCss);
    this.atmosphereLayer.style.setProperty("--release-heat", heatCss);
    const scenePosition = (performance.now() % this.sceneCycleMs) / this.sceneCycleMs * 4;
    const sceneIndex = Math.floor(scenePosition);
    const sceneBlend = scenePosition - sceneIndex;
    const eased = sceneBlend * sceneBlend * (3 - 2 * sceneBlend);
    for (let index = 0; index < 4; index += 1) {
      const amount = index === sceneIndex ? 1 - eased : index === (sceneIndex + 1) % 4 ? eased : 0;
      this.atmosphereLayer.style.setProperty(`--scene-${String.fromCharCode(97 + index)}`, amount.toFixed(3));
    }
  }

  reactToHands(points = []) {
    for (const bubble of this.bubbles.values()) {
      if (bubble.state !== "alive") continue;
      let proximity = 0;
      for (const point of points) {
        const distance = Math.hypot(bubble.position.x - point.x, bubble.position.y - point.y);
        proximity = Math.max(proximity, 1 - THREE.MathUtils.clamp(distance / 190, 0, 1));
      }
      bubble.reaction += (proximity - bubble.reaction) * 0.2;
    }
  }

  celebrateClear() {
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const count = this.reducedMotion ? 24 : 72;
    for (let i = 0; i < count; i += 1) {
      const size = 2 + Math.random() * 7;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(size, 7, 5),
        new THREE.MeshBasicMaterial({
          color: [0xa7f3ff, 0xffdca8, 0xd9bbff][i % 3],
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.15;
      const speed = 4 + Math.random() * 9;
      dot.position.set(center.x, center.y, 18);
      dot.userData = {
        burst: true,
        effect: "celebration",
        bornAt: performance.now(),
        life: 950,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 0.3,
      };
      this.scene.add(dot);
    }
  }

  showRenderCheck() {
    const check = this.addBubble({
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.34,
      radius: 54,
      opacity: 0.72,
    });
    window.setTimeout(() => {
      if (!this.bubbles.has(check.id)) return;
      this.scene.remove(check.group);
      this.bubbles.delete(check.id);
    }, 1800);
  }

  clear() {
    for (const bubble of this.bubbles.values()) this.scene.remove(bubble.group);
    this.bubbles.clear();
    for (const obj of [...this.scene.children]) {
      if (!obj.userData?.burst) continue;
      if (obj.userData.naturalRelease && obj.userData.landed) continue;
      this.scene.remove(obj);
    }
  }

  aliveCount() {
    return [...this.bubbles.values()].filter((b) => b.state === "alive").length;
  }

  coverageRatio() {
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const occupiedArea = [...this.bubbles.values()]
      .filter((bubble) => bubble.state === "alive")
      .reduce((sum, bubble) => sum + Math.PI * bubble.radius * bubble.radius, 0);
    return Math.min(1, occupiedArea / viewportArea);
  }
}

function randomBetween(range) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

function signedRandomBetween(range) {
  return randomBetween(range) * (Math.random() < 0.5 ? -1 : 1);
}
