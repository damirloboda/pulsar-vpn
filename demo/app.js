"use strict";
const $ = (s) => document.querySelector(s);
const api = () => window.pywebview.api;

const S = {
  state: "idle",
  mode: "gaming",
  servers: new Map(),   // id -> server
  ranked: [],           // ids, best first
  probed: 0,
  selected: null,       // null = automatic
  current: null,
  since: 0,
  admin: true,
  hist: { down: Array(40).fill(0), up: Array(40).fill(0) },
};

/* ================= helpers ================= */
const BOLT = `<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>`;
const STAR = `<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>`;
const ROBLOX = `<svg viewBox="0 0 24 24"><path d="M6.2 2.8 21.2 6.8 17.8 21.2 2.8 17.2z"/><path d="m10.6 9.4 4 1.1-1.1 4-4-1.1z"/></svg>`;
const CLOUD = `<svg viewBox="0 0 24 24"><path d="M7 18h10.5a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.4 10.1 4 4 0 0 0 7 18z"/></svg>`;
const protoName = (s) => s.kind === "direct" ? "Direct" : s.kind === "warp" ? "WARP" :
  s.kind === "wireguard" ? "WireGuard" : `OpenVPN ${s.proto.toUpperCase()}`;
const flagHTML = (s) =>
  s && s.kind === "direct" ? ROBLOX :
  s && s.kind === "warp" ? CLOUD :
  s && s.cc ?`<img src="https://flagcdn.com/w80/${s.cc}.png" alt="" onerror="this.replaceWith(document.createTextNode('${s.cc.toUpperCase()}'))">`
    : s && s.source === "custom" ? STAR : BOLT;
const pingClass = (p) => p == null ? "" : p < 90 ? "p-good" : p < 150 ? "p-mid" : "p-bad";
const fmtPing = (p) => p == null ? "—" : `${Math.round(p)} ms`;
function fmtRate(bytesPerSec) {
  const bits = bytesPerSec * 8;
  if (bits >= 1e6) return [(bits / 1e6).toFixed(bits >= 1e8 ? 0 : 1), "Mbps"];
  return [(bits / 1e3).toFixed(0), "Kbps"];
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}`;
}
function swapText(el, text) {
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap");
}
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
let toastT;
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg; t.className = `toast glass show ${kind}`;
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3200);
}

/* ================= liquid glass lens =================
   Builds a displacement map for a rounded rectangle: near the rim the backdrop is
   pushed along the surface normal, so whatever is behind bends like thick glass. */
let lensId = 0;
function lensMap(w, h, r, bezel) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d"), img = ctx.createImageData(w, h), d = img.data;
  const hx = w / 2 - r, hy = h / 2 - r;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + .5 - w / 2, py = y + .5 - h / 2;
      const qx = Math.abs(px) - hx, qy = Math.abs(py) - hy;
      let nx, ny, dist;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        nx = qx / len * Math.sign(px); ny = qy / len * Math.sign(py); dist = len - r;
      } else if (qx > qy) { nx = Math.sign(px); ny = 0; dist = qx - r; }
      else { nx = 0; ny = Math.sign(py); dist = qy - r; }
      const t = Math.min(1, Math.max(0, 1 + dist / bezel)); // 1 at rim, 0 past the bezel
      const m = dist > 0 ? 0 : t * t * t;
      const i = (y * w + x) * 4;
      d[i] = 128 + nx * m * 127; d[i + 1] = 128 + ny * m * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}
function applyLens(el) {
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
  const bezel = +el.dataset.bezel || 20, scale = +el.dataset.scale || -40;
  const id = el.dataset.lensId || `lens${++lensId}`;
  el.dataset.lensId = id;
  const ns = "http://www.w3.org/2000/svg";
  let f = document.getElementById(id);
  if (!f) { f = document.createElementNS(ns, "filter"); f.id = id; $("#lensDefs").appendChild(f); }
  f.setAttribute("x", 0); f.setAttribute("y", 0); f.setAttribute("width", w); f.setAttribute("height", h);
  f.setAttribute("filterUnits", "userSpaceOnUse"); f.setAttribute("color-interpolation-filters", "sRGB");
  f.innerHTML = `<feImage href="${lensMap(w, h, r, bezel)}" x="0" y="0" width="${w}" height="${h}" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>`;
  el.style.backdropFilter = `url(#${id}) blur(1px) saturate(170%) brightness(1.1)`;
}

