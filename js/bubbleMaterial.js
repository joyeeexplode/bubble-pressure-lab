export function pickBubbleStyle(random = Math.random) {
  const roll = random();
  return roll < 0.34 ? 0 : roll < 0.62 ? 1 : roll < 0.82 ? 2 : 3;
}

export function createBubbleMaterial(THREE, { opacity, style, random = Math.random }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: Math.max(0.32, Math.min(0.72, opacity)) },
      uTime: { value: random() * 20 },
      uHue: { value: random() },
      uStyle: { value: style },
      uSeed: { value: random() * 12 },
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
      uniform float uTime;
      uniform float uHue;
      uniform float uStyle;
      uniform float uSeed;

      void main() {
        vec3 n = normalize(vNormal);
        float facing = clamp(abs(n.z), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 2.15);
        float film = sin(n.y * 13.0 + n.x * 7.0 + fresnel * 19.0 + uTime * 0.5 + uSeed);
        float hue = fract(uHue + fresnel * 0.56 + n.x * 0.15 + n.y * 0.09 + film * 0.055);
        vec3 spectrum = 0.58 + 0.42 * cos(6.28318 * (hue + vec3(0.0, 0.33, 0.67)));
        vec3 color = vec3(0.8, 0.96, 1.0);
        float centerHaze = 0.0;
        float rimBoost = 0.0;

        if (uStyle < 0.5) {
          color = mix(color, spectrum, 0.07 + fresnel * 0.2);
          rimBoost = fresnel * 0.22;
        } else if (uStyle < 1.5) {
          float oilBand = 0.5 + 0.5 * film;
          color = mix(color, spectrum, 0.22 + fresnel * 0.62 + oilBand * 0.12);
          rimBoost = fresnel * 0.3;
        } else if (uStyle < 2.5) {
          vec3 pearl = mix(vec3(0.75, 0.92, 1.0), vec3(1.0, 0.74, 0.9), 0.5 + 0.5 * n.y);
          color = mix(pearl, spectrum, 0.12 + fresnel * 0.28);
          centerHaze = facing * 0.13;
        } else {
          float crescent = smoothstep(-0.12, 0.7, n.x * 0.75 - n.y * 0.28 + fresnel);
          color = mix(color, spectrum, 0.12 + crescent * 0.5 + fresnel * 0.28);
          rimBoost = fresnel * (0.18 + crescent * 0.2);
        }

        float highlight = pow(max(dot(n, normalize(vec3(-0.48, 0.62, 0.72))), 0.0), 72.0);
        float secondary = pow(max(dot(n, normalize(vec3(0.55, -0.3, 0.78))), 0.0), 110.0);
        float windowLight = pow(max(dot(n, normalize(vec3(-0.24, 0.78, 0.58))), 0.0), 145.0);
        color += vec3(1.0) * (highlight * 0.92 + secondary * 0.52 + windowLight * 0.7);
        float alpha = uOpacity * (0.035 + fresnel * 0.68 + centerHaze + rimBoost)
          + highlight * 0.76 + secondary * 0.38 + windowLight * 0.5;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.92));
      }
    `,
  });
}
