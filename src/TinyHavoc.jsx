import React, { useEffect, useRef, useState } from 'react';
import undoRaw from '../icons/undo.svg?raw';
import resetRaw from '../icons/reset.svg?raw';
import cursorRaw from '../icons/cursor-hand.svg?raw';
import heartRaw from '../icons/heart.svg?raw';

/* ============================================================
   Tiny Havoc — a tiny world you grow, then take apart.
   Single-component cellular automata sandbox.
   Grid: 200×150 @ 4px cells → 800×600 canvas (4:3; on mobile the display is
   stretched a little taller for more room).
   ============================================================ */

// inline icon markup (strips the xml prolog, themes via currentColor, sizes it)
const prepIcon = (raw, w, h) => raw
  .replace(/<\?xml[^>]*\?>/, '')
  .replace('<svg', `<svg fill="currentColor" width="${w}" height="${h}"`);
const UNDO_SVG = prepIcon(undoRaw, 17, 15);
const RESET_SVG = prepIcon(resetRaw, 14, 17);
// keep the heart's own pixel colours (red/white/black)
const HEART_SVG = heartRaw.replace(/<\?xml[^>]*\?>/, '').replace('<svg', '<svg width="17" height="16"');
const speakerSvg = (on) => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="currentColor" stroke="none"/>${on ? '<path d="M16.5 8.8a3.6 3.6 0 0 1 0 6.4"/><path d="M19 6.2a7 7 0 0 1 0 11.6"/>' : '<path d="M17 9.5 21.5 14.5M21.5 9.5 17 14.5"/>'}</svg>`;
const SPEAKER_ON = speakerSvg(true);
const SPEAKER_OFF = speakerSvg(false);
const SHARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/></svg>`;
// the Tiny Havoc emblem: a little sprout (build) with one ember spark (havoc), pixel-style
const TH_EMBLEM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="42" height="42" shape-rendering="crispEdges"><rect width="16" height="16" rx="3" fill="#172012"/><rect x="3" y="12" width="10" height="2" fill="#6b4a2b"/><rect x="7" y="6" width="2" height="6" fill="#7fae4e"/><rect x="4" y="8" width="3" height="2" fill="#a3bd6b"/><rect x="9" y="6" width="3" height="2" fill="#a3bd6b"/><rect x="11" y="3" width="2" height="2" fill="#ff5224"/></svg>`;

// the pointing pixel-hand cursor (points down-left); hotspot pinned at the
// fingertip, which sits at the bottom-left of the artwork (~6%,95% of the box)
const HAND_ART = cursorRaw.replace(/<\?xml[^>]*\?>/, '').replace('<svg', '<svg width="28" height="31"');
const HAND_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(HAND_ART)}") 2 29, pointer`;
// same hand as a ghost sprite the onboarding drifts across the canvas
const GHOST_HAND = `data:image/svg+xml,${encodeURIComponent(HAND_ART)}`;

const W = 200;
const H = 150;

/* cell types */
const E = 0, SOIL = 1, SAND = 2, STONE = 3, WATER = 4, PLANT = 5, MOSS = 6,
      FUNGUS = 7, FLOWER = 8, FIRE = 9, WIND = 10, LAVA = 11, ICE = 12,
      ASH = 13, FROZEN = 14, BOLT = 15, WOOD = 16, MITE = 17, VINE = 18,
      LEAF = 19;
// plant organism states. PSTEM reuses the original PLANT id (structural stem).
const PSEED = 20, PTIP = 21, PLEAF = 22, PMATURE = 23, PSTEM = PLANT;
const FBASE = 24; // flower clump root — pushes up a new flowering stalk when watered
const NTYPES = 25;

/* palette tools that are not cell types */
const LIGHTNING_TOOL = 99;
const ICESTORM_TOOL = 98;

const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const VARIANTS = {
  [SOIL]:   ['#6b4423', '#5e3b1e', '#7a5030', '#604020'],
  [SAND]:   ['#c8a96e', '#d4b87e', '#bfa060', '#cbb478'],
  [STONE]:  ['#7a7d7f', '#6e7173', '#868a8c', '#747779'],
  [WATER]:  ['#3a7bd5', '#2e6fc9', '#4685df', '#3271cb'],
  [PLANT]:  ['#2d6a2d', '#3d8a3d', '#2d6a2d', '#3d8a3d'], // stem: primary / highlight
  [PSEED]:  ['#2d6a2d', '#2d6a2d', '#2d6a2d', '#2d6a2d'],
  [PTIP]:   ['#5ec05e', '#5ec05e', '#5ec05e', '#5ec05e'],
  [PLEAF]:  ['#4ea84e', '#4ea84e', '#4ea84e', '#4ea84e'],
  [PMATURE]:['#2d6a2d', '#2d6a2d', '#2d6a2d', '#2d6a2d'],
  [MOSS]:   ['#5a9a5e', '#4e8e52', '#66a66a', '#528a56'],
  [FUNGUS]: ['#d4c870', '#c8bc64', '#e0d47c', '#ccbf5c'],
  [FLOWER]: ['#e85d75', '#f2d65c', '#9b6ad6', '#5c9fe0'], // pink, yellow, purple, blue
  [FIRE]:   ['#ff4500', '#ff6b00', '#ff3300', '#ff5500'],
  [WIND]:   ['#8ecae6', '#9ed4ec', '#7ec0e0', '#aedcf0'],
  [LAVA]:   ['#e01830', '#cf1020', '#d81428', '#e62038'],
  [ICE]:    ['#a8d8ea', '#b8e8fa', '#d0e8f0', '#c0d8e8'],
  [ASH]:    ['#4a4a48', '#565651', '#403f3d', '#5e5e58'],
  [FROZEN]: ['#9cc8d8', '#8cb8cc', '#acd4e2', '#94c0d2'],
  [BOLT]:   ['#ffffff', '#ffd60a', '#fff6c0', '#ffffff'],
  [WOOD]:   ['#9c6b30', '#8a5d28', '#a87838', '#946426'],
  [MITE]:   ['#8a4030', '#7a3326', '#9a4c38', '#84392a'],
  [VINE]:   ['#3e8e4e', '#348044', '#489a58', '#2e7a3e'],
  [LEAF]:   ['#62b05a', '#56a650', '#6fbc66', '#4e9a48'],
  [FBASE]:  ['#2e7a3e', '#348044', '#2e7a3e', '#3a8a48'],
};

const COL = new Uint8Array(NTYPES * 4 * 3);
for (const t in VARIANTS) {
  VARIANTS[t].forEach((h, v) => {
    const [r, g, b] = hx(h);
    const o = (+t * 4 + v) * 3;
    COL[o] = r; COL[o + 1] = g; COL[o + 2] = b;
  });
}

// top-lit foliage ramp (shadow → highlight) — gives plants a leafy, volumetric
// bush look instead of flat green wires
const FOL_HEX = ['#22451c', '#2f5d26', '#447d33', '#62a043', '#8ec457'];
const FOL = new Uint8Array(FOL_HEX.length * 3);
FOL_HEX.forEach((h, k) => { const [r, g, b] = hx(h); FOL[k * 3] = r; FOL[k * 3 + 1] = g; FOL[k * 3 + 2] = b; });

// blossom palette: 6 petal colours + a pale center (index 6) — flowers store
// their colour index in aux and are drawn straight from this ramp
const FLOWER_HEX = ['#ea6a86', '#b06ee2', '#f2d85e', '#f0a444', '#6aa6e6', '#e85b5b', '#f7eecb'];
const FLOWER_COL = new Uint8Array(FLOWER_HEX.length * 3);
FLOWER_HEX.forEach((h, k) => { const [r, g, b] = hx(h); FLOWER_COL[k * 3] = r; FLOWER_COL[k * 3 + 1] = g; FLOWER_COL[k * 3 + 2] = b; });
const FLOWER_PETALS = FLOWER_HEX.length - 1; // 6
const FLOWER_CENTER = FLOWER_HEX.length - 1; // index 6

const BG_BUILD = hx('#0d130b');   // calm cool-green night
const BG_DESTROY = hx('#0e0608'); // deeper, scorched, oppressive
// faint "sky" lift added to the air near the top of the canvas (cool dusk in
// Build, hot ember in Destroy) — gives the empty space depth without touching physics
const SKY_BUILD = [11, 17, 22];
const SKY_DESTROY = [34, 12, 7];

const FLAMMABLE = new Uint8Array(NTYPES);
FLAMMABLE[PLANT] = FLAMMABLE[MOSS] = FLAMMABLE[FUNGUS] = FLAMMABLE[FLOWER] = 1;
FLAMMABLE[WOOD] = FLAMMABLE[VINE] = FLAMMABLE[MITE] = FLAMMABLE[LEAF] = 1;
FLAMMABLE[PSEED] = FLAMMABLE[PTIP] = FLAMMABLE[PLEAF] = FLAMMABLE[PMATURE] = 1;
FLAMMABLE[FBASE] = 1;

// every plant state, for destroy interactions and growth-collision checks
const ISPLANT = new Uint8Array(NTYPES);
ISPLANT[PSEED] = ISPLANT[PSTEM] = ISPLANT[PTIP] = ISPLANT[PLEAF] = ISPLANT[PMATURE] = 1;

const DX4 = [0, 0, -1, 1], DY4 = [-1, 1, 0, 0];
const DX8 = [-1, 0, 1, -1, 1, -1, 0, 1], DY8 = [-1, -1, -1, 0, 0, 1, 1, 1];

/* ---------------- simulation state ---------------- */

function makeSim() {
  const n = W * H;
  return {
    grid: new Uint8Array(n),
    meta: new Uint8Array(n),   // per-type counter: fire life, lava heat, plant energy, bolt fade…
    aux: new Uint8Array(n),    // per-type extra: wind direction, flower color, fungus heading
    wet: new Uint8Array(n),    // soil moisture
    frost: new Uint8Array(n),  // ice-storm spread energy / frost coating
    moved: new Uint8Array(n),
    frame: 0,
  };
}

function clearSim(s) {
  s.grid.fill(0); s.meta.fill(0); s.aux.fill(0); s.wet.fill(0); s.frost.fill(0);
}

function mv(s, i, j) {
  s.grid[j] = s.grid[i]; s.meta[j] = s.meta[i]; s.aux[j] = s.aux[i];
  s.wet[j] = s.wet[i]; s.frost[j] = s.frost[i];
  s.grid[i] = E; s.meta[i] = 0; s.aux[i] = 0; s.wet[i] = 0; s.frost[i] = 0;
  s.moved[j] = 1;
}

function swap(s, i, j) {
  const g = s.grid[j], m = s.meta[j], a = s.aux[j], w = s.wet[j], f = s.frost[j];
  s.grid[j] = s.grid[i]; s.meta[j] = s.meta[i]; s.aux[j] = s.aux[i]; s.wet[j] = s.wet[i]; s.frost[j] = s.frost[i];
  s.grid[i] = g; s.meta[i] = m; s.aux[i] = a; s.wet[i] = w; s.frost[i] = f;
  s.moved[i] = 1; s.moved[j] = 1;
}

function setCell(s, i, t) {
  s.grid[i] = t; s.meta[i] = 0; s.aux[i] = 0; s.wet[i] = 0; s.frost[i] = 0;
}

function nearSurface(s, x, y, incSand) {
  const g = s.grid;
  for (let k = 0; k < 8; k++) {
    const nx = x + DX8[k], ny = y + DY8[k];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const c = g[ny * W + nx];
    if (c === SOIL || c === STONE || c === WOOD || (incSand && c === SAND)) return true;
  }
  return false;
}

function waterNear(s, x, y) {
  const g = s.grid;
  for (let dy = -4; dy <= 3; dy++) {
    const ny = y + dy;
    if (ny < 0 || ny >= H) continue;
    for (let dx = -5; dx <= 5; dx++) {
      const nx = x + dx;
      if (nx < 0 || nx >= W) continue;
      const j = ny * W + nx, c = g[j];
      if (c === WATER || (c === SOIL && s.wet[j] > 0)) return true;
    }
  }
  return false;
}

/* ---------------- per-element updates ---------------- */

function upSoil(s, x, y, i, frame) {
  const g = s.grid;
  if (y < H - 1 && g[i + W] === E) {
    let j = i + W;
    if (y < H - 2 && g[j + W] === E) j += W;
    mv(s, i, j);
    return;
  }
  if ((frame & 3) === 0) {
    if ((x > 0 && g[i - 1] === WATER) || (x < W - 1 && g[i + 1] === WATER) ||
        (y > 0 && g[i - W] === WATER) || (y < H - 1 && g[i + W] === WATER)) {
      s.wet[i] = 255;
    } else if (s.wet[i] > 0 && (frame & 31) === 0) {
      s.wet[i] -= 1;
    }
  }
}

function upSand(s, x, y, i, c) {
  if (y >= H - 1) return;
  const g = s.grid, d = i + W;
  if (g[d] === E) {
    let j = d;
    if (y < H - 2 && g[d + W] === E) j = d + W;
    mv(s, i, j);
    return;
  }
  if (c === SAND && g[d] === WATER) { swap(s, i, d); return; }
  const dir = Math.random() < 0.5 ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    const dd = k === 0 ? dir : -dir;
    const nx = x + dd;
    if (nx < 0 || nx >= W) continue;
    if (g[i + dd] === E && g[d + dd] === E) { mv(s, i, d + dd); return; }
    if (c === SAND && g[i + dd] === WATER && g[d + dd] === WATER) { swap(s, i, d + dd); return; }
  }
}

