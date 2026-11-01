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
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (p, a, b) => clamp((p - a) / (b - a));         // progress of p between a and b
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const $ = (s) => document.querySelector(s);

/* ---------- reveal ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("in");
    io.unobserve(e.target);
    e.target.querySelectorAll("[data-to]").forEach(countTo);
    e.target.querySelectorAll("[data-count]").forEach(countTo);
  }
}, { threshold: 0.15 });
document.querySelectorAll(".rise").forEach((el) => {
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("rise"));
  el.style.setProperty("--d", `${Math.min(sibs.indexOf(el), 5) * 0.08}s`);
  io.observe(el);
});
function countTo(el) {
  const target = +(el.dataset.to ?? el.dataset.count), dec = +(el.dataset.dec || 0);
  if (!target) { el.textContent = "0"; return; }
  const t0 = performance.now(), dur = 1600;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = (target * easeOut(p)).toFixed(dec);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- pinned scenes: progress through a tall section, softened so wheel steps glide ---------- */
const scenes = [...document.querySelectorAll("[data-scene]")].map((el) => ({ el, p: 0 }));
const target = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight)); };

// scene 1: the laptop opens a crack of light, boots, then we fly into its screen
const laptop = $("#laptop"), lid = $("#lid"), intro = $("#intro"), lead = $("#lead"), hint = $("#hint");
const boot = $("#boot"), bootbar = $("#bootbar"), desk = $("#desk"), glare = $("#glare"), leak = $("#leak");
const LW = 760, LH = 470;
let fit = 1;

// a real keyboard: six rows, wide modifiers, a long space bar
const ROWS = [["", 13, "w15"], ["w15", 12, "w15"], ["w18", 11, "w22"], ["w22", 10, "w22"], ["", 3, "w6", 4]];
$("#keys").innerHTML = [[0, 14]].concat(ROWS).map((r, i) => {
  if (i === 0) return `<div class="krow" style="flex:.7">${'<i class="k"></i>'.repeat(14)}</div>`;
  const [lead0, n, tail, n2] = r;
  if (tail === "w6") return `<div class="krow">${'<i class="k"></i>'.repeat(n)}<i class="k w6"></i>${'<i class="k"></i>'.repeat(n2)}</div>`;
  return `<div class="krow">${lead0 ? `<i class="k ${lead0}"></i>` : ""}${'<i class="k"></i>'.repeat(n)}<i class="k ${tail}"></i></div>`;
}).join("");

// the title arrives letter by letter
const word = $("#word");
word.innerHTML = [...word.textContent].map((c, i) => `<span class="ch" style="--i:${i}">${c}</span>`).join("");

function renderOpen(p) {
  const open = easeOut(range(p, 0.03, 0.4));
  const zoom = smooth(range(p, 0.55, 0.95));
  // we look down at the laptop (theta); the lid starts a crack open and opens until it faces us
  const theta = (32 - 16 * open) * (1 - zoom);
  const lidDeg = (-84 + 100 * open) * (1 - zoom);
  lid.style.transform = `rotateX(${lidDeg}deg)`;
  // phones: fill the width, so the app on the screen stays in view
  const Z = innerWidth <= 760 ? innerWidth / ((LW - 22) * fit) : Math.max(innerWidth / ((LW - 22) * fit), innerHeight / ((LH - 41) * fit)) * 1.02;
  const scale = fit * (1 + (Z - 1) * zoom);
  laptop.style.transform = `translateY(${(1 - open) * 5}vh) rotateX(${-theta}deg) scale(${scale})`;

  // light: leaking from the gap, then the screen boots (logo, bar), then the desktop
  const on = smooth(range(p, 0.14, 0.34));
  laptop.style.setProperty("--on", on.toFixed(3));
  leak.style.opacity = (0.9 * (1 - smooth(range(p, 0.02, 0.16)))).toFixed(3);
  const bootIn = smooth(range(p, 0.12, 0.2)), bootOut = smooth(range(p, 0.3, 0.38));
  boot.style.opacity = (bootIn * (1 - bootOut)).toFixed(3);
  bootbar.style.transform = `scaleX(${range(p, 0.17, 0.3).toFixed(3)})`;
  desk.style.opacity = bootOut.toFixed(3);
  desk.style.transform = `scale(${1.06 - 0.06 * bootOut})`;
  glare.style.transform = `translateX(${(1 - open) * 30 - zoom * 25}%)`;

  const gone = smooth(range(p, 0.04, 0.2));
  intro.style.opacity = 1 - gone;
  intro.style.transform = `translateY(${-70 * gone}px) scale(${1 - 0.06 * gone})`;
  hint.style.opacity = 1 - smooth(range(p, 0, 0.06));
  const show = smooth(range(p, 0.34, 0.44)) * (1 - smooth(range(p, 0.52, 0.6)));
  lead.style.opacity = show;
  lead.style.transform = `translateY(${(1 - show) * 24}px)`;
  lead.style.pointerEvents = show > 0.5 ? "auto" : "none";
}

