/* 经典算法场景渲染器：计数排序 / 二分查找 / 二分答案 / 盛水双指针 / 滑窗 / 跳跃 / 链表反转 / 快慢指针。
 *
 * 与 render-scene.js 同一套约定（画在 800×300、纯函数、入场错峰、完成绿浪），
 * 绘制原语全部来自 render-kit.js。
 *
 * 指针类动画的一个共同细节：指针的位置要在两帧之间插值，
 * 否则指针是"跳"的而柱子是"滑"的，看着很割裂。
 * 所以这里统一用 stateA/stateB 的 pointers 做 lerp（见 pointerX）。
 */
import { THEME } from "./theme.js?v=16";
import { clamp01, easeInOutCubic, mixHex } from "./motion.js?v=16";
import {
  H, WAVE_FLASH, mk, text, rect, createStage, createPanel, applyWave, inkOn,
  makeSlots, makeCells,
} from "./render-kit.js?v=16";

/* 指针牌"没有指向任何元素"时停在这里。
 * 早先写的是 0，牌宽 38 且居中摆放 → x = -19，直接跑到画布外（虽然 opacity 为 0
 * 看不见，但一旦哪天忘了关 opacity 就是缺一块，而且几何越界检查会一直报警）。 */
const HIDDEN_X = 60;

/* 决策 → 配色：这套映射在指针类/链表类渲染器里共用，
 * 保证"淘汰=变暗、命中=变绿、正在看=高亮"在所有动画里是同一种语言。 */
function decisionFill(keep) {
  switch (keep) {
    case "hit": case "meet": case "placed": return THEME.sorted;
    case "ok": case "counted": case "dup": return THEME.comparing;
    case "drop": case "dead": case "tooSmall": case "tooBig": case "none": return THEME.dim;
    default: return THEME.bar;
  }
}

/* 指针在两帧之间滑动 */
function pointerX(stateA, stateB, name, cx, ease) {
  const a = stateA.pointers ? stateA.pointers[name] : undefined;
  const b = stateB.pointers ? stateB.pointers[name] : undefined;
  if (b === undefined || b === null) return null;
  if (a === undefined || a === null || a === b) return cx(b);
  return cx(a) + (cx(b) - cx(a)) * ease;
}

/* ---------------- 1. 计数排序 ---------------- */

function countingRenderer(input) {
  const { values } = input;
  const n = values.length;
  const maxV = Math.max(...values, 1);
  const svg = createStage(`计数排序：不比较任何两个元素（n=${n}）`);

  const slots = makeSlots({ n, left: 24, right: 340, gap: 0.3 });
  const baseY = 250;
  const maxH = 100;
  text(svg, 24, 42, "输入（等待计数）", { anchor: "start", size: 12 });
  const bars = [];
  const valTexts = [];
  const idxTexts = [];
  values.forEach((v, i) => {
    const x = slots.cx(i) - slots.barW / 2;
    bars.push(rect(svg, x, baseY, slots.barW, 0, { rx: 4, fill: THEME.bar }));
    valTexts.push(text(svg, slots.cx(i), baseY - 10, String(v), { size: 12, fill: THEME.barText }));
    idxTexts.push(text(svg, slots.cx(i), baseY + 14, String(i), { size: 11 }));
  });

  const histTitle = text(svg, 366, 42, "计数", { anchor: "start", size: 12 });
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  const hSlots = makeSlots({ n: distinct.length, left: 366, right: 556, gap: 0.3 });
  const histBars = [];
  const histVals = [];
  const histKeys = [];
  distinct.forEach((v, k) => {
    const x = hSlots.cx(k) - hSlots.barW / 2;
    histBars.push(rect(svg, x, baseY, hSlots.barW, 0, { rx: 4, fill: THEME.written }));
    histVals.push(text(svg, hSlots.cx(k), baseY - 10, "", { size: 12, fill: THEME.barText }));
    histKeys.push(text(svg, hSlots.cx(k), baseY + 14, String(v), { size: 11 }));
  });

  const outPanel = createPanel(svg, 580, 44, 196, 216, "输出位（倒着填）", n);
  const resultEls = outPanel.rows.map((r) => ({ rect: r.rect, base: THEME.sorted }));

  return {
    svg,
    elementCount: n + distinct.length + n,
    stats(state) {
      const placed = state.metrics.placed || 0;
      const counted = state.metrics.counted || 0;
      return placed > 0 ? `已放 ${placed}/${n}` : `已数 ${counted}/${n}`;
    },
    render({ stateA, stateB, t, ent, waveT }) {
      const ease = easeInOutCubic(t);
      const hist = stateB.lists.prefix || stateB.lists.count || [];
      histTitle.textContent = stateB.lists.prefix ? "前缀和（累加后）" : "计数";

      values.forEach((v, i) => {
        const d = stateB.decisions[i] === undefined ? stateA.decisions[i] : stateB.decisions[i];
        const h = (v / maxV) * maxH * ent(i);
        bars[i].setAttribute("height", h);
        bars[i].setAttribute("y", baseY - h);
        bars[i].setAttribute("fill", decisionFill(d));
        valTexts[i].setAttribute("y", baseY - h - 10);
        idxTexts[i].setAttribute("opacity", ent(i));
      });

      const histA = stateA.lists.prefix || stateA.lists.count || [];
      const maxC = Math.max(...hist, 1);
      distinct.forEach((v, k) => {
        const ca = histA[k] || 0;
        const cb = hist[k] || 0;
        const c = ca + (cb - ca) * ease;
        const h = (c / maxC) * maxH * ent(n + k);
        histBars[k].setAttribute("height", h);
        histBars[k].setAttribute("y", baseY - h);
        histVals[k].textContent = cb ? String(cb) : "";
        histVals[k].setAttribute("y", baseY - h - 10);
        histKeys[k].setAttribute("opacity", ent(n + k));
      });

      const out = stateB.lists.out || stateA.lists.out || [];
      out.forEach((v, k) => {
        if (v === null || v === undefined) { outPanel.set(k, { label: null }); return; }
        outPanel.set(k, {
          label: `out[${k}]`, value: v, fill: THEME.sorted, opacity: ent(n + distinct.length + k),
        });
      });
      for (let k = out.length; k < n; k++) outPanel.set(k, { label: null });
      applyWave(resultEls.slice(0, out.filter((v) => v !== null).length), waveT);
    },
  };
}