function upWater(s, x, y, i) {
  const g = s.grid;
  // soak into any touching soil and disappear, leaving the ground wet
  for (let k = 0; k < 4; k++) {
    const nx = x + DX4[k], ny = y + DY4[k];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const j = ny * W + nx;
    if (g[j] === SOIL && s.wet[j] < 255 && Math.random() < 0.18) {
      s.wet[j] = 255; g[i] = E;
      return;
    }
  }
  // plants & flowers DRINK the water that touches them, so it never just pools on
  // the canopy — and they grow where it lands: a clump root sprouts a fresh
  // flower, a watered flower's stem climbs taller (up through its own bloom), and
  // a bush grows up into the water.
  for (let k = 0; k < 4; k++) {
    const nx = x + DX4[k], ny = y + DY4[k];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const c = g[ny * W + nx];
    if (c === FBASE) {
      if (Math.random() < 0.5) spawnStem(s, nx, ny);
      g[i] = E; return;
    }
    if (c === VINE || c === FLOWER || c === LEAF) {
      // find this column's highest stem cell and re-arm it so the flower grows
      // taller — clearing the old bloom on the way up so the stem stays a clean,
      // slender line and simply re-blooms at its new top (no thickening)
      for (let yy = ny; yy <= Math.min(H - 1, ny + 28); yy++) {
        const vj = yy * W + nx;
        if (g[vj] === VINE) { if (s.meta[vj] === 0) s.meta[vj] = 3 + ((Math.random() * 4) | 0); break; }
        if (g[vj] === FLOWER) {
          g[vj] = E;  // remove the bloom (and its side petals) — it moves up with the tip
          if (nx > 0 && g[yy * W + nx - 1] === FLOWER) g[yy * W + nx - 1] = E;
          if (nx < W - 1 && g[yy * W + nx + 1] === FLOWER) g[yy * W + nx + 1] = E;
        } else if (g[vj] !== LEAF) break; // past the flower's crown
      }
      g[i] = E; return;
    }
    if (c === PLEAF) {
      if (Math.random() < 0.25) { g[i] = PLEAF; s.aux[i] = 0; s.meta[i] = 0; }
      else g[i] = E;
      return;
    }
  }
  if (y < H - 1) {
    const d = i + W, dc = g[d];
    if (dc === E) {
      let j = d;
      if (y < H - 2 && g[d + W] === E) j = d + W;
      mv(s, i, j);
      return;
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let k = 0; k < 2; k++) {
      const dd = k === 0 ? dir : -dir;
      const nx = x + dd;
      if (nx < 0 || nx >= W) continue;
      if (g[i + dd] === E && g[d + dd] === E) { mv(s, i, d + dd); return; }
    }
    for (let k = 0; k < 2; k++) {
      const dd = k === 0 ? dir : -dir;
      const nx = x + dd;
      if (nx < 0 || nx >= W) continue;
      if (g[i + dd] === E) {
        if (Math.random() < 0.85) mv(s, i, i + dd);
        return;
      }
    }
  } else {
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let k = 0; k < 2; k++) {
      const dd = k === 0 ? dir : -dir;
      const nx = x + dd;
      if (nx < 0 || nx >= W) continue;
      if (g[i + dd] === E) {
        if (Math.random() < 0.85) mv(s, i, i + dd);
        return;
      }
    }
  }
  // settled water slowly soaks into porous ground nearby — soil, sand or ash.
  // Stone (and a bare canvas) are not porous, so a stone basin stays full.
  if (Math.random() < 0.02) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const c = g[ny * W + nx];
        if (c === SOIL || c === SAND || c === ASH) { g[i] = E; return; }
      }
    }
  }
}

function sproutLeaf(s, x, y) {
  // a leaf pair flanking a stalk cell, giving plants/vines a bushy silhouette
  const g = s.grid;
  const dir = Math.random() < 0.5 ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    const dd = k === 0 ? dir : -dir;
    const nx = x + dd;
    if (nx < 0 || nx >= W) continue;
    const j = y * W + nx;
    if (g[j] === E) { g[j] = LEAF; s.moved[j] = 1; if (Math.random() < 0.4) break; }
  }
}

function bloom(s, cx, cy, color) {
  // a distinct little flower head: a pale center ringed by coloured petals, so
  // each stem is crowned by a clear blossom (not a vague speck)
  const g = s.grid;
  const petal = color === undefined ? (Math.random() * FLOWER_PETALS) | 0 : (color % FLOWER_PETALS);
  const put = (x, y, c) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const j = y * W + x;
    if (g[j] === E) { g[j] = FLOWER; s.aux[j] = c; s.meta[j] = 0; s.moved[j] = 1; }
  };
  put(cx, cy, FLOWER_CENTER);                       // pale center
  put(cx - 1, cy, petal); put(cx + 1, cy, petal);   // cardinal petals
  put(cx, cy - 1, petal); put(cx, cy + 1, petal);
  if (Math.random() < 0.6) {                         // fuller, rounder bloom
    put(cx - 1, cy - 1, petal); put(cx + 1, cy - 1, petal);
    put(cx - 1, cy + 1, petal); put(cx + 1, cy + 1, petal);
  }
}

/* ---------------- plant organism (seed → tip → stem/leaf → mature) ----------------
   A plant grows as one travelling tip that lays down stem behind it, sprouts the
   odd leaf, leans as it climbs, and stops at a randomised height. The tip carries
   the whole plant's height state: aux packs max_height (high nibble) and
   current_height (low nibble); meta is a per-step grow countdown.            */

// foliage spreads into empty space, biased upward (and a little to the sides)
// so the bush keeps a rounded, mounded silhouette as it fills out
const FOL_DIRS = [[0, -1], [0, -1], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]];

function upSeed(s, x, y, i) {
  // a planted seed sprouts into foliage promptly (grow when planted)
  if (Math.random() >= 0.18) return;
  s.grid[i] = PLEAF; s.aux[i] = 0; s.meta[i] = 0; s.moved[i] = 1;
}

function upFoliage(s, x, y, i) {
  // a leaf cell spreads the bush into a neighbouring empty cell — fast around
  // wet soil, slowly on dry ground. (Water landing on the bush is drunk in
  // upWater, where the bush grows up into it.)
  if (Math.random() >= 0.06) return;
  if (!waterNear(s, x, y) && Math.random() >= 0.05) return; // dry: much slower
  const d = FOL_DIRS[(Math.random() * FOL_DIRS.length) | 0];
  const nx = x + d[0], ny = y + d[1];
  if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
  const j = ny * W + nx;
  if (s.grid[j] === E) { s.grid[j] = PLEAF; s.aux[j] = 0; s.meta[j] = 0; s.moved[j] = 1; }
}

const MOSS_DIRS = [[-1, 0], [1, 0], [-1, 1], [1, 1], [-1, -1], [1, -1]];

function upMoss(s, x, y, i) {
  const m = s.meta;
  if (nearSurface(s, x, y, false) && m[i] < 8) m[i] = 8;
  if (m[i] === 0 || Math.random() >= 0.014) return;
  const [dx, dy] = MOSS_DIRS[(Math.random() * MOSS_DIRS.length) | 0];
  const nx = x + dx, ny = y + dy;
  if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
  const j = ny * W + nx;
  if (s.grid[j] === E && nearSurface(s, nx, ny, false)) {
    s.grid[j] = MOSS; m[j] = m[i] - 1; s.moved[j] = 1;
  }
}

function upFungus(s, x, y, i) {
  // destroy element: web-like threads — only the tip (meta > 0) crawls,
  // the body it leaves behind is inert, so growth stays one cell thin
  const g = s.grid, m = s.meta;
  if (m[i] === 0 || Math.random() >= 0.15) return;
  let d = s.aux[i];
  if (d > 7) d = (Math.random() * 8) | 0;
  // when living tissue is adjacent, steer the tip onto it — fungus hunts plants
  let prey = -1;
  for (let k = 0; k < 8; k++) {
    const px = x + DX8[k], py = y + DY8[k];
    if (px < 0 || px >= W || py < 0 || py >= H) continue;
    const c = g[py * W + px];
    if (ISPLANT[c] || c === FLOWER || c === VINE || c === LEAF || c === MOSS || c === FBASE) { prey = k; break; }
  }
  if (prey >= 0 && Math.random() < 0.85) d = prey;
  else if (Math.random() < 0.25) d = (d + (Math.random() < 0.5 ? 1 : 7)) % 8;
  const nx = x + DX8[d], ny = y + DY8[d];
  if (nx < 0 || nx >= W || ny < 0 || ny >= H) { s.aux[i] = (Math.random() * 8) | 0; return; }
  const j = ny * W + nx, t = g[j];
  const living = (ISPLANT[t] || t === FLOWER || t === VINE || t === LEAF || t === MOSS || t === FBASE);
  if (t === E || living) {
    g[j] = FUNGUS; s.aux[j] = d;
    m[j] = m[i] > 0 ? m[i] - 1 : 0;
    if (living) m[j] = Math.min(255, m[j] + 4); // feeding on tissue lets it spread further
    m[i] = 0;
    s.moved[j] = 1;
    if (Math.random() < 0.04 && m[j] > 6) {
      // fork: leave a second tip behind, angled away
      m[i] = m[j] >> 1;
      s.aux[i] = (d + (Math.random() < 0.5 ? 2 : 6)) % 8;
    }
  } else {
    s.aux[i] = (Math.random() * 8) | 0;
  }
}

/* ---------------- wildflower clump ----------------
   FBASE is a persistent root. It pushes up flowering stalks (VINE tips); and
   every inert stem can branch a new stalk too, so the clump keeps spreading and
   climbing. Growth happens slowly even on dry ground and speeds right up when
   watered — with no cap, so a watered patch keeps filling the canvas. A VINE tip
   climbs with a gentle curve, drops the odd leaf, and crowns itself with a
   blossom cluster. aux packs blossom colour (low 2 bits) + curve phase (upper). */

const flowerCountdown = () => 10 + ((Math.random() * 12) | 0);

// aux packs blossom colour (low 3 bits, 0–5) + curve phase (upper bits)
function startStalk(s, j, col) {
  s.grid[j] = VINE;
  s.aux[j] = (col % FLOWER_PETALS) | (((Math.random() * 32) | 0) << 3);
  s.meta[j] = 7 + ((Math.random() * 16) | 0);   // varied stalk height 7–22
  s.moved[j] = 1;
}

// start one fresh stalk from a clear, well-spaced spot on the ground near the
// base, so flowers stay as distinct upright stems rather than a tangled mass
function spawnStem(s, bx, by) {
  const g = s.grid;
  for (let tries = 0; tries < 10; tries++) {
    const nx = bx + ((Math.random() * 23) | 0) - 11;
    if (nx < 1 || nx >= W - 1) continue;
    for (let ny = by - 2; ny <= by + 3; ny++) {
      if (ny < 1 || ny >= H - 1) continue;
      if (g[ny * W + nx] !== E) continue;
      const below = g[(ny + 1) * W + nx];
      if (below !== SOIL && below !== SAND && below !== WOOD && below !== FBASE) continue;
      // keep a stem's own footprint clear (≥2 cells apart) so the field stays
      // lush but each flower still reads as its own stem
      let crowded = false;
      for (let dx = -1; dx <= 1 && !crowded; dx++) {
        if (g[ny * W + nx + dx] === VINE || g[(ny - 1) * W + nx + dx] === VINE) crowded = true;
      }
      if (crowded) break; // this column is taken; try a new x
      startStalk(s, ny * W + nx, (Math.random() * FLOWER_PETALS) | 0);
      if (Math.random() < 0.4) sproutLeaf(s, nx, ny);
      return true;
    }
  }
  return false;
}

function upFlowerBase(s, x, y, i) {
  if (s.meta[i] > 1) { s.meta[i]--; return; }   // pace growth
  s.meta[i] = flowerCountdown();
  // sprout the first flower when planted, plus a slow trickle so a clump keeps a
  // little life of its own. Watering is handled where the water lands (upWater):
  // it sprouts new flowers at the root and pushes the bloomed ones taller.
  if (s.aux[i] === 0 || Math.random() < 0.04) {
    if (spawnStem(s, x, y) && s.aux[i] < 250) s.aux[i]++;
  }
}

function upVine(s, x, y, i) {
  // a flowering stalk tip climbing cleanly toward its blossom. Inert stems
  // (meta 0) do nothing — no branching — so stems stay slender and distinct.
  const m = s.meta;
  if (m[i] === 0) return;
  if (Math.random() >= 0.24) return;            // watchable pace
  const g = s.grid;
  const col = s.aux[i] & 7;
  if (y <= 1 || m[i] <= 1) { m[i] = 0; bloom(s, x, Math.max(1, y - 1), col); return; }
  // mostly straight up with the occasional gentle lean — a slender, clean stem
  const phase = (s.aux[i] >> 3) & 31;
  const sway = Math.sin(phase * (Math.PI / 14));
  let tx = x;
  if (Math.abs(sway) > 0.7 && Math.random() < 0.28) {
    tx = x + (sway > 0 ? 1 : -1);
    if (tx < 0) tx = 0; else if (tx >= W) tx = W - 1;
  }
  const ny = y - 1, j = ny * W + tx;
  if (g[j] === E) {
    g[j] = VINE; s.aux[j] = (col % FLOWER_PETALS) | (((phase + 1) & 31) << 3);
    m[j] = m[i] - 1; m[i] = 0; s.moved[j] = 1;
    if (Math.random() < 0.05) sproutLeaf(s, x, y);
  } else {
    m[i] = 0; bloom(s, x, Math.max(1, y - 1), col); // reached the top → blossom
  }
}

