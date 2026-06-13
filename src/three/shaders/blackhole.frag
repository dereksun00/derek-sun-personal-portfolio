uniform sampler2D uTex;     // snapshot of the screen being consumed/revealed
uniform float uProgress;    // 0 = untouched screen, 1 = fully collapsed
uniform float uTime;        // seconds; drives accretion disk rotation
uniform float uAspect;      // viewport width / height
uniform float uAberration;  // 1.0 = chromatic aberration on (high); 0.0 = off (medium), with a slightly wider/brighter disk to compensate for the reduced bloom

varying vec2 vUv;

// cheap 1D value-noise for accretion streaks (full perlin is overkill here)
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}

void main() {
  // aspect-corrected coordinates centered on the singularity
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r = length(p);
  float ang = atan(p.y, p.x);
  float prog = uProgress;

  // ── gravitational swirl ──────────────────────────────────────────
  // angular displacement ∝ 1/r² (Keplerian-ish): pixels whip around
  // faster as they near the hole. eps keeps it finite at the center,
  // and the clamp stops the very middle from aliasing into noise.
  float swirl = prog * prog * 0.55 / (r * r + 0.05);
  swirl = min(swirl, 14.0);
  float a2 = ang + swirl;

  // ── inward pull ──────────────────────────────────────────────────
  // pow(r, 1+k) contracts the middle faster than the edges, which
  // reads as space stretching toward the hole rather than a flat zoom.
  float pulled = mix(r, pow(r, 1.0 + 2.5 * prog), prog) * (1.0 - 0.4 * prog);

  vec2 q = vec2(cos(a2), sin(a2)) * pulled;
  vec2 uv2 = q / vec2(uAspect, 1.0) + 0.5;

  // ── event horizon ────────────────────────────────────────────────
  float horizon = pow(prog, 1.6) * 0.55;

  // chromatic aberration on the rim: RGB sampled at radially split
  // offsets, strongest in the zone just outside the horizon.
  float rimZone = smoothstep(horizon + 0.25, horizon, r);
  float split = (0.004 + 0.02 * prog) * rimZone;
  vec2 dir = p / max(r, 1e-5);
  vec2 off = dir * split / vec2(uAspect, 1.0);

  vec3 col;
  if (uAberration < 0.5) {
    // medium: single tap, no RGB split
    col = texture2D(uTex, clamp(uv2, 0.0, 1.0)).rgb;
  } else {
    col.r = texture2D(uTex, clamp(uv2 + off, 0.0, 1.0)).r;
    col.g = texture2D(uTex, clamp(uv2, 0.0, 1.0)).g;
    col.b = texture2D(uTex, clamp(uv2 - off, 0.0, 1.0)).b;
  }
  float noBloom = 1.0 - uAberration; // medium widens/brightens the disk a touch

  // light dims near the horizon — nothing escapes
  col *= 1.0 - 0.55 * prog * smoothstep(horizon * 2.2, horizon, r);

  // ── accretion disk ───────────────────────────────────────────────
  // emissive ring hugging the horizon: deep orange at the inner edge
  // grading to cyan at the outer edge, with rotating noise streaks.
  // HDR values (>1) here are what feed the bloom pass.
  float diskR = horizon * 1.18 + 0.02;
  // medium widens the band slightly to stand in for the reduced bloom halo
  float band = exp(-pow((r - diskR) / ((0.028 + 0.03 * prog) * (1.0 + 0.5 * noBloom)), 2.0));
  float streaks = 0.55 + 0.45 * noise1(ang * 4.0 + uTime * 3.0 + r * 30.0);
  float diskT = clamp((r - horizon) / max(diskR * 1.7 - horizon, 1e-4), 0.0, 1.0);
  vec3 diskCol = mix(vec3(1.0, 0.42, 0.05), vec3(0.35, 0.9, 1.0), diskT);
  float diskI = band * streaks * smoothstep(0.05, 0.35, prog) * (1.7 + 0.3 * noBloom);
  col += diskCol * diskI;

  // photon ring: razor-thin hot glow right at the horizon lip
  col += vec3(1.0, 0.6, 0.25) * exp(-pow((r - horizon) / 0.012, 2.0)) * prog * 1.1;

  // the hole itself: hard black with a 1px-soft lip
  col *= smoothstep(horizon, horizon + 0.012, r);

  gl_FragColor = vec4(col, 1.0);
}
