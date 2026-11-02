"use strict";
const C = window.PULSAR || {};

/* ---------- download links ---------- */
// GitHub counts every download of a release asset, so the link goes straight to the file
// (clicks are also counted per day in stats.js)
// A Mac gets the .dmg (Apple chip by default; browsers can't tell Intel from Apple silicon, so
// Intel Macs get a small link), everything else the Windows .exe. iPads also say "Macintosh".
const REL = C.owner ? `https://github.com/${C.owner}/${C.repo}/releases/latest/download/` : "";
const IS_MAC = /mac/i.test(`${navigator.userAgentData?.platform || ""} ${navigator.platform || ""}`)
  && navigator.maxTouchPoints < 2;
const FILES = { win: "PulsarVPN.exe", mac: "PulsarVPN-mac.dmg", intel: "PulsarVPN-mac-intel.dmg" };
const dl = (k) => (REL ? REL + FILES[k] : "#");
document.querySelectorAll("[data-download]").forEach((a) => { a.href = dl(IS_MAC ? "mac" : "win"); });
if (IS_MAC) document.querySelectorAll("[data-mac]").forEach((el) => { el.innerHTML = el.dataset.mac; });
const alt = document.getElementById("alt");
if (alt) alt.innerHTML = IS_MAC
  ? `Intel Mac? <a href="${dl("intel")}" data-download>Get this one</a> · <a href="${dl("win")}" data-download>Windows</a>`
  : `Also on <a href="${dl("mac")}" data-download>Mac</a> · <a href="${dl("intel")}" data-download>Intel Mac</a>`;

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- logo: the ring makes one full orbit per hover (and the big one once when it scrolls in) ---------- */
document.querySelectorAll(".plogo").forEach((el) => {
  const spin = () => { if (!still) el.classList.add("spin"); };
  (el.closest("a") || el).addEventListener("pointerenter", spin);
  el.addEventListener("click", spin);
  el.addEventListener("animationend", (e) => { if (e.animationName === "orbit") el.classList.remove("spin"); });
});
const bigLogo = document.querySelector(".ficon");
if (bigLogo && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { setTimeout(() => !still && bigLogo.classList.add("spin"), 500); io.disconnect(); }
  }, { threshold: 0.8 });
  io.observe(bigLogo);
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (p, a, b) => clamp((p - a) / (b - a));         // progress of p between a and b
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const settle = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);   // eases out past 1, then settles back
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (s) => document.querySelector(s);

/* ---------- reveal ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("in");
    io.unobserve(e.target);
  }
}, { threshold: 0.15 });
document.querySelectorAll(".rise").forEach((el) => {
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("rise"));
  el.style.setProperty("--d", `${Math.min(sibs.indexOf(el), 5) * 0.08}s`);
  io.observe(el);
});

/* ---------- pinned scenes: progress through a tall section, glided so wheel steps feel soft ---------- */
const scenes = [...document.querySelectorAll("[data-scene]")].map((el) => ({ el, p: 0 }));
const target = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight)); };

/* ===== scene 1: a laptop opens on Pulsar VPN — exposed, racing servers, protected — then we fly in ===== */
const pin1 = $("#top .pin"), laptop = $("#laptop"), lid = $("#lid"), glare = $("#glare"), intro = $("#intro"), hint = $("#hint");
const vpn = $("#vpn"), vstate = $("#vstate"), vtitle = $("#vtitle"), vip = $("#vip"), vsrv = $("#vsrv"), vping = $("#vping"), vbtnTxt = $("#vbtnTxt"), arc = $("#arc");
const capsA = [$("#scapA"), $("#scapB"), $("#scapC")];
const LW = 760, LH = 470;
let fit = 1;

