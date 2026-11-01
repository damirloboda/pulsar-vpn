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

addEventListener("pointermove", (e) => {
  tx = e.clientX / innerWidth * 2 - 1;
  ty = e.clientY / innerHeight * 2 - 1;
}, { passive: true });
addEventListener("scroll", () => { sy = scrollY; }, { passive: true });

function frame() {
  px += (tx - px) * 0.08; py += (ty - py) * 0.08;
  ey += (sy - ey) * 0.12;
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