function upMite(s, x, y, i) {
  const g = s.grid, m = s.meta;
  if (m[i] <= 1) { g[i] = E; m[i] = 0; return; }
  m[i]--;
  // eat its food — wood and the moss growing on it. This is what fells a platform,
  // even one capped with moss; a meal extends the mite's life.
  for (let k = 0; k < 8; k++) {
    const nx = x + DX8[k], ny = y + DY8[k];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const j = ny * W + nx, c = g[j];
    if ((c === WOOD || c === MOSS) && Math.random() < 0.16) {
      g[j] = E; s.meta[j] = 0;
      m[i] = Math.min(180, m[i] + (c === WOOD ? 18 : 9));
      break;
    }
  }
  // mites don't eat plants or flowers — like wind, but crawling along the ground,
  // they tear foliage loose and shove it aside to get at the wood beneath
  if (Math.random() < 0.5) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = ny * W + nx, c = g[j];
      if (ISPLANT[c] || c === FLOWER || c === LEAF || c === VINE) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        let tossed = false;
        const spots = [[nx + dir, ny - 1], [nx, ny - 1], [nx + dir, ny], [nx - dir, ny - 1]];
        for (const [px, py] of spots) {
          if (px < 0 || px >= W || py < 0 || py >= H) continue;
          const pj = py * W + px;
          if (g[pj] === E) {
            g[pj] = c; s.meta[pj] = s.meta[j]; s.aux[pj] = s.aux[j]; s.moved[pj] = 1;
            g[j] = E; s.meta[j] = 0; s.aux[j] = 0;
            tossed = true; break;
          }
        }
        if (!tossed && Math.random() < 0.25) { g[j] = E; s.meta[j] = 0; s.aux[j] = 0; } // torn off
        break;
      }
    }
  }
  // crawl: settle downward with a little horizontal wander
  if (y < H - 1 && g[i + W] === E && Math.random() < 0.6) { mv(s, i, i + W); return; }
  if (Math.random() < 0.45) {
    const tx = x + ((Math.random() * 5) | 0) - 2;
    const ty = y - ((Math.random() * 3) | 0);
    if (tx >= 0 && tx < W && ty >= 0 && ty < H && g[ty * W + tx] === E) mv(s, i, ty * W + tx);
  }
}

function upFlower(s, x, y, i) {
  // petals stay put while anchored to anything; loose ones drift down
  if (y >= H - 1) return;
  const g = s.grid;
  for (let k = 0; k < 4; k++) {
    const nx = x + DX4[k], ny = y + DY4[k];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const c = g[ny * W + nx];
    if (c !== E && c !== WIND && c !== FIRE) return;
  }
  if (Math.random() < 0.6) mv(s, i, i + W);
}

function upFire(s, x, y, i) {
  const g = s.grid, m = s.meta;
  for (let k = 0; k < 4; k++) {
    const nx = x + DX4[k], ny = y + DY4[k];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const j = ny * W + nx, c = g[j];
    if (c === WATER) {
      if (Math.random() < 0.45) g[j] = E; // boils off as steam
      if (Math.random() < 0.12) { g[i] = E; m[i] = 0; return; }
    } else if (c === STONE && Math.random() < 0.06) { g[i] = E; m[i] = 0; return; }
    else if (c === ICE && Math.random() < 0.1) { g[j] = WATER; s.frost[j] = 0; }
  }
  for (let k = 0; k < 8; k++) {
    const nx = x + DX8[k], ny = y + DY8[k];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const j = ny * W + nx, c = g[j];
    if (FLAMMABLE[c] && Math.random() < 0.22) {
      g[j] = FIRE; m[j] = 30 + ((Math.random() * 40) | 0); s.aux[j] = 0; s.moved[j] = 1;
    } else if (c === FROZEN && Math.random() < 0.15) {
      g[j] = E; s.frost[j] = 0;
    }
  }
  if (y > 0 && m[i] > 12 && g[i - W] === E && Math.random() < 0.28) {
    g[i - W] = FIRE; m[i - W] = m[i] - 12; s.moved[i - W] = 1;
  }
  if (m[i] <= 1) {
    g[i] = Math.random() < 0.3 ? ASH : E;
    m[i] = 0; s.frost[i] = 0;
  } else {
    m[i]--;
  }
}

function upWind(s, x, y, i) {
  const g = s.grid, m = s.meta;
  const dir = s.aux[i] === 1 ? 1 : -1;
  // gust: loose particles in the wind's path get thrown downwind in an arc,
  // landing several cells away — the pile face visibly sprays and erodes
  for (let k = 1; k <= 2; k++) {
    const tx = x + dir * k;
    if (tx < 0 || tx >= W) break;
    const ti = y * W + tx, t = g[ti];
    if (t === SAND || t === ASH || t === WATER || t === FLOWER) {
      let lx = tx + dir * (4 + ((Math.random() * 5) | 0));
      if (lx < 0) lx = 0;
      if (lx >= W) lx = W - 1;
      let ly = y - (2 + ((Math.random() * 4) | 0));
      if (ly < 0) ly = 0;
      let j = -1;
      for (let yy = ly; yy >= 0; yy--) {
        if (g[yy * W + lx] === E) { j = yy * W + lx; break; }
      }
      if (j >= 0) {
        g[j] = t; s.meta[j] = s.meta[ti]; s.aux[j] = s.aux[ti]; s.frost[j] = s.frost[ti]; s.wet[j] = 0;
        g[ti] = E; s.meta[ti] = 0; s.aux[ti] = 0; s.frost[ti] = 0; s.wet[ti] = 0;
        s.moved[j] = 1;
      }
    } else if (ISPLANT[t] || t === LEAF || t === VINE) {
      // bends foliage downwind, reshaping the plant; loose leaves tear away
      if (Math.random() < 0.5) {
        const bx = tx + dir, by = y - (Math.random() < 0.5 ? 1 : 0);
        if (bx >= 0 && bx < W && by >= 0 && g[by * W + bx] === E) {
          g[by * W + bx] = t; s.meta[by * W + bx] = s.meta[ti]; s.aux[by * W + bx] = s.aux[ti];
          g[ti] = E; s.meta[ti] = 0; s.aux[ti] = 0;
          s.moved[by * W + bx] = 1;
        }
      }
      // foliage slows the gust but doesn't halt it
    } else if (t !== E && t !== WIND) {
      break;
    }
  }
  if (m[i] <= 1) { g[i] = E; m[i] = 0; s.aux[i] = 0; return; }
  const life = m[i] - 1;
  const nx = x + dir;
  let ny = y;
  if (Math.random() < 0.2) ny = y + (Math.random() < 0.5 ? -1 : 1);
  if (ny < 0) ny = 0;
  if (ny >= H) ny = H - 1;
  const j = ny * W + nx;
  if (nx >= 0 && nx < W && g[j] === E) {
    g[j] = WIND; s.meta[j] = life; s.aux[j] = s.aux[i]; s.moved[j] = 1;
    g[i] = E; s.meta[i] = 0; s.aux[i] = 0;
  } else if (nx >= 0 && nx < W && (ISPLANT[g[j]] || g[j] === LEAF || g[j] === VINE || g[j] === FLOWER)) {
    // plow through foliage: shove it downwind and take its place, reshaping the plant
    const px = nx + dir;
    if (px >= 0 && px < W && g[ny * W + px] === E && Math.random() < 0.7) {
      const pj = ny * W + px, tc = g[j];
      g[pj] = tc; s.meta[pj] = s.meta[j]; s.aux[pj] = s.aux[j]; s.moved[pj] = 1;
      g[j] = WIND; s.meta[j] = life; s.aux[j] = s.aux[i]; s.moved[j] = 1;
      g[i] = E; s.meta[i] = 0; s.aux[i] = 0;
    } else {
      m[i] = life;
    }
  } else {
    m[i] = life;
  }
}

function upLava(s, x, y, i, frame) {
  const g = s.grid, m = s.meta;
  // water/ice chill it toward solidifying
  for (let k = 0; k < 4; k++) {
    const nx = x + DX4[k], ny = y + DY4[k];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const j = ny * W + nx, c = g[j];
    if (c === WATER) {
      g[j] = E; // flashes to steam, chilling the lava
      m[i] = m[i] > 70 ? m[i] - 70 : 0;
      if (m[i] === 0) { g[i] = STONE; return; }
    } else if (c === ICE) {
      g[j] = WATER; s.frost[j] = 0;
      m[i] = m[i] > 40 ? m[i] - 40 : 0;
    }
  }
  // devour everything around it, fast
  for (let k = 0; k < 8; k++) {
    const nx = x + DX8[k], ny = y + DY8[k];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const j = ny * W + nx, c = g[j];
    if (FLAMMABLE[c]) {
      g[j] = FIRE; s.meta[j] = 30 + ((Math.random() * 40) | 0); s.moved[j] = 1;
    } else if ((c === SOIL || c === SAND || c === WOOD) && Math.random() < 0.4) {
      g[j] = E; s.wet[j] = 0; // burns terrain away quickly
    } else if (c === STONE && Math.random() < 0.02) {
      g[j] = E;
    }
  }
  // slow cool — long enough to burn through, decremented every frame
  if (m[i] <= 1) { g[i] = STONE; m[i] = 0; return; }
  m[i]--;
  // flow like hot liquid EVERY frame so it never just settles on top
  if (y < H - 1) {
    const d = i + W, dc = g[d];
    if (dc === E) { mv(s, i, d); return; }
    // melt straight through terrain beneath it and keep sinking
    if ((dc === SOIL || dc === SAND || dc === WOOD) && Math.random() < 0.6) {
      g[d] = E; s.wet[d] = 0; mv(s, i, d); return;
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let k = 0; k < 2; k++) {
      const dd = k === 0 ? dir : -dir;
      const nx = x + dd;
      if (nx < 0 || nx >= W) continue;
      if (g[i + dd] === E && g[d + dd] === E) { mv(s, i, d + dd); return; }
    }
    for (let k = 0; k < 2; k++) {
      const dd = k === 0 ? dir : -dir;
      const nx = x + dd;
      if (nx < 0 || nx >= W) continue;
      if (g[i + dd] === E) { mv(s, i, i + dd); return; }
    }
  }
}

function spreadFrost(s, x, y, i) {
  const en = s.frost[i];
  const d = (Math.random() * 8) | 0;
  const nx = x + DX8[d], ny = y + DY8[d];
  if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
  const j = ny * W + nx, t = s.grid[j];
  if (t === WATER) {
    s.grid[j] = ICE; s.meta[j] = 0; s.frost[j] = en - 1;
  } else if (t === LAVA) {
    s.grid[j] = STONE; s.meta[j] = 0; s.frost[j] = en - 1;
  } else if (FLAMMABLE[t]) {
    s.grid[j] = FROZEN; s.meta[j] = 0; s.frost[j] = en - 1;
  } else if ((t === SOIL || t === STONE || t === SAND || t === ASH || t === ICE || t === FROZEN || t === WOOD) && s.frost[j] === 0) {
    s.frost[j] = en - 1;
  }
}

function step(s, growP) {
  s.moved.fill(0);
  const frame = s.frame++;
  const ltr = (frame & 1) === 0;
  const g = s.grid;
  for (let y = H - 1; y >= 0; y--) {
    const row = y * W;
    for (let k = 0; k < W; k++) {
      const x = ltr ? k : W - 1 - k;
      const i = row + x;
      const c = g[i];
      if (c === E || s.moved[i]) continue;
      if (s.frost[i] > 1 && Math.random() < 0.3) spreadFrost(s, x, y, i);
      switch (c) {
        case SOIL: upSoil(s, x, y, i, frame); break;
        case SAND: case ASH: upSand(s, x, y, i, c); break;
        case WATER: upWater(s, x, y, i); break;
        case PSEED: upSeed(s, x, y, i); break;
        case PLEAF: upFoliage(s, x, y, i); break;
        case MOSS: upMoss(s, x, y, i); break;
        case FUNGUS: upFungus(s, x, y, i); break;
        case FLOWER: upFlower(s, x, y, i); break;
        case FBASE: upFlowerBase(s, x, y, i); break;
        case VINE: upVine(s, x, y, i); break;
        case MITE: upMite(s, x, y, i); break;
        case FIRE: upFire(s, x, y, i); break;
        case WIND: upWind(s, x, y, i); break;
        case LAVA: upLava(s, x, y, i, frame); break;
        case BOLT:
          if (s.meta[i] <= 1) { g[i] = E; s.meta[i] = 0; } else s.meta[i]--;
          break;
        default: break; // STONE, ICE, FROZEN, WOOD, LEAF, PSTEM/PMATURE are static
      }
    }
  }
}

/* ---------------- lightning ---------------- */

function impact(s, cx, cy) {
  const g = s.grid;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy > 10) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x, c = g[i];
      if (FLAMMABLE[c]) {
        g[i] = FIRE; s.meta[i] = 35 + ((Math.random() * 35) | 0);
      } else if (c === WATER) {
        g[i] = E; s.meta[i] = 0; // flash-evaporated
      } else if (c === SAND) {
        const tx = x + (((Math.random() * 9) | 0) - 4);
        const ty = y - (((Math.random() * 4) | 0) + 1);
        if (tx >= 0 && tx < W && ty >= 0 && ty < H && g[ty * W + tx] === E) {
          g[ty * W + tx] = SAND; g[i] = E;
        }
      }
    }
  }
}

function strike(s, sx, sy) {
  const g = s.grid;
  const branches = [[sx, sy, 0]];
  let cells = 0;
  while (branches.length && cells < 500) {
    const seg = branches.shift();
    let x = seg[0], y = seg[1];
    const depth = seg[2];
    // forks are short offshoots; only the trunk runs to the ground
    const maxSteps = depth === 0 ? H : 8 + ((Math.random() * 12) | 0);
    let steps = 0;
    while (y < H && steps < maxSteps) {
      if (x < 0 || x >= W) break;
      const i = y * W + x;
      const c = g[i];
      if (c !== E && c !== BOLT && c !== WIND) { impact(s, x, y); break; }
      g[i] = BOLT; s.meta[i] = 8 + ((Math.random() * 4) | 0);
      cells++;
      if (depth < 3 && branches.length < 10 && Math.random() < 0.32) {
        branches.push([x + (Math.random() < 0.5 ? -1 : 1), y + 1, depth + 1]);
      }
      if (Math.random() < 0.4) x += Math.random() < 0.5 ? -1 : 1;
      y++;
      steps++;
      if (y >= H) { impact(s, x, H - 1); break; }
    }
  }
}

/* ---------------- painting ---------------- */