/* ---------------- 2. 通用"柱子 + 指针 + 区间" ----------------
 * 二分查找 / 盛水双指针 / 跳跃游戏共用：都是"一串数字 + 命名指针 + 一个考察区间"。 */

function makePointerBars({ title, metrics, resultLabel, resultFmt }) {
  return function pointerBarsRenderer(input) {
    const values = input.values || input.height || input.nums || [];
    const n = values.length;
    const maxV = Math.max(...values, 1);
    const svg = createStage(title(input));

    const slots = makeSlots({ n, left: 24, right: 560, gap: 0.32 });
    const baseY = 236;
    /* 柱高上限要给最上面那行指针牌留位置：最高的柱子，数值标签画在 baseY-h-10，
     * h 太大就会顶进指针牌里（实测"91"压在 hi 牌上，大屏上看不见）。 */
    const maxH = 104;
    const bars = [];
    const valTexts = [];
    const idxTexts = [];
    values.forEach((v, i) => {
      const x = slots.cx(i) - slots.barW / 2;
      bars.push(rect(svg, x, baseY, slots.barW, 0, { rx: 4, fill: THEME.bar }));
      valTexts.push(text(svg, slots.cx(i), baseY - 10, String(v), { size: 12, fill: THEME.barText }));
      idxTexts.push(text(svg, slots.cx(i), baseY + 14, String(i), { size: 11 }));
    });

    /* 指针牌：每个指针一行，牌跟着指针所在槽位滑动 */
    const chipRows = {};
    metrics.pointers.forEach((name, k) => {
      const y = 46 + k * 24;
      chipRows[name] = {
        box: rect(svg, 0, y - 9, 38, 18, { rx: 5, fill: THEME.comparing, opacity: 0 }),
        label: text(svg, 0, y, name, { size: 11, fill: "#1A1004", opacity: 0 }),
        line: mk("line", { x1: 0, y1: y + 9, x2: 0, y2: baseY - maxH - 6, stroke: THEME.comparing, "stroke-width": 1, "stroke-dasharray": "3 4", opacity: 0 }, svg),
      };
    });

    const panel = createPanel(svg, 596, 44, 180, 150, "当前状态", metrics.rows.length + 1);
    const metricTexts = metrics.rows.map(() => null);
    metrics.rows.forEach((row, k) => { metricTexts[k] = panel.rows[k]; });
    const resultRow = panel.rows[metrics.rows.length];
    const resultEls = [{ rect: resultRow.rect, base: THEME.sorted }];

    return {
      svg,
      elementCount: n + metrics.pointers.length + metrics.rows.length + 1,
      stats(state) {
        return metrics.rows
          .map((r) => `${r.label} ${state.metrics[r.name] === undefined ? "—" : state.metrics[r.name]}`)
          .join(" · ");
      },
      render({ stateA, stateB, t, ent, waveT }) {
        const ease = easeInOutCubic(t);
        const range = stateB.range;
        values.forEach((v, i) => {
          const d = stateB.decisions[i] === undefined ? stateA.decisions[i] : stateB.decisions[i];
          const inRange = !range || (i >= range.lo && i <= range.hi);
          const h = (v / maxV) * maxH * ent(i);
          bars[i].setAttribute("height", h);
          bars[i].setAttribute("y", baseY - h);
          let fill = decisionFill(d);
          if (!inRange && d === undefined) fill = THEME.dim;
          bars[i].setAttribute("fill", fill);
          bars[i].setAttribute("opacity", inRange ? 1 : 0.45);
          valTexts[i].setAttribute("y", baseY - h - 10);
          idxTexts[i].setAttribute("opacity", ent(i));
        });

        metrics.pointers.forEach((name) => {
          const c = chipRows[name];
          const x = pointerX(stateA, stateB, name, slots.cx, ease);
          const at = stateB.pointers ? stateB.pointers[name] : undefined;
          const show = x !== null && at !== undefined && at !== null && at >= 0;
          const op = show ? ent(n) : 0;
          c.box.setAttribute("x", (x === null ? HIDDEN_X : x) - 19);
          c.box.setAttribute("opacity", op);
          c.label.setAttribute("x", x === null ? HIDDEN_X : x);
          c.label.setAttribute("opacity", op);
          c.line.setAttribute("x1", x === null ? HIDDEN_X : x);
          c.line.setAttribute("x2", x === null ? HIDDEN_X : x);
          c.line.setAttribute("opacity", op * 0.8);
        });

        metrics.rows.forEach((row, k) => {
          const v = stateB.metrics[row.name];
          metricTexts[k].rect.setAttribute("fill", THEME.bar);
          metricTexts[k].rect.setAttribute("opacity", ent(n + 2 + k));
          metricTexts[k].label.textContent = row.label;
          metricTexts[k].label.setAttribute("fill", THEME.text);
          metricTexts[k].label.setAttribute("opacity", ent(n + 2 + k));
          metricTexts[k].value.textContent = v === undefined ? "—" : String(v);
          metricTexts[k].value.setAttribute("fill", THEME.muted);
          metricTexts[k].value.setAttribute("opacity", ent(n + 2 + k));
        });

        const ans = stateB.lists.answer;
        const done = ans && ans.length;
        resultRow.rect.setAttribute("opacity", done ? ent(n + 6) : 0);
        resultRow.rect.setAttribute("fill", THEME.sorted);
        resultRow.label.textContent = resultLabel;
        resultRow.label.setAttribute("fill", "#0B1020");
        resultRow.label.setAttribute("opacity", done ? ent(n + 6) : 0);
        resultRow.value.textContent = done ? resultFmt(ans[0]) : "";
        resultRow.value.setAttribute("fill", "#0B1020");
        resultRow.value.setAttribute("opacity", done ? ent(n + 6) : 0);
        applyWave(done ? resultEls : [], waveT);
      },
    };
  };
}

