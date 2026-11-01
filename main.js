"use strict";
const C = window.PULSAR || {};

/* ---------- download links ---------- */
// GitHub counts every download of a release asset, so the link goes straight to the file
// (clicks are also counted per day in stats.js)
const DOWNLOAD_URL = C.owner
  ? `https://github.com/${C.owner}/${C.repo}/releases/latest/download/PulsarVPN.exe`
  : "#";
document.querySelectorAll("[data-download]").forEach((a) => { a.href = DOWNLOAD_URL; });

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(pointer: fine)").matches;
const narrow = () => innerWidth < 900;

/* ---------- arrival ---------- */
requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll(".fade").forEach((el) => el.classList.add("in"))));

const nav = document.getElementById("nav");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 30), { passive: true });

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("in");
    io.unobserve(e.target);
    const n = e.target.querySelector("[data-count]");
    if (n) countUp(n);
  }
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
document.querySelectorAll(".reveal").forEach((el) => {
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
  el.style.setProperty("--d", `${Math.min(sibs.indexOf(el), 5) * 0.08}s`);
  io.observe(el);
});

function countUp(el) {
  const target = +el.dataset.count, dec = +(el.dataset.dec || 0);
  const t0 = performance.now(), dur = 1800;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = (target * (1 - Math.pow(1 - p, 4))).toFixed(dec);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- the pulsar: a white-hot star whose two beams sweep around a tilted axis,
   inside a slowly turning disk of particles. It moves between scenes as you scroll. ---------- */
const Space = (() => {
  const canvas = document.getElementById("space");
  if (!window.THREE || still) { document.body.classList.add("no-gl"); canvas.remove(); return null; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !narrow(), powerPreference: "high-performance" }); }
  catch (_) { document.body.classList.add("no-gl"); canvas.remove(); return null; }
  renderer.setPixelRatio(Math.min(narrow() ? 1.5 : 2, devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02020a);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

  const tex = (stops) => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  };
  const dot = tex([[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,.6)"], [1, "rgba(255,255,255,0)"]]);
  const haloTex = tex([[0, "rgba(255,255,255,1)"], [0.12, "rgba(220,212,255,.9)"], [0.35, "rgba(140,120,255,.35)"], [1, "rgba(80,60,220,0)"]]);

  const star = new THREE.Group(); scene.add(star);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 48), new THREE.MeshBasicMaterial({ color: 0xf4f1ff }));
  star.add(core);
  const sprite = (op) => new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
  const glowA = sprite(1), glowB = sprite(0.35);
  star.add(glowA, glowB);

  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uLen: { value: 9 }, uOp: { value: 0 } },
    vertexShader: "varying float vD; void main(){ vD = -position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: `uniform float uLen; uniform float uOp; varying float vD;
      void main(){ float t = clamp(vD/uLen,0.,1.); float a = pow(1.-t,2.2)*.55*uOp;
        vec3 c = mix(vec3(1.,.98,1.), mix(vec3(.62,.55,1.), vec3(.45,.8,1.), t), smoothstep(0.,.35,t));
        gl_FragColor = vec4(c, a); }`,
  });
  const spin = new THREE.Group(); star.add(spin);
  const axis = new THREE.Group(); axis.rotation.z = 0.62; spin.add(axis);
  for (const flip of [0, Math.PI]) {
    for (const r of [1.15, 0.22]) {
      const g = new THREE.ConeGeometry(r, 9, r > 1 ? 48 : 24, 1, true); g.translate(0, -4.5, 0);
      const m = new THREE.Mesh(g, beamMat); m.rotation.z = flip; axis.add(m);
    }
  }

  const points = (n, place, size, opacity) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const palette = [[0.62, 0.55, 1], [0.45, 0.78, 1], [0.5, 0.96, 0.82], [1, 1, 1]];
    for (let i = 0; i < n; i++) { pos.set(place(), i * 3); col.set(palette[(Math.random() * palette.length) | 0], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, map: dot, vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  };
  const disk = points(narrow() ? 4500 : 9000, () => {
    const r = 1.6 + Math.pow(Math.random(), 1.6) * 9, a = Math.random() * Math.PI * 2, arm = Math.sin(a * 2 + r * 0.7) * 0.5;
    return [Math.cos(a + arm) * r, (Math.random() - 0.5) * 0.35 * (1 + r * 0.08), Math.sin(a + arm) * r];
  }, 0.07, 0.9);
  disk.rotation.x = 0.38; star.add(disk);
  const far = points(narrow() ? 1800 : 4000, () => {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 40 + Math.random() * 60, s = Math.sqrt(1 - u * u);
    return [Math.cos(th) * s * r, u * r, Math.sin(th) * s * r];
  }, 0.35, 0.8);
  scene.add(far);

  // where the star sits in each part of the page (world units; x is ±9 at the screen edge on desktop)
  const WIDE = {
    top:      { x: 2.4, y: 0.9, z: 12, beam: 1, glow: 1, disk: 0.9 },
    app:      { x: 3.6, y: 0.2, z: 13, beam: 0.9, glow: 0.95, disk: 0.75 },
    features: { x: 0, y: 5.2, z: 16, beam: 0.45, glow: 0.55, disk: 0.45 },
    how:      { x: -7.5, y: -0.6, z: 15, beam: 0.4, glow: 0.5, disk: 0.5 },
    faq:      { x: -7.8, y: 1.6, z: 15, beam: 0.35, glow: 0.5, disk: 0.45 },
    final:    { x: 0, y: 3.5, z: 11, beam: 1.15, glow: 1.2, disk: 0.95 },
  };
  const TALL = {
    top:      { x: 0, y: 4.4, z: 14, beam: 1, glow: 0.9, disk: 0.9 },
    app:      { x: 0, y: 3.6, z: 15, beam: 0.8, glow: 0.9, disk: 0.7 },
    features: { x: 0, y: 6, z: 18, beam: 0.4, glow: 0.5, disk: 0.4 },
    how:      { x: 0, y: -5, z: 17, beam: 0.35, glow: 0.45, disk: 0.45 },
    faq:      { x: 0, y: 5, z: 17, beam: 0.35, glow: 0.45, disk: 0.4 },
    final:    { x: 0, y: 4.6, z: 14, beam: 1.05, glow: 1.1, disk: 0.9 },
  };
  const ids = ["top", "app", "features", "how", "faq", "final"];
  const els = ids.map((id) => document.getElementById(id));
  const keys = ["x", "y", "z", "beam", "glow", "disk"];
  const cur = { ...WIDE.top };
  let anchors = [];

  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    anchors = els.map((el) => el.getBoundingClientRect().top + scrollY);
  }
  addEventListener("resize", layout); addEventListener("load", layout); layout();

  // a scroll position becomes a blend of two neighbouring scenes
  function target() {
    const set = narrow() ? TALL : WIDE;
    const mid = scrollY + innerHeight * 0.5;
    let i = 0;
    while (i < anchors.length - 1 && mid >= anchors[i + 1]) i++;
    const a = set[ids[i]], b = set[ids[Math.min(i + 1, ids.length - 1)]];
    const span = (anchors[i + 1] ?? anchors[i] + 1) - anchors[i];
    let t = i === anchors.length - 1 ? 0 : Math.min(1, Math.max(0, (mid - anchors[i]) / span));
    t = Math.min(1, Math.max(0, (t - 0.55) / 0.45));   // hold the scene while you read, glide near the end
    t = t * t * (3 - 2 * t);
    const out = {};
    for (const k of keys) out[k] = a[k] + (b[k] - a[k]) * t;
    return out;
  }

  let mx = 0, my = 0, cx = 0, cy = 0, last = performance.now();
  const born = performance.now();
  addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const goal = target(), k = 1 - Math.pow(0.02, dt);       // glide toward the scene, frame-rate independent
    for (const key of keys) cur[key] += (goal[key] - cur[key]) * k;
    cx += (mx - cx) * 0.04; cy += (my - cy) * 0.04;
    const ignite = Math.min(1, (now - born) / 1800), e = 1 - Math.pow(1 - ignite, 3);

    star.position.set(cur.x, cur.y, 0);
    spin.rotation.y += dt * 1.15;
    disk.rotation.y += dt * 0.05;
    far.rotation.y += dt * 0.004;
    beamMat.uniforms.uOp.value = cur.beam * e;
    disk.material.opacity = cur.disk * e;
    const pulse = 1 + Math.sin(now * 0.004) * 0.05;
    glowA.scale.setScalar(4.2 * cur.glow * pulse * (0.3 + 0.7 * e));
    glowB.scale.setScalar(11 * cur.glow * (0.3 + 0.7 * e));
    glowB.material.opacity = 0.35 * cur.glow * e;
    core.scale.setScalar(0.4 + 0.6 * e);

    camera.position.set(cx * 2.4, -cy * 1.6 + 1, cur.z);
    camera.lookAt(cx * 0.6, 0, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame((t) => { canvas.classList.add("on"); frame(t); });
  return { layout };
})();

/* ---------- page motion: progress, app window lean, steps line ---------- */
const progress = document.getElementById("progress");
const win = document.getElementById("window");
const stepsEl = document.querySelector(".steps");
const stepItems = stepsEl ? [...stepsEl.children] : [];
let px = 0, py = 0, tx = 0, ty = 0;
addEventListener("pointermove", (e) => { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });

function tick() {
  px += (tx - px) * 0.07; py += (ty - py) * 0.07;
  const vh = innerHeight, max = document.documentElement.scrollHeight - vh;
  progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  if (win && fine) { win.style.setProperty("--wy", `${px * 7}deg`); win.style.setProperty("--wx", `${-py * 5}deg`); }
  if (stepsEl) {
    const r = stepsEl.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) {
      const sp = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (vh * 0.42)));
      stepsEl.style.setProperty("--sp", sp.toFixed(3));
      stepItems.forEach((li, i) => li.classList.toggle("lit", sp >= i / (stepItems.length - 1) - 0.02));
    }
  }
  requestAnimationFrame(tick);
}
if (still) { stepItems.forEach((li) => li.classList.add("lit")); if (stepsEl) stepsEl.style.setProperty("--sp", 1); }
else requestAnimationFrame(tick);

/* ---------- cards: the hairline lights up wherever the cursor is, across the whole group ---------- */
document.querySelectorAll(".glow-group").forEach((group) => {
  const cards = [...group.querySelectorAll(".card, .qcard")];
  group.addEventListener("pointermove", (e) => {
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", `${e.clientX - r.left}px`);
      c.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
  });
  group.addEventListener("pointerleave", () => {
    for (const c of cards) { c.style.setProperty("--mx", "-999px"); c.style.setProperty("--my", "-999px"); }
  });
});

if (fine && !still) {
  document.querySelectorAll(".card").forEach((c) => {
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 6}deg`);
      c.style.setProperty("--rx", `${(0.5 - (e.clientY - r.top) / r.height) * 5}deg`);
    });
    c.addEventListener("pointerleave", () => { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); });
  });
  // magnetic download buttons
  document.querySelectorAll(".dl").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      b.style.transition = "transform .15s linear, box-shadow .5s";
      b.style.transform = `translate(${dx * 0.14}px, ${dy * 0.26}px) scale(1.03)`;
    });
    b.addEventListener("pointerleave", () => { b.style.transition = ""; b.style.transform = ""; });
  });
}

// anchors and images shift the page once fonts and the demo load: re-measure the scenes
document.fonts && document.fonts.ready.then(() => Space && Space.layout());

/* ---------- the live demo's wallpaper sleeps while the demo is off-screen ---------- */
const demo = document.querySelector(".window-screen iframe");
if (demo) {
  new IntersectionObserver(([e]) => {
    try { demo.contentWindow.eval(`typeof Liquid !== "undefined" && Liquid.pause(${!e.isIntersecting})`); } catch (_) {}
  }).observe(demo);
}