function paintAt(s, cx, cy, el, windDir) {
  let destructive = false;
  const g = s.grid;
  const R = el === PSEED ? 5 : 3;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R + 1) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x, c = g[i];
      const r = Math.random();
      switch (el) {
        case SOIL: if (c === E && r < 0.85) setCell(s, i, SOIL); break;
        case SAND: if (c === E && r < 0.55) setCell(s, i, SAND); break;
        case STONE: if (c === E) setCell(s, i, STONE); break;
        case WATER: if (c === E && r < 0.22) setCell(s, i, WATER); break;
        case WOOD: if (c === E && r < 0.9) setCell(s, i, WOOD); break;
        case PSEED: {
          // the plant tool paints seeds onto soil/sand/wood; they sprout when watered
          const pb = y < H - 1 ? g[i + W] : E;
          if (c === E && (pb === SOIL || pb === SAND || pb === WOOD) && r < 0.4) {
            setCell(s, i, PSEED);
          }
          break;
        }
        case MOSS:
          if (c === E && r < 0.4 && nearSurface(s, x, y, false)) {
            setCell(s, i, MOSS); s.meta[i] = 8;
          }
          break;
        case FUNGUS:
          if (c === E && r < 0.05) {
            setCell(s, i, FUNGUS);
            s.meta[i] = 100;
            s.aux[i] = (Math.random() * 8) | 0;
            destructive = true;
          }
          break;
        case MITE:
          if (c === E && r < 0.05) {
            setCell(s, i, MITE);
            s.meta[i] = 120;
            destructive = true;
          }
          break;
        case FLOWER: {
          if (c !== E) break;
          // plant a flower clump root on soil, sand or wood; it sprouts its first
          // flower at once and a new one each time it's watered
          const below = y < H - 1 ? g[i + W] : STONE;
          if ((below === SOIL || below === SAND || below === WOOD) && r < 0.25) {
            setCell(s, i, FBASE);
            s.meta[i] = 1;  // sprout the first stem almost immediately
            s.aux[i] = 0;   // stem count (0 = not yet sprouted)
          }
          break;
        }
        case FIRE:
          if ((c === E && r < 0.5) || FLAMMABLE[c]) {
            setCell(s, i, FIRE); s.meta[i] = 40 + ((Math.random() * 30) | 0);
            destructive = true;
          }
          break;
        case WIND:
          if (c === E && r < 0.5) {
            setCell(s, i, WIND);
            s.meta[i] = 14 + ((Math.random() * 6) | 0);
            s.aux[i] = windDir > 0 ? 1 : 0;
            destructive = true;
          }
          break;
        case LAVA:
          if (c === E && r < 0.6) {
            setCell(s, i, LAVA); s.meta[i] = 190 + ((Math.random() * 50) | 0);
            destructive = true;
          }
          break;
        case ICESTORM_TOOL:
          if (c === WATER) { g[i] = ICE; s.meta[i] = 0; s.frost[i] = 14; destructive = true; }
          else if (c === LAVA) { g[i] = STONE; s.meta[i] = 0; s.frost[i] = 12; destructive = true; }
          else if (FLAMMABLE[c]) { g[i] = FROZEN; s.meta[i] = 0; s.frost[i] = 14; destructive = true; }
          else if (c === SOIL || c === STONE || c === SAND || c === ASH) {
            if (s.frost[i] < 12) s.frost[i] = 12;
            destructive = true;
          }
          break;
        default: break;
      }
    }
  }
  // ice storm cast into open air: frost lands on the first surface below
  if (el === ICESTORM_TOOL && cy >= 0 && cy < H && cx >= 0 && cx < W && g[cy * W + cx] === E) {
    for (let y = cy; y < Math.min(H, cy + 50); y++) {
      const i = y * W + cx;
      if (g[i] !== E) {
        for (let dx = -2; dx <= 2; dx++) {
          const x2 = cx + dx;
          if (x2 < 0 || x2 >= W) continue;
          const j = y * W + x2, cc = g[j];
          if (cc === WATER) { g[j] = ICE; s.meta[j] = 0; s.frost[j] = 14; }
          else if (cc === LAVA) { g[j] = STONE; s.meta[j] = 0; s.frost[j] = 12; }
          else if (FLAMMABLE[cc]) { g[j] = FROZEN; s.meta[j] = 0; s.frost[j] = 14; }
          else if (cc !== E && s.frost[j] < 12) s.frost[j] = 12;
        }
        destructive = true;
        break;
      }
    }
  }
  return destructive;
}

/* ---------------- rendering ---------------- */

function render(s, data, now, bg, sweepX) {
  const g = s.grid, m = s.meta, aux = s.aux, wet = s.wet, frost = s.frost;
  const band = 30;
  for (let y = 0; y < H; y++) {
    let mix = 1;
    if (bg.p < 1) {
      const dist = bg.dirUp ? H - 1 - y : y;
      mix = (bg.p * (H + band) - dist) / band;
      if (mix < 0) mix = 0;
      if (mix > 1) mix = 1;
    }
    // vertical atmosphere: faintly lighter sky at the top, deeper soil at the bottom
    const tcol = y / (H - 1);
    const up = 1 - tcol, skyf = up * up * up, sink = tcol * tcol * 3;
    const skyR = bg.skyFr[0] + (bg.skyTo[0] - bg.skyFr[0]) * mix;
    const skyG = bg.skyFr[1] + (bg.skyTo[1] - bg.skyFr[1]) * mix;
    const skyB = bg.skyFr[2] + (bg.skyTo[2] - bg.skyFr[2]) * mix;
    const bgr = bg.fr[0] + (bg.to[0] - bg.fr[0]) * mix + skyR * skyf - sink;
    const bgg = bg.fr[1] + (bg.to[1] - bg.fr[1]) * mix + skyG * skyf - sink;
    const bgb = bg.fr[2] + (bg.to[2] - bg.fr[2]) * mix + skyB * skyf - sink;
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = row + x;
      const c = g[i];
      let r, gg, b;
      if (c === E) {
        r = bgr; gg = bgg; b = bgb;
      } else if (ISPLANT[c]) {
        // foliage: top-lit volumetric shading. Cells exposed to sky catch light,
        // buried interior cells fall into shadow, with a leafy dither on top.
        let tone;
        if (c === PSEED) {
          tone = 1;
        } else {
          const aboveOpen = y === 0 || !ISPLANT[g[i - W]];
          if (aboveOpen) {
            const sideOpen = (x === 0 || !ISPLANT[g[i - 1]]) || (x === W - 1 || !ISPLANT[g[i + 1]]);
            tone = sideOpen ? 4 : 3;
          } else {
            let cover = 1;
            if (y > 1 && ISPLANT[g[i - 2 * W]]) cover = 2;
            tone = cover >= 2 ? 0 : 1;
            // a buried cell with an open side still catches a little light
            if ((x > 0 && !ISPLANT[g[i - 1]]) || (x < W - 1 && !ISPLANT[g[i + 1]])) tone += 1;
          }
          // leafy texture dither
          const d = (x * 7 + y * 13) & 7;
          if (d === 0) tone += 1; else if (d === 3 || d === 6) tone -= 1;
          if (tone < 0) tone = 0; else if (tone > 4) tone = 4;
        }
        const fo = tone * 3;
        r = FOL[fo]; gg = FOL[fo + 1]; b = FOL[fo + 2];
        if (frost[i] > 0) { r += (168 - r) * 0.4; gg += (216 - gg) * 0.4; b += (234 - b) * 0.4; }
      } else if (c === FLOWER) {
        const fo = (aux[i] % FLOWER_HEX.length) * 3;
        r = FLOWER_COL[fo]; gg = FLOWER_COL[fo + 1]; b = FLOWER_COL[fo + 2];
        if (frost[i] > 0) { r += (168 - r) * 0.4; gg += (216 - gg) * 0.4; b += (234 - b) * 0.4; }
      } else {
        let o;
        o = (c * 4 + ((x * 7 + y * 13) & 3)) * 3;
        r = COL[o]; gg = COL[o + 1]; b = COL[o + 2];
        if (c === FIRE) {
          const f = 0.7 + Math.random() * 0.3;
          r *= f; gg *= f; b *= f;
        } else if (c === FUNGUS) {
          const f = 0.88 + 0.16 * Math.sin(now * 0.004 + (x + y) * 0.6);
          r *= f; gg *= f; b *= f;
        } else if (c === LAVA) {
          const cool = 1 - Math.min(1, m[i] / 200);
          r += (85 - r) * cool * 0.85; gg += (85 - gg) * cool * 0.85; b += (85 - b) * cool * 0.85;
        } else if (c === BOLT) {
          const f = 0.4 + 0.6 * Math.min(1, m[i] / 10);
          r *= f; gg *= f; b *= f;
        } else if (c === SOIL && wet[i] > 0) {
          r *= 0.6; gg *= 0.6; b *= 0.6;
        } else if (c === WIND) {
          const f = 0.25 + 0.5 * Math.min(1, m[i] / 20);
          r = bgr + (r - bgr) * f; gg = bgg + (gg - bgg) * f; b = bgb + (b - bgb) * f;
        }
        if (frost[i] > 0 && c !== ICE && c !== FROZEN) {
          r += (168 - r) * 0.4; gg += (216 - gg) * 0.4; b += (234 - b) * 0.4;
        }
      }
      if (sweepX >= 0) {
        const dd = sweepX - x;
        if (dd >= -1 && dd < 5) {
          const glow = 0.45 * (1 - Math.abs(dd - 1) / 5);
          r += (235 - r) * glow; gg += (235 - gg) * glow; b += (235 - b) * glow;
        }
      }
      const p = i * 4;
      data[p] = r; data[p + 1] = gg; data[p + 2] = b; data[p + 3] = 255;
    }
  }
}

/* ---------------- UI data ---------------- */

const BUILD_TERRAIN = [
  { t: SOIL, n: 'Soil', c: '#6b4423' },
  { t: SAND, n: 'Sand', c: '#c8a96e' },
  { t: STONE, n: 'Stone', c: '#7a7d7f' },
  { t: WATER, n: 'Water', c: '#3a7bd5' },
];
const BUILD_ORGANIC = [
  { t: PSEED, n: 'Plant', c: '#2d6a2d' },
  { t: MOSS, n: 'Moss', c: '#5a9a5e' },
  { t: WOOD, n: 'Wood', c: '#9c6b30' },
  { t: FLOWER, n: 'Flower', c: '#e85d75' },
];
const DESTROY_ROW1 = [
  { t: FIRE, n: 'Fire', c: '#ff4500' },
  { t: WIND, n: 'Wind', c: '#8ecae6' },
  { t: LAVA, n: 'Lava', c: '#cf1020' },
  { t: LIGHTNING_TOOL, n: 'Lightning', c: '#ffd60a' },
];
const DESTROY_ROW2 = [
  { t: ICESTORM_TOOL, n: 'Ice Storm', c: '#a8d8ea' },
  { t: FUNGUS, n: 'Fungus', c: '#d4c870' },
  { t: MITE, n: 'Mites', c: '#8a4030' },
];
// brush-spark tint per element, taken straight from the palette swatch colours
const ELEM_COLOR = {};
[...BUILD_TERRAIN, ...BUILD_ORGANIC, ...DESTROY_ROW1, ...DESTROY_ROW2]
  .forEach((d) => { ELEM_COLOR[d.t] = d.c; });