const binarySearchRenderer = makePointerBars({
  title: (i) => `二分查找：在 ${i.values.length} 个有序元素里找 ${i.target}`,
  metrics: { pointers: ["lo", "mid", "hi"], rows: [{ name: "round", label: "轮次" }] },
  resultLabel: "下标",
  resultFmt: (v) => (v < 0 ? "-1（未找到）" : String(v)),
});

const twoWaterRenderer = makePointerBars({
  title: (i) => `盛水双指针：容量 = 窄边 × 宽度（${i.height.length} 根柱子）`,
  metrics: {
    pointers: ["l", "r"],
    rows: [{ name: "area", label: "容量" }, { name: "best", label: "最大" }],
  },
  resultLabel: "最大容量",
  resultFmt: (v) => String(v),
});

const jumpGameRenderer = makePointerBars({
  title: (i) => `跳跃游戏：只问「最远能到哪」（nums=${i.nums.join(",")}）`,
  metrics: { pointers: ["i"], rows: [{ name: "farthest", label: "最远" }] },
  resultLabel: "能否到达",
  resultFmt: (v) => (v ? "true" : "false"),
});

/* ---------------- 3. 滑窗（字符格子） ---------------- */

function windowRenderer(input) {
  const chars = input.chars.split("");
  const n = chars.length;
  const svg = createStage(`最长无重复子串：右边界只前进（"${input.chars}"）`);

  const cells = makeCells({ n, left: 24, right: 560, cellH: 42, gap: 8 });
  const cellY = 120;
  const boxes = [];
  const labels = [];
  const idxTexts = [];
  chars.forEach((c, i) => {
    const x = cells.cx(i) - cells.cellW / 2;
    boxes.push(rect(svg, x, cellY, cells.cellW, cells.cellH, { rx: 6, fill: THEME.bar }));
    labels.push(text(svg, cells.cx(i), cellY + cells.cellH / 2, c, { size: 15, fill: THEME.text }));
    idxTexts.push(text(svg, cells.cx(i), cellY + cells.cellH + 14, String(i), { size: 11 }));
  });

  /* 窗口框是"盖在格子上的高亮"，标 chrome —— 它不是内容块 */
  const winBox = rect(svg, 0, cellY - 8, 0, cells.cellH + 16, {
    rx: 8, fill: "none", stroke: THEME.comparing, "stroke-width": 2, opacity: 0, chrome: true,
  });

  const chips = {};
  ["lo", "hi"].forEach((name, k) => {
    const y = 66 + k * 24;
    chips[name] = {
      box: rect(svg, 0, y - 9, 38, 18, { rx: 5, fill: THEME.comparing, opacity: 0 }),
      label: text(svg, 0, y, name, { size: 11, fill: "#1A1004", opacity: 0 }),
    };
  });

  const panel = createPanel(svg, 596, 44, 180, 170, "窗口", 4);
  const winText = text(svg, 24, 232, "", { anchor: "start", size: 13, fill: THEME.text });
  const resultEls = [{ rect: panel.rows[3].rect, base: THEME.sorted }];

  return {
    svg,
    elementCount: n + 2,
    stats(state) {
      return `长度 ${state.metrics.len || 0} · 最长 ${state.metrics.best || 0}`;
    },
    render({ stateA, stateB, t, ent, waveT }) {
      const ease = easeInOutCubic(t);
      const range = stateB.range || { lo: 0, hi: -1 };
      chars.forEach((c, i) => {
        const d = stateB.decisions[i] === undefined ? stateA.decisions[i] : stateB.decisions[i];
        const bg = decisionFill(d);
        boxes[i].setAttribute("fill", bg);
        boxes[i].setAttribute("opacity", ent(i));
        labels[i].setAttribute("fill", inkOn(bg) || THEME.text);
        labels[i].setAttribute("opacity", ent(i));
        idxTexts[i].setAttribute("opacity", ent(i));
      });

      const loX = cells.cx(range.lo) - cells.cellW / 2 - 6;
      const hiX = cells.cx(range.hi) + cells.cellW / 2 + 6;
      const shown = range.hi >= range.lo;
      const w = Math.max(0, hiX - loX);
      winBox.setAttribute("x", loX);
      winBox.setAttribute("width", w);
      winBox.setAttribute("opacity", shown ? ease : 0);

      ["lo", "hi"].forEach((name) => {
        const c = chips[name];
        const x = pointerX(stateA, stateB, name, cells.cx, ease);
        const at = stateB.pointers ? stateB.pointers[name] : undefined;
        const show = x !== null && at !== undefined && at >= 0;
        c.box.setAttribute("x", (x === null ? HIDDEN_X : x) - 19);
        c.box.setAttribute("opacity", show ? ent(n) : 0);
        c.label.setAttribute("x", x === null ? HIDDEN_X : x);
        c.label.setAttribute("opacity", show ? ent(n) : 0);
      });

      panel.set(0, { label: "窗口", value: shown ? `"${chars.slice(range.lo, range.hi + 1).join("")}"` : "—", fill: THEME.bar, opacity: ent(n) });
      panel.set(1, { label: "当前长度", value: stateB.metrics.len === undefined ? "—" : stateB.metrics.len, fill: THEME.bar, opacity: ent(n) });
      panel.set(2, { label: "最长", value: stateB.metrics.best === undefined ? "—" : stateB.metrics.best, fill: THEME.bar, opacity: ent(n) });

      const ans = stateB.lists.answer;
      const done = ans && ans.length;
      panel.set(3, {
        label: "答案", value: done ? String(ans[0]) : "",
        fill: THEME.sorted, opacity: done ? ent(n + 1) : 0,
      });
      winText.textContent = shown ? `窗口 = "${chars.slice(range.lo, range.hi + 1).join("")}"（[${range.lo}, ${range.hi}]）` : "";
      applyWave(done ? resultEls : [], waveT);
    },
  };
}