// a real keyboard: function row, number row, three letter rows, then the space-bar row
$("#keys").innerHTML = [
  { n: 14, small: true }, { n: 13, tail: "w15" }, { head: "w15", n: 12, tail: "w15" },
  { head: "w18", n: 11, tail: "w22" }, { head: "w22", n: 10, tail: "w22" }, { n: 3, space: true, after: 4 },
].map((r) => {
  const k = (c = "") => `<i class="k ${c}"></i>`;
  const keys = r.space ? k().repeat(r.n) + k("w6") + k().repeat(r.after) : (r.head ? k(r.head) : "") + k().repeat(r.n) + (r.tail ? k(r.tail) : "");
  return `<div class="krow"${r.small ? ' style="flex:.7"' : ""}>${keys}</div>`;
}).join("");

// the title arrives letter by letter
const word = $("#word");
word.innerHTML = [...word.textContent].map((c, i) => c === " " ? "&nbsp;" : `<span class="ch" style="--i:${i}">${c}</span>`).join("");

// what the screen says while Pulsar races the servers, then where it lands
const RACE = [["Warsaw", "26 ms"], ["Amsterdam", "31 ms"], ["Tokyo", "240 ms — too slow"], ["Prague", "34 ms"], ["Frankfurt", "18 ms"]];
let shownState = "";
function setState(s, scanT) {
  if (s !== shownState) {
    shownState = s;
    vpn.dataset.state = s;
    vstate.textContent = s === "off" ? "Not protected" : s === "scan" ? "Connecting" : "Protected";
    vtitle.textContent = s === "off" ? "Your IP is visible" : s === "scan" ? "Finding the fastest server" : "You’re protected";
    vip.textContent = s === "on" ? "Hidden" : "203.0.113.42";
    vbtnTxt.textContent = s === "off" ? "Tap to connect" : s === "scan" ? "Connecting…" : "Connected";
  }
  if (s === "scan") {
    const [city, ms] = RACE[Math.min(RACE.length - 1, Math.floor(scanT * RACE.length))];
    vsrv.textContent = city; vping.textContent = ms;
  } else if (s === "on") { vsrv.textContent = "Frankfurt"; vping.textContent = "18 ms"; }
  else { vsrv.textContent = "—"; vping.textContent = "—"; }
}

function caption(el, a) {
  el.style.opacity = a.toFixed(3);
  el.style.transform = `translateY(${((1 - a) * 26).toFixed(1)}px)`;
  el.style.visibility = a < 0.01 ? "hidden" : "visible";
}

function renderOpen(p) {
  // the lid opens with a soft settle while the camera swings from the side to the front
  const o = range(p, 0.02, 0.24), open = settle(o);
  const zoom = smooth(range(p, 0.8, 0.98));
  const theta = lerp(34, 15, easeOut(o)) * (1 - zoom);           // how far we look down at it
  const phi = lerp(innerWidth <= 760 ? -8 : -14, 0, smooth(range(p, 0.0, 0.26))) * (1 - zoom);
  const css3d = !document.body.classList.contains("gl3d");
  if (css3d) lid.style.transform = `rotateX(${(lerp(-84, 15, open)) * (1 - zoom)}deg)`;
  const Z = innerWidth <= 760 ? innerWidth / ((LW - 22) * fit) : Math.max(innerWidth / ((LW - 22) * fit), innerHeight / ((LH - 41) * fit)) * 1.02;
  const rise = lerp(-17, 0, easeOut(o));   // closed, it sits higher so all of it is in view
  if (css3d) laptop.style.transform = `translateY(${rise}vh) rotateX(${-theta}deg) rotateY(${phi}deg) scale(${fit * lerp(innerHeight < 720 ? 0.58 : 0.68, 1, easeOut(o)) * (1 + (Z - 1) * zoom)})`;   // it also comes closer as it opens
  if (css3d) glare.style.transform = `translateX(${(1 - easeOut(o)) * 34 - zoom * 30}%)`;

  // screen light; its colour turns from violet to green once protected
  laptop.style.setProperty("--on", smooth(range(p, 0.12, 0.22)).toFixed(3));
  const g = smooth(range(p, 0.56, 0.62));
  pin1.style.setProperty("--gc", `${Math.round(lerp(142, 62, g))}, ${Math.round(lerp(125, 240, g))}, ${Math.round(lerp(255, 176, g))}`);

  // the screen's story
  setState(p < 0.4 ? "off" : p < 0.58 ? "scan" : "on", range(p, 0.4, 0.56));
  arc.style.strokeDashoffset = (160 * (1 - smooth(range(p, 0.44, 0.58)))).toFixed(1);

  // words: title → three captions
  const gone = smooth(range(p, 0.03, 0.14));
  intro.style.opacity = 1 - gone;
  intro.style.transform = `translateY(${-50 * gone}px) scale(${1 - 0.05 * gone})`;
  intro.style.visibility = gone > 0.99 ? "hidden" : "visible";
  hint.style.opacity = 1 - smooth(range(p, 0, 0.05));
  caption(capsA[0], smooth(range(p, 0.22, 0.27)) * (1 - smooth(range(p, 0.36, 0.4))));
  caption(capsA[1], smooth(range(p, 0.4, 0.45)) * (1 - smooth(range(p, 0.54, 0.58))));
  caption(capsA[2], smooth(range(p, 0.59, 0.64)) * (1 - smooth(range(p, 0.78, 0.82))));
  capsA[2].querySelector(".buy").style.pointerEvents = p > 0.6 && p < 0.79 ? "auto" : "none";
}

