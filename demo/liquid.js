"use strict";
/* Liquid wallpaper. The backdrop is a slowly flowing, domain-warped gradient that never
   stops moving. The cursor stirs it: a small low-res velocity field (ping-ponged between
   two textures) collects the mouse motion, carries itself along and fades, and the
   wallpaper is sampled through it, so colours smear and shimmer behind the cursor like
   paint in water. No lens, no rings.
   Cost control: renders at reduced resolution, 30 fps when idle and 60 fps while the
   mouse moves, drops lower by itself on slow machines, and stops when hidden. */
const Liquid = (() => {
  const canvas = document.getElementById("liquid");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true });
  if (!gl) return { setState() {}, hold() {} };

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  // base top, base bottom, then four light blobs (match the CSS fallback wallpapers)
  const PALETTES = {
    idle: ["#1c1550", "#0b0d24", "#7a5cff", "#ff6b8b", "#ff9a5a", "#3b5bff"],
    busy: ["#0d2160", "#070b22", "#2f7bff", "#00c2ff", "#6c5cff", "#00e0d0"],
    on:   ["#06323a", "#04121a", "#00c48c", "#1ad0ff", "#2fe3a0", "#2f6bff"],
  };
  const paletteFor = (s) => s === "connected" ? "on" : (s === "scanning" || s === "connecting") ? "busy" : "idle";

  const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }";

  // velocity field: rg = velocity (encoded around 0.5), b = stir energy
  const FIELD_FS = `
  precision mediump float;
  uniform sampler2D uF; uniform vec2 uFRes; uniform float uAspect; uniform float uDt;
  uniform vec2 uMouse; uniform vec2 uMVel; uniform vec3 uBurst;
  vec3 dec(vec4 c) { return vec3(c.rg * 2. - 1., c.b); }
  void main() {
    vec2 uv = gl_FragCoord.xy / uFRes;
    vec3 here = dec(texture2D(uF, uv));
    vec3 f = dec(texture2D(uF, uv - here.xy * uDt * .6));   // the flow carries itself
    vec2 v = f.xy * .955;
    float e = f.z * .972;
    vec2 d = (uv - uMouse) * vec2(uAspect, 1.);
    float g = exp(-dot(d, d) / .010);
    v += uMVel * g;
    e += min(1., length(uMVel) * 1.4) * g * .55;
    vec2 bd = (uv - uBurst.xy) * vec2(uAspect, 1.);
    float bg = exp(-dot(bd, bd) / .02) * uBurst.z;
    v += normalize(bd + 1e-4) * bg * .9;
    e += bg * .5;
    v = clamp(v, -1., 1.);
    v *= step(.012, abs(v));          // 8-bit storage: kill sub-step residue so it can't drift forever
    e = e < .012 ? 0. : min(e, 1.);
    gl_FragColor = vec4(v * .5 + .5, e, 1.);
  }`;

  const RENDER_FS = `
  precision mediump float;
  uniform vec2 uRes; uniform float uTime; uniform sampler2D uF; uniform vec3 uC[6];
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 3; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
  float blob(vec2 uv, vec2 c, vec2 s) { vec2 d = (uv - c) / s; return exp(-dot(d, d)); }
  vec3 hue(float h) { return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float a = uRes.x / uRes.y, t = uTime;
    vec4 raw = texture2D(uF, uv);
    vec2 vel = raw.rg * 2. - 1.;
    float e = raw.b;
    vec2 p = uv - vel * .085;                                   // stirred by the cursor
    vec2 q = p * vec2(a, 1.) * 1.6;
    vec2 w = vec2(fbm(q + vec2(0., t * .05)), fbm(q + vec2(5.2, 1.3) - vec2(t * .04, 0.)));
    vec2 pw = p + (w - .5) * .24;                               // the slow liquid flow
    vec3 col = mix(uC[1], uC[0], smoothstep(0., 1., pw.y));
    col += uC[2] * .80 * blob(pw, vec2(.08, .94) + .06 * vec2(sin(t * .11), cos(t * .09)), vec2(.40, .24));
    col += uC[3] * .62 * blob(pw, vec2(1.0, .62) + .06 * vec2(cos(t * .10), sin(t * .12)), vec2(.36, .22));
    col += uC[4] * .55 * blob(pw, vec2(.20, .0) + .06 * vec2(sin(t * .08), cos(t * .13)), vec2(.46, .22));
    col += uC[5] * .60 * blob(pw, vec2(.78, .12) + .06 * vec2(cos(t * .07), sin(t * .10)), vec2(.32, .18));
    float silk = sin((pw.x * a * 1.1 + pw.y * 1.9) * 16. + w.x * 7.);
    col *= 1. + .05 * silk;
    // a faint pearl sheen drifting on its own, stronger wherever the cursor stirred
    float pearl = smoothstep(.5, .78, fbm(q * .7 + vec2(t * .025, -t * .02)));
    vec3 iri = hue(w.y * 1.6 + t * .04 + e * .8);
    col += iri * (pearl * .035 + e * .17) + vec3(e * .035);
    col += (hash(gl_FragCoord.xy + fract(t)) - .5) / 255.;      // dither: no banding in the dark
    gl_FragColor = vec4(col, 1.);
  }`;

  function program(fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, "p");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace("[0]", "");
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }
  let fieldProg, renderProg;
  try {
    fieldProg = program(FIELD_FS);
    renderProg = program(RENDER_FS);
  } catch (e) {
    console.warn("liquid wallpaper disabled:", e);
    return { setState() {}, hold() {} };
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // ---- velocity field ping-pong ----
  const FW = 72;
  let FH = 128, fields = [];
  function makeFields() {
    for (const f of fields) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fb); }
    const neutral = new Uint8Array(FW * FH * 4);
    for (let i = 0; i < neutral.length; i += 4) { neutral[i] = 128; neutral[i + 1] = 128; neutral[i + 3] = 255; }
    fields = [0, 1].map(() => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, neutral);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fb };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const SCALE = 0.6; // soft gradients: render below native resolution, the browser scales it up
  let W = 1, H = 1;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1) * SCALE;
    W = Math.max(1, Math.round(innerWidth * dpr)); H = Math.max(1, Math.round(innerHeight * dpr));
    canvas.width = W; canvas.height = H;
    const fh = Math.max(16, Math.round(FW * innerHeight / Math.max(1, innerWidth)));
    if (fh !== FH || !fields.length) { FH = fh; makeFields(); }
  }

  let cur = PALETTES.idle.map(hex), target = cur.map((c) => c.slice());
  const mouse = { x: .5, y: .5, px: .5, py: .5 };
  let lastMove = -1e9, burst = [0, 0, 0], t = Math.random() * 100, last = 0, lastDraw = 0;
  let src = 0, avgDt = 16, idleFps = 30, running = false, holdUntil = 0, paused = false;

  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);
    // intro is playing: give it the whole GPU (after the very first frame is on screen)
    if (now < holdUntil && canvas.classList.contains("on")) return;
    const sinceMove = now - lastMove;
    const fps = sinceMove < 2500 ? 60 : idleFps;
    if (now - lastDraw < 1000 / fps - 2) return;
    const dt = Math.min(.05, (now - (lastDraw || now)) / 1000 || .016);
    avgDt += ((now - lastDraw) - avgDt) * .05;
    lastDraw = now; t += dt;
    // slow machine guard: if even idle frames arrive late, flow at a gentler rate
    if (fps === idleFps && avgDt > 55 && idleFps > 15) idleFps = 15;

    // mouse velocity (uv/s, gl orientation), scaled into the field's -1..1 range
    let mvx = (mouse.x - mouse.px) / dt * .22, mvy = -(mouse.y - mouse.py) / dt * .22;
    const m = Math.hypot(mvx, mvy);
    if (m > 1) { mvx /= m; mvy /= m; }
    mouse.px = mouse.x; mouse.py = mouse.y;

    // 1. advance the velocity field
    const a = fields[src], b = fields[1 - src];
    gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb);
    gl.viewport(0, 0, FW, FH);
    gl.useProgram(fieldProg.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex);
    const fu = fieldProg.u;
    gl.uniform1i(fu.uF, 0);
    gl.uniform2f(fu.uFRes, FW, FH);
    gl.uniform1f(fu.uAspect, innerWidth / Math.max(1, innerHeight));
    gl.uniform1f(fu.uDt, dt);
    gl.uniform2f(fu.uMouse, mouse.x, 1 - mouse.y);
    gl.uniform2f(fu.uMVel, mvx, mvy);
    gl.uniform3f(fu.uBurst, burst[0], 1 - burst[1], burst[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    burst[2] = 0;
    src = 1 - src;

    // 2. paint the wallpaper through it
    for (let i = 0; i < cur.length; i++) for (let j = 0; j < 3; j++) {
      cur[i][j] += (target[i][j] - cur[i][j]) * (1 - Math.pow(.05, dt));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(renderProg.p);
    gl.bindTexture(gl.TEXTURE_2D, b.tex);
    const ru = renderProg.u;
    gl.uniform1i(ru.uF, 0);
    gl.uniform2f(ru.uRes, W, H);
    gl.uniform1f(ru.uTime, t);
    gl.uniform3fv(ru.uC, new Float32Array(cur.flat()));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add("on");
  }
  function start() {
    if (running || paused || document.hidden) return;
    running = true; lastDraw = 0;
    requestAnimationFrame(step);
  }
  function stop() { running = false; }

  addEventListener("mousemove", (e) => {
    mouse.x = e.clientX / innerWidth; mouse.y = e.clientY / innerHeight;
    if (performance.now() - lastMove > 400) { mouse.px = mouse.x; mouse.py = mouse.y; } // no jump on re-entry
    lastMove = performance.now();
  }, { passive: true });
  addEventListener("mousedown", (e) => {
    burst = [e.clientX / innerWidth, e.clientY / innerHeight, 1];
    lastMove = performance.now();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  addEventListener("resize", resize);
  resize();
  start();

  return {
    setState(state) { target = PALETTES[paletteFor(state)].map(hex); },
    hold(ms) { holdUntil = performance.now() + ms; },
    // the website stops it while the canvas is scrolled out of sight
    pause(on) { paused = on; on ? stop() : start(); },
  };
})();
