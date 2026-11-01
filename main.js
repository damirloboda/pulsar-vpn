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

/* ---------- load-in: let the first frame paint, then release the intro ---------- */
requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("loading")));

/* ---------- nav ---------- */
const nav = document.getElementById("nav");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 20), { passive: true });

/* ---------- scroll reveal: siblings arrive one after another ---------- */
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
  el.style.setProperty("--d", `${Math.min(sibs.indexOf(el), 5) * 0.07}s`);
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

/* ---------- one rAF loop: pointer and scroll, eased, transform-only ---------- */
const progress = document.getElementById("progress");
const win = document.getElementById("window");
const chips = [...document.querySelectorAll(".chip-float")];
const finalSec = document.getElementById("final");
const stepsEl = document.querySelector(".steps");
const stepItems = stepsEl ? [...stepsEl.children] : [];
let tx = 0, ty = 0, px = 0, py = 0;

addEventListener("pointermove", (e) => {
  tx = e.clientX / innerWidth * 2 - 1;
  ty = e.clientY / innerHeight * 2 - 1;
}, { passive: true });

function frame() {
  px += (tx - px) * 0.07; py += (ty - py) * 0.07;
  const y = scrollY, vh = innerHeight;
  const max = document.documentElement.scrollHeight - vh;
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

  if (y < vh * 1.6) {
    // the app window starts leaning back and stands up as the page scrolls
    const k = Math.min(1, y / (vh * 0.55));
    const tilt = (1 - k) * (innerWidth > 880 ? 26 : 14);
    win.style.transform = `rotateX(${tilt - py * 3}deg) rotateY(${px * 5}deg) scale(${0.9 + 0.1 * k})`;
    for (const c of chips) {
      const d = +c.dataset.depth;
      c.style.translate = `${px * d}px ${py * d - y * Math.abs(d) * 0.006}px`;
    }
  }

  if (stepsEl) {
    const r = stepsEl.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) {
      const sp = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (vh * 0.42)));
      stepsEl.style.setProperty("--sp", sp.toFixed(3));
      stepItems.forEach((li, i) => li.classList.toggle("lit", sp >= i / (stepItems.length - 1) - 0.02));
    }
  }

  if (finalSec) {
    const r = finalSec.getBoundingClientRect();
    if (r.top < vh) {
      const q = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.8)));
      finalSec.style.setProperty("--fy", `${(1 - q) * 120}px`);
      finalSec.style.setProperty("--fs", (0.6 + q * 0.4).toFixed(3));
      finalSec.style.setProperty("--fo", q.toFixed(3));
    }
  }
  requestAnimationFrame(frame);
}
if (still) {
  stepItems.forEach((li) => li.classList.add("lit"));
  if (stepsEl) stepsEl.style.setProperty("--sp", 1);
  if (finalSec) { finalSec.style.setProperty("--fy", "0px"); finalSec.style.setProperty("--fs", 1); finalSec.style.setProperty("--fo", 1); }
} else {
  requestAnimationFrame(frame);
}

/* ---------- cards: the border lights up wherever the cursor is, across the whole group ---------- */
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

/* the card under the cursor tilts toward it */
if (fine && !still) {
  document.querySelectorAll(".card").forEach((c) => {
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 6}deg`);
      c.style.setProperty("--rx", `${(0.5 - (e.clientY - r.top) / r.height) * 5}deg`);
    });
    c.addEventListener("pointerleave", () => { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); });
  });

  /* magnetic primary buttons */
  document.querySelectorAll(".btn-primary, .nav-dl").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      b.style.transition = "transform .15s linear, box-shadow .45s";
      b.style.transform = `translate(${dx * 0.16}px, ${dy * 0.28}px) scale(1.03)`;
    });
    b.addEventListener("pointerleave", () => { b.style.transition = ""; b.style.transform = ""; });
  });
}

/* ---------- the live demo's wallpaper sleeps while the demo is off-screen ---------- */
const demo = document.querySelector(".window-screen iframe");
if (demo) {
  new IntersectionObserver(([e]) => {
    try { demo.contentWindow.eval(`typeof Liquid !== "undefined" && Liquid.pause(${!e.isIntersecting})`); } catch (_) {}
  }).observe(demo);
}
