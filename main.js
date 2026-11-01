"use strict";
const C = window.PULSAR || {};

/* ---------- download links ---------- */
// GitHub counts every download of a release asset, so the link goes straight to the file
const DOWNLOAD_URL = C.owner
  ? `https://github.com/${C.owner}/${C.repo}/releases/latest/download/PulsarVPN.exe`
  : "#";
document.querySelectorAll("[data-download]").forEach((a) => { a.href = DOWNLOAD_URL; });

/* ---------- nav border on scroll ---------- */
const nav = document.getElementById("nav");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 10), { passive: true });

/* ---------- scroll reveal ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("in");
    io.unobserve(e.target);
    const n = e.target.querySelector("[data-count]");
    if (n) countUp(n);
  }
}, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
document.querySelectorAll(".reveal, .reveal-device").forEach((el) => {
  // siblings in the same group enter one after another
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
  el.style.setProperty("--d", `${Math.min(sibs.indexOf(el), 6) * 0.08}s`);
  io.observe(el);
});

function countUp(el) {
  const target = +el.dataset.count, dec = +(el.dataset.dec || 0);
  const t0 = performance.now(), dur = 1400;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = (target * (1 - Math.pow(1 - p, 4))).toFixed(dec);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- statement: words light up as it scrolls through the viewport ---------- */
const st = document.querySelector(".reveal-words");
if (st) {
  st.innerHTML = st.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span> `).join("");
  const words = [...st.querySelectorAll(".w")];
  const light = () => {
    const r = st.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle("lit", i < n));
  };
  addEventListener("scroll", light, { passive: true });
  light();
}


/* ---------- motion: one rAF loop, transform-only, eased toward pointer/scroll targets ---------- */
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(pointer: fine)").matches;
const progress = document.getElementById("progress");
const device = document.querySelector(".device");
const glow = document.querySelector(".hero-glow");
let px = 0, py = 0, tx = 0, ty = 0;           // pointer target / eased, -1..1
let sy = scrollY, ey = scrollY;               // scroll target / eased
const onFrame = [];                           // per-frame hooks for the scroll-driven sections

// inertia scrolling (Lenis); anchor links glide instead of jumping
const lenis = !still && window.Lenis ? new Lenis({ lerp: 0.09 }) : null;
if (lenis) {
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const t = id.length > 1 && document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    lenis.scrollTo(t, { offset: -60, duration: 1.4 });
  }));
}

addEventListener("pointermove", (e) => {
  tx = e.clientX / innerWidth * 2 - 1;
  ty = e.clientY / innerHeight * 2 - 1;
}, { passive: true });
addEventListener("scroll", () => { sy = scrollY; }, { passive: true });

function frame(now) {
  if (lenis) lenis.raf(now);
  px += (tx - px) * 0.08; py += (ty - py) * 0.08;
  ey += (sy - ey) * (lenis ? 0.35 : 0.12);
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? ey / max : 0})`;
  if (device && innerWidth > 880) {
    // the app window leans toward the cursor and settles flat as you scroll past
    const s = Math.min(1, ey / innerHeight);
    device.style.transform =
      `translateY(${-s * 60}px) rotateY(${(-14 + px * 10) * (1 - s)}deg) rotateX(${(6 - py * 8) * (1 - s)}deg)`;
    device.classList.add("live");
  }
  if (glow) glow.style.translate = `${px * 30}px ${py * 30 + ey * 0.25}px`;
  for (const f of onFrame) f();
  requestAnimationFrame(frame);
}
if (!still) requestAnimationFrame(frame);

/* cursor spotlight on cards; feature cards also tilt toward the pointer */
document.querySelectorAll(".tile, .steps li").forEach((el) => {
  const tilt = fine && !still && el.classList.contains("tile");
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    if (tilt) {
      el.style.setProperty("--ry", `${(x / r.width - 0.5) * 8}deg`);
      el.style.setProperty("--rx", `${(0.5 - y / r.height) * 6}deg`);
    }
  });
  if (tilt) el.addEventListener("pointerleave", () => {
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  });
});

