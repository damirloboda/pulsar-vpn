"use strict";
/* Website demo: stands in for the Python side of Pulsar so the real interface runs in a
   browser. It only simulates — nothing here connects anywhere. */
(() => {
  const emit = (ev) => window.__pulsar && window.__pulsar(ev);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SERVERS = [
    { id: "cf-warp", name: "Cloudflare WARP", ip: "162.159.192.1", port: 2408, proto: "udp", kind: "warp", source: "warp", country: "Cloudflare WARP", cc: "", speed_mbps: 1000, sessions: 0, ping: 24 },
    { id: "ru-vpn14-par", name: "Paris · vpn14-par", ip: "51.159.196.108", port: 1194, proto: "udp", kind: "openvpn", source: "riseup", country: "France", cc: "fr", speed_mbps: 300, sessions: 0, ping: 69 },
    { id: "ru-vpn20-par", name: "Paris · vpn20-par", ip: "51.159.198.167", port: 1194, proto: "udp", kind: "openvpn", source: "riseup", country: "France", cc: "fr", speed_mbps: 300, sessions: 0, ping: 72 },
    { id: "ru-vpn04-ams", name: "Amsterdam · vpn04-ams", ip: "51.15.9.205", port: 1194, proto: "udp", kind: "openvpn", source: "riseup", country: "Netherlands", cc: "nl", speed_mbps: 300, sessions: 0, ping: 84 },
    { id: "vg-public-vpn-1", name: "public-vpn-1", ip: "150.40.105.16", port: 1194, proto: "udp", kind: "openvpn", source: "vpngate", country: "Croatia", cc: "hr", speed_mbps: 207, sessions: 12, ping: 90 },
  ];
  let statsTimer = null, current = null;

  async function connect(id) {
    const srv = SERVERS.find((s) => s.id === id) || SERVERS[0];
    current = srv;
    emit({ type: "state", state: "connecting", msg: `Locking onto ${srv.country}…`, server: srv, attempt: 1 });
    await wait(1700);
    if (current !== srv) return;
    emit({ type: "state", state: "connected", msg: "", server: srv, since: Date.now() / 1000 });
    emit({ type: "ip", ip: "104.28.216.172", country: "", cc: "", city: "", isp: "" });
    let t = 0;
    clearInterval(statsTimer);
    statsTimer = setInterval(() => {
      t++;
      const burst = Math.sin(t / 4) > 0.6 ? 6e5 + Math.random() * 4e5 : 2e4 + Math.random() * 6e4;
      emit({ type: "stats", down: burst, up: burst * 0.18, rx: 0, tx: 0, ping: t % 2 ? null : srv.ping + Math.round(Math.random() * 6) });
    }, 1000);
  }

  window.pywebview = {
    api: {
      init: async () => ({ admin: true, engines: { openvpn: true, wireguard: false, warp: true }, mode: "gaming" }),
      my_ip: () => emit({ type: "ip", ip: "Hidden in demo", country: "", cc: "", city: "", isp: "" }),
      scan: async () => {
        emit({ type: "scan_start" });
        emit({ type: "scan_list", servers: SERVERS.map((s) => ({ ...s, ping: null })) });
        for (const s of SERVERS) { await wait(120); emit({ type: "probe", id: s.id, ping: s.ping }); }
        emit({ type: "ranked", servers: SERVERS });
      },
      connect: (id) => { connect(id); },
      disconnect: async () => {
        current = null;
        clearInterval(statsTimer);
        emit({ type: "state", state: "disconnecting", msg: "" });
        await wait(500);
        emit({ type: "state", state: "idle", msg: "Disconnected" });
      },
      set_mode: () => emit({ type: "ranked", servers: SERVERS }),
      speed_test: async () => {
        emit({ type: "speedtest", phase: "start", server: "Demo test server", ping: 18 });
        for (let i = 1; i <= 32; i++) {
          await wait(250);
          emit({ type: "speedtest", phase: "progress", mbps: +(40 + Math.random() * 12).toFixed(1), progress: i / 32 });
        }
        emit({ type: "speedtest", phase: "done", mbps: 46.8, ping: 18, server: "Demo test server", via: current ? current.country : "Direct" });
      },
      import_config: async () => null,
      remove_config: () => {},
      install_engine: () => {},
      open_url: () => {},
    },
  };
})();
