/* 场景渲染器的绘制原语（SVG）。
 *
 * 从 render-scene.js 里抽出来，是因为经典算法动画（指针条、链表、DP 表格…）
 * 要新写一批渲染器，它们需要的"舞台 / 面板 / 圆角矩形 / 文字 / 绿浪"完全一样。
 * 原语复制一份的后果就是样式和行为各走各的，最后两份都改不动。
 *
 * 约定：所有渲染器都画在 800×300 的 viewBox 里，播放器负责等比缩放。
 */
import { THEME } from "./theme.js?v=16";
import { mixHex } from "./motion.js?v=16";

export const NS = "http://www.w3.org/2000/svg";
export const W = 800;
export const H = 300;
export const WAVE_SWEEP = 0.55;
export const WAVE_FLASH = 0.3;

/* ---------------- SVG 原语 ---------------- */

export function mk(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

export function text(parent, x, y, str, o = {}) {
  const t = mk("text", {
    x, y,
    fill: o.fill || THEME.muted,
    "font-size": o.size || 12,
    "text-anchor": o.anchor || "middle",
    "dominant-baseline": "central",
  }, parent);
  t.textContent = str;
  return t;
}

/* chrome=true 表示"这是一块容器底板"：它天生要被别的矩形盖在上面（面板底、卡片底、轨道底）。
 * 测试靠这个标记区分"容器"与"内容块"，只对内容块做重叠检查——
 * 否则面板里嵌的行、轨道上叠的进度条都会被误判成压盖。 */
export function rect(parent, x, y, w, h, o = {}) {
  const attrs = {
    x, y, width: w, height: h,
    rx: o.rx ?? 6,
    fill: o.fill ?? THEME.panel,
    stroke: o.stroke ?? "none",
    "stroke-width": o.strokeWidth ?? 0,
    opacity: o.opacity ?? 1,
  };
  if (o.chrome) attrs.class = "scene-chrome";
  return mk("rect", attrs, parent);
}

export function createStage(title) {
  const svg = mk("svg", {
    viewBox: `0 0 ${W} ${H}`, class: "anim-svg", preserveAspectRatio: "xMidYMid meet",
  });
  rect(svg, 0, 0, W, H, { rx: 12, fill: THEME.bg, chrome: true });
  text(svg, 24, 22, title, { anchor: "start", fill: THEME.accent, size: 13 });
  return svg;
}

/* 亮色底的墨色。
 * 实测 bug：面板行/节点底色用 sorted(#34D399) 这类高饱和亮色时，
 * 浅色文字（text #E6ECF5 / muted #93A4BF）会糊成一片，
 * Top-K 的相似度分数几乎读不出来。亮底一律换成深色墨，暗底才用浅色。 */
const BRIGHT_FILLS = new Set([
  THEME.sorted, THEME.comparing, THEME.written, THEME.swapping, THEME.key,
].map((c) => c.toUpperCase()));

/** 返回亮色底上该用的深色墨；底色本来就暗则返回 null（表示沿用浅色） */
export function inkOn(fill) {
  return BRIGHT_FILLS.has(String(fill || "").toUpperCase()) ? "#0B1020" : null;
}

/* 通用面板：标题 + 若干行（行可动态显示/隐藏） */
export function createPanel(parent, x, y, w, h, title, maxRows) {
  rect(parent, x, y, w, h, { rx: 10, fill: THEME.panel, stroke: THEME.grid, "stroke-width": 1, chrome: true });
  text(parent, x + 10, y + 16, title, { anchor: "start", fill: THEME.muted, size: 12 });
  const rows = [];
  for (let i = 0; i < maxRows; i++) {
    const ry = y + 34 + i * 26;
    const r = rect(parent, x + 8, ry, w - 16, 22, { rx: 5, fill: THEME.bar, opacity: 0 });
    const label = text(parent, x + 16, ry + 11, "", { anchor: "start", fill: THEME.text, size: 12, opacity: 0 });
    const value = text(parent, x + w - 16, ry + 11, "", { anchor: "end", fill: THEME.muted, size: 12, opacity: 0 });
    rows.push({ rect: r, label, value });
  }
  return {
    rows,
    set(i, { label, value, fill, opacity }) {
      const row = rows[i];
      if (!row) return;
      if (label === null || label === undefined) {
        row.rect.setAttribute("opacity", 0);
        row.label.setAttribute("opacity", 0);
        row.value.setAttribute("opacity", 0);
        return;
      }
      const bg = fill || THEME.bar;
      const ink = inkOn(bg);
      row.rect.setAttribute("fill", bg);
      row.rect.setAttribute("opacity", opacity ?? 1);
      row.label.textContent = label;
      row.label.setAttribute("fill", ink || THEME.text);
      row.label.setAttribute("opacity", opacity ?? 1);
      row.value.textContent = value === undefined ? "" : String(value);
      row.value.setAttribute("fill", ink || THEME.muted);
      row.value.setAttribute("opacity", opacity ?? 1);
    },
  };
}

/* 完成绿浪：结果元素从左到右依次混白闪光 */
export function applyWave(els, waveT) {
  if (waveT === null || waveT === undefined) {
    els.forEach((e) => e.rect.setAttribute("fill", e.base));
    return;
  }
  els.forEach((e, i) => {
    const local = (waveT - (i * WAVE_SWEEP) / Math.max(1, els.length)) / WAVE_FLASH;
    if (local > 0 && local < 1) {
      e.rect.setAttribute("fill", mixHex(e.base, "#FFFFFF", Math.sin(Math.PI * local) * 0.75));
    } else {
      e.rect.setAttribute("fill", e.base);
    }
  });
}

export function segsOf(path) {
  return String(path).replace(/^\/+|\/+$/g, "").split("/");
}

export function shorten(s, n = 28) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/* ---------------- 条形布局（多渲染器共用） ----------------
 * 一排等宽槽位，返回每个槽位的中心 x 与宽度。
 * 指针条、滑窗、计数排序都要这个，各写一份迟早对不齐。 */
export function makeSlots({ n, left = 24, right = 560, gap = 0.34 }) {
  const span = right - left;
  const slot = span / n;
  const barW = Math.max(10, slot * (1 - gap));
  const cx = (i) => left + slot * i + slot / 2;
  return { slot, barW, cx, left, right };
}

/* 等宽格子（滑窗的字符、DP 的单元格）：不按数值定高，统一高度 */
export function makeCells({ n, left = 24, right = 560, cellH = 40, gap = 6 }) {
  const span = right - left;
  const slot = span / n;
  const cellW = Math.max(14, slot - gap);
  const cx = (i) => left + slot * i + slot / 2;
  return { slot, cellW, cellH, cx, left, right };
}