/* ---------------- 4. 二分答案（柱子 + 答案空间轨道） ---------------- */

function answerSpaceRenderer(input) {
  const { piles, hours } = input;
  const n = piles.length;
  const maxP = Math.max(...piles);
  const svg = createStage(`二分答案：找最小的 k，使耗时 ≤ ${hours} 小时`);

  const slots = makeSlots({ n, left: 24, right: 340, gap: 0.3 });
  const baseY = 216;
  const maxH = 110;
  text(svg, 24, 42, "每堆的数量", { anchor: "start", size: 12 });
  const bars = [];
  const valTexts = [];
  piles.forEach((v, i) => {
    const x = slots.cx(i) - slots.barW / 2;
    bars.push(rect(svg, x, baseY, slots.barW, 0, { rx: 4, fill: THEME.bar }));
    valTexts.push(text(svg, slots.cx(i), baseY - 10, String(v), { size: 12, fill: THEME.barText }));
  });

  /* k 的水平线：把"速度"画成一条横线，柱子被切成几段就是几小时 */
  const kLine = mk("line", {
    x1: 20, y1: baseY, x2: 344, y2: baseY,
    stroke: THEME.pivot, "stroke-width": 2, "stroke-dasharray": "6 4", opacity: 0,
  }, svg);
  const kTag = text(svg, 350, baseY, "", { anchor: "start", size: 11, fill: THEME.pivot, opacity: 0 });

  /* 答案空间轨道：k 的候选区间 [1, maxP] */
  text(svg, 24, 252, "答案空间 k ∈ [1, " + maxP + "]", { anchor: "start", size: 12 });
  const track = rect(svg, 24, 266, 520, 14, { rx: 7, fill: THEME.dim, chrome: true });
  const seg = rect(svg, 24, 266, 0, 14, { rx: 7, fill: THEME.accent, opacity: 0 });
  const trackLo = text(svg, 24, 292, "1", { size: 11 });
  const trackHi = text(svg, 544, 292, String(maxP), { size: 11 });

  const panel = createPanel(svg, 596, 44, 180, 170, "判定", 5);
  const resultEls = [{ rect: panel.rows[4].rect, base: THEME.sorted }];

  const trackX = (k) => 24 + ((Math.min(k, maxP) - 1) / Math.max(1, maxP - 1)) * 520;

  return {
    svg,
    elementCount: n + 5,
    stats(state) {
      const k = state.metrics.k;
      const h = state.metrics.hours;
      if (k === undefined) return "尚未开始";
      return `k=${k} → ${h} 小时 / ${hours}`;
    },
    render({ stateA, stateB, t, ent, waveT }) {
      const ease = easeInOutCubic(t);
      piles.forEach((v, i) => {
        const h = (v / maxP) * maxH * ent(i);
        bars[i].setAttribute("height", h);
        bars[i].setAttribute("y", baseY - h);
        valTexts[i].setAttribute("y", baseY - h - 10);
      });

      const kA = stateA.metrics.k;
      const kB = stateB.metrics.k;
      const k = kB === undefined ? kA : (kA === undefined ? kB : kA + (kB - kA) * ease);
      const shown = k !== undefined;
      const ky = shown ? baseY - (k / maxP) * maxH : baseY;
      kLine.setAttribute("y1", ky);
      kLine.setAttribute("y2", ky);
      kLine.setAttribute("opacity", shown ? 1 : 0);
      kTag.setAttribute("y", ky);
      kTag.textContent = shown ? `k=${Math.round(k)}` : "";
      kTag.setAttribute("opacity", shown ? 1 : 0);

      const lo = stateB.metrics.lo;
      const hi = stateB.metrics.hi;
      const hasRange = lo !== undefined && hi !== undefined;
      const x0 = hasRange ? trackX(lo) : 24;
      const x1 = hasRange ? trackX(hi) : 544;
      seg.setAttribute("x", x0);
      seg.setAttribute("width", Math.max(4, x1 - x0));
      seg.setAttribute("opacity", hasRange ? 1 : 0);
      trackLo.textContent = hasRange ? String(lo) : "1";
      trackHi.textContent = hasRange ? String(hi) : String(maxP);

      const rows = [
        { label: "k", value: stateB.metrics.k },
        { label: "需要小时", value: stateB.metrics.hours },
        { label: "上限", value: hours },
        { label: "轮次", value: stateB.metrics.round },
      ];
      rows.forEach((r, idx) => {
        panel.set(idx, {
          label: r.label, value: r.value === undefined ? "—" : r.value,
          fill: THEME.bar, opacity: ent(n + idx),
        });
      });
      const verdict = stateB.lists.verdict;
      if (verdict && verdict.length) {
        const ok = verdict[0] === "可行";
        panel.set(2, { label: "判定", value: verdict[0], fill: ok ? THEME.sorted : THEME.comparing, opacity: 1 });
      }

      const ans = stateB.lists.answer;
      const done = ans && ans.length;
      panel.set(4, {
        label: "最小 k", value: done ? String(ans[0]) : "",
        fill: THEME.sorted, opacity: done ? ent(n + 4) : 0,
      });
      applyWave(done ? resultEls : [], waveT);
    },
  };
}