const CSS = `
/* Build — a soft, alive, breathable dusk-green world (calm, low-contrast) */
.th-root{
  --chrome:#1d2916; --bordc:#34472a; --accent:#a3bd6b;
  --text:#d2dcbd; --text2:#96a974; --glow:rgba(130,160,86,.10);
  position:relative;
  height:100dvh; width:100%; box-sizing:border-box; overflow:hidden;
  display:flex; flex-direction:column; align-items:center;
  padding:0 12px 12px;
  background:var(--chrome);
  transition:background-color .5s ease .15s;
  font-family:'JetBrains Mono',monospace;
  -webkit-tap-highlight-color:transparent; /* no blue flash on touch */
}
/* kill the mobile tap-highlight / long-press selection across the whole app */
.th-root *{ -webkit-tap-highlight-color:transparent; }
.th-root button, .th-canvas{
  -webkit-touch-callout:none; user-select:none; -webkit-user-select:none;
}
/* Destroy — a dark, scorched, high-contrast ember world (intense, oppressive) */
.th-root.th-destroy{
  --chrome:#140a0b; --bordc:#4d222a; --accent:#ff5224;
  --text:#e8a79d; --text2:#bd7a72; --glow:rgba(255,82,28,.11);
}
/* page atmosphere behind the content: a glow that the canvas seems to rise out
   of, a soft vignette into the corners, a faint static grain, and a drifting
   field of dust (Build) / embers (Destroy) */
.th-atmos, .th-grain, .th-bgfx{
  position:absolute; inset:0; width:100%; height:100%;
  pointer-events:none; z-index:0;
}
.th-atmos{
  background:
    radial-gradient(58% 46% at 50% 40%, var(--glow), transparent 72%),
    radial-gradient(135% 115% at 50% 46%, transparent 52%, rgba(0,0,0,.5) 100%);
  transition:background .6s ease;
}
.th-grain{
  opacity:.04;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
/* mode-shift flare: a one-shot glow that flares from the world on each switch —
   a warm ignition into Destroy, a cool wash back into Build */
.th-flash{
  position:absolute; inset:0; z-index:4; pointer-events:none;
  opacity:0; mix-blend-mode:screen; transform-origin:50% 56%;
}
.th-flash.ignite{
  background:radial-gradient(circle at 50% 56%,
    rgba(255,196,120,.95), rgba(255,90,30,.6) 34%, rgba(120,20,8,.22) 56%, transparent 72%);
  animation:th-ignite .6s ease-out forwards;
}
.th-flash.cool{
  background:radial-gradient(circle at 50% 52%,
    rgba(180,214,140,.55), rgba(110,160,96,.28) 42%, transparent 70%);
  animation:th-cool .66s ease-out forwards;
}
@keyframes th-ignite{
  0%{opacity:0; transform:scale(.72);}
  16%{opacity:1;}
  44%{opacity:.5;}
  100%{opacity:0; transform:scale(1.16);}
}
@keyframes th-cool{
  0%{opacity:0; transform:scale(1.12);}
  28%{opacity:.6;}
  100%{opacity:0; transform:scale(1);}
}
/* a brief impact shake of the world when havoc begins */
@keyframes th-quake{
  0%,100%{transform:translate(0,0);}
  12%{transform:translate(-3px,1px);}
  24%{transform:translate(4px,-2px);}
  36%{transform:translate(-4px,2px);}
  48%{transform:translate(3px,-1px);}
  60%{transform:translate(-3px,2px);}
  72%{transform:translate(2px,-2px);}
  84%{transform:translate(-1px,1px);}
}
@media (prefers-reduced-motion: reduce){
  .th-flash{animation:none !important; opacity:0 !important;}
}
.th-stage, .th-palette{position:relative; z-index:1;}
.th-header{position:relative; z-index:5;} /* keeps the share popover above canvas/palette */
.th-header{
  flex:none; width:100%; max-width:840px;
  display:flex; align-items:baseline; gap:14px;
  padding:12px 2px 8px; box-sizing:border-box;
}
.th-htools{margin-left:auto; display:flex; gap:14px; align-self:center;}
.th-like{
  position:relative; display:inline-flex; align-items:center; justify-content:center;
  background:none; border:none; padding:0; min-width:44px; min-height:44px;
  color:var(--text2); cursor:pointer; transition:color .25s ease;
}
.th-like:hover{color:var(--text);}
.th-like:focus-visible{outline:2px solid var(--accent); outline-offset:3px; border-radius:2px;}
.th-heart{display:flex; line-height:0; transform-origin:center; position:relative; z-index:1;}
.th-heart.pop{animation:th-heart-pop .5s cubic-bezier(.34,1.56,.64,1);}
@keyframes th-heart-pop{0%{transform:scale(1);}30%{transform:scale(1.45);}55%{transform:scale(.92);}100%{transform:scale(1);}}
/* tap the heart → a little flurry of hearts floats up and fades (Instagram-style) */
.th-burst{position:absolute; left:50%; top:50%; width:0; height:0; pointer-events:none; z-index:4;}
.th-fly{
  position:absolute; left:0; top:0; line-height:0; opacity:0;
  transform:translate(-50%,-50%) scale(.3);
  animation-name:th-fly-up; animation-timing-function:cubic-bezier(.35,.7,.35,1);
  animation-fill-mode:forwards;
}
@keyframes th-fly-up{
  0%{opacity:0; transform:translate(-50%,-50%) scale(.3);}
  20%{opacity:1;}
  100%{opacity:0; transform:translate(calc(-50% + var(--dx)), calc(-50% - 56px)) scale(var(--s));}
}
.th-snd{
  background:none; border:none; padding:0; min-width:44px; min-height:44px;
  display:inline-flex; align-items:center; justify-content:center;
  color:var(--text2); cursor:pointer; transition:color .25s ease;
}
.th-snd:hover{color:var(--text);}
.th-snd[aria-pressed="false"]{color:var(--text2); opacity:.7;}
.th-snd:focus-visible{outline:2px solid var(--accent); outline-offset:3px; border-radius:2px;}
/* share: an icon button with a hover tooltip that opens a small share popover */
.th-sharewrap{position:relative; display:inline-flex;}
.th-share[data-tip]::after{
  content:attr(data-tip); position:absolute; top:100%; left:50%; transform:translateX(-50%);
  margin-top:1px; padding:3px 8px; border-radius:4px; white-space:nowrap;
  background:var(--chrome); border:1px solid var(--bordc); color:var(--text);
  font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase;
  opacity:0; pointer-events:none; transition:opacity .12s ease;
}
.th-share:hover[data-tip]::after, .th-share:focus-visible[data-tip]::after{opacity:1;}
.th-share[aria-expanded="true"][data-tip]::after{opacity:0;}
.th-shareveil{position:fixed; inset:0; z-index:18;}
.th-sharebox{
  position:absolute; top:calc(100% + 8px); right:0; z-index:19; width:250px; box-sizing:border-box;
  background:var(--chrome); border:1px solid var(--bordc); border-radius:10px;
  box-shadow:0 14px 34px rgba(0,0,0,.5); padding:14px; color:var(--text);
  animation:th-pop-in .16s ease-out;
}
@keyframes th-pop-in{from{opacity:0; transform:translateY(-6px) scale(.98);}to{opacity:1; transform:none;}}
.th-sharehead{display:flex; gap:11px; align-items:flex-start; margin-bottom:13px;}
.th-shareicon{flex:none; display:flex; line-height:0; border-radius:8px; overflow:hidden;}
.th-sharecopy{min-width:0;}
.th-sharecopy strong{
  display:block; font-family:'Silkscreen',monospace; font-weight:700; font-size:12px;
  letter-spacing:.04em; color:var(--text); margin-bottom:5px;
}
.th-sharecopy p{
  margin:0; font-family:'JetBrains Mono',monospace; font-size:11px; line-height:1.45; color:var(--text2);
}
.th-shareacts{display:flex; flex-direction:column; gap:7px;}
.th-sharebtn{
  width:100%; min-height:38px; padding:8px 12px; border-radius:7px;
  background:transparent; border:1px solid var(--bordc); color:var(--text);
  font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.05em;
  cursor:pointer; transition:background-color .2s ease, border-color .2s ease;
}
.th-sharebtn:hover{
  background:color-mix(in srgb, var(--accent) 10%, transparent);
  border-color:color-mix(in srgb, var(--accent) 45%, transparent);
}
.th-sharebtn.primary{
  background:color-mix(in srgb, var(--accent) 18%, transparent);
  border-color:color-mix(in srgb, var(--accent) 50%, transparent);
}
.th-sharebtn.primary:hover{background:color-mix(in srgb, var(--accent) 28%, transparent);}
.th-sharebtn:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}
.th-about{
  background:none; border:none; padding:6px 6px; min-height:44px;
  display:inline-flex; align-items:center;
  color:var(--text2);
  font-family:'JetBrains Mono',monospace; font-size:11px;
  letter-spacing:.1em; text-transform:uppercase;
  cursor:pointer; transition:color .25s ease;
}
.th-about:hover{color:var(--text);}
.th-about:focus-visible{outline:2px solid var(--accent); outline-offset:3px; border-radius:2px;}
.th-tbtn{
  min-width:44px; min-height:30px; padding:6px 12px;
  background:transparent; border:1px solid var(--bordc); border-radius:4px;
  color:var(--text2);
  font-family:'JetBrains Mono',monospace; font-size:11px;
  letter-spacing:.08em; text-transform:uppercase;
  cursor:pointer;
  transition:border-color .25s ease, color .25s ease, background-color .25s ease;
}
.th-tbtn:hover{border-color:var(--accent); color:var(--text);}
.th-tbtn:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}
.th-tools{
  position:absolute; top:8px; right:8px; z-index:2;
  display:flex; gap:6px;
}
.th-tool{
  position:relative;
  width:32px; height:32px; padding:0;
  display:flex; align-items:center; justify-content:center;
  background:color-mix(in srgb, var(--chrome) 80%, transparent);
  border:1px solid var(--bordc); border-radius:5px;
  color:var(--text2);
  cursor:pointer;
  transition:border-color .2s ease, color .2s ease, background-color .2s ease, opacity .2s ease;
}
.th-tool .th-ico{display:flex; pointer-events:none;}
/* the text label is hidden on desktop (hover tooltips do the job there) */
.th-tlabel{display:none; pointer-events:none;}
.th-tool:hover{border-color:var(--accent); color:var(--text);
  background:color-mix(in srgb, var(--chrome) 92%, transparent);}
.th-tool:active{transform:scale(.94);}
.th-tool:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}
.th-tool:disabled{opacity:.3; cursor:default; border-color:var(--bordc); color:var(--text2);
  background:color-mix(in srgb, var(--chrome) 80%, transparent);}
.th-tool::after{
  content:attr(data-tip); position:absolute; top:calc(100% + 6px); left:50%;
  transform:translateX(-50%);
  padding:4px 9px; border-radius:4px; white-space:nowrap;
  background:var(--chrome); border:1px solid var(--bordc); color:var(--text);
  font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em;
  text-transform:uppercase;
  opacity:0; pointer-events:none; transition:opacity .12s ease;
}
.th-tool:not(:disabled):hover::after, .th-tool:focus-visible::after{opacity:1;}
.th-title{
  font-family:'Silkscreen',monospace; font-weight:700; font-size:22px;
  letter-spacing:.03em; color:var(--text); margin:0;
  transition:color .4s ease .2s;
}
.th-ind{
  position:relative; font-family:'Silkscreen',monospace; font-weight:700;
  font-size:11px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--accent);
  transition:color .4s ease .2s;
}
.th-ind span{transition:opacity .35s ease .25s;}
.th-ind .i-d{position:absolute; left:0; top:0; opacity:0;}
.th-destroy .th-ind .i-b{opacity:0;}
.th-destroy .th-ind .i-d{opacity:1;}
.th-stage{
  flex:1 1 auto; min-height:0; width:100%; overflow:hidden;
  display:flex; justify-content:center; align-items:center;
  line-height:0;
}
.th-canvas-wrap{
  position:relative; display:block; line-height:0;
}
/* the onboarding ghost hand — positioned imperatively each frame, floats over
   both the canvas and the palette so it can "pick" Water then splash the bed */
.th-ghost{
  position:absolute; left:0; top:0; width:28px; height:31px; z-index:6;
  opacity:0; pointer-events:none; image-rendering:pixelated;
  will-change:transform, opacity;
  filter:drop-shadow(0 3px 5px rgba(0,0,0,.55));
}
/* soft inner vignette — gives the world edges that fall into shadow */
.th-vignette{
  position:absolute; inset:1px; border-radius:2px; z-index:1; pointer-events:none;
  background:radial-gradient(125% 135% at 50% 36%, transparent 50%, rgba(0,0,0,.28) 80%, rgba(0,0,0,.5) 100%);
}
.th-canvas{
  display:block; box-sizing:border-box; aspect-ratio:${W}/${H};
  border:1px solid var(--bordc); border-radius:2px;
  transition:border-color .5s ease .1s;
  cursor:${HAND_CURSOR};
  touch-action:none; image-rendering:pixelated;
  user-select:none; -webkit-user-select:none; -webkit-touch-callout:none;
}
.th-hint{
  position:absolute; left:50%; top:18px; transform:translate(-50%,0); z-index:2;
  padding:7px 15px; border-radius:999px;
  background:color-mix(in srgb, var(--chrome) 82%, transparent);
  border:1px solid var(--bordc); color:var(--text);
  font-family:'JetBrains Mono',monospace; font-size:11px; line-height:1.3;
  letter-spacing:.04em; white-space:nowrap; pointer-events:none;
  opacity:.92; transition:opacity .5s ease;
  animation:th-bob 2.6s ease-in-out infinite;
}
.th-hint.gone{opacity:0;}
@keyframes th-bob{0%,100%{transform:translate(-50%,0);}50%{transform:translate(-50%,5px);}}
.th-modal{
  position:fixed; inset:0; z-index:20;
  display:flex; align-items:center; justify-content:center; padding:20px;
  background:rgba(0,0,0,.55);
}
.th-card{
  max-width:380px; width:100%; box-sizing:border-box;
  background:var(--chrome); border:1px solid var(--bordc); border-radius:8px;
  padding:20px 22px; color:var(--text);
  font-family:'JetBrains Mono',monospace; font-size:13px; line-height:1.5;
}
.th-card p{margin:0 0 12px;}
.th-card strong{color:var(--accent);}
.th-ctitle{
  font-family:'Silkscreen',monospace; font-weight:700; font-size:15px;
  letter-spacing:.08em; margin:0 0 14px; color:var(--text);
}
.th-close{margin-top:4px;}
/* a light, borderless tray — the canvas carries the visual weight, not this */
.th-palette{
  flex:none; width:100%; max-width:840px;
  margin-top:6px; padding:4px 2px 2px;
  box-sizing:border-box;
  background:transparent; border:none;
}
.th-panes{display:grid;}
.th-pane{
  grid-area:1/1; display:flex; flex-direction:column; gap:5px;
  transition:opacity .3s ease, transform .3s ease;
}
.th-pane.hidden{opacity:0; transform:translateY(8px); pointer-events:none; transition-delay:0s;}
.th-pane.shown{opacity:1; transform:none; transition-delay:.4s;}
.th-row{display:flex; flex-wrap:wrap; gap:4px;}
.th-el{
  flex:1 1 auto; display:inline-flex; align-items:center; justify-content:center; gap:9px;
  min-height:44px; min-width:64px; padding:6px 10px;
  background:transparent; border:1px solid transparent; border-radius:10px;
  color:var(--text2);
  font-family:'JetBrains Mono',monospace; font-size:11px;
  letter-spacing:.1em; text-transform:uppercase;
  cursor:pointer;
  transition:color .25s ease, background-color .2s ease;
}
.th-el:hover{background:color-mix(in srgb, var(--accent) 9%, transparent); color:var(--text);}
.th-el:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}
.th-el[aria-pressed="true"]{
  color:var(--text);
  background:color-mix(in srgb, var(--accent) 14%, transparent);
}
.th-sw{
  width:11px; height:11px; border-radius:3px; flex:none;
  box-shadow:0 0 0 1px rgba(0,0,0,.3); transition:box-shadow .2s ease;
}
.th-el[aria-pressed="true"] .th-sw{box-shadow:0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent);}
.th-switch{
  display:block; width:fit-content; margin:7px auto 0; min-height:40px; padding:9px 26px;
  border:1px solid transparent; border-radius:999px;
  font-family:'Silkscreen',monospace; font-size:11px;
  letter-spacing:.08em; text-transform:uppercase;
  cursor:pointer; opacity:.95;
  transition:opacity .3s ease, background-color .3s ease, border-color .3s ease,
             box-shadow .3s ease, color .3s ease, transform .15s ease;
}
.th-switch:hover{opacity:1;}
.th-switch:focus-visible{outline:2px solid currentColor; outline-offset:3px;}
/* the gateway to Destroy: hot, angular and dangerous even from calm Build */
.th-root:not(.th-destroy) .th-switch{
  color:#ffe2d2;
  background:linear-gradient(180deg, #d23b14 0%, #861a04 100%);
  border:1px solid #ff7a45; border-radius:5px;
  padding:12px 34px; font-size:14px; letter-spacing:.16em;
  text-shadow:0 1px 1px rgba(60,0,0,.6);
  box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 5px 18px rgba(226,60,18,.35),
             inset 0 1px 0 rgba(255,200,170,.4), inset 0 -2px 6px rgba(90,10,0,.5);
  animation:th-ember 2.6s ease-in-out infinite;
}
.th-root:not(.th-destroy) .th-switch:hover{
  animation:none;
  background:linear-gradient(180deg, #ff5326 0%, #a82407 100%);
  border-color:#ffa074; transform:translateY(-1px);
  box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 8px 26px rgba(255,69,0,.55),
             inset 0 1px 0 rgba(255,215,185,.5), inset 0 -2px 6px rgba(90,10,0,.5);
}
.th-root:not(.th-destroy) .th-switch:active{transform:translateY(0);}
@keyframes th-ember{
  0%,100%{box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 5px 16px rgba(226,60,18,.30),
          inset 0 1px 0 rgba(255,200,170,.4), inset 0 -2px 6px rgba(90,10,0,.5);}
  50%{box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 6px 26px rgba(255,90,30,.6),
      inset 0 1px 0 rgba(255,200,170,.4), inset 0 -2px 6px rgba(90,10,0,.5);}
}
@media (prefers-reduced-motion: reduce){
  .th-root:not(.th-destroy) .th-switch{animation:none;}
}
/* the way back to calm mirrors the Destroy button's shape and weight, in living green */
.th-destroy .th-switch{
  color:#eef5da;
  background:linear-gradient(180deg, #6f8a3f 0%, #3c5020 100%);
  border:1px solid #a3bd6b; border-radius:5px;
  padding:12px 34px; font-size:14px; letter-spacing:.16em;
  text-shadow:0 1px 1px rgba(20,40,5,.6);
  box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 5px 18px rgba(120,160,70,.32),
             inset 0 1px 0 rgba(210,230,160,.4), inset 0 -2px 6px rgba(25,45,10,.5);
  animation:th-sage 2.8s ease-in-out infinite;
}
.th-destroy .th-switch:hover{
  animation:none;
  background:linear-gradient(180deg, #82a04b 0%, #496226 100%);
  border-color:#bcd488; transform:translateY(-1px);
  box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 8px 26px rgba(140,185,80,.5),
             inset 0 1px 0 rgba(225,240,180,.5), inset 0 -2px 6px rgba(25,45,10,.5);
}
.th-destroy .th-switch:active{transform:translateY(0);}
@keyframes th-sage{
  0%,100%{box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 5px 16px rgba(120,160,70,.28),
          inset 0 1px 0 rgba(210,230,160,.4), inset 0 -2px 6px rgba(25,45,10,.5);}
  50%{box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 6px 26px rgba(150,195,85,.55),
      inset 0 1px 0 rgba(210,230,160,.4), inset 0 -2px 6px rgba(25,45,10,.5);}
}
@media (prefers-reduced-motion: reduce){
  .th-destroy .th-switch{animation:none;}
}
@media (max-width:600px){
  /* center the app in the *visible* viewport (svh, so the address bar doesn't push
     it low) with a small upward bias so the whitespace reads balanced */
  .th-root{
    height:auto; min-height:100dvh; min-height:100svh; overflow:visible;
    justify-content:center; padding-top:12px; padding-bottom:40px;
  }
  .th-stage{flex:none;}
  .th-canvas{width:100%; height:auto; max-height:none;}
  .th-el{padding:6px 4px; font-size:11px; min-width:52px;}
  .th-header{padding-top:0; gap:7px;}
  .th-title{font-size:16px; white-space:nowrap;}
  .th-ind{font-size:9px; letter-spacing:.08em;}
  .th-htools{gap:2px;}
  .th-snd, .th-like{min-width:36px;}
  .th-about{font-size:10px; letter-spacing:.02em; padding:6px 3px; min-width:auto;}
  /* touch has no hover, so the tools are plain text buttons (the icons looked alike) */
  .th-tools{top:10px; right:10px; gap:8px;}
  .th-tool{width:auto; min-width:48px; height:auto; min-height:40px; padding:0 14px; gap:0;}
  .th-tool .th-ico{display:none;}
  .th-tool::after{content:none;} /* the button text labels it — no tap-stuck tooltip */
  .th-tlabel{display:inline; font-family:'JetBrains Mono',monospace; font-size:11px;
    letter-spacing:.08em; text-transform:uppercase;}
  /* drop the hint below the tool row so they don't collide */
  .th-hint{top:62px;}
  /* give the mode switch room so it isn't crowding the element palette */
  .th-switch{margin-top:22px;}
}
`;