/* ===== scene 2: the real app turns while three captions take turns; at the third it connects ===== */
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
  });
  const idx = Math.min(n - 1, Math.floor(p * n));
  dots.forEach((d, i) => d.classList.toggle("on", i === idx));
  phone.style.transform = `scale(${pf * (0.94 + 0.08 * p)}) rotateY(${-16 + 30 * p}deg) rotateX(${7 - 11 * p}deg)`;
  if (p > 0.72 && !connected) {
    connected = true;
    heroApp.classList.add("on");
    try { $("#storyApp").contentDocument.getElementById("orb").click(); } catch (_) {}
  }
}

function measure() {
  const narrow = innerWidth <= 760;
  fit = Math.min(1, innerWidth * (narrow ? 0.9 : 0.7) / LW, innerHeight * 0.4 / LH);
  const room = innerHeight - 52;   // the product bar covers the top of the pinned scene
  pf = narrow ? Math.min((room - 290) / 812, (innerWidth - 44) / 420) : Math.min(1, room * 0.84 / 812, (innerWidth / 2 - 40) / 420);
  pf = Math.max(0.3, pf);
  heroApp.style.width = `${420 * pf}px`;
  heroApp.style.height = `${812 * pf}px`;
}
addEventListener("resize", measure);
measure();

let last = performance.now(), drawn = [-1, -1];
function frame(now) {
  requestAnimationFrame(frame);
  const k = still ? 1 : 1 - Math.exp(-Math.min(0.05, (now - last) / 1000) * 9);   // same glide at 60 or 144 Hz
  last = now;
  for (const s of scenes) {
    const t = target(s.el);
    s.p += (t - s.p) * k;
    if (Math.abs(t - s.p) < 0.0004) s.p = t;
  }
  window.__p1 = scenes[0].p;   // the 3D laptop (laptop3d.js) follows the same progress
  // only touch the page when a scene has actually moved
  if (scenes[0].p !== drawn[0]) { renderOpen(scenes[0].p); drawn[0] = scenes[0].p; }
  if (scenes[1].p !== drawn[1]) { renderApp(scenes[1].p); drawn[1] = scenes[1].p; }
}
requestAnimationFrame(frame);

/* ---------- the demo app's liquid wallpaper sleeps while off-screen ---------- */
document.querySelectorAll("iframe[src*='demo/']").forEach((f) => {
  new IntersectionObserver(([e]) => {
    // let its wallpaper paint for a moment, then hold it still so the glass on top never re-blurs
    try { f.contentWindow.eval(`typeof Liquid !== "undefined" && Liquid.pause(${!e.isIntersecting})`); } catch (_) {}
    if (e.isIntersecting) setTimeout(() => { try { f.contentWindow.eval(`typeof Liquid !== "undefined" && Liquid.pause(true)`); } catch (_) {} }, 1200);
  }).observe(f);
});