/* ---------------- 5. 链表（反转 / 快慢指针） ---------------- */

function makeListRenderer({ title, pointers, resultLabel, resultFmt }) {
  return function listRenderer(input) {
    const values = input.values;
    const n = values.length;
    const svg = createStage(title(input));

    const boxW = 84;
    const boxH = 40;
    const gap = (760 - 24 - n * boxW) / Math.max(1, n - 1);
    const xOf = (i) => 24 + i * (boxW + Math.min(gap, 60));
    const y0 = 128;

    const nodeBoxes = [];
    const nodeLabels = [];
    const idxTexts = [];
    values.forEach((v, i) => {
      nodeBoxes.push(rect(svg, xOf(i), y0, boxW, boxH, { rx: 7, fill: THEME.bar }));
      nodeLabels.push(text(svg, xOf(i) + boxW / 2, y0 + boxH / 2, String(v), { size: 15, fill: THEME.text }));
      idxTexts.push(text(svg, xOf(i) + boxW / 2, y0 - 12, String(i), { size: 11 }));
    });

    /* 箭头：每种 (from,to) 各画一条，靠 opacity 控制当前是否生效。
     * 反向箭头（to < from）走下方通道，避免从节点框里穿过去。 */
    const arrows = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const x1 = xOf(i) + boxW;
        const x2 = xOf(j);
        const yMid = y0 + boxH / 2;
        const back = j < i;
        const d = back
          ? `M ${x1} ${yMid} Q ${(x1 + x2) / 2} ${y0 + boxH + 46} ${x2} ${yMid}`
          : `M ${x1} ${yMid} L ${x2} ${yMid}`;
        arrows.push({
          from: i, to: j,
          path: mk("path", { d, fill: "none", stroke: THEME.grid, "stroke-width": 1.8, opacity: 0 }, svg),
        });
      }
    }
    /* 指向 None 的箭头 */
    const noneX = xOf(n - 1) + boxW + 46;
    const nonePath = mk("path", {
      d: `M ${xOf(n - 1) + boxW} ${y0 + boxH / 2} L ${noneX} ${y0 + boxH / 2}`,
      fill: "none", stroke: THEME.grid, "stroke-width": 1.8, opacity: 0,
    }, svg);
    const noneText = text(svg, noneX + 14, y0 + boxH / 2, "None", { size: 12, opacity: 0 });

    const chips = {};
    pointers.forEach((name, k) => {
      const y = 58 + k * 24;
      chips[name] = {
        box: rect(svg, 0, y - 9, 44, 18, { rx: 5, fill: THEME.comparing, opacity: 0 }),
        label: text(svg, 0, y, name, { size: 11, fill: "#1A1004", opacity: 0 }),
      };
    });

    const panel = createPanel(svg, 596, 200, 180, 74, "结论", 2);
    const resultEls = [{ rect: panel.rows[0].rect, base: THEME.sorted }];

    return {
      svg,
      elementCount: n + pointers.length + 1,
      stats(state) {
        if (state.metrics.moved !== undefined) return `已掉头 ${state.metrics.moved}/${n}`;
        if (state.metrics.round !== undefined) return `第 ${state.metrics.round} 轮`;
        return "就绪";
      },
      render({ stateA, stateB, t, ent, waveT }) {
        const ease = easeInOutCubic(t);
        const nextB = stateB.lists.next || [];
        const nextA = stateA.lists.next || [];
        const next = nextB.length ? nextB : nextA;

        values.forEach((v, i) => {
          const d = stateB.decisions[i] === undefined ? stateA.decisions[i] : stateB.decisions[i];
          const bg = decisionFill(d);
          const focus = (stateB.focus || []).includes(i);
          nodeBoxes[i].setAttribute("fill", focus ? THEME.comparing : bg);
          nodeBoxes[i].setAttribute("opacity", ent(i));
          nodeLabels[i].setAttribute("fill", inkOn(focus ? THEME.comparing : bg) || THEME.text);
          nodeLabels[i].setAttribute("opacity", ent(i));
          idxTexts[i].setAttribute("opacity", ent(i));
        });

        arrows.forEach((a) => {
          const on = next[a.from] === a.to;
          const wasOn = nextA[a.from] === a.to;
          const op = on ? ease : (wasOn ? 1 - ease : 0);
          a.path.setAttribute("opacity", op * 0.95);
          a.path.setAttribute("stroke", a.to < a.from ? THEME.pivot : THEME.sorted);
        });
        const noneOn = next[n - 1] === -1 || next[n - 1] === undefined;
        nonePath.setAttribute("opacity", noneOn ? 0.9 : 0);
        noneText.setAttribute("opacity", noneOn ? 0.9 : 0);

        pointers.forEach((name) => {
          const c = chips[name];
          const at = stateB.pointers ? stateB.pointers[name] : undefined;
          const prev = stateA.pointers ? stateA.pointers[name] : undefined;
          const show = at !== undefined && at !== null && at >= 0;
          let x = null;
          if (show) {
            const target = xOf(at) + boxW / 2;
            const src = prev !== undefined && prev !== null && prev >= 0 ? xOf(prev) + boxW / 2 : target;
            x = src + (target - src) * ease;
          }
          const op = show ? ent(n) : (at === -1 ? 0 : 0);
          c.box.setAttribute("x", (x === null ? HIDDEN_X : x) - 22);
          c.box.setAttribute("opacity", op);
          c.label.setAttribute("x", x === null ? HIDDEN_X : x);
          c.label.setAttribute("opacity", op);
        });

        const ans = stateB.lists.answer;
        const done = ans && ans.length;
        panel.set(0, {
          label: resultLabel, value: done ? resultFmt(ans[0], values) : "",
          fill: THEME.sorted, opacity: done ? ent(n + 1) : 0,
        });
        panel.set(1, { label: null });
        applyWave(done ? resultEls : [], waveT);
      },
    };
  };
}