/* ---------------- sound: a sample-based engine ----------------
   Plays the project's own recordings (in /sounds): a short clip per material on
   placement, plus a dedicated cue on each Build/Destroy switch. Lazily started on
   the first user gesture, with a mute toggle. */
const SOUND_URLS = (() => {
  const all = import.meta.glob('../sounds/**/*.{mp3,m4a}', { eager: true, query: '?url', import: 'default' });
  const map = {};
  for (const p in all) map[p.split('/').pop().replace(/\.(mp3|m4a)$/i, '')] = all[p];
  return map;
})();
const PLACE_SOUND = {
  [SOIL]: 'soil', [SAND]: 'sand', [STONE]: 'stone', [WATER]: 'water', [WOOD]: 'wood',
  [PSEED]: 'plant', [MOSS]: 'moss', [FLOWER]: 'flower',
  [FIRE]: 'fire', [WIND]: 'wind', [LAVA]: 'lava', [LIGHTNING_TOOL]: 'lightning',
  [ICESTORM_TOOL]: 'ice-storm', [FUNGUS]: 'fungus', [MITE]: 'mites',
};

function createAudio() {
  let ctx = null, master = null, muted = false, started = false;
  const buffers = {};   // sound name -> decoded AudioBuffer (short placement clips)
  const raw = {};       // sound name -> prefetched arrayBuffer promise

  // start downloading the short placement clips right away (no ambient beds — the
  // background music was removed; only per-element placement sounds play now)
  for (const name in SOUND_URLS) {
    if (name.indexOf('ambient') === 0) continue;
    raw[name] = fetch(SOUND_URLS[name]).then((r) => r.arrayBuffer()).catch(() => null);
  }

  function start() {
    if (started) return; started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    for (const name in raw) {
      raw[name].then((a) => (a ? ctx.decodeAudioData(a.slice(0)) : null))
        .then((b) => { if (b) buffers[name] = b; }).catch(() => { /* leave silent */ });
    }
  }

  return {
    resume() {
      start();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
    },
    setMuted(m) {
      muted = m;
      if (!ctx) return;
      master.gain.linearRampToValueAtTime(m ? 0 : 1, ctx.currentTime + 0.15);
    },
    // the dedicated mode-switch sounds (Build a little quieter than Destroy)
    transition(to) {
      if (!ctx || muted) return;
      const b = buffers[to === 'destroy' ? 'button-destroy' : 'button-build'];
      if (!b) return;
      const src = ctx.createBufferSource(); src.buffer = b;
      const g = ctx.createGain();
      g.gain.value = to === 'destroy' ? 1 : 0.65; // soften the return to Build
      src.connect(g); g.connect(master);
      src.start(ctx.currentTime);
    },
    setMode() { /* compat */ },
    swell() { /* compat */ },
    place(el) {
      if (!ctx || muted) return;
      const b = buffers[PLACE_SOUND[el]];
      if (!b) return;
      const t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = b;
      s.playbackRate.value = 0.96 + Math.random() * 0.08; // slight variation
      // keep placements snappy and prevent long clips from piling up on a drag:
      // play a short window with a quick fade-out
      const dur = Math.min(b.duration, 1.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.85, t);
      if (b.duration > dur) g.gain.setValueAtTime(0.85, t + dur - 0.12);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      s.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur + 0.02);
    },
  };
}