/* magnetic download buttons */
if (fine && !still) {
  document.querySelectorAll(".btn-primary, .nav-dl").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      b.style.transition = "transform .15s linear, box-shadow .4s";
      b.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px) scale(1.04)`;
    });
    b.addEventListener("pointerleave", () => {
      b.style.transition = "";
      b.style.transform = "";
    });
  });
}

/* ---------- pinned story: servers get scanned, the slow ones fall away, the best one connects ---------- */
const story = document.getElementById("story");
if (story) {
  const field = document.getElementById("field");
  const beam = document.getElementById("beam");
  const label = document.getElementById("sorbMs");
  const steps = [...story.querySelectorAll(".sstep")];
  const dots = [...story.querySelectorAll(".story-dots i")];
  const rnd = (i) => { const v = Math.sin(i * 78.233) * 43758.5453; return v - Math.floor(v); };

  // servers scattered around the orb: the angle sets scan order, the distance stands in for ping
  const N = 46, nodes = [];
  for (let i = 0; i < N; i++) {
    const r = i === 9 ? 0 : rnd(i);
    const el = document.createElement("i");
    field.appendChild(el);
    nodes.push({ el, cls: "", a: (i / N) * Math.PI * 2 + (rnd(i + 99) - .5) * .3, r: .31 + r * .17, ping: Math.round(18 + r * 250) });
  }
  const best = nodes.reduce((m, n) => (n.ping < m.ping ? n : m));
  const slow = nodes.filter((n) => n.ping > 150).sort((a, b) => b.ping - a.ping);
  const kept = N - slow.length;

  const layout = () => {
    const size = field.offsetWidth;
    for (const n of nodes) {
      n.el.style.setProperty("--x", `${Math.cos(n.a) * n.r * size}px`);
      n.el.style.setProperty("--y", `${Math.sin(n.a) * n.r * size}px`);
    }
    beam.setAttribute("x2", Math.cos(best.a) * best.r * 400);
    beam.setAttribute("y2", Math.sin(best.a) * best.r * 400);
  };
  layout();
  addEventListener("resize", layout);

  let stage = -1;
  onFrame.push(() => {
    const r = story.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    const s = p < .34 ? 0 : p < .67 ? 1 : 2;
    if (s !== stage) {
      stage = s;
      story.dataset.stage = s;
      steps.forEach((el, i) => { el.classList.toggle("on", i === s); el.classList.toggle("up", i < s); });
      dots.forEach((el, i) => el.classList.toggle("on", i === s));
      beam.classList.toggle("on", s === 2);
      if (typeof Liquid !== "undefined") Liquid.setState(s === 2 ? "connected" : "scanning");
    }
    const scan = Math.min(1, p / .28);                         // stage 0: sweep around the circle
    const cut = Math.min(1, Math.max(0, (p - .36) / .24));     // stage 1: drop the slow ones
    const cutSet = new Set(slow.slice(0, Math.round(cut * slow.length)));
    let seen = 0;
    for (const n of nodes) {
      let c = "";
      if (n.a / (Math.PI * 2) < scan) { c = "seen"; seen++; }
      if (s >= 1) c = cutSet.has(n) || (s === 2 && n.ping > 150) ? "cut" : "seen good";
      if (s === 2) c = n === best ? "best" : n.ping > 150 ? "cut" : "seen good fade";
      if (c !== n.cls) { n.el.className = c; n.cls = c; }
    }
    label.textContent = s === 0 ? `${seen} / ${N}` : s === 1 ? `${N - cutSet.size} left` : `${best.ping} ms`;
  });
}

/* ---------- final call to action: the orb rises as you arrive ---------- */
const finalSec = document.getElementById("final");
if (finalSec) {
  onFrame.push(() => {
    const r = finalSec.getBoundingClientRect();
    if (r.top > innerHeight) return;
    const q = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * .9)));
    finalSec.style.setProperty("--fy", `${(1 - q) * 220}px`);
    finalSec.style.setProperty("--fs", .6 + q * .5);
    finalSec.style.setProperty("--fo", q);
  });
}

/* ---------- liquid wallpaper: bright behind the hero, back during the story, off elsewhere ---------- */
const liquid = document.getElementById("liquid");
if (typeof Liquid !== "undefined" && liquid) {
  Liquid.setState("scanning");
  let paused = false;
  onFrame.push(() => {
    const hero = Math.max(0, 1 - scrollY / innerHeight);
    let mid = 0;
    if (story) {
      const r = story.getBoundingClientRect();
      mid = Math.min(1, Math.max(0, Math.min(-r.top / innerHeight + .3, (r.bottom - innerHeight) / innerHeight + .3) * 2));
    }
    const v = Math.max(hero * .6, mid * .4);
    liquid.style.setProperty("--lq", v.toFixed(3));
    if ((v < .01) !== paused) { paused = v < .01; Liquid.pause(paused); }
  });
}