/* ================= sparkline (redrawn once per stats tick) ================= */
const sp = $("#spark"), sx = sp.getContext("2d");
function drawSpark() {
  const w = sp.width, h = sp.height, pad = 6;
  sx.clearRect(0, 0, w, h);
  const max = Math.max(32 * 1024, ...S.hist.down, ...S.hist.up) * 1.15;
  for (const [data, col] of [[S.hist.up, "255,179,245"], [S.hist.down, "100,210,255"]]) {
    const pts = data.map((v, i) => [i / (data.length - 1) * w, h - pad - (v / max) * (h - pad * 2)]);
    sx.beginPath(); sx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
      sx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
    }
    sx.strokeStyle = `rgb(${col})`; sx.lineWidth = 3.5; sx.stroke();
    sx.lineTo(w, h); sx.lineTo(0, h); sx.closePath();
    const g = sx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(${col},.3)`); g.addColorStop(1, `rgba(${col},0)`);
    sx.fillStyle = g; sx.fill();
  }
}

/* ================= tweened numbers (loop stops when settled) ================= */
const tweens = {};
let tweening = false;
function tweenNum(el, target, fmt) {
  const t = tweens[el.id] || (tweens[el.id] = { v: 0 });
  Object.assign(t, { target, fmt, el });
  if (!tweening) { tweening = true; requestAnimationFrame(stepTweens); }
}
function stepTweens() {
  let busy = false;
  for (const t of Object.values(tweens)) {
    t.v += (t.target - t.v) * .18;
    if (Math.abs(t.target - t.v) > Math.max(1, t.target * .002)) busy = true; else t.v = t.target;
    t.el.textContent = t.fmt(t.v);
  }
  if (busy) requestAnimationFrame(stepTweens); else tweening = false;
}

setInterval(() => {
  if (S.state === "connected" && S.since) $("#statusSub").textContent = fmtTime(Date.now() / 1000 - S.since);
}, 500);

/* ================= UI state ================= */
const CHIP = { idle: "Not protected", scanning: "Scanning", connecting: "Connecting", connected: "Protected", disconnecting: "Disconnecting" };
function setState(state, msg = "", extra = {}) {
  const prev = S.state;
  S.state = state;
  document.body.classList.remove("lan-lost");
  document.body.dataset.state = state;
  Liquid.setState(state);
  $("#chipText").textContent = CHIP[state] || state;
  const title = $("#statusTitle"), sub = $("#statusSub");
  sub.classList.remove("timer");
  if (state === "idle") {
    swapText(title, "Tap to connect");
    swapText(sub, msg || idleHint());
    S.current = null; S.since = 0;
    if (msg && /couldn|error|could not|no server/i.test(msg)) { replay($("#stage"), "shake"); toast(msg, "bad"); }
    if (prev === "connected" || prev === "disconnecting") resetTraffic();
  } else if (state === "scanning") {
    swapText(title, "Searching");
    swapText(sub, msg || "Pinging servers…");
  } else if (state === "connecting") {
    swapText(title, "Connecting");
    swapText(sub, (msg || "Handshaking…") + (extra.attempt > 1 ? `  ·  try ${extra.attempt}/4` : ""));
    if (extra.server) S.current = extra.server;
  } else if (state === "connected") {
    swapText(title, "You're protected");
    sub.classList.add("timer");
    S.since = extra.since || Date.now() / 1000;
    S.current = extra.server;
    sub.textContent = fmtTime(Date.now() / 1000 - S.since);
    replay($(".ripple"), "go");
    replay($("#orb"), "squish");
    toast(msg || `Connected · ${extra.server.country}`, msg ? "bad" : "ok");
  } else if (state === "disconnecting") {
    swapText(title, "Disconnecting"); swapText(sub, "");
  }
  showServer();
  renderList();
}

function showServer() {
  const live = (S.state === "connected" || S.state === "connecting") && S.current;
  const srv = live ? S.current : (S.selected && S.servers.get(S.selected));
  const flag = $("#flag"), country = $("#locCountry"), sub = $("#locSub");
  flag.classList.toggle("auto", !srv || srv.kind === "direct");
  if (!srv && S.mode === "roblox") {
    flag.innerHTML = ROBLOX; flag.dataset.id = "";
    swapText(country, "Roblox Unblock");
    sub.textContent = "No VPN detour · same ping as without VPN";
    $("#ping").textContent = "—"; $("#ping").className = "";
    $("#proto").textContent = "Direct";
    return;
  }
  if (!srv) {
    flag.innerHTML = BOLT; flag.dataset.id = "";
    swapText(country, "Automatic");
    const best = S.servers.get(S.ranked[0]);
    sub.textContent = best ? `Best now: ${best.country} · ${fmtPing(best.ping)}` : "Finding the fastest route";
    $("#ping").textContent = "—"; $("#ping").className = "";
    $("#proto").textContent = "—";
    return;
  }
  if (flag.dataset.id !== srv.id) { flag.innerHTML = flagHTML(srv); flag.dataset.id = srv.id; }
  swapText(country, srv.country);
  if (srv.kind === "direct") sub.textContent = "Game traffic goes straight to Roblox";
  else if (!live || !sub.dataset.city) sub.textContent = srv.kind === "warp" ? "Cloudflare network · nearest edge"
    : srv.source === "custom" ? `${srv.name} · your server` : `${srv.name} · ${srv.ip}`;
  $("#ping").textContent = fmtPing(srv.ping);
  $("#ping").className = pingClass(srv.ping);
  $("#proto").textContent = protoName(srv);
}

function resetTraffic() {
  S.hist.down.fill(0); S.hist.up.fill(0);
  $("#locSub").dataset.city = "";
  tweenNum($("#down"), 0, (v) => fmtRate(v)[0]);
  tweenNum($("#up"), 0, (v) => fmtRate(v)[0]);
  $("#downU").textContent = $("#upU").textContent = "Kbps";
  drawSpark();
}

/* ================= server list ================= */
const PROVIDER = { warp: "Cloudflare", riseup: "Riseup", vpngate: "VPN Gate", custom: "Your server" };
const CHEV = `<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>`;
const ARROW = `<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;
S.open = new Set();

const isOn = (s) => (S.current ? S.current.id === s.id : S.selected === s.id);
const pill = (p) => `<span class="pill ${pingClass(p)}"><i></i>${fmtPing(p)}</span>`;
const city = (s) => s.source === "riseup" ? s.name.split(" · ")[0] : "";
function tags(s) {
  const t = [s.kind === "warp" ? "WARP" : s.proto.toUpperCase()];
  if (s.kind === "warp") t.push("Unlimited");
  if (s.source !== "custom") t.push("Free");
  return t.map((x) => `<span class="tag">${x}</span>`).join("");
}
function groupKey(s) {
  return s.source === "warp" ? "warp" : s.source === "custom" ? `mine-${s.id}` : `${s.source}-${s.cc || s.country}`;
}

function heroHTML(s) {
  const auto = !S.selected && !S.current;
  return `<button class="hero-card ${isOn(s) ? "active" : ""}" data-id="${s.id}" style="--i:0">
    <span class="hero-label">${auto ? "Best for you · picked automatically" : "Best for you"}</span>
    <span class="hero-main">
      <span class="flag big">${flagHTML(s)}</span>
      <span class="mid"><b>${s.kind === "warp" ? "Cloudflare WARP" : s.country}</b><small>${PROVIDER[s.source] || ""}</small></span>
      <span class="hero-ping ${pingClass(s.ping)}"><b>${s.ping == null ? "—" : Math.round(s.ping)}</b><small>ms</small></span>
    </span>
    <span class="hero-foot"><span class="tags">${tags(s)}</span><span class="go">${isOn(s) ? CHECK : ARROW}</span></span>
  </button>`;
}

function groupHTML(g, idx) {
  const first = g.items[0], single = g.items.length === 1;
  const open = S.open.has(g.key) && !single;
  const active = g.items.some(isOn);
  const cities = [...new Set(g.items.map(city).filter(Boolean))].join(", ");
  const sub = [PROVIDER[first.source], cities, single ? "" : `${g.items.length} servers`].filter(Boolean).join(" · ");
  const head = `<button class="grp-head" ${single ? `data-id="${first.id}"` : `data-g="${g.key}"`}>
      <span class="flag">${flagHTML(first)}</span>
      <span class="mid"><b>${g.title}</b><small>${sub}</small></span>
      ${pill(first.ping)}
      ${first.source === "custom" ? `<span class="del" data-del="${first.id}" title="Remove"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></span>` : `<span class="chev ${single ? "solo" : ""}">${single && isOn(first) ? CHECK : CHEV}</span>`}
    </button>`;
  const rows = single ? "" : g.items.map((s) => `<button class="srv ${isOn(s) ? "active" : ""}" data-id="${s.id}">
      <span class="mid"><b>${s.source === "riseup" ? s.name : s.name}</b><small>${s.proto.toUpperCase()}${s.source === "vpngate" ? ` · ${s.sessions} online` : ""}</small></span>
      ${pill(s.ping)}
    </button>`).join("");
  return `<div class="grp ${open ? "open" : ""} ${active ? "active" : ""}" style="--i:${idx + 2}">${head}
    ${single ? "" : `<div class="grp-body"><div class="grp-inner">${rows}</div></div>`}</div>`;
}

function renderList() {
  if (!document.body.classList.contains("sheet-open")) return;
  const list = $("#list");
  const q = $("#search").value.trim().toLowerCase();
  if (!S.ranked.length) {
    const total = S.servers.size;
    list.innerHTML = (total ? `<div class="section-label">Testing ${S.probed} of ${total} servers…</div>` : "") + '<div class="skeleton"></div>'.repeat(5);
    $("#srvCount").textContent = "Finding the fastest servers";
    return;
  }
  const ranked = S.ranked.map((id) => S.servers.get(id)).filter(Boolean);
  const match = (s) => !q || [s.country, s.name, PROVIDER[s.source] || "", s.cc || ""].some((x) => x.toLowerCase().includes(q));
  const groups = new Map();
  for (const s of ranked.filter(match)) {
    const k = groupKey(s);
    if (!groups.has(k)) groups.set(k, { key: k, title: s.kind === "warp" ? "Cloudflare WARP" : s.country, items: [] });
    groups.get(k).items.push(s);
  }
  const auto = !S.selected && !S.current;
  let html = "";
  if (!q) {
    html += heroHTML(ranked[0]);
    html += `<button class="auto-pill ${auto ? "on" : ""}" data-auto="1" style="--i:1">
      <span class="dot-check">${auto ? CHECK : ""}</span>Automatic — always the fastest for ${S.mode === "gaming" ? "gaming" : "speed"}</button>`;
  }
  html += `<div class="section-label">Networks</div>`;
  // a one-server network that is already the hero card would just repeat it
  const shown = [...groups.values()].filter((g) => q || !(g.items.length === 1 && g.items[0].id === ranked[0].id));
  html += shown.map(groupHTML).join("");
  if (!groups.size) html += `<div class="empty">Nothing matches “${q}”</div>`;
  html += `<div class="credit">Pulsar VPN · by Damir Loboda</div>`;
  list.innerHTML = html;
  // the cascade plays when the sheet opens; later refreshes (pings, connect) swap in place
  clearTimeout(renderList.t);
  renderList.t = setTimeout(() => list.classList.add("settled"), 900);
  $("#srvCount").textContent = `${ranked.length} online · all under 150 ms`;
}
function openSheet() { $("#list").classList.remove("settled"); document.body.classList.add("sheet-open"); renderList(); }
function closeSheet() { document.body.classList.remove("sheet-open"); }

async function pickServer(id) {
  S.selected = id;
  closeSheet();
  if (S.state !== "idle") await api().disconnect();
  showServer();
  api().connect(id);
}

/* ================= events from Python ================= */
window.__pulsar = (ev) => {
  switch (ev.type) {
    case "state": setState(ev.state, ev.msg, ev); break;
    case "progress": if (S.state === "connecting") swapText($("#statusSub"), ev.msg); break;
    case "scan_start": S.probed = 0; S.ranked = []; $("#rescan").classList.add("spin"); renderList(); break;
    case "scan_list": S.servers = new Map(ev.servers.map((s) => [s.id, s])); renderList(); break;
    case "probe": {
      const s = S.servers.get(ev.id);
      S.probed++;
      if (s) s.ping = ev.ping;
      if (S.state === "scanning") $("#statusSub").textContent = `Pinged ${S.probed} of ${S.servers.size} servers`;
      if (S.probed % 8 === 0) renderList();
      break;
    }
    case "ranked":
      for (const s of ev.servers) S.servers.set(s.id, s);
      S.ranked = ev.servers.map((s) => s.id);
      $("#rescan").classList.remove("spin");
      renderList();
      if (S.state === "idle") showServer();
      break;
    case "scan_error": $("#rescan").classList.remove("spin"); toast(ev.msg, "bad"); break;
    case "ip":
      $("#ip").textContent = ev.ip || "—";
      if (S.state === "connected" && ev.city && S.current && S.current.kind !== "direct") {
        $("#locSub").textContent = `${ev.city}, ${ev.country}${ev.isp ? " · " + ev.isp : ""}`;
        $("#locSub").dataset.city = "1";
      }
      break;
    case "stats": {
      S.hist.down.push(ev.down); S.hist.down.shift();
      S.hist.up.push(ev.up); S.hist.up.shift();
      tweenNum($("#down"), ev.down, (v) => fmtRate(v)[0]); $("#downU").textContent = fmtRate(ev.down)[1];
      tweenNum($("#up"), ev.up, (v) => fmtRate(v)[0]); $("#upU").textContent = fmtRate(ev.up)[1];
      drawSpark();
      if (ev.ping != null) { const p = $("#ping"); p.textContent = fmtPing(ev.ping); p.className = pingClass(ev.ping); }
      break;
    }
    case "reveal": intro(); break;
    case "speedtest": onSpeedTest(ev); break;
    case "health": {
      const lost = ev.status === "lan-lost";
      document.body.classList.toggle("lan-lost", lost);
      $("#chipText").textContent = lost ? "Wi-Fi lost" : (CHIP[S.state] || S.state);
      if (lost) toast("Your Wi-Fi dropped · Pulsar reconnects by itself when it's back", "bad");
      else if (S.state === "connected") toast("Back online", "ok");
      break;
    }
    case "engine_missing": showEngineModal(ev.kind); break;
    case "engine_installed":
      $("#engProg").classList.add("hidden");
      $("#engInstall").disabled = false;
      if (ev.ok) {
        $("#engineModal").classList.add("hidden");
        hideBanner();
        toast("Engine installed", "ok");
        api().connect(S.selected);
      } else {
        $("#engText").innerHTML = `Automatic install failed (${ev.msg || "unknown"}). Download it manually, then reopen Pulsar.`;
        $("#engInstall").textContent = "Open download page";
        $("#engInstall").dataset.manual = "1";
      }
      break;
  }
};

/* ================= line speed test ================= */
function startSpeedTest() {
  const card = $(".card.traffic");
  if (card.classList.contains("testing") || !window.pywebview) return;
  clearTimeout(startSpeedTest.t);
  card.classList.remove("done");
  card.classList.add("testing");
  $("#stLabel").textContent = "Line speed";
  $("#stSub").textContent = "Finding the nearest test server…";
  $("#stBar").style.transform = "scaleX(0)";
  tweenNum($("#stNum"), 0, (v) => v.toFixed(1));
  api().speed_test();
}
function onSpeedTest(ev) {
  const card = $(".card.traffic");
  if (ev.phase === "start") {
    $("#stSub").textContent = `${ev.server} · ${ev.ping} ms`;
  } else if (ev.phase === "progress") {
    tweenNum($("#stNum"), ev.mbps, (v) => v.toFixed(1));
    $("#stBar").style.transform = `scaleX(${ev.progress})`;
  } else if (ev.phase === "done") {
    card.classList.add("done");
    tweenNum($("#stNum"), ev.mbps, (v) => v.toFixed(1));
    $("#stBar").style.transform = "scaleX(1)";
    $("#stLabel").textContent = "Your line's maximum";
    $("#stSub").textContent = `${ev.via === "Direct" ? "Direct" : "Through " + ev.via} · ${ev.server} · ${ev.ping} ms`;
    $("#speedBtnText").textContent = `Max ${ev.mbps} Mbps`;
    $("#speedBtn").classList.add("has-result");
    startSpeedTest.t = setTimeout(() => card.classList.remove("testing", "done"), 5000);
  } else if (ev.phase === "error") {
    card.classList.remove("testing", "done");
    toast(`Speed test failed: ${ev.msg}`, "bad");
  }
}

/* ================= engine modal & banner ================= */
let engineKind = "openvpn";
function showEngineModal(kind) {
  engineKind = kind;
  const name = kind === "wireguard" ? "WireGuard" : "OpenVPN";
  $("#engText").innerHTML = kind === "warp"
    ? `The fastest free route near you runs on <b>Cloudflare WARP</b>. Pulsar installs Cloudflare's official app once and drives it for you. By installing you accept Cloudflare's WARP terms.`
    : `Pulsar uses the open-source <b>${name}</b> engine to build the encrypted tunnel. Install it once and you're set.`;
  $("#engInstall").textContent = "Install engine";
  delete $("#engInstall").dataset.manual;
  $("#engineModal").classList.remove("hidden");
}
function showBanner(html) { const b = $("#banner"); b.innerHTML = html; b.classList.remove("hidden"); }
function hideBanner() { $("#banner").classList.add("hidden"); }

/* ================= wiring ================= */
function idleHint() {
  return "Finds the fastest server for you";
}
// opening animation: on launch and every time the window comes back from the taskbar
function intro() {
  Liquid.hold(1400);
  replay(document.body, "intro");
  clearTimeout(intro.t);
  intro.t = setTimeout(() => document.body.classList.remove("intro"), 1800);
}
function setMode(m, animate) {
  S.mode = m;
  $("#mode").dataset.mode = m;
  for (const b of document.querySelectorAll("#mode button")) b.classList.toggle("on", b.dataset.mode === m);
  if (animate) replay($("#thumb"), "squish");
  if (S.state === "idle") { swapText($("#statusSub"), idleHint()); showServer(); }
}

function wire() {
  $("#orb").onclick = () => {
    replay($("#orb"), "squish");
    if (!window.pywebview) return;
    if (S.state === "idle") {
      if (!S.admin) return toast("Run Pulsar as administrator to connect", "bad");
      api().connect(S.selected);
    } else if (S.state !== "disconnecting") {
      api().disconnect();
    }
  };
  for (const b of document.querySelectorAll("#mode button")) {
    b.onclick = () => {
      if (S.mode === b.dataset.mode) return;
      setMode(b.dataset.mode, true);
      if (window.pywebview) api().set_mode(b.dataset.mode);
    };
  }
  $("#speedBtn").onclick = startSpeedTest;
  $("#openServers").onclick = openSheet;
  $("#scrim").onclick = closeSheet;
  $("#search").oninput = renderList;
  $("#rescan").onclick = () => api().scan();
  $("#importBtn").onclick = async () => {
    const r = await api().import_config();
    if (r && r.error) toast(r.error, "bad");
    else if (r && r.imported) toast(`Added ${r.imported.join(", ")}`, "ok");
  };
  $("#list").onclick = (e) => {
    const del = e.target.closest("[data-del]");
    if (del) { e.stopPropagation(); api().remove_config(del.dataset.del); return; }
    if (e.target.closest("[data-auto]")) return pickServer(null);
    const g = e.target.closest("[data-g]");
    if (g) {
      // toggle in place (no re-render) so the accordion slides open smoothly
      const key = g.dataset.g, box = g.parentElement;
      S.open.has(key) ? S.open.delete(key) : S.open.add(key);
      box.classList.toggle("open", S.open.has(key));
      return;
    }
    const row = e.target.closest("[data-id]");
    if (row) pickServer(row.dataset.id);
  };
  $("#engCancel").onclick = () => $("#engineModal").classList.add("hidden");
  $("#engInstall").onclick = () => {
    if ($("#engInstall").dataset.manual) {
      api().open_url({ wireguard: "https://www.wireguard.com/install/", warp: "https://one.one.one.one/" }[engineKind]
        || "https://openvpn.net/community-downloads/");
      return;
    }
    $("#engInstall").disabled = true;
    $("#engText").innerHTML = "Installing… this takes about a minute.";
    $("#engProg").classList.remove("hidden");
    api().install_engine(engineKind);
  };
  $("#banner").addEventListener("click", (e) => { if (e.target.closest("button")) showEngineModal("openvpn"); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
}

function bootUI() {
  wire();
  setMode(S.mode);
  showServer();
  drawSpark();
  document.querySelectorAll(".lensed").forEach(applyLens);
  intro();
}

let bridged = false;
async function bootBridge() {
  if (bridged || !window.pywebview || !window.pywebview.api) return;
  bridged = true;
  const info = await api().init();
  S.admin = info.admin;
  setMode(info.mode);
  if (!info.admin) showBanner(`<span>Not running as administrator — connecting needs admin rights.</span>`);
  else if (!info.engines.openvpn) showBanner(`<span>VPN engine not installed yet.</span><button>Install</button>`);
  api().my_ip();
  api().scan(); // warm up: by the time you tap, the best server is already known
}

bootUI();
window.addEventListener("pywebviewready", bootBridge);
bootBridge();