/* ---------------- component ---------------- */
export default function TinyHavoc() {
  const canvasRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const rootRef = useRef(null);
  const wrapRef = useRef(null);
  const ghostRef = useRef(null);
  const [mode, setModeState] = useState('build');
  const [sel, setSel] = useState(SOIL);
  const [about, setAbout] = useState(false);
  const [hint, setHint] = useState(false); // stays hidden until the ghost demo ends
  const [canUndo, setCanUndo] = useState(false);
  const [pop, setPop] = useState(0); // bump to replay the heart animation
  const [hearts, setHearts] = useState([]); // floating-heart bursts (Instagram-style)
  const [shared, setShared] = useState(false); // brief "link copied" acknowledgement
  const [shareOpen, setShareOpen] = useState(false); // the share popover
  const [fx, setFx] = useState({ n: 0, to: 'build' }); // one-shot mode-transition flash
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('th-muted') !== '1'; } catch { return true; }
  });
  const audioRef = useRef(null);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  const toggleSound = () => {
    const on = !soundOn;
    setSoundOn(on);
    try { localStorage.setItem('th-muted', on ? '0' : '1'); } catch { /* ignore */ }
    if (audioRef.current) { audioRef.current.setMuted(!on); if (on) audioRef.current.resume(); }
  };

  // a tiny affirmation — tap the heart and a little flurry of hearts floats up
  const onLike = () => {
    setPop((p) => p + 1);
    try { navigator.vibrate && navigator.vibrate(12); } catch { /* ignore */ }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = Date.now() + Math.random();
    const burst = Array.from({ length: 4 }, (_, i) => ({
      k: i,
      dx: (Math.random() * 44 - 22) | 0,
      delay: i * 55,
      dur: 1100 + Math.random() * 450,
      s: (0.65 + Math.random() * 0.6).toFixed(2),
    }));
    setHearts((h) => [...h, { id, burst }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1750);
  };

  const SHARE_URL = typeof window !== 'undefined' ? window.location.href : '';
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyLink = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(SHARE_URL); ok = true; } catch { /* fallback */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = SHARE_URL; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { /* clipboard unavailable */ }
    }
    if (ok) { setShared(true); setTimeout(() => setShared(false), 1800); }
  };

  // native share sheet (gives WhatsApp, Messages, etc. on a phone)
  const nativeShare = async () => {
    try {
      await navigator.share({
        title: 'Tiny Havoc',
        text: 'A tiny living world you grow — then take apart.',
        url: SHARE_URL,
      });
      setShareOpen(false);
    } catch { /* dismissed */ }
  };

  const simRef = useRef(null);
  const historyRef = useRef([]);
  const undoRef = useRef(() => {});
  const modeRef = useRef('build');
  const selRef = useRef(SOIL);
  const transRef = useRef({ from: 'build', to: 'build', start: -10000 });
  const pointerRef = useRef({ down: false, x: 0, y: 0, lastX: 0, lastY: 0, windDir: 1, lastStrike: 0 });
  const endRef = useRef({ phase: 'live', start: 0, quiet: 0, lastPaint: 0, sweepCol: 0, armed: false });
  const obRef = useRef({ active: true, f: 0, spawned: 0, planted: false, picked: false, flowered: false, seeds: [], bedL: 0, bedR: 0 });
  const clearRef = useRef(() => {});

  selRef.current = sel;

  const beginTransition = (to) => {
    const now = performance.now();
    const tr = transRef.current;
    if (now - tr.start < 850) return;
    tr.from = modeRef.current;
    tr.to = to;
    tr.start = now;
    modeRef.current = to;
    setModeState(to);
    setSel(to === 'destroy' ? FIRE : SOIL);
    // a one-shot flare from the world, plus an impact shake when havoc begins
    setFx((s) => ({ n: s.n + 1, to }));
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wrap = wrapRef.current;
    if (wrap && to === 'destroy' && !reduce) {
      wrap.style.animation = 'none';
      void wrap.offsetWidth; // reflow so the shake restarts on a repeat switch
      wrap.style.animation = 'th-quake .5s cubic-bezier(.36,.07,.19,.97)';
      setTimeout(() => { if (wrapRef.current) wrapRef.current.style.animation = ''; }, 520);
    }
    // a heavier buzz dropping into Destroy, a soft tick returning to calm
    try { navigator.vibrate && navigator.vibrate(to === 'destroy' ? [0, 18, 40, 22] : 10); } catch { /* unsupported */ }
    const a = audioRef.current;
    if (a) { if (soundOnRef.current) a.resume(); a.transition(to); }
  };

  const onModeSwitch = () => {
    if (endRef.current.phase !== 'live') return;
    if (modeRef.current === 'build') {
      beginTransition('destroy');
    } else {
      // back to building — the loop continues with whatever survived
      endRef.current.armed = false;
      endRef.current.quiet = 0;
      beginTransition('build');
    }
  };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const sim = makeSim();
    simRef.current = sim;
    if (import.meta.env.DEV) window.__th = { sim, ob: obRef, end: endRef, pr: pointerRef };

    const audio = createAudio();
    audio.setMuted(!soundOnRef.current);
    audioRef.current = audio;
    if (import.meta.env.DEV) window.__thAudio = audio;
    let lastSoundT = 0;

    // brush sparks — small pixel motes that puff off the cursor as you paint.
    // Stored in the 800×600 canvas space (cell (x,y) → pixel (x*4, y*4)).
    let sparks = [];
    let lastSparkT = 0;
    const noMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const spawnSparks = (cellX, cellY, col, n, energy) => {
      if (noMotion) return;
      const px = cellX * 4 + 2, py = cellY * 4 + 2;
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.4 + Math.random() * energy;
        sparks.push({
          x: px + (Math.random() * 6 - 3), y: py + (Math.random() * 6 - 3),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - energy * 0.4,
          life: 1, decay: 0.025 + Math.random() * 0.03,
          col, r: 1 + Math.random() * 1.5,
        });
      }
      if (sparks.length > 160) sparks.splice(0, sparks.length - 160);
    };
    const drawSparks = () => {
      if (!sparks.length) return;
      ctx.save();
      for (let k = sparks.length - 1; k >= 0; k--) {
        const s = sparks[k];
        s.x += s.vx; s.y += s.vy; s.vy += 0.05; s.vx *= 0.97; s.life -= s.decay;
        if (s.life <= 0) { sparks.splice(k, 1); continue; }
        ctx.globalAlpha = Math.max(0, s.life) * 0.9;
        ctx.fillStyle = s.col;
        const r = s.r * (0.5 + s.life * 0.7);
        ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
      }
      ctx.restore();
    };

    // the onboarding ghost hand: dips to the Water swatch, sweeps a splash across
    // the bed left→right, then lifts away. Anchored to the root so it can travel
    // between the palette and the canvas. Driven off the onboarding clock (ob.f).
    const SWEEP0 = 300, SWEEPD = 116, WATER_Y = 112; // shared with the tick's sweep
    const lerp = (a, b, t) => a + (b - a) * t;
    const sstep = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
    const updateGhost = () => {
      const g = ghostRef.current, root = rootRef.current;
      if (!g || !root) return;
      const o = obRef.current;
      if (noMotion || !o.active || !o.planted || o.f < 150 || !o.seeds.length) {
        if (g.style.opacity !== '0') g.style.opacity = '0';
        return;
      }
      const rr = root.getBoundingClientRect();
      const cr = cv.getBoundingClientRect();
      const wb = root.querySelector('.th-el[data-el="' + WATER + '"]');
      const wbr = wb ? wb.getBoundingClientRect() : cr;
      const cellX = (cx) => (cr.left - rr.left) + (cx / W) * cr.width;   // cell→root px
      const cellY = (cy) => (cr.top - rr.top) + (cy / H) * cr.height;
      const wbX = (wbr.left - rr.left) + wbr.width * 0.18;              // the water swatch
      const wbY = (wbr.top - rr.top) + wbr.height * 0.5;
      const sweepT = sstep((o.f - SWEEP0) / SWEEPD);
      const sweepX = cellX(lerp(o.bedL, o.bedR, sweepT));
      const sweepY = cellY(WATER_Y - 8);
      const midX = cellX(100), midY = cellY(64); // the middle of the canvas
      const f = o.f;
      let x, y, op = 1;
      if (f < 192) {                 // appear in the middle of the canvas and settle
        const t = sstep((f - 152) / 40); x = midX; y = lerp(midY - 24, midY, t); op = t;
      } else if (f < 250) {          // travel down toward the Water swatch
        const t = sstep((f - 192) / 58); x = lerp(midX, wbX, t); y = lerp(midY, wbY, t);
      } else if (f < 286) {          // tap it — a slow press that selects Water (~f262)
        x = wbX; y = wbY + 8 * Math.sin(sstep((f - 250) / 36) * Math.PI);
      } else if (f < SWEEP0) {       // carry the water up to the left of the bed
        const t = sstep((f - 286) / (SWEEP0 - 286)); x = lerp(wbX, cellX(o.bedL), t); y = lerp(wbY, sweepY, t);
      } else if (f <= SWEEP0 + SWEEPD) { // sweep across, splashing
        x = sweepX; y = sweepY;
      } else {                       // lift away and fade out
        const t = sstep((f - (SWEEP0 + SWEEPD)) / 64);
        x = lerp(cellX(o.bedR), cellX(o.bedR) + 30, t); y = lerp(sweepY, sweepY - 54, t); op = 1 - t;
      }
      g.style.transform = `translate(${x - 2}px, ${y - 29}px)`; // pin the bottom-left fingertip
      g.style.opacity = String(op);
    };

    // start the ambient as early as the browser allows: try immediately (works if
    // the user already engaged this page/site), and otherwise on the very first
    // interaction anywhere on the page — not just inside the canvas.
    if (soundOnRef.current) audio.resume();
    const startAmbient = () => {
      if (soundOnRef.current) audio.resume();
      wakeEvents.forEach((ev) => window.removeEventListener(ev, startAmbient));
    };
    const wakeEvents = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'wheel', 'scroll'];
    wakeEvents.forEach((ev) => window.addEventListener(ev, startAmbient, { passive: true }));

    const ctx = cv.getContext('2d');
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d');
    const img = octx.createImageData(W, H);

    // ambient dust motes — purely decorative, drawn over the world each frame in
    // the canvas's own pixel space (800x600). They never touch the simulation.
    const CW = cv.width, CH = cv.height;
    const motes = Array.from({ length: 26 }, () => ({
      x: Math.random() * CW,
      y: Math.random() * CH,
      sz: 2 + ((Math.random() * 3) | 0),
      sp: 0.08 + Math.random() * 0.28,          // slow upward drift
      ph: Math.random() * Math.PI * 2,          // sway phase
      amp: 0.2 + Math.random() * 0.5,
      a: 0.06 + Math.random() * 0.16,           // base opacity
    }));
    const drawMotes = (cx, w, h, destroy) => {
      for (const m of motes) {
        m.y -= m.sp;
        m.ph += 0.012;
        m.x += Math.sin(m.ph) * m.amp;
        if (m.y < -m.sz) { m.y = h + m.sz; m.x = Math.random() * w; }
        if (m.x < -m.sz) m.x = w; else if (m.x > w) m.x = -m.sz;
        const tw = 0.75 + 0.25 * Math.sin(m.ph * 1.7); // gentle twinkle
        cx.fillStyle = destroy
          ? `rgba(255,150,70,${(m.a * tw).toFixed(3)})`
          : `rgba(210,222,180,${(m.a * tw).toFixed(3)})`;
        cx.fillRect(m.x | 0, m.y | 0, m.sz, m.sz);
      }
    };

    // full-page ambient particle field behind the canvas — dust in Build, rising
    // embers in Destroy. Lives in viewport space, never touches the simulation.
    const bgcv = bgCanvasRef.current;
    const bgctx = bgcv ? bgcv.getContext('2d') : null;
    let bgW = 0, bgH = 0;
    const newPart = (init) => ({
      x: Math.random() * (bgW || window.innerWidth),
      y: init ? Math.random() * (bgH || window.innerHeight) : (bgH || window.innerHeight) + 6,
      sz: 1 + ((Math.random() * 2) | 0),
      sp: 0.12 + Math.random() * 0.5,
      ph: Math.random() * Math.PI * 2,
      amp: 0.15 + Math.random() * 0.6,
      a: 0.05 + Math.random() * 0.16,
    });
    const parts = Array.from({ length: 54 }, () => newPart(true));
    const sizeBg = () => {
      if (!bgcv) return;
      bgW = bgcv.width = window.innerWidth;
      bgH = bgcv.height = window.innerHeight;
    };
    const drawBg = (destroy) => {
      if (!bgctx) return;
      bgctx.clearRect(0, 0, bgW, bgH);
      for (const p of parts) {
        p.y -= p.sp * (destroy ? 2.3 : 1);   // embers rise faster
        p.ph += destroy ? 0.06 : 0.014;
        p.x += Math.sin(p.ph) * p.amp;
        if (p.y < -p.sz) { p.y = bgH + p.sz; p.x = Math.random() * bgW; }
        if (p.x < -p.sz) p.x = bgW; else if (p.x > bgW) p.x = -p.sz;
        const tw = destroy ? (0.45 + 0.55 * Math.abs(Math.sin(p.ph * 2.3)))
                           : (0.7 + 0.3 * Math.sin(p.ph * 1.4));
        bgctx.fillStyle = destroy
          ? `rgba(255,${120 + ((Math.sin(p.ph * 3) * 40) | 0)},48,${(p.a * tw).toFixed(3)})`
          : `rgba(184,206,156,${(p.a * tw).toFixed(3)})`;
        bgctx.fillRect(p.x | 0, p.y | 0, p.sz, p.sz);
      }
    };
    sizeBg();

    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    const toCell = (e) => {
      const rect = cv.getBoundingClientRect();
      return [
        clamp(((e.clientX - rect.left) / rect.width * W) | 0, 0, W - 1),
        clamp(((e.clientY - rect.top) / rect.height * H) | 0, 0, H - 1),
      ];
    };

    const markDestructive = (now) => {
      endRef.current.lastPaint = now;
      if (modeRef.current === 'destroy') endRef.current.armed = true;
    };

    const onDown = (e) => {
      if (endRef.current.phase !== 'live') return;
      if (e.button > 0) return; // only the primary button/touch paints
      e.preventDefault();
      setHint(false);
      snapshot(); // remember the world before this stroke so it can be undone
      try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const [x, y] = toCell(e);
      const pr = pointerRef.current;
      pr.down = true;
      pr.x = x; pr.y = y; pr.lastX = x; pr.lastY = y;
      pr.windDir = Math.random() < 0.5 ? -1 : 1;
      const now = performance.now();
      if (soundOnRef.current) audio.resume();
      audio.place(selRef.current);     // immediate placement sound on press
      lastSoundT = now;
      try { navigator.vibrate && navigator.vibrate(6); } catch { /* unsupported */ }
      if (selRef.current !== LIGHTNING_TOOL) {
        const col = ELEM_COLOR[selRef.current] || '#fff';
        spawnSparks(x, y, col, modeRef.current === 'destroy' ? 6 : 4,
                    modeRef.current === 'destroy' ? 2.6 : 1.5);
        lastSparkT = now;
      }
      if (modeRef.current === 'destroy' && selRef.current === LIGHTNING_TOOL) {
        strike(sim, x, y);
        pr.lastStrike = now;
        markDestructive(now);
      }
    };
    const onMove = (e) => {
      const pr = pointerRef.current;
      if (!pr.down) return;
      const [x, y] = toCell(e);
      pr.x = x; pr.y = y;
    };
    // painting only ever happens while the pointer is held; a global up/cancel
    // listener guarantees it can never get stuck "on" if release lands off-canvas
    const onUp = () => { pointerRef.current.down = false; };

    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);

    // Size the canvas in JS to fit the space the palette leaves, keeping 4:3.
    // (CSS percentage-height on an aspect-ratio canvas is unreliable and was
    // letting the canvas overflow and push the buttons off-screen.)
    const stage = cv.closest('.th-stage');
    const fitCanvas = () => {
      if (!stage || !rootRef.current) return;
      const availW = stage.clientWidth;
      let w, hRatio = H / W; // desktop keeps the true 4:3 grid aspect (square pixels)
      if (window.innerWidth <= 600) {
        w = availW;      // mobile: full-width, page scrolls
        hRatio = 0.9;    // mobile-only: display a bit taller for more room (slight pixel stretch)
      } else {
        const availH = stage.clientHeight;
        w = Math.min(availW, availH * W / H, 840); // cap to align with palette
      }
      w = Math.max(0, Math.floor(w));
      cv.style.width = w + 'px';
      cv.style.height = Math.floor(w * hRatio) + 'px';
      rootRef.current.style.setProperty('--stage-w', w + 'px');
    };
    const onResize = () => { fitCanvas(); sizeBg(); };
    const ro = new ResizeObserver(fitCanvas);
    if (stage) ro.observe(stage);
    window.addEventListener('resize', onResize);
    fitCanvas();
    // a second pass after layout settles (fonts/flex) catches the initial size
    requestAnimationFrame(fitCanvas);

    const resetToBuild = () => {
      clearSim(sim);
      endRef.current = { phase: 'live', start: 0, quiet: 0, lastPaint: 0, sweepCol: 0, armed: false };
      const tr = transRef.current;
      tr.from = 'destroy'; tr.to = 'build'; tr.start = performance.now();
      modeRef.current = 'build';
      setModeState('build');
      setSel(SOIL);
    };

    // snapshot the whole world so an action (a stroke, a clear) can be undone
    const snapshot = () => {
      const h = historyRef.current;
      h.push({
        grid: sim.grid.slice(), meta: sim.meta.slice(), aux: sim.aux.slice(),
        wet: sim.wet.slice(), frost: sim.frost.slice(),
      });
      if (h.length > 12) h.shift();
      setCanUndo(true);
    };

    undoRef.current = () => {
      const h = historyRef.current;
      if (!h.length) return;
      const s = h.pop();
      sim.grid.set(s.grid); sim.meta.set(s.meta); sim.aux.set(s.aux);
      sim.wet.set(s.wet); sim.frost.set(s.frost);
      obRef.current.active = false;
      const en = endRef.current;
      en.phase = 'live'; en.armed = false; en.quiet = 0; en.sweepCol = 0;
      setCanUndo(h.length > 0);
    };

    // wipe the world to empty, in place, without changing mode
    clearRef.current = () => {
      snapshot();
      clearSim(sim);
      obRef.current.active = false;
      const en = endRef.current;
      en.phase = 'live'; en.armed = false; en.quiet = 0; en.sweepCol = 0;
    };

    let raf = 0;
    let lastStep = 0;
    let sweepX = -1;
    const tick = (now) => {
      const en = endRef.current;
      const ob = obRef.current;
      // cap the sim near 60 steps/s so 120Hz+ displays don't run double speed
      const doStep = en.phase === 'live' && now - lastStep >= 12;

      /* --- guided onboarding: soil settles, a ghost hand picks Water and splashes
         a curtain across the bed left→right; seeds sprout in its wake, then it
         lifts away. Frame-based so a throttled tab pauses it; interaction cancels.
         Sweep runs cells bedL→bedR over frames [SWEEP0, SWEEP0+SWEEPD]. --- */
      if (doStep && ob.active) {
        ob.f++;
        const el = ob.f;
        // 1) soil rains into the centre and piles into a little bed
        if (el > 16 && el < 130 && ob.spawned < 120 && Math.random() < 0.75) {
          const x = (W / 2 - 32 + Math.random() * 64) | 0;
          if (sim.grid[x] === E) { sim.grid[x] = SOIL; ob.spawned++; }
        }
        // 2) plant a row of dry seeds across the bed (the sweep will water them)
        if (el > 140 && !ob.planted) {
          ob.planted = true;
          ob.seeds = [];
          const tops = [];
          for (let x = (W / 2 - 32) | 0; x <= (W / 2 + 32) | 0; x++) {
            if (sim.grid[(H - 1) * W + x] !== SOIL) continue;
            let y = H - 1;
            while (y > 0 && sim.grid[(y - 1) * W + x] === SOIL) y--;
            if (y > 0 && sim.grid[(y - 1) * W + x] === E) tops.push({ x, y: y - 1 });
          }
          if (tops.length) {
            ob.bedL = tops[0].x;
            ob.bedR = tops[tops.length - 1].x;
            const N = Math.min(6, tops.length);
            const seen = new Set();
            for (let n = 0; n < N; n++) {
              const p = tops[((n + 0.5) / N * tops.length) | 0];
              if (!p || seen.has(p.x) || sim.grid[p.y * W + p.x] !== E) continue;
              seen.add(p.x);
              sim.grid[p.y * W + p.x] = PSEED;
              sim.meta[p.y * W + p.x] = 0; sim.aux[p.y * W + p.x] = 0;
              ob.seeds.push(p);
            }
          } else { ob.bedL = (W / 2 - 16) | 0; ob.bedR = (W / 2 + 16) | 0; }
        }
        // 3) the hand "selects" Water — highlight the swatch as it taps it (~f262)
        if (el > 262 && !ob.picked) { ob.picked = true; setSel(WATER); }
        // 4) the sweep: splash a falling curtain of water at the hand's x
        if (el >= SWEEP0 && el <= SWEEP0 + SWEEPD && ob.seeds.length) {
          const t = (el - SWEEP0) / SWEEPD;
          const hx = (ob.bedL + (ob.bedR - ob.bedL) * t) | 0;
          for (let k = 0; k < 4; k++) {
            const wx = hx + ((Math.random() * 7 - 3) | 0);
            const wy = WATER_Y - ((Math.random() * 6) | 0);
            const wi = wy * W + wx;
            if (wx >= 0 && wx < W && wy > 0 && sim.grid[wi] === E) sim.grid[wi] = WATER;
          }
          // make the pass count: wet any seed the curtain is currently over
          for (const s of ob.seeds) {
            if (Math.abs(s.x - hx) < 5) {
              sim.wet[s.y * W + s.x] = 255;
              if (s.y + 1 < H) sim.wet[(s.y + 1) * W + s.x] = 255;
            }
          }
        }
        // 5) a flower or two as a payoff once the plants have climbed
        if (el > 444 && !ob.flowered) {
          ob.flowered = true;
          const cand = [];
          for (let y = 1; y < H - 1; y++) {
            for (let x = 0; x < W; x++) {
              const i = y * W + x;
              if (sim.grid[i] === E && ISPLANT[sim.grid[i + W]]) cand.push(i);
            }
          }
          for (let n = 0; n < 2 && cand.length; n++) {
            const i = cand.splice((Math.random() * cand.length) | 0, 1)[0];
            sim.grid[i] = FLOWER;
            sim.aux[i] = (Math.random() * 4) | 0;
          }
        }
        if (el > 500) { ob.active = false; setHint(true); } // hand off with the hint
      }

      /* --- painting --- */
      const pr = pointerRef.current;
      if (doStep && pr.down) {
        const elSel = selRef.current;
        // a soft, throttled placement sound while dragging (lightning sounds per strike)
        if (elSel !== LIGHTNING_TOOL && now - lastSoundT > 150) { audio.place(elSel); lastSoundT = now; }
        if (elSel === LIGHTNING_TOOL) {
          if (modeRef.current === 'destroy' && now - pr.lastStrike > 320 &&
              (pr.x !== pr.lastX || pr.y !== pr.lastY)) {
            strike(sim, pr.x, pr.y);
            audio.place(LIGHTNING_TOOL);
            pr.lastStrike = now;
            markDestructive(now);
          }
        } else {
          const steps = Math.max(Math.abs(pr.x - pr.lastX), Math.abs(pr.y - pr.lastY), 1);
          for (let n = 0; n < steps; n++) {
            const x = Math.round(pr.lastX + (pr.x - pr.lastX) * (n + 1) / steps);
            const y = Math.round(pr.lastY + (pr.y - pr.lastY) * (n + 1) / steps);
            if (paintAt(sim, x, y, elSel, pr.windDir)) markDestructive(now);
          }
          en.lastPaint = now;
          if (now - lastSparkT > 45) {
            const col = ELEM_COLOR[elSel] || '#fff';
            spawnSparks(pr.x, pr.y, col, modeRef.current === 'destroy' ? 3 : 2,
                        modeRef.current === 'destroy' ? 2.4 : 1.3);
            lastSparkT = now;
          }
        }
        pr.lastX = pr.x; pr.lastY = pr.y;
      }

      /* --- physics --- */
      if (doStep) {
        step(sim, ob.active ? 0.16 : 0.05);
        lastStep = now;
      }

      /* --- ending detection: the world has gone quiet --- */
      if (en.phase === 'live' && modeRef.current === 'destroy' && en.armed && sim.frame % 15 === 0) {
        let organics = 0, active = 0;
        const g = sim.grid;
        for (let i = 0; i < g.length; i++) {
          const c = g[i];
          if (ISPLANT[c] || c === MOSS || c === FLOWER || c === VINE || c === WOOD || c === LEAF || c === FBASE) organics++;
          else if (c === FIRE || c === WIND || c === LAVA || c === BOLT || c === MITE) active++;
          else if (c === FUNGUS && sim.meta[i] > 0) active++;
        }
        if (organics === 0 && active === 0 && !pr.down && now - en.lastPaint > 2200) en.quiet++;
        else en.quiet = 0;
        if (en.quiet >= 4) { en.phase = 'hold'; en.start = now; }
      }
      if (en.phase === 'hold' && now - en.start > 1500) {
        en.phase = 'sweep'; en.start = now; en.sweepCol = 0;
      }
      sweepX = -1;
      if (en.phase === 'sweep') {
        const f = Math.min(1, (now - en.start) / 1400);
        sweepX = (f * (W + 8)) | 0;
        const until = Math.min(W, sweepX);
        for (let x = en.sweepCol; x < until; x++) {
          for (let y = 0; y < H; y++) {
            const i = y * W + x;
            sim.grid[i] = E; sim.meta[i] = 0; sim.aux[i] = 0; sim.wet[i] = 0; sim.frost[i] = 0;
          }
        }
        if (until > en.sweepCol) en.sweepCol = until;
        if (f >= 1) { resetToBuild(); sweepX = -1; }
      }
    };
    if (import.meta.env.DEV) {
      window.__thTick = (n) => {
        let t = performance.now();
        for (let k = 0; k < n; k++) { t += 16; tick(t); lastStep = 0; }
      };
    }

    const frame = () => {
      const now = performance.now();
      tick(now);

      /* --- render --- */
      const tr = transRef.current;
      const p = Math.min(1, (now - tr.start) / 650);
      const toDestroy = tr.to === 'destroy';
      const bg = {
        fr: tr.from === 'destroy' ? BG_DESTROY : BG_BUILD,
        to: toDestroy ? BG_DESTROY : BG_BUILD,
        skyFr: tr.from === 'destroy' ? SKY_DESTROY : SKY_BUILD,
        skyTo: toDestroy ? SKY_DESTROY : SKY_BUILD,
        p,
        dirUp: toDestroy,
      };
      render(sim, img.data, now, bg, sweepX);
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, W, H, 0, 0, cv.width, cv.height);
      const destroyMode = modeRef.current === 'destroy';
      drawMotes(ctx, cv.width, cv.height, destroyMode);
      drawSparks();
      drawBg(destroyMode);
      updateGhost();

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wakeEvents.forEach((ev) => window.removeEventListener(ev, startAmbient));
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const elBtn = (d, hidden) => (
    <button
      key={d.t}
      className="th-el"
      data-el={d.t}
      aria-pressed={sel === d.t}
      tabIndex={hidden ? -1 : 0}
      onClick={() => setSel(d.t)}
    >
      <span className="th-sw" style={{ background: d.c }} aria-hidden="true" />
      {d.n}
    </button>
  );

  const isDestroy = mode === 'destroy';

  return (
    <div ref={rootRef} className={`th-root${isDestroy ? ' th-destroy' : ''}`}>
      <style>{CSS}</style>
      <div className="th-atmos" aria-hidden="true" />
      <div className="th-grain" aria-hidden="true" />
      <canvas ref={bgCanvasRef} className="th-bgfx" aria-hidden="true" />
      <img ref={ghostRef} className="th-ghost" src={GHOST_HAND} alt="" aria-hidden="true" draggable="false" />
      {fx.n > 0 && (
        <div
          key={fx.n}
          className={`th-flash ${fx.to === 'destroy' ? 'ignite' : 'cool'}`}
          aria-hidden="true"
        />
      )}
      <header className="th-header">
        <h1 className="th-title">TINY HAVOC</h1>
        <span className="th-ind" aria-live="polite">
          <span className="i-b">Build</span>
          <span className="i-d">Destroy</span>
        </span>
        <div className="th-htools">
          <button
            className="th-snd"
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Mute sound' : 'Turn sound on'}
            dangerouslySetInnerHTML={{ __html: soundOn ? SPEAKER_ON : SPEAKER_OFF }}
          />
          <div className="th-sharewrap">
            <button
              className="th-snd th-share"
              onClick={() => setShareOpen((o) => !o)}
              data-tip="Share"
              aria-haspopup="dialog"
              aria-expanded={shareOpen}
              aria-label="Share Tiny Havoc"
              dangerouslySetInnerHTML={{ __html: SHARE_SVG }}
            />
            {shareOpen && (
              <>
                <div className="th-shareveil" onClick={() => setShareOpen(false)} />
                <div className="th-sharebox" role="dialog" aria-label="Share Tiny Havoc">
                  <div className="th-sharehead">
                    <span className="th-shareicon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: TH_EMBLEM }} />
                    <div className="th-sharecopy">
                      <strong>Tiny Havoc</strong>
                      <p>Know someone who&rsquo;d love to grow a little world &mdash; then take it apart? Send it their way.</p>
                    </div>
                  </div>
                  <div className="th-shareacts">
                    <button className="th-sharebtn" onClick={copyLink}>
                      {shared ? 'Link copied ✓' : 'Copy link'}
                    </button>
                    {canNativeShare && (
                      <button className="th-sharebtn primary" onClick={nativeShare}>Share to apps</button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <button className="th-like" onClick={onLike} aria-label="Send this little world some love">
            <span
              className={pop > 0 ? 'th-heart pop' : 'th-heart'}
              key={pop}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: HEART_SVG }}
            />
            {hearts.map((b) => (
              <span className="th-burst" key={b.id} aria-hidden="true">
                {b.burst.map((h) => (
                  <span
                    className="th-fly"
                    key={h.k}
                    style={{
                      '--dx': `${h.dx}px`, '--s': h.s,
                      animationDelay: `${h.delay}ms`, animationDuration: `${h.dur}ms`,
                    }}
                    dangerouslySetInnerHTML={{ __html: HEART_SVG }}
                  />
                ))}
              </span>
            ))}
          </button>
          <button
            className="th-about"
            onClick={() => setAbout(true)}
            aria-haspopup="dialog"
            aria-label="About Tiny Havoc"
          >
            About
          </button>
        </div>
      </header>
      <div className="th-stage">
        <div className="th-canvas-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="th-canvas"
            width={W * 4}
            height={H * 4}
            aria-label="Tiny Havoc world"
          />
          <div className="th-vignette" aria-hidden="true" />
          <div className="th-tools">
            <button
              className="th-tool"
              onClick={() => undoRef.current()}
              disabled={!canUndo}
              aria-label="Undo"
              data-tip="Undo"
            >
              <span className="th-ico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: UNDO_SVG }} />
              <span className="th-tlabel">Undo</span>
            </button>
            <button
              className="th-tool"
              onClick={() => clearRef.current()}
              aria-label="Clear the world"
              data-tip="Clear"
            >
              <span className="th-ico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: RESET_SVG }} />
              <span className="th-tlabel">Clear</span>
            </button>
          </div>
          <div className={`th-hint${hint ? '' : ' gone'}`} aria-hidden="true">
            {isDestroy ? 'Hold and drag to unleash havoc' : 'Hold and drag to grow your world'}
          </div>
        </div>
      </div>
      {about && (
        <div className="th-modal" role="dialog" aria-modal="true" aria-label="About Tiny Havoc"
             onClick={() => setAbout(false)}>
          <div className="th-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="th-ctitle">TINY HAVOC</h2>
            <p>A tiny living world you grow — then take apart.</p>
            <p><strong>Build:</strong> hold and drag to place soil, water, and life. Water your
            soil and plants; flowers and vines spread on their own.</p>
            <p><strong>Destroy:</strong> unleash fire, wind, lava, lightning, ice, fungus, and
            mites. Switch back to Build any time — create, destroy, repeat.</p>
            <button className="th-tbtn th-close" onClick={() => setAbout(false)}>Close</button>
          </div>
        </div>
      )}
      <div className="th-palette">
        <div className="th-panes">
          <div
            className={`th-pane ${isDestroy ? 'hidden' : 'shown'}`}
            role="toolbar"
            aria-label="Build elements"
            aria-hidden={isDestroy}
          >
            <div className="th-row">{BUILD_TERRAIN.map((d) => elBtn(d, isDestroy))}</div>
            <div className="th-row">{BUILD_ORGANIC.map((d) => elBtn(d, isDestroy))}</div>
          </div>
          <div
            className={`th-pane ${isDestroy ? 'shown' : 'hidden'}`}
            role="toolbar"
            aria-label="Destroy elements"
            aria-hidden={!isDestroy}
          >
            <div className="th-row">{DESTROY_ROW1.map((d) => elBtn(d, !isDestroy))}</div>
            <div className="th-row">{DESTROY_ROW2.map((d) => elBtn(d, !isDestroy))}</div>
          </div>
        </div>
        <button className="th-switch" onClick={onModeSwitch}>
          {isDestroy ? '← Build' : 'Destroy →'}
        </button>
      </div>
    </div>
  );
}