// scene 2: the app turns while three captions take turns; at the third it connects
const caps = [...document.querySelectorAll(".cap")];
const dots = [...document.querySelectorAll(".dots i")];
const heroApp = $("#heroApp"), phone = heroApp.querySelector(".phone");
let pf = 1, connected = false;
function renderApp(p) {
  const n = caps.length;
  caps.forEach((c, i) => {
    const local = p * n - i;
    let a = smooth(range(local, -0.04, 0.16)) * (1 - smooth(range(local, 0.84, 1)));
    if (i === 0) a = 1 - smooth(range(local, 0.84, 1));
    if (i === n - 1) a = smooth(range(local, -0.04, 0.16));
    c.style.opacity = a.toFixed(3);
    c.style.transform = `translateY(${(0.45 - clamp(local, -0.3, 1.3)) * 44}px)`;
    c.style.filter = a > 0.98 ? "none" : `blur(${((1 - a) * 8).toFixed(1)}px)`;
  });
  const idx = Math.min(n - 1, Math.floor(p * n));
  dots.forEach((d, i) => d.classList.toggle("on", i === idx));
  phone.style.transform = `scale(${pf * (0.94 + 0.08 * p)}) rotateY(${-16 + 30 * p}deg) rotateX(${7 - 11 * p}deg)`;
  if (p > 0.7 && !connected) {
    connected = true;
    heroApp.classList.add("on");
    try { $("#storyApp").contentDocument.getElementById("orb").click(); } catch (_) {}
  }
}

function measure() {
  fit = Math.min(1, innerWidth * 0.84 / LW, innerHeight * 0.42 / LH);
  const narrow = innerWidth <= 760;
  pf = narrow ? Math.min((innerHeight - 330) / 812, (innerWidth - 44) / 420) : Math.min(1, innerHeight * 0.8 / 812, (innerWidth / 2 - 40) / 420);
  pf = Math.max(0.3, pf);
  heroApp.style.width = `${420 * pf}px`;
  heroApp.style.height = `${812 * pf}px`;
}
addEventListener("resize", measure);
measure();
Object.assign(phone.style, { position: "absolute", left: "50%", top: "50%", margin: "-406px 0 0 -210px" });

let last = performance.now();
function frame(now) {
  const k = still ? 1 : 1 - Math.exp(-Math.min(0.05, (now - last) / 1000) * 10);  // same glide at 60 or 144 Hz
  last = now;
  for (const s of scenes) {
    const t = target(s.el);
    s.p += (t - s.p) * k;
    if (Math.abs(t - s.p) < 0.0004) s.p = t;
  }
  renderOpen(scenes[0].p);
  renderApp(scenes[1].p);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- the demo apps' liquid wallpaper sleeps while off-screen ---------- */
document.querySelectorAll("iframe[src*='demo/']").forEach((f) => {
  new IntersectionObserver(([e]) => {
    try { f.contentWindow.eval(`typeof Liquid !== "undefined" && Liquid.pause(${!e.isIntersecting})`); } catch (_) {}
  }).observe(f);
});
