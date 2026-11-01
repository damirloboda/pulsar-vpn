// The hero laptop as a real 3D object: brushed-metal body lit by a studio environment, a
// backlit keyboard, a glass trackpad and a glossy screen. Scroll opens the lid while the camera
// swings round to the front; the screen shows Pulsar VPN going from exposed to protected; then
// the camera flies into the screen. main.js publishes the scroll progress as window.__p1.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.getElementById("gl");
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (p, a, b) => clamp((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const settle = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const lerp = (a, b, t) => a + (b - a) * t;
const DEG = Math.PI / 180;

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
// a flat slab with big rounded corners and softly bevelled edges, lying on y = 0..t
function slab(w, d, t, r, bevel) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - 2 * bevel, d - 2 * bevel, r), {
    depth: t - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 24,
  });
  g.rotateX(-Math.PI / 2); g.translate(0, bevel, 0); g.computeVertexNormals();
  return g;
}
// a flat shape lying on the top of a surface (normal +y)
function flat(w, d, r) { const g = new THREE.ShapeGeometry(roundedRect(w, d, r), 12); g.rotateX(-Math.PI / 2); return g; }
function radialTexture(stops, size = 256) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function start() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (_) { canvas.remove(); return; }
  document.body.classList.add("gl3d");
  renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // ---------- materials ----------
  // anodised space-grey aluminium: satin, with the studio's reflections kept soft so it reads as metal, not white plastic
  const alu = new THREE.MeshPhysicalMaterial({ color: 0x6f727a, metalness: 1, roughness: 0.42, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.62 });
  const aluDark = new THREE.MeshPhysicalMaterial({ color: 0x55575e, metalness: 1, roughness: 0.42 });
  const well = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.8 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x131315, roughness: 0.5, metalness: 0.2 });
  const glassBlack = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 });
  const pad = new THREE.MeshPhysicalMaterial({ color: 0x5d6068, metalness: 0.6, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.6 });

  // ---------- the laptop (≈ a 15" machine, units are decimetres) ----------
  const W = 3.2, D = 2.2, T = 0.085, LT = 0.045, LD = 2.12;
  const laptop = new THREE.Group(); scene.add(laptop);
  laptop.add(new THREE.Mesh(slab(W, D, T, 0.17, 0.022), alu));
  const top = T + 0.0008;

  // keyboard: a dark well, a light under the keys, and the keys themselves
  const kbW = 2.52, kbD = 0.98, kbZ = -0.4;
  const kWell = new THREE.Mesh(flat(kbW + 0.06, kbD + 0.06, 0.06), well); kWell.position.set(0, top, kbZ); laptop.add(kWell);
  const backlight = new THREE.Mesh(flat(kbW, kbD, 0.05), new THREE.MeshBasicMaterial({ color: 0x8e7dff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  backlight.position.set(0, top + 0.0012, kbZ); laptop.add(backlight);
  const rows = [
    { u: Array(14).fill(1), h: 0.7 }, { u: [...Array(13).fill(1), 1.5] }, { u: [1.5, ...Array(12).fill(1), 1.5] },
    { u: [1.8, ...Array(11).fill(1), 2.25] }, { u: [2.25, ...Array(10).fill(1), 2.25] }, { u: [1, 1, 1, 6, 1, 1, 1, 1] },
  ];
  const gap = 0.03, rowUnits = rows.reduce((s, r) => s + (r.h || 1), 0), unitH = (kbD - gap * (rows.length + 1)) / rowUnits;
  const keyGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.22);
  const nKeys = rows.reduce((s, r) => s + r.u.length, 0);
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, nKeys);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let zCur = kbZ - kbD / 2 + gap, idx = 0;
  for (const r of rows) {
    const h = unitH * (r.h || 1), total = r.u.reduce((a, b) => a + b, 0), unitW = (kbW - gap * (r.u.length + 1)) / total;
    let xCur = -kbW / 2 + gap;
    for (const u of r.u) {
      const w = unitW * u;
      m4.compose(v.set(xCur + w / 2, top + 0.016, zCur + h / 2), q, sc.set(w, 0.026, h));
      keys.setMatrixAt(idx++, m4);
      xCur += w + gap;
    }
    zCur += h + gap;
  }
  laptop.add(keys);

  // speaker grilles either side of the keyboard
  const grilleTex = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#000"; for (let y = 4; y < 256; y += 8) for (let x = 4; x < 64; x += 8) { g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); }
    return new THREE.CanvasTexture(c);
  })();
  for (const sx of [-1, 1]) {
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(0.22, kbD).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: grilleTex, transparent: true, opacity: 0.85, depthWrite: false }));
    gm.position.set(sx * 1.42, top + 0.0006, kbZ); laptop.add(gm);
  }
  const trackpad = new THREE.Mesh(flat(1.3, 0.8, 0.07), pad); trackpad.position.set(0, top + 0.0006, 0.6); laptop.add(trackpad);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 24).rotateZ(Math.PI / 2), aluDark);
  hinge.position.set(0, T + 0.01, -D / 2 + 0.05); laptop.add(hinge);

  // the lid hangs on a pivot at the hinge; closed it lies on the deck, its screen facing down
  const pivot = new THREE.Group(); pivot.position.set(0, T + 0.004, -D / 2 + 0.05); laptop.add(pivot);
  const lid = new THREE.Group(); lid.position.z = LD / 2 - 0.03; pivot.add(lid);
  lid.add(new THREE.Mesh(slab(W, LD, LT, 0.17, 0.014), alu));
  const bezel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W - 0.034, LD - 0.034, 0.15), 12).rotateX(Math.PI / 2), glassBlack);
  bezel.position.y = -0.0015; lid.add(bezel);

  // the display: the VPN screen is drawn into a canvas each time it changes
  const ui = document.createElement("canvas"); ui.width = 1100; ui.height = 666;
  const uiTex = new THREE.CanvasTexture(ui); uiTex.colorSpace = THREE.SRGBColorSpace; uiTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const dispW = 2.96, dispH = dispW / 1.6517;
  const dispMat = new THREE.MeshBasicMaterial({ map: uiTex, toneMapped: false, color: 0x000000 });
  const display = new THREE.Mesh(new THREE.PlaneGeometry(dispW, dispH).rotateX(Math.PI / 2), dispMat);
  display.position.set(0, -0.003, 0.07); lid.add(display);
  // a faint glass sheen over the display
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(dispW, dispH).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.18, roughness: 0.04, metalness: 0, clearcoat: 1 }));
  sheen.position.set(0, -0.0036, 0.07); lid.add(sheen);
  const screenLight = new THREE.PointLight(0x8e7dff, 0, 5, 2); screenLight.position.set(0, -0.5, 0.2); lid.add(screenLight);

  // the logo on the back of the lid
  const logoImg = new Image(); logoImg.src = "icon.svg";
  const logoCanvas = document.createElement("canvas"); logoCanvas.width = logoCanvas.height = 512;
  const logoTex = new THREE.CanvasTexture(logoCanvas); logoTex.colorSpace = THREE.SRGBColorSpace;
  logoImg.onload = () => { logoCanvas.getContext("2d").drawImage(logoImg, 0, 0, 512, 512); logoTex.needsUpdate = true; draw(true); };
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false }));
  logo.position.set(0, LT + 0.0015, 0); lid.add(logo);

  // contact shadow and the screen's light on the desk
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: radialTexture([[0, "rgba(0,0,0,.85)"], [0.45, "rgba(0,0,0,.5)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false }));
  shadow.position.y = -0.002; laptop.add(shadow);
  const deskGlow = new THREE.Mesh(new THREE.PlaneGeometry(7, 5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: radialTexture([[0, "rgba(255,255,255,1)"], [0.5, "rgba(255,255,255,.25)"], [1, "rgba(255,255,255,0)"]]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  deskGlow.position.set(0, -0.001, -0.6); laptop.add(deskGlow);

  // studio light: a soft key from the front, cool rims from behind so the outline reads on black
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(3, 6, 6); scene.add(key);
  const rimL = new THREE.DirectionalLight(0x9d8cff, 2.4); rimL.position.set(-6, 3, -6); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0x5cb8ff, 1.8); rimR.position.set(6, 2.5, -6); scene.add(rimR);

  // ---------- the VPN screen ----------
  const g2 = ui.getContext("2d");
  const toXY = (x, y) => [330 + (x - 150) * 1.62, 372 + (y - 150) * 1.62];
  const CITIES = [[196, 108], [214, 128], [176, 96], [232, 164], [98, 118], [250, 122]];
  const SLOW = new Set([3, 5]);
  const RACE = [["Warsaw", "26 ms"], ["Amsterdam", "31 ms"], ["Tokyo", "240 ms — too slow"], ["Prague", "34 ms"], ["Frankfurt", "18 ms"]];
  const COL = { off: "#ff5d6c", scan: "#ffb547", on: "#3ef0b0" };
  let drawn = "";
  function pill(x, y, w, h, r) { g2.beginPath(); g2.roundRect(x, y, w, h, r); }
  function draw(force, state = "off", scanT = 0, arcT = 0, t = 0) {
    const sig = `${state}|${(scanT * 50) | 0}|${(arcT * 80) | 0}|${state === "scan" ? (t * 6) | 0 : 0}`;
    if (!force && sig === drawn) return;
    drawn = sig;
    const c = g2, col = COL[state];
    // background with two soft blobs
    let gr = c.createLinearGradient(0, 0, 1100, 666); gr.addColorStop(0, "#1c1352"); gr.addColorStop(0.6, "#0c0a28"); gr.addColorStop(1, "#070716");
    c.fillStyle = gr; c.fillRect(0, 0, 1100, 666);
    const blob = (x, y, r, color) => { const b = c.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, color); b.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = b; c.fillRect(0, 0, 1100, 666); };
    blob(160, 40, 420, "rgba(106,77,255,.55)");
    blob(1000, 640, 480, state === "on" ? "rgba(31,211,154,.42)" : "rgba(255,93,154,.32)");
    // top bar
    if (logoImg.complete) c.drawImage(logoImg, 34, 22, 30, 30);
    c.fillStyle = "#fff"; c.font = "600 22px Inter, sans-serif"; c.fillText("Pulsar VPN", 76, 45);
    c.font = "600 15px Inter, sans-serif"; const mw = c.measureText("Gaming mode").width + 30;
    pill(1100 - 40 - mw, 20, mw, 34, 17); c.fillStyle = "rgba(255,255,255,.1)"; c.fill(); c.strokeStyle = "rgba(255,255,255,.16)"; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = "#d8d8e0"; c.fillText("Gaming mode", 1100 - 40 - mw + 15, 42);
    // globe
    const [gx, gy] = toXY(150, 150), R = 122 * 1.62;
    gr = c.createRadialGradient(gx - 70, gy - 80, 10, gx, gy, R); gr.addColorStop(0, "#3b2f9a"); gr.addColorStop(0.6, "#191347"); gr.addColorStop(1, "#0b0a24");
    c.fillStyle = gr; c.beginPath(); c.arc(gx, gy, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(170,160,255,.24)"; c.lineWidth = 1.6;
    for (const rx of [R, R * 0.72, R * 0.38]) { c.beginPath(); c.ellipse(gx, gy, rx, R, 0, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(gx, gy - R); c.lineTo(gx, gy + R); c.stroke();
    c.beginPath(); c.ellipse(gx, gy, R, R * 0.28, 0, 0, Math.PI * 2); c.stroke();
    for (const dy of [-0.44, 0.44]) { c.beginPath(); c.ellipse(gx, gy + R * dy, R * 0.85, R * 0.18, 0, 0, Math.PI * 2); c.stroke(); }
    // cities
    const lit = state === "scan" ? ((t * 6) | 0) % CITIES.length : -1;
    CITIES.forEach(([x, y], i) => {
      const [px, py] = toXY(x, y);
      c.fillStyle = i === lit ? "#ffb547" : state === "on" ? (SLOW.has(i) ? "rgba(255,93,108,.6)" : "rgba(255,255,255,.2)") : "rgba(255,255,255,.4)";
      if (i === lit) { c.shadowColor = "#ffb547"; c.shadowBlur = 18; }
      c.beginPath(); c.arc(px, py, i === 0 ? 7 : 6, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    });
    // the route, drawn as far as it has got
    const [ax, ay] = toXY(112, 176), [cx, cy] = toXY(140, 70), [bx, by] = toXY(196, 108);
    if (arcT > 0) {
      c.save(); c.lineWidth = 5; c.lineCap = "round"; c.shadowColor = "#3ef0b0"; c.shadowBlur = 16;
      const lg = c.createLinearGradient(ax, ay, bx, by); lg.addColorStop(0, "#fff"); lg.addColorStop(1, "#3ef0b0"); c.strokeStyle = lg;
      c.beginPath(); c.moveTo(ax, ay);
      for (let s = 1; s <= 40; s++) { const u = (s / 40) * arcT, w = 1 - u; c.lineTo(w * w * ax + 2 * w * u * cx + u * u * bx, w * w * ay + 2 * w * u * cy + u * u * by); }
      c.stroke(); c.restore();
    }
    c.fillStyle = "rgba(255,255,255,.25)"; c.beginPath(); c.arc(ax, ay, 16, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(ax, ay, 9, 0, Math.PI * 2); c.fill();
    c.font = "600 19px Inter, sans-serif"; c.textAlign = "center"; c.fillStyle = "#e4e4ee"; c.fillText("You", ax, ay + 40);
    if (state === "on") {
      c.shadowColor = "#3ef0b0"; c.shadowBlur = 22; c.fillStyle = "#3ef0b0"; c.beginPath(); c.arc(bx, by, 11, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
      c.fillText("Frankfurt", bx, by - 26);
    }
    c.textAlign = "left";
    // status panel
    const X = 640;
    c.font = "700 15px Inter, sans-serif"; c.letterSpacing = "2px";
    const stTxt = state === "off" ? "NOT PROTECTED" : state === "scan" ? "CONNECTING" : "PROTECTED";
    const sw = c.measureText(stTxt).width + 52;
    pill(X, 168, sw, 36, 18); c.fillStyle = "rgba(0,0,0,.28)"; c.fill(); c.strokeStyle = col + "88"; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 12; c.beginPath(); c.arc(X + 20, 186, 6, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    c.fillText(stTxt, X + 36, 192); c.letterSpacing = "0px";
    c.fillStyle = "#fff"; c.font = "700 46px Inter, sans-serif";
    const title = state === "off" ? ["Your IP is visible"] : state === "scan" ? ["Finding the fastest", "server"] : ["You’re protected"];
    title.forEach((l, i) => c.fillText(l, X, 262 + i * 52));
    const rowsY = state === "scan" ? 352 : 302;
    const [city, ms] = state === "scan" ? RACE[Math.min(RACE.length - 1, Math.floor(scanT * RACE.length))] : state === "on" ? ["Frankfurt", "18 ms"] : ["—", "—"];
    const ROWS = [["Your IP", state === "on" ? "Hidden" : "203.0.113.42", state === "on" ? "#3ef0b0" : "#ff5d6c"], ["Server", city, "#fff"], ["Ping", ms, "#fff"]];
    c.strokeStyle = "rgba(255,255,255,.1)"; c.lineWidth = 1.5;
    ROWS.forEach(([k, val, vc], i) => {
      const y = rowsY + i * 50;
      c.beginPath(); c.moveTo(X, y); c.lineTo(1060, y); c.stroke();
      c.font = "500 20px Inter, sans-serif"; c.fillStyle = "#a5a5b4"; c.fillText(k, X, y + 33);
      c.font = "600 20px Inter, sans-serif"; c.fillStyle = vc; c.textAlign = "right"; c.fillText(val, 1060, y + 33); c.textAlign = "left";
    });
    // the button
    const by2 = rowsY + 176, btxt = state === "off" ? "Tap to connect" : state === "scan" ? "Connecting…" : "Connected";
    c.font = "700 21px Inter, sans-serif"; const bw = c.measureText(btxt).width + 92;
    pill(X, by2, bw, 58, 29);
    if (state === "off") { c.fillStyle = "#fff"; c.fill(); }
    else if (state === "scan") { c.fillStyle = "rgba(255,181,71,.14)"; c.fill(); c.strokeStyle = "#ffb547"; c.lineWidth = 2; c.stroke(); }
    else { c.shadowColor = "#3ef0b0"; c.shadowBlur = 34; c.fillStyle = "#3ef0b0"; c.fill(); c.shadowBlur = 0; }
    const ink = state === "off" ? "#1b1250" : state === "scan" ? "#ffb547" : "#04261a";
    c.strokeStyle = ink; c.lineWidth = 3.2; c.lineCap = "round";
    const ix = X + 34, iy = by2 + 29;
    if (state === "scan") { c.beginPath(); c.arc(ix, iy, 10, t * 7, t * 7 + 4.6); c.stroke(); }
    else { c.beginPath(); c.arc(ix, iy + 1, 10, -Math.PI / 2 + 0.62, Math.PI * 1.5 - 0.62); c.stroke(); c.beginPath(); c.moveTo(ix, iy - 12); c.lineTo(ix, iy); c.stroke(); }
    c.fillStyle = ink; c.fillText(btxt, X + 60, by2 + 37);
    uiTex.needsUpdate = true;
  }

  // ---------- camera ----------
  const tgt = new THREE.Vector3(), pos = new THREE.Vector3(), tmp = new THREE.Vector3(), nrm = new THREE.Vector3();
  function orbit(target, az, el, dist) {
    return new THREE.Vector3(target.x + dist * Math.cos(el * DEG) * Math.sin(az * DEG), target.y + dist * Math.sin(el * DEG), target.z + dist * Math.cos(el * DEG) * Math.cos(az * DEG));
  }
  let W2 = 1, H2 = 1;
  function resize() {
    W2 = canvas.clientWidth; H2 = canvas.clientHeight;
    renderer.setSize(W2, H2, false); camera.aspect = W2 / H2; camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize); resize();

  const violet = new THREE.Color(0x8e7dff), green = new THREE.Color(0x3ef0b0), glowCol = new THREE.Color();
  let first = true;
  function frame(now) {
    requestAnimationFrame(frame);
    const host = canvas.parentElement.getBoundingClientRect();
    if (host.bottom < 0 || host.top > innerHeight) return;
    const p = window.__p1 || 0, t = now / 1000, aspect = camera.aspect;

    const o = range(p, 0.02, 0.24), open = settle(o), zoom = smooth(range(p, 0.8, 0.98));
    // it starts half open with the screen already lit, so the first frame shows light, not a closed slab
    pivot.rotation.x = -lerp(64, 106, open) * DEG;
    const on = lerp(0.88 + 0.08 * Math.sin(t * 1.6), 1, smooth(range(p, 0, 0.2))), gmix = smooth(range(p, 0.56, 0.62));
    glowCol.copy(violet).lerp(green, gmix);
    dispMat.color.setScalar(on);
    backlight.material.color.copy(glowCol); backlight.material.opacity = on * 0.85;
    deskGlow.material.color.copy(glowCol); deskGlow.material.opacity = on * 0.4;
    screenLight.color.copy(glowCol); screenLight.intensity = on * 6;
    const state = p < 0.4 ? "off" : p < 0.58 ? "scan" : "on";
    draw(false, state, range(p, 0.4, 0.56), smooth(range(p, 0.44, 0.58)), t);

    // where the camera is: closed (high, from the side) → open (front) → in front of the screen
    const fitW = aspect < 1.25 ? 4.6 / (2 * Math.tan(15 * DEG) * aspect) : 0;   // keep it all in view on narrow screens
    const sw = smooth(range(p, 0, 0.26));
    const closedT = new THREE.Vector3(0, 0.5, -0.25), openT = new THREE.Vector3(0, 0.82, -0.42);
    tgt.lerpVectors(closedT, openT, sw);
    // before you scroll the camera hangs low at three-quarters and drifts, so the shot is alive
    const idle = 1 - sw;
    const az = lerp(aspect < 1 ? -16 : -34, 0, sw) + Math.sin(t * 0.45) * (aspect < 1 ? 3 : 5) * idle, el = lerp(17, 12, sw) + Math.sin(t * 0.33) * 2 * idle;
    const dist = Math.max(lerp(10.2, 8.6, sw), fitW);
    pos.copy(orbit(tgt, az, el, dist));
    if (zoom > 0) {
      laptop.updateMatrixWorld(true);
      display.getWorldPosition(tmp);
      nrm.set(0, -1, 0).applyQuaternion(display.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const dh = (dispH / 2) / Math.tan(15 * DEG), dw = (dispW / 2) / (Math.tan(15 * DEG) * aspect);
      const d = (aspect < 1 ? dw : Math.min(dh, dw)) * 0.98;
      pos.lerp(tmp.clone().addScaledVector(nrm, d), zoom);
      tgt.lerp(tmp, zoom);
    }
    camera.position.copy(pos); camera.lookAt(tgt);
    // leave room for the words above it (less as we fly in)
    const shift = -H2 * lerp(aspect < 1 ? lerp(0.13, 0.07, sw) : lerp(0.2, 0.09, sw), 0, zoom);   // below the title at first
    camera.setViewOffset(W2, H2, 0, shift, W2, H2);

    renderer.render(scene, camera);
    if (first) { first = false; canvas.classList.add("on"); }
  }
  (document.fonts ? document.fonts.load("700 46px Inter") : Promise.resolve()).finally(() => { draw(true); requestAnimationFrame(frame); });
}

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) start();