const reverseListRenderer = makeListRenderer({
  title: (i) => `链表反转：prev / cur / nxt 三指针（${i.values.join("→")}）`,
  pointers: ["prev", "cur", "nxt"],
  resultLabel: "新链头",
  resultFmt: (head, values) => (head < 0 ? "None" : `${head}（${values[head]}）`),
});

const cycleRenderer = makeListRenderer({
  title: (i) => `快慢指针找环：慢针 1 步、快针 2 步（${i.values.join("→")}）`,
  pointers: ["slow", "fast"],
  resultLabel: "相遇点",
  resultFmt: (at) => (at < 0 ? "无环" : `下标 ${at}`),
});

/* ---------------- 注册表 ---------------- */

const RENDERERS = {
  counting: countingRenderer,
  "binary-search": binarySearchRenderer,
  "binary-answer": answerSpaceRenderer,
  "two-water": twoWaterRenderer,
  "sliding-window": windowRenderer,
  "jump-game": jumpGameRenderer,
  "reverse-list": reverseListRenderer,
  "cycle-detect": cycleRenderer,
};

export function createClassicRenderer(kind, input) {
  const fn = RENDERERS[kind];
  if (!fn) throw new Error(`未知经典算法渲染器: ${kind}`);
  return fn(input);
}

export const CLASSIC_RENDERERS = RENDERERS;
