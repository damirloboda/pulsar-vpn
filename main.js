"use strict";
const C = window.PULSAR || {};

/* ---------- download links ---------- */
// GitHub counts every download of a release asset, so the link goes straight to the file
const DOWNLOAD_URL = C.owner
  ? `https://github.com/${C.owner}/${C.repo}/releases/latest/download/PulsarVPN.exe`
  : "#";
document.querySelectorAll("[data-download]").forEach((a) => {
  a.href = DOWNLOAD_URL;
  a.addEventListener("click", () => {
    // visitor analytics (GoatCounter): record the click as a "download" event
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: "download", title: "Download PulsarVPN.exe", event: true });
    }
  });
});

/* ---------- visitor analytics (cookieless GoatCounter, only if configured) ---------- */
if (C.goatcounter) {
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = `https://${C.goatcounter}.goatcounter.com/count`;
  document.head.appendChild(s);
}

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
  const target = +el.dataset.count;
  const t0 = performance.now(), dur = 1400;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
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
