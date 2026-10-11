// GOONCAT ($GOONCAT) site script. Plain browser JS, no build step, no dependencies.
// @ts-check
(function () {
  "use strict";

  const SITE_URL = "https://gooncat.si-md.xyz/";
  const LOGO_SRC = "assets/img/logo.jpg";
  const REFRESH_MS = 30000;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** @param {string} sel @param {ParentNode} [root] @returns {HTMLElement[]} */
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  /** @param {string} sel @param {ParentNode} [root] @returns {HTMLElement | null} */
  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ---------- Toast ---------- */
  const toast = $("[data-toast]");
  let toastTimer = 0;
  /** @param {string} msg */
  function showToast(msg) {
    if (!toast || !toast.firstElementChild) return;
    toast.firstElementChild.textContent = msg;
    toast.dataset.show = "true";
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.dataset.show = "false"; }, 2200);
  }

  /** @param {string} text @returns {Promise<boolean>} */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (_e) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /* ---------- Nav ---------- */
  const menuToggle = $("[data-menu-toggle]");
  const menu = $("[data-menu]");
  if (menuToggle && menu) {
    const setOpen = (/** @type {boolean} */ open) => {
      menu.dataset.open = String(open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.textContent = open ? "Close" : "Menu";
    };
    menuToggle.addEventListener("click", () => setOpen(menu.dataset.open !== "true"));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.dataset.open === "true") { setOpen(false); menuToggle.focus(); }
    });
  }

  /* ---------- Scroll reveals ---------- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Magnetic buttons ---------- */
  if (!reduceMotion.matches && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".magnetic").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform = `translate(${(dx * 8).toFixed(1)}px, ${(dy * 8).toFixed(1)}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- Confetti ---------- */
  const confettiLayer = $("[data-confetti-layer]");
  const CONFETTI_COLORS = ["#ffe066", "#ff4d9d", "#b4ff3c", "#fff6e5"];
  /** @param {number} x @param {number} y */
  function burst(x, y) {
    if (!confettiLayer || reduceMotion.matches) return;
    const n = 28;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const d = 80 + Math.random() * 160;
      p.style.setProperty("--x", `${x}px`);
      p.style.setProperty("--y", `${y}px`);
      p.style.setProperty("--dx", `${Math.cos(a) * d}px`);
      p.style.setProperty("--dy", `${Math.sin(a) * d + 120}px`);
      p.style.setProperty("--c", CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      confettiLayer.appendChild(p);
      p.addEventListener("animationend", () => p.remove(), { once: true });
    }
  }
  $$("[data-confetti]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2);
      void e;
    });
  });

  /* ---------- Draggable logo sticker ---------- */
  const sticker = $("[data-drag-sticker]");
  if (sticker) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    sticker.addEventListener("pointerdown", (e) => {
      dragging = true;
      sticker.classList.add("dragging");
      sticker.setPointerCapture(e.pointerId);
      sx = e.clientX - ox; sy = e.clientY - oy;
    });
    sticker.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      ox = e.clientX - sx; oy = e.clientY - sy;
      sticker.style.transform = `translate(${ox}px, ${oy}px) rotate(${(ox / 20).toFixed(1)}deg)`;
    });
    const stop = () => { dragging = false; sticker.classList.remove("dragging"); };
    sticker.addEventListener("pointerup", stop);
    sticker.addEventListener("pointercancel", stop);
    sticker.addEventListener("dblclick", () => { ox = 0; oy = 0; sticker.style.transform = ""; });
  }

  /* ---------- How to buy tabs ---------- */
  const tabs = $$("[role=tab]");
  const panels = $$("[role=tabpanel]");
  /** @param {number} i @param {boolean} focus */
  function selectTab(i, focus) {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (panels[k]) panels[k].hidden = !on;
    });
    if (focus && tabs[i]) tabs[i].focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(i, false));
    t.addEventListener("keydown", (e) => {
      const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      const d = /** @type {Record<string, number>} */ (map)[e.key];
      if (d === undefined && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      let n = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + d + tabs.length) % tabs.length;
      selectTab(n, true);
    });
  });
  $$("[data-step-next]").forEach((b) => b.addEventListener("click", () => {
    const cur = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    selectTab(Math.min(cur + 1, tabs.length - 1), true);
  }));
  $$("[data-step-prev]").forEach((b) => b.addEventListener("click", () => {
    const cur = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    selectTab(Math.max(cur - 1, 0), true);
  }));

  /* ---------- Copy buttons ---------- */
  $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const ok = await copyText(b.dataset.copy || "");
    showToast(ok ? "Copied to clipboard" : "Unable to copy. Select the text and copy it manually.");
  }));
  $$("[data-copy-link]").forEach((b) => b.addEventListener("click", async () => {
    const ok = await copyText(SITE_URL);
    showToast(ok ? "Site link copied" : "Unable to copy. The link is gooncat.si-md.xyz");
  }));

  /* ---------- Live data ---------- */
  /** @typedef {{name?: string, symbol?: string, token?: string|null, chainName?: string, coinUrl?: string, chartUrl?: string, status?: string, logo?: string, market?: {marketCap?: number|string|null, priceUsd?: number|string|null, volume24h?: number|string|null}}} CoinData */
  /** @type {CoinData} */
  let coin = {};
  /** @type {Record<string, number>} */
  const shown = {};

  /** @param {number} n @param {"usd"|"price"} fmt */
  function fmtNumber(n, fmt) {
    if (!Number.isFinite(n)) return "launching…";
    if (fmt === "price") {
      if (n === 0) return "$0";
      if (n < 0.0001) return "$" + n.toExponential(2);
      if (n < 1) return "$" + n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
      return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }
    const abs = Math.abs(n);
    if (abs >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  /** @param {HTMLElement} el @param {number} to @param {"usd"|"price"} fmt */
  function animateNumber(el, to, fmt) {
    const key = el.dataset.stat || "";
    const from = shown[key];
    shown[key] = to;
    if (reduceMotion.matches || from === undefined || from === to) { el.textContent = fmtNumber(to, fmt); return; }
    const t0 = performance.now();
    const dur = 900;
    const step = (/** @type {number} */ t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtNumber(from + (to - from) * e, fmt);
      if (p < 1) requestAnimationFrame(step); else { el.textContent = fmtNumber(to, fmt); el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 450); }
    };
    requestAnimationFrame(step);
  }

  /** @param {unknown} v @returns {number} */
  const num = (v) => { const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : NaN; };

  function render() {
    const m = coin.market || {};
    $$("[data-stat]").forEach((el) => {
      const key = /** @type {"marketCap"|"priceUsd"|"volume24h"} */ (el.dataset.stat);
      const fmt = /** @type {"usd"|"price"} */ (el.dataset.format || "usd");
      const v = num(m[key]);
      if (Number.isFinite(v)) animateNumber(el, v, fmt); else el.textContent = "launching…";
    });
    const token = typeof coin.token === "string" && /^0x[0-9a-fA-F]{40}$/.test(coin.token) ? coin.token : "";
    $$("[data-contract]").forEach((el) => { el.textContent = token || "launching…"; });
    $$("[data-copy-contract]").forEach((b) => {
      b.setAttribute("aria-disabled", token ? "false" : "true");
      b.dataset.copy = token;
    });
    $$("[data-buy-link]").forEach((a) => {
      if (coin.coinUrl) { a.setAttribute("href", coin.coinUrl); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
    });
    $$("[data-chart-link]").forEach((a) => {
      if (coin.chartUrl) { a.setAttribute("href", coin.chartUrl); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
    });
    const st = $("[data-status]"); if (st) st.textContent = coin.status || "launching…";
    const ch = $("[data-chain]"); if (ch) ch.textContent = coin.chainName || "Ethereum";
    if (coin.logo && typeof coin.logo === "string") {
      $$("[data-logo]").forEach((img) => { if (img.getAttribute("src") !== coin.logo) img.setAttribute("src", /** @type {string} */ (coin.logo)); });
      $$("[data-logo-svg]").forEach((im) => im.setAttribute("href", /** @type {string} */ (coin.logo)));
    }
    renderBillboard();
  }

  $$("[data-copy-contract]").forEach((b) => b.addEventListener("click", async () => {
    const addr = b.dataset.copy || "";
    if (!addr) { showToast("The contract address appears here after launch."); return; }
    const ok = await copyText(addr);
    showToast(ok ? "Contract address copied" : "Unable to copy. Select the address and copy it manually.");
  }));

  async function refresh() {
    try {
      const res = await fetch("/simd-coin.json", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (data && typeof data === "object") coin = data;
      const upd = $("[data-stats-updated]");
      if (upd) upd.textContent = "Updated " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      const upd = $("[data-stats-updated]");
      if (upd) upd.textContent = "Live data not available yet";
    }
    render();
  }
  refresh();
  window.setInterval(refresh, REFRESH_MS);

  /* ---------- Donut ---------- */
  const donut = $("[data-donut]");
  if (donut) {
    const circ = 2 * Math.PI * 90;
    const run = () => $$("[data-seg]", donut).forEach((seg) => {
      const pct = parseFloat(seg.dataset.seg || "0") / 100;
      seg.setAttribute("stroke-dasharray", `${(circ * pct).toFixed(2)} ${(circ * (1 - pct)).toFixed(2)}`);
    });
    if ("IntersectionObserver" in window && !reduceMotion.matches) {
      const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { run(); io.disconnect(); } }, { threshold: 0.3 });
      io.observe(donut);
    } else run();
  }

  /* ---------- Meme compositions (SVG, built from the logo) ---------- */
  const FONT = "Bungee, Impact, 'Arial Black', sans-serif";
  /** @param {string} s */
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
  /** @param {string} t @param {number} y @param {number} size @param {string} [fill] */
  const memeText = (t, y, size, fill) => t ? `<text x="200" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${size}" fill="${fill || "#fff6e5"}" stroke="#120d0b" stroke-width="${Math.max(3, size / 7)}" paint-order="stroke" style="text-transform:uppercase">${esc(t)}</text>` : "";
  /** @param {number} x @param {number} y @param {number} s @param {number} r @param {string} [extra] */
  const logoImg = (x, y, s, r, extra) => `<image href="${LOGO_SRC}" x="${x}" y="${y}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round ${r})" ${extra || ""} data-logo-svg/>`;

  /** @type {{id: string, name: string, draw: (top: string, bottom: string) => string, top?: string, bottom?: string}[]} */
  const TEMPLATES = [
    { id: "classic", name: "Classic", top: "gm", bottom: "going back to sleep", draw: (t, b) => `
      <rect width="400" height="400" fill="#1a1310"/>
      <rect x="20" y="20" width="360" height="360" rx="40" fill="#ffe066" stroke="#120d0b" stroke-width="6"/>
      ${logoImg(60, 60, 280, 60, 'stroke="#120d0b"')}
      <rect x="60" y="60" width="280" height="280" rx="60" fill="none" stroke="#120d0b" stroke-width="6"/>
      ${memeText(t, 56, 34)}${memeText(b, 384, 34)}` },
    { id: "chart", name: "Chart", top: "chart went up", bottom: "cat did not notice", draw: (t, b) => `
      <rect width="400" height="400" fill="#120d0b"/>
      <path d="M20 330 L80 290 L130 310 L200 220 L250 250 L320 130 L380 90" fill="none" stroke="#b4ff3c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20 330 L80 290 L130 310 L200 220 L250 250 L320 130 L380 90 L380 400 L20 400Z" fill="#b4ff3c" opacity="0.15"/>
      ${logoImg(230, 200, 150, 40)}
      ${memeText(t, 60, 34)}${memeText(b, 380, 34)}` },
    { id: "stamp", name: "Stamp", top: "certified", bottom: "sleepy", draw: (t, b) => `
      <rect width="400" height="400" fill="#ff4d9d"/>
      <circle cx="200" cy="200" r="160" fill="#fff6e5" stroke="#120d0b" stroke-width="8"/>
      <circle cx="200" cy="200" r="130" fill="none" stroke="#120d0b" stroke-width="4" stroke-dasharray="12 10"/>
      ${logoImg(110, 110, 180, 90)}
      <circle cx="200" cy="200" r="90" fill="none" stroke="#120d0b" stroke-width="6"/>
      ${memeText(t, 70, 36, "#ffe066")}${memeText(b, 370, 36, "#ffe066")}` },
    { id: "halftone", name: "Halftone", top: "wake me", bottom: "at 1b mcap", draw: (t, b) => `
      <rect width="400" height="400" fill="#b4ff3c"/>
      <pattern id="dots-placeholder" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="3" fill="#120d0b"/></pattern>
      <rect width="400" height="400" fill="url(#dots-placeholder)"/>
      <g transform="rotate(-8 200 200)">
        <rect x="70" y="70" width="260" height="260" rx="30" fill="#ffe066" stroke="#120d0b" stroke-width="8"/>
        ${logoImg(90, 90, 220, 20)}
      </g>
      ${memeText(t, 60, 40)}${memeText(b, 380, 40)}` },
    { id: "neon", name: "Neon", top: "gooncat city", bottom: "open all night", draw: (t, b) => `
      <rect width="400" height="400" fill="#0a0612"/>
      <g stroke="#ff4d9d" stroke-width="2" opacity="0.6">${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 50}" y1="240" x2="${200 + (i * 50 - 200) * 3}" y2="400"/>`).join("")}</g>
      <g stroke="#b4ff3c" stroke-width="2" opacity="0.6"><line x1="0" y1="260" x2="400" y2="260"/><line x1="0" y1="300" x2="400" y2="300"/><line x1="0" y1="360" x2="400" y2="360"/></g>
      <rect x="110" y="70" width="180" height="180" rx="40" fill="none" stroke="#ff4d9d" stroke-width="10" filter="url(#glow-placeholder)"/>
      ${logoImg(120, 80, 160, 36)}
      ${memeText(t, 56, 36, "#b4ff3c")}${memeText(b, 384, 36, "#ff4d9d")}` },
    { id: "wanted", name: "Wanted", top: "wanted", bottom: "for excessive napping", draw: (t, b) => `
      <rect width="400" height="400" fill="#fff6e5"/>
      <rect x="24" y="24" width="352" height="352" fill="none" stroke="#120d0b" stroke-width="8"/>
      <rect x="40" y="40" width="320" height="320" fill="none" stroke="#120d0b" stroke-width="3" stroke-dasharray="8 6"/>
      ${logoImg(100, 90, 200, 12, 'stroke="#120d0b"')}
      <rect x="100" y="90" width="200" height="200" fill="none" stroke="#120d0b" stroke-width="6"/>
      ${memeText(t, 78, 44, "#ff4d9d")}${memeText(b, 345, 24, "#120d0b")}` },
    { id: "sticker", name: "Sticker", top: "zzz", bottom: "$gooncat", draw: (t, b) => `
      <rect width="400" height="400" fill="#3b2d26"/>
      <path d="M200 30 l40 50 60-20 10 62 60 20-35 52 35 52-60 20-10 62-60-20-40 50-40-50-60 20-10-62-60-20 35-52-35-52 60-20 10-62 60 20z" fill="#ffe066" stroke="#120d0b" stroke-width="8" stroke-linejoin="round"/>
      ${logoImg(120, 120, 160, 80)}
      ${memeText(t, 60, 40, "#b4ff3c")}${memeText(b, 380, 32, "#ff4d9d")}` },
    { id: "speech", name: "Speech", top: "sell?", bottom: "no, sleep", draw: (t, b) => `
      <rect width="400" height="400" fill="#ff4d9d"/>
      ${logoImg(20, 150, 230, 50)}
      <path d="M240 60 h130 a16 16 0 0 1 16 16 v110 a16 16 0 0 1 -16 16 h-70 l-40 40 v-40 h-20 a16 16 0 0 1 -16 -16 v-110 a16 16 0 0 1 16 -16z" fill="#fff6e5" stroke="#120d0b" stroke-width="6" stroke-linejoin="round"/>
      <text x="305" y="120" text-anchor="middle" font-family="${FONT}" font-size="26" fill="#120d0b">${esc(t)}</text>
      <text x="305" y="160" text-anchor="middle" font-family="${FONT}" font-size="22" fill="#ff4d9d">${esc(b)}</text>` },
  ];

  /** @param {string} id @param {string} top @param {string} bottom */
  function renderMeme(id, top, bottom) {
    const tpl = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
    const uid = "p" + Math.random().toString(36).slice(2, 8);
    let body = tpl.draw(top, bottom).replace(/dots-[a-z0-9]+/g, "dots-" + uid).replace(/dots-placeholder/g, "dots-" + uid).replace(/glow-placeholder/g, "glow-" + uid);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 400" width="400" height="400">
      <defs><filter id="glow-${uid}"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${body}</svg>`;
  }

  /** @type {string | null} */
  let logoDataUrl = null;
  async function getLogoDataUrl() {
    if (logoDataUrl) return logoDataUrl;
    const src = (coin.logo && typeof coin.logo === "string") ? coin.logo : LOGO_SRC;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || 122; c.height = img.naturalHeight || 122;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0);
    logoDataUrl = c.toDataURL("image/png");
    return logoDataUrl;
  }

  /** Rasterise an SVG string to a PNG and trigger a download. @param {string} svg @param {string} filename */
  async function downloadSvgAsPng(svg, filename) {
    const dataUrl = await getLogoDataUrl();
    const inlined = svg.replace(/href="[^"]*"( [^>]*data-logo-svg)/g, `href="${dataUrl}"$1`);
    const blob = new Blob([inlined], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 1200; c.height = 1200;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(img, 0, 0, 1200, 1200);
      const png = await new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
      if (!png) throw new Error("no png");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(/** @type {Blob} */ (png));
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const wall = $("[data-meme-wall]");
  if (wall) {
    wall.innerHTML = TEMPLATES.map((t, i) => `
      <article class="card meme reveal" style="--delay: ${(i % 4) * 80}ms">
        <figure>
          <div data-meme-svg="${t.id}">${renderMeme(t.id, t.top || "", t.bottom || "")}</div>
          <figcaption><span>${esc(t.name)}</span><button class="btn btn-sm btn-contrast" type="button" data-meme-download="${t.id}" aria-label="Download the ${esc(t.name)} meme as PNG">Download PNG</button></figcaption>
        </figure>
      </article>`).join("");
    $$("[data-meme-download]", wall).forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.memeDownload || "";
      const holder = $(`[data-meme-svg="${id}"]`, wall);
      if (!holder) return;
      try { await downloadSvgAsPng(holder.innerHTML, `gooncat-${id}.png`); showToast("PNG downloaded"); }
      catch (_) { showToast("Unable to export this meme. Try another browser."); }
    }));
    // reveal observer for late-rendered cards
    if ("IntersectionObserver" in window && !reduceMotion.matches) {
      const io2 = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io2.unobserve(en.target); } }), { threshold: 0.1 });
      $$(".reveal", wall).forEach((el) => io2.observe(el));
    } else $$(".reveal", wall).forEach((el) => el.classList.add("in"));
  }

  /* ---------- Meme generator ---------- */
  const tplHolder = $("[data-templates]");
  const preview = $("[data-gen-preview]");
  const topIn = /** @type {HTMLInputElement | null} */ ($("[data-top]"));
  const botIn = /** @type {HTMLInputElement | null} */ ($("[data-bottom]"));
  const genStatus = $("[data-gen-status]");
  let currentTpl = TEMPLATES[0].id;
  const RANDOM_LINES = [
    ["gm", "going back to sleep"], ["red candles", "cat unbothered"], ["bought the dip", "then napped"],
    ["no owner", "no problem"], ["one billion supply", "one billion naps"], ["wen moon", "wen pillow"],
  ];
  function drawPreview() {
    if (!preview) return;
    const top = topIn ? topIn.value : "";
    const bottom = botIn ? botIn.value : "";
    const tpl = TEMPLATES.find((x) => x.id === currentTpl) || TEMPLATES[0];
    preview.innerHTML = renderMeme(currentTpl, top || tpl.top || "", bottom || tpl.bottom || "");
    const svg = preview.firstElementChild;
    if (svg) { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `Meme preview: ${top || tpl.top || ""} / ${bottom || tpl.bottom || ""}`); }
  }
  if (tplHolder) {
    tplHolder.innerHTML = TEMPLATES.map((t) => `<button class="template" type="button" aria-pressed="${t.id === currentTpl}" data-tpl="${t.id}" aria-label="${esc(t.name)} template">${renderMeme(t.id, "", "")}</button>`).join("");
    $$("[data-tpl]", tplHolder).forEach((b) => b.addEventListener("click", () => {
      currentTpl = b.dataset.tpl || TEMPLATES[0].id;
      $$("[data-tpl]", tplHolder).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      drawPreview();
    }));
  }
  if (topIn) topIn.addEventListener("input", drawPreview);
  if (botIn) botIn.addEventListener("input", drawPreview);
  const randomBtn = $("[data-gen-random]");
  if (randomBtn) randomBtn.addEventListener("click", () => {
    const pick = RANDOM_LINES[Math.floor(Math.random() * RANDOM_LINES.length)];
    if (topIn) topIn.value = pick[0];
    if (botIn) botIn.value = pick[1];
    drawPreview();
  });
  const dl = $("[data-gen-download]");
  if (dl) dl.addEventListener("click", async () => {
    if (!preview) return;
    if (genStatus) genStatus.textContent = "Rendering…";
    try {
      await downloadSvgAsPng(preview.innerHTML, `gooncat-meme-${currentTpl}.png`);
      if (genStatus) genStatus.textContent = "PNG downloaded.";
    } catch (_) {
      if (genStatus) genStatus.textContent = "Unable to export. Try another browser.";
    }
  });
  drawPreview();

  /* ---------- GOONCAT City ---------- */
  const city = $("[data-city]");
  const world = $("[data-world]");
  const DISTRICTS = [
    { id: "blanket", name: "Blanket Boulevard", blurb: "Where the cat lives. Soft lights, softer pillows.", color: "#ffe066" },
    { id: "frog", name: "Frog Pond District", blurb: "Little frogs on every corner. They never stop hopping.", color: "#b4ff3c" },
    { id: "pool", name: "Pool Street", blurb: "The IMD liquidity pool glows at the end of the road.", color: "#ff4d9d" },
    { id: "swarm", name: "Swarm Quarter", blurb: "Built by the Identity.md swarm, block by block.", color: "#ff7fb9" },
  ];
  const DEPTH = 2400; // px of street per loop
  const BLOCK = DEPTH / DISTRICTS.length;
  let walk = 0;
  /** @type {Record<string, number>} */
  let votes = {};
  try { votes = JSON.parse(localStorage.getItem("gooncat-votes") || "{}") || {}; } catch (_) { votes = {}; }

  function frogSvg() {
    return `<svg viewBox="0 0 42 34" aria-hidden="true"><ellipse cx="21" cy="22" rx="18" ry="11" fill="currentColor" stroke="#120d0b" stroke-width="2"/><circle cx="12" cy="11" r="6" fill="currentColor" stroke="#120d0b" stroke-width="2"/><circle cx="30" cy="11" r="6" fill="currentColor" stroke="#120d0b" stroke-width="2"/><circle cx="12" cy="11" r="2.5" fill="#120d0b"/><circle cx="30" cy="11" r="2.5" fill="#120d0b"/><path d="M13 25 q8 5 16 0" stroke="#120d0b" stroke-width="2" fill="none"/></svg>`;
  }
  function pawSvg() {
    return `<svg class="paw" viewBox="0 0 70 70" aria-hidden="true"><circle cx="35" cy="42" r="18" fill="currentColor" stroke="#120d0b" stroke-width="4"/><circle cx="16" cy="24" r="8" fill="currentColor" stroke="#120d0b" stroke-width="4"/><circle cx="32" cy="14" r="8" fill="currentColor" stroke="#120d0b" stroke-width="4"/><circle cx="50" cy="18" r="8" fill="currentColor" stroke="#120d0b" stroke-width="4"/><circle cx="60" cy="36" r="7" fill="currentColor" stroke="#120d0b" stroke-width="4"/></svg>`;
  }

  function buildWorld() {
    if (!world) return;
    const parts = [];
    const rnd = (/** @type {number} */ seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };
    for (let i = 0; i < 24; i++) {
      const z = -(i * 100) - 60;
      const side = i % 2 === 0 ? -1 : 1;
      const d = DISTRICTS[Math.floor(((i * 100) % DEPTH) / BLOCK)];
      const w = 70 + Math.floor(rnd(i) * 60);
      const h = 120 + Math.floor(rnd(i + 7) * 180);
      const x = side * (260 + Math.floor(rnd(i + 3) * 120));
      const signs = ["$GOONCAT", "NAP", "GM", "ZZZ", "IMD", "POOL", "SWARM", "FROG"];
      parts.push(`<div class="block" style="transform: translateZ(${z}px) translateX(${x}px)"><div class="bld" style="--w:${w}px;--h:${h}px;--c:${d.color};left:${-w / 2}px"><span class="sign">${signs[i % signs.length]}</span></div></div>`);
      if (i % 3 === 0) parts.push(`<div class="frog" style="left: calc(50% + ${side * (120 + Math.floor(rnd(i + 11) * 90))}px); transform: translateZ(${z + 40}px); --d: ${(rnd(i + 5) * 1.4).toFixed(2)}s; --hop: ${(1.1 + rnd(i + 9) * 0.8).toFixed(2)}s">${frogSvg()}</div>`);
    }
    DISTRICTS.forEach((d, k) => {
      parts.push(`<div class="district" style="transform: translateZ(${-(k * BLOCK) - 20}px) translateY(-200px)"><div class="district-sign" style="--c:${d.color}">${esc(d.name)}</div></div>`);
    });
    parts.push(`<div class="mascot"><img src="${LOGO_SRC}" alt="" width="220" height="220" data-logo>${pawSvg()}</div>`);
    parts.push(`<div class="billboard" data-billboard><div class="t">GOONCAT CITY · LIVE</div><div class="big num" data-bb-mcap>launching…</div><div class="row"><span>Price <strong class="num" data-bb-price>launching…</strong></span><span>24h vol <strong class="num" data-bb-vol>launching…</strong></span></div><div class="feed" data-bb-feed>Trade feed: waiting for the pool to open</div></div>`);
    world.innerHTML = parts.join("");
  }

  function renderBillboard() {
    const m = coin.market || {};
    const mc = $("[data-bb-mcap]"); if (mc) mc.textContent = Number.isFinite(num(m.marketCap)) ? "MCAP " + fmtNumber(num(m.marketCap), "usd") : "launching…";
    const pr = $("[data-bb-price]"); if (pr) pr.textContent = fmtNumber(num(m.priceUsd), "price");
    const vo = $("[data-bb-vol]"); if (vo) vo.textContent = fmtNumber(num(m.volume24h), "usd");
    const fe = $("[data-bb-feed]");
    if (fe) fe.textContent = coin.status && coin.status !== "launching" && Number.isFinite(num(m.volume24h)) ? `Trading live on ${coin.chainName || "Ethereum"} · ${coin.status}` : "Trade feed: waiting for the pool to open";
  }

  function applyWalk() {
    if (!city) return;
    const z = ((walk % DEPTH) + DEPTH) % DEPTH;
    city.style.setProperty("--walk-z", `${z}px`);
    city.style.setProperty("--walk-bg", `${z}px`);
    const idx = Math.floor(z / BLOCK) % DISTRICTS.length;
    const pos = $("[data-city-pos]");
    if (pos) pos.textContent = `Block ${idx + 1} · ${DISTRICTS[idx].name}`;
  }
  /** @param {number} dir */
  function step(dir) { walk += dir * 60; applyWalk(); }

  function renderDistricts() {
    const holder = $("[data-districts]");
    if (!holder) return;
    const max = Math.max(0, ...DISTRICTS.map((d) => votes[d.id] || 0));
    holder.innerHTML = DISTRICTS.map((d) => `
      <article class="card district-card" data-leader="${max > 0 && (votes[d.id] || 0) === max}">
        <h3 style="color:${d.color}">${esc(d.name)}</h3>
        <p>${esc(d.blurb)}</p>
        <p class="tally num">${(votes[d.id] || 0) === 1 ? "1 vote" : `${votes[d.id] || 0} votes`}</p>
        <button class="btn btn-sm btn-ghost" type="button" data-vote="${d.id}" aria-label="Vote for ${esc(d.name)}">Vote</button>
      </article>`).join("");
    $$("[data-vote]", holder).forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.vote || "";
      votes[id] = (votes[id] || 0) + 1;
      try { localStorage.setItem("gooncat-votes", JSON.stringify(votes)); } catch (_) { /* private mode */ }
      renderDistricts();
      const again = $(`[data-vote="${id}"]`, holder);
      if (again) again.focus();
      showToast("Vote counted in this browser");
    }));
  }

  if (city && world) {
    buildWorld();
    renderDistricts();
    applyWalk();
    $$("[data-walk]").forEach((b) => b.addEventListener("click", () => step(parseInt(b.dataset.walk || "1", 10))));
    city.addEventListener("keydown", (e) => {
      if (["ArrowRight", "ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); step(1); }
      else if (["ArrowLeft", "ArrowDown", "s", "S"].includes(e.key)) { e.preventDefault(); step(-1); }
    });
    let dragX = 0, dragStart = 0, isDrag = false;
    city.addEventListener("pointerdown", (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest("button")) return;
      isDrag = true; dragX = e.clientX; dragStart = walk; city.setPointerCapture(e.pointerId);
    });
    city.addEventListener("pointermove", (e) => { if (!isDrag) return; walk = dragStart + (e.clientX - dragX) * 2; applyWalk(); });
    const end = () => { isDrag = false; };
    city.addEventListener("pointerup", end);
    city.addEventListener("pointercancel", end);
    // Ambient walk while visible (opt-in motion)
    if (!reduceMotion.matches && "IntersectionObserver" in window) {
      let visible = false;
      let last = 0;
      const io3 = new IntersectionObserver((en) => { visible = en.some((x) => x.isIntersecting); }, { threshold: 0.2 });
      io3.observe(city);
      const tick = (/** @type {number} */ t) => {
        if (visible && !isDrag && document.visibilityState === "visible") {
          if (last) walk += (t - last) * 0.02;
          applyWalk();
        }
        last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  /* ---------- Vibe meter ---------- */
  const vibeBtn = $("[data-vibe-btn]");
  const vibeMeter = $("[data-vibe-meter]");
  const vibeCount = $("[data-vibe-count]");
  const vibeLabel = $("[data-vibe-label]");
  let pets = 0;
  try { pets = parseInt(localStorage.getItem("gooncat-pets") || "0", 10) || 0; } catch (_) { pets = 0; }
  function renderVibe() {
    const pct = Math.min(100, 4 + Math.round(100 * (1 - Math.exp(-pets / 25))));
    if (vibeMeter) {
      vibeMeter.style.setProperty("--vibe", pct + "%");
      vibeMeter.setAttribute("aria-valuenow", String(pct));
    }
    if (vibeCount) vibeCount.textContent = String(pets);
    if (vibeLabel) vibeLabel.textContent = pct < 25 ? "warming up" : pct < 55 ? "purring" : pct < 85 ? "fully gooned" : "maximum goon";
  }
  if (vibeBtn) vibeBtn.addEventListener("click", () => {
    pets += 1;
    try { localStorage.setItem("gooncat-pets", String(pets)); } catch (_) { /* ignore */ }
    renderVibe();
    if (pets % 10 === 0) { const r = vibeBtn.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); }
  });
  renderVibe();

  /* ---------- Share ---------- */
  const SHARE_TEXTS = [
    "GOONCAT is the sleepiest cat on Ethereum. One billion $GOONCAT, no owner, no minting. Stay tucked in.",
    "No owner. No admin. No minting after launch. $GOONCAT just naps on top of a Uniswap v4 pool paired with IMD.",
    "There is a rainy neon cat city on the $GOONCAT site and the frogs never stop hopping. Walk it:",
  ];
  $$("[data-share]").forEach((a) => {
    const i = parseInt(a.dataset.share || "0", 10);
    const url = new URL("https://x.com/intent/post");
    url.searchParams.set("text", SHARE_TEXTS[i] || SHARE_TEXTS[0]);
    url.searchParams.set("url", SITE_URL);
    a.setAttribute("href", url.toString());
  });

  /* ---------- Marquee: duplicate track for a seamless loop ---------- */
  const marquee = $("[data-marquee]");
  if (marquee) marquee.innerHTML += marquee.innerHTML;

  // Expose a tiny debug hook for validation scripts (not used by the page itself).
  /** @type {any} */ (window).__gooncat = { refresh, render, setCoin: (/** @type {CoinData} */ c) => { coin = c; render(); }, TEMPLATES };
})();
