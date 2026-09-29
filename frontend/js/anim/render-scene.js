/* 场景视图渲染器：向量检索 / 多路召回 / 上下文裁剪 / Trie 路由 / 工作流 DAG / URL 去重。
 *
 * 与柱状图渲染器共用同一套动效原语（入场错峰弹簧、相邻状态插值、完成绿浪混白），
 * 画面依然是 (steps, 浮点进度) 的纯函数 —— 可单步、可回退、可给 Remotion 逐帧渲染。
 *
 * 每个渲染器返回：
 *   { svg, elementCount, stats(state), render({stateA, stateB, t, ent, waveT}) }
 * ent(i) 由播放器提供：第 i 个元素的入场进度（克制型弹簧，错峰）。
 */
import { THEME } from "./theme.js?v=16";
import { clamp01, easeInOutCubic, mixHex } from "./motion.js?v=16";
import { normalizeUrl } from "./agents.js?v=16";
import {
  W, H, WAVE_FLASH, mk, text, rect, createStage, createPanel, applyWave, inkOn,
  segsOf, shorten,
} from "./render-kit.js?v=16";
import { createClassicRenderer } from "./render-classic.js?v=16";

/* ---------------- 1. 向量检索 ---------------- */

function vectorRenderer(input) {
  const { vectors, query, k } = input;
  const svg = createStage(`RAG 向量检索：余弦相似度 Top-${k}（库内 ${vectors.length} 条）`);
  const n = vectors.length;
  const midY = 190;
  const maxH = 60;                     // 上下都要留出数值文字的位置（下面还有轴标签）
  const slot = (560 - 60) / n;
  const barW = Math.min(40, slot * 0.62);

  mk("line", {
    x1: 34, y1: midY, x2: 566, y2: midY,
    stroke: THEME.grid, "stroke-width": 1, "stroke-dasharray": "4 5",
  }, svg);

  const bars = [];
  const simTexts = [];
  for (let i = 0; i < n; i++) {
    const cx = 50 + slot * i + slot / 2;
    bars.push(rect(svg, cx - barW / 2, midY, barW, 0, { rx: 4, fill: THEME.bar }));
    text(svg, cx, midY + 86, `a[${i}]`, { size: 11 });
    simTexts.push(text(svg, cx, midY - 11, "", { size: 11, fill: THEME.muted }));
  }
  text(svg, 24, midY, "相似度 0", { anchor: "start", size: 11 });

  const panel = createPanel(svg, 596, 44, 184, 212, "Top-K 候选（降序）", k);
  const resultEls = panel.rows.map((r) => ({ rect: r.rect, base: THEME.sorted }));

  return {
    svg,
    elementCount: n + k,
    stats(state) {
      const heap = state.lists.heap || [];
      return `已评分 ${state.metrics.scored || 0}/${n} · 候选 ${heap.length}/${k}`;
    },
    render({ stateA, stateB, t, ent, waveT }) {
      const ease = easeInOutCubic(t);
      const focus = new Set(stateB.focus || []);
      const heap = stateB.lists.heap || [];
      const inHeap = new Set(heap.map((e) => e.i));

      for (let i = 0; i < n; i++) {
        const a = stateA.scores[i];
        const b = stateB.scores[i];
        const from = (a === undefined ? 0 : a) * maxH;
        const to = (b === undefined ? 0 : b) * maxH;
        const h = (from + (to - from) * ease) * ent(i);
        const scored = b !== undefined;
        bars[i].setAttribute("height", Math.abs(h));
        bars[i].setAttribute("y", h >= 0 ? midY - h : midY);
        bars[i].setAttribute("opacity", scored ? 1 : 0.35);
        let fill = THEME.bar;
        if (!scored) fill = THEME.dim;
        else if (focus.has(i)) fill = THEME.comparing;
        else if (inHeap.has(i)) fill = THEME.sorted;
        else if (b < 0) fill = THEME.pivot;
        bars[i].setAttribute("fill", fill);
        simTexts[i].textContent = scored ? b.toFixed(2) : "";
        // 负相似度的柱子朝下长，数值要落在柱尾之外（midY - h 对负 h 才是"柱子下端"）
        simTexts[i].setAttribute("y", h >= 0 ? midY - h - 11 : midY - h + 11);
      }

      heap.forEach((e, idx) => {
        panel.set(idx, {
          label: `a[${e.i}]`,
          value: e.sim.toFixed(3),
          fill: THEME.sorted,
          opacity: ent(n + idx),
        });
        resultEls[idx].base = THEME.sorted;
      });
      for (let idx = heap.length; idx < k; idx++) panel.set(idx, { label: null });
      applyWave(resultEls.slice(0, heap.length), waveT);
    },
  };
}

/* ---------------- 2. 多路召回融合 ---------------- */

function rerankRenderer(input) {
  const { routes, k } = input;
  const svg = createStage(`多路召回融合：${routes.length} 路 → 全局 Top-${k}`);
  const rows = [];
  routes.forEach((route, ri) => {
    const x = 24 + ri * 168;
    rect(svg, x, 44, 156, 150, { rx: 10, fill: THEME.panel, stroke: THEME.grid, "stroke-width": 1, chrome: true });
    text(svg, x + 12, 60, `第 ${ri + 1} 路`, { anchor: "start", size: 12, fill: THEME.muted });
    route.forEach((row, idx) => {
      const ry = 76 + idx * 26;
      const r = rect(svg, x + 10, ry, 136, 22, { rx: 5, fill: THEME.bar });
      const label = text(svg, x + 18, ry + 11, row[0], { anchor: "start", size: 12, fill: THEME.text });
      const value = text(svg, x + 138, ry + 11, String(row[1]), { anchor: "end", size: 12, fill: THEME.muted });
      rows.push({ id: `${ri}:${idx}`, rect: r, label, value, doc: row[0] });
    });
  });

  const mapPanel = createPanel(svg, 536, 44, 128, 150, "融合表（取最高分）", 6);
  const topBoxes = [];
  const topLabels = [];
  for (let i = 0; i < k; i++) {
    const x = 24 + i * 96;
    topBoxes.push(rect(svg, x, 240, 88, 30, { rx: 6, fill: THEME.sorted, opacity: 0 }));
    topLabels.push(text(svg, x + 44, 255, "", { size: 12, fill: "#06251A", opacity: 0 }));
  }
  text(svg, 24, 224, `Top-${k} 结果（分数降序）`, { anchor: "start", size: 12, fill: THEME.muted });

  const resultEls = topBoxes.map((r) => ({ rect: r, base: THEME.sorted }));

  return {
    svg,
    elementCount: rows.length + k,
    stats(state) {
      const map = state.lists.map || [];
      const top = state.lists.top || [];
      return `融合表 ${map.length} 篇 · Top ${top.length}`;
    },
    render({ stateA, stateB, t, ent, waveT }) {
      const ease = easeInOutCubic(t);
      const focus = new Set(stateB.focus || []);
      const merged = new Set((stateB.lists.map || []).map((e) => e.doc));

      rows.forEach((r, idx) => {
        const hot = focus.has(r.id);
        const bg = hot ? THEME.comparing : (merged.has(r.doc) ? THEME.sorted : THEME.bar);
        r.rect.setAttribute("fill", bg);
        r.rect.setAttribute("opacity", ent(idx));
        r.label.setAttribute("fill", inkOn(bg) || THEME.text);
        r.value.setAttribute("fill", inkOn(bg) || THEME.muted);
      });

      const map = stateB.lists.map || [];
      map.slice(0, 6).forEach((e, idx) => {
        mapPanel.set(idx, { label: e.doc, value: e.score, fill: THEME.written, opacity: ent(rows.length + idx) });
      });
      for (let idx = map.length; idx < 6; idx++) mapPanel.set(idx, { label: null });

      const top = stateB.lists.top || [];
      const shown = Math.min(top.length, k);
      top.forEach((e, idx) => {
        if (idx >= k) return;
        const grow = 0.15 + 0.85 * ease * ent(rows.length + 6 + idx);
        topBoxes[idx].setAttribute("opacity", grow);
        topBoxes[idx].setAttribute("fill", THEME.sorted);
        topLabels[idx].textContent = e.doc;
        topLabels[idx].setAttribute("opacity", grow);
      });
      for (let idx = shown; idx < k; idx++) {
        topBoxes[idx].setAttribute("opacity", 0);
        topLabels[idx].setAttribute("opacity", 0);
      }
      applyWave(resultEls.slice(0, shown), waveT);
    },
  };
}

/* ---------------- 3. 上下文窗口裁剪 ---------------- */

function ctxRenderer(input) {
  const { messages, budget } = input;
  const svg = createStage(`上下文预算裁剪：预算 ${budget} tokens（system 必留，其余从最新往回）`);
  const maxTokens = Math.max(...messages.map((m) => m.tokens), 1);
  const barX = 24;
  const barW = 452;
  rect(svg, barX, 44, barW, 16, { rx: 8, fill: THEME.dim, chrome: true });   // 轨道底，进度条会盖上来
  const usedBar = rect(svg, barX, 44, 0, 16, { rx: 8, fill: THEME.accent });
  const usedText = text(svg, barX + barW + 70, 52, "", { anchor: "start", size: 12, fill: THEME.text });

  const blocks = [];
  messages.forEach((m, i) => {
    const y = 82 + i * 34;
    const w = Math.max(28, (m.tokens / maxTokens) * 400);
    const r = rect(svg, barX, y, w, 26, { rx: 6, fill: THEME.bar });
    const roleText = text(svg, barX + 10, y + 13, `${i}· ${m.role}`, { anchor: "start", size: 12, fill: THEME.text });
    const tokText = text(svg, barX + w + 52, y + 13, `${m.tokens} tk`, { anchor: "start", size: 11, fill: THEME.muted });
    const strike = mk("line", {
      x1: barX + 6, y1: y + 13, x2: barX + w - 6, y2: y + 13,
      stroke: THEME.text, "stroke-width": 1.5, opacity: 0,
    }, svg);
    blocks.push({ rect: r, roleText, tokText, strike, tokens: m.tokens });
  });

  const outPanel = createPanel(svg, 560, 44, 216, 212, "保留结果（原顺序）", 6);
  const resultEls = outPanel.rows.map((r) => ({ rect: r.rect, base: THEME.sorted }));

  return {
    svg,
    elementCount: messages.length + 6,
    stats(state) {
      const out = state.lists.out || [];
      return `已用 ${state.metrics.used || 0}/${budget} · 保留 ${out.length}/${messages.length} 条`;
    },
    render({ stateA, stateB, t, ent, waveT }) {
      const ease = easeInOutCubic(t);
      const usedA = stateA.metrics.used || 0;
      const usedB = stateB.metrics.used || 0;
      const used = usedA + (usedB - usedA) * ease;
      usedBar.setAttribute("width", Math.min(barW, (used / budget) * barW));
      usedText.textContent = `已用 ${Math.round(used)} / ${budget}`;

      messages.forEach((m, i) => {
        const b = blocks[i];
        const a = stateA.decisions[i];
        const c = stateB.decisions[i];
        const cur = c === undefined ? a : c;
        let fill = THEME.bar;
        if (m.role === "system") fill = THEME.pivot;
        if (cur === "keep") fill = THEME.sorted;
        else if (cur === "drop") fill = THEME.dim;
        const decided = cur !== undefined;
        const bg = decided ? fill : THEME.bar;
        b.rect.setAttribute("fill", bg);
        b.rect.setAttribute("opacity", (cur === "drop" ? 0.5 : 1) * ent(i));
        // roleText 落在色块内部，要跟着底色换墨；tokText 在色块右侧的舞台上，保持浅色
        b.roleText.setAttribute("fill", inkOn(bg) || THEME.text);
        b.strike.setAttribute("opacity", cur === "drop" ? 0.9 : 0);
      });

      const out = stateB.lists.out || [];
      out.slice(0, 6).forEach((idx, r) => {
        outPanel.set(r, {
          label: `消息 ${idx} · ${messages[idx].tokens} tk`,
          value: messages[idx].role,
          fill: THEME.sorted,
          opacity: ent(messages.length + r),
        });
      });
      for (let r = out.length; r < 6; r++) outPanel.set(r, { label: null });
      applyWave(resultEls.slice(0, Math.min(out.length, 6)), waveT);
    },
  };
}

/* ---------------- 4. Trie 最长前缀路由 ---------------- */

function routerRenderer(input) {
  const { routes, query } = input;
  const svg = createStage(`最长前缀路由：匹配 ${query}`);

  // 树布局：叶子顺序占位，内部节点取子节点均值
  const root = { seg: "", key: "", depth: 0, children: [], handler: null };
  routes.forEach((r) => {
    let node = root;
    let acc = "";
    segsOf(r.path).forEach((seg) => {
      acc = acc ? `${acc}/${seg}` : seg;
      let child = node.children.find((c) => c.seg === seg);
      if (!child) {
        child = { seg, key: acc, depth: node.depth + 1, children: [], handler: null };
        node.children.push(child);
      }
      node = child;
    });
    node.handler = r.handler;
  });
  let leaves = 0;
  const nodes = [];
  (function walk(n) { nodes.push(n); if (!n.children.length) leaves++; n.children.forEach(walk); })(root);
  const slotW = 700 / Math.max(1, leaves);
  let cursor = 0;
  (function assign(n) {
    if (!n.children.length) { n.x = 50 + cursor * slotW + slotW / 2; cursor += 1; return n.x; }
    let sum = 0;
    n.children.forEach((c) => { sum += assign(c); });
    n.x = sum / n.children.length;
    return n.x;
  })(root);
  nodes.forEach((n) => { n.y = 84 + n.depth * 52; });

  // 边
  const edges = [];
  nodes.forEach((n) => n.children.forEach((c) => {
    edges.push({
      from: n, to: c,
      line: mk("line", {
        x1: n.x, y1: n.y + 26, x2: c.x, y2: c.y - 26,
        stroke: THEME.grid, "stroke-width": 1.5,
      }, svg),
    });
  }));

  // 节点
  nodes.forEach((n) => {
    const w = Math.max(58, n.seg.length * 11 + 20);
    n.box = rect(svg, n.x - w / 2, n.y, w, 26, { rx: 6, fill: THEME.bar, opacity: 0 });
    n.label = text(svg, n.x, n.y + 13, n.seg || "/", { size: 12, fill: THEME.text, opacity: 0 });
    if (n.handler) {
      n.tag = text(svg, n.x, n.y + 40, `→ ${n.handler}`, { size: 11, fill: THEME.sorted, opacity: 0 });
    }
  });

  /* 结果框放右上角，不放底部：树最深能到 3 层（y=240、箭头标签到 280），
   * 底部那条 300 高的舞台已经被占满，结果框压上去会把最深节点盖住。 */
  const bestBox = rect(svg, 462, 36, 314, 32, { rx: 8, fill: THEME.panel, stroke: THEME.grid, "stroke-width": 1 });
  const bestText = text(svg, 476, 52, "最长匹配：—", { anchor: "start", size: 13, fill: THEME.text });
  const queryBox = text(svg, 24, 44, `请求路径：${query}`, { anchor: "start", size: 12, fill: THEME.muted });

  return {
    svg,
    elementCount: nodes.length,
    stats(state) {
      return `规则 ${(state.trie || []).length}/${routes.length} · 已下走 ${(state.walk || []).length} 段`;
    },
    render({ stateA, stateB, t, ent, waveT }) {
      const ease = easeInOutCubic(t);
      const trie = stateB.trie || [];
      const walk = stateB.walk || [];
      const walkKey = walk.join("/");

      nodes.forEach((n, idx) => {
        const inserted = trie.some((r) => segsOf(r.path).join("/").startsWith(n.key));
        const appear = inserted ? 1 : (stateA.trie || []).some((r) => segsOf(r.path).join("/").startsWith(n.key)) ? 1 : 0;
        const vis = (appear ? 1 : ease) * ent(idx);
        n.box.setAttribute("opacity", vis);
        n.label.setAttribute("opacity", vis);
        if (n.tag) n.tag.setAttribute("opacity", vis);
        const onPath = n.depth > 0 && n.depth <= walk.length &&
          n.key === walk.slice(0, n.depth).join("/");
        let fill = THEME.bar;
        if (onPath) fill = THEME.comparing;
        if (n.handler && onPath) fill = THEME.sorted;
        n.box.setAttribute("fill", fill);
        n.label.setAttribute("fill", inkOn(fill) || THEME.text);
      });

      edges.forEach((e) => {
        const onPath = e.to.depth <= walk.length &&
          e.to.key === walk.slice(0, e.to.depth).join("/");
        e.line.setAttribute("stroke", onPath ? THEME.comparing : THEME.grid);
        e.line.setAttribute("opacity", onPath ? 1 : 0.6);
      });

      const best = stateB.best === undefined ? null : stateB.best;
      bestText.textContent = best ? `最长匹配：${query} → ${best}` : `最长匹配：${query} → 无`;
      bestBox.setAttribute("stroke", best ? THEME.sorted : THEME.grid);
      if (waveT !== null && waveT !== undefined && best) {
        const local = waveT / WAVE_FLASH;
        if (local > 0 && local < 1) {
          bestBox.setAttribute("fill", mixHex(THEME.panel, "#FFFFFF", Math.sin(Math.PI * local) * 0.6));
        } else {
          bestBox.setAttribute("fill", THEME.panel);
        }
      } else {
        bestBox.setAttribute("fill", THEME.panel);
      }
      queryBox.textContent = `请求路径：${query}${walkKey ? `（已匹配 ${walkKey}）` : ""}`;
    },
  };
}

/* ---------------- 5. 工作流并行分批 ---------------- */

function workflowRenderer(input) {
  const { tasks, deps } = input;
  const svg = createStage(`工作流并行分批：${tasks.length} 个任务（一批内可并发）`);

  const depth = {};
  tasks.forEach((t) => { depth[t] = 0; });
  for (let pass = 0; pass < tasks.length; pass++) {
    deps.forEach(([a, b]) => { depth[b] = Math.max(depth[b], depth[a] + 1); });
  }
  const byCol = {};
  tasks.forEach((t) => { (byCol[depth[t]] = byCol[depth[t]] || []).push(t); });

  const pos = {};
  Object.keys(byCol).forEach((d) => {
    const col = byCol[d];
    col.forEach((t, i) => {
      pos[t] = { x: 70 + Number(d) * 150, y: 90 + i * 52 };
    });
  });

  /* 跨列的依赖（比如 fetch-db → answer 直接跳过两列）如果拉直线，
   * 会从中间的无关节点底下穿过去，看起来像是连到了那个节点。
   * 所以跨列边一律下沉绕行：走到所有节点下方的一条通道里再拐过去。
   * 相邻列的边照旧拉直线，最短最清楚。 */
  const bottomY = tasks.length ? Math.max(...tasks.map((t) => pos[t].y + 34)) : 0;
  const dipY = Math.min(276, bottomY + 24);

  const edgeEls = [];
  deps.forEach(([a, b]) => {
    const pa = pos[a];
    const pb = pos[b];
    const x1 = pa.x + 50;
    const y1 = pa.y + 17;
    const x2 = pb.x - 50;
    const y2 = pb.y + 17;
    const span = depth[b] - depth[a];
    const el = span > 1
      ? mk("path", {
        d: `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${dipY} ${x2} ${y2}`,
        fill: "none", stroke: THEME.grid, "stroke-width": 1.5,
      }, svg)
      : mk("line", {
        x1, y1, x2, y2, stroke: THEME.grid, "stroke-width": 1.5,
      }, svg);
    edgeEls.push({ a, b, line: el });
  });

  const nodeEls = {};
  tasks.forEach((t) => {
    const p = pos[t];
    const r = rect(svg, p.x - 50, p.y, 100, 34, { rx: 7, fill: THEME.bar, stroke: "none" });
    const label = text(svg, p.x, p.y + 17, t, { size: 13, fill: THEME.text });
    nodeEls[t] = { rect: r, label };
  });

  const batchPanel = createPanel(svg, 560, 60, 216, 180, "分批结果", 5);
  const resultEls = batchPanel.rows.map((r) => ({ rect: r.rect, base: THEME.sorted }));

  return {
    svg,
    elementCount: tasks.length + 5,
    stats(state) {
      const done = (state.lists.done || []).length;
      return `批次 ${state.layers.length} · 已完成 ${done}/${tasks.length}`;
    },
    render({ stateA, stateB, t, ent, waveT }) {
      const ease = easeInOutCubic(t);
      const doneList = new Set(stateB.lists.done || []);
      const layers = stateB.layers || [];
      const current = layers.length ? new Set(layers[layers.length - 1]) : new Set();

      tasks.forEach((tk, idx) => {
        const el = nodeEls[tk];
        const isDone = doneList.has(tk);
        const isCurrent = current.has(tk);
        let fill = THEME.bar;
        if (isDone) fill = THEME.sorted;
        else if (isCurrent) fill = THEME.comparing;
        el.rect.setAttribute("fill", fill);
        el.rect.setAttribute("opacity", ent(idx));
        el.rect.setAttribute("stroke", isCurrent ? "rgba(255,255,255,0.85)" : "none");
        el.rect.setAttribute("stroke-width", isCurrent ? 1.5 : 0);
        el.label.setAttribute("fill", inkOn(fill) || THEME.text);
      });

      edgeEls.forEach((e) => {
        e.line.setAttribute("stroke", doneList.has(e.a) ? THEME.sorted : THEME.grid);
        e.line.setAttribute("opacity", doneList.has(e.a) ? 0.95 : 0.55);
      });

      layers.forEach((batch, i) => {
        batchPanel.set(i, {
          label: `第 ${i + 1} 批`,
          value: batch.join("、"),
          fill: i === layers.length - 1 ? THEME.comparing : THEME.sorted,
          opacity: ent(tasks.length + i),
        });
      });
      for (let i = layers.length; i < 5; i++) batchPanel.set(i, { label: null });
      applyWave(resultEls.slice(0, layers.length), waveT);
    },
  };
}

/* ---------------- 6. URL 归一化去重 ---------------- */

function dedupRenderer(input) {
  const { urls } = input;
  const svg = createStage(`检索结果去重：归一化 ${urls.length} 个 URL（保持首现顺序）`);

  const rows = [];
  urls.forEach((u, i) => {
    const y = 66 + i * 34;
    const raw = text(svg, 24, y + 13, shorten(u, 30), { anchor: "start", size: 11, fill: THEME.muted });
    text(svg, 300, y + 13, "→", { size: 12, fill: THEME.grid });
    const key = text(svg, 318, y + 13, "", { anchor: "start", size: 11, fill: THEME.barText });
    const badge = rect(svg, 566, y, 76, 26, { rx: 6, fill: THEME.bar, opacity: 0 });
    const badgeText = text(svg, 604, y + 13, "", { size: 11, fill: THEME.text });
    const strike = mk("line", {
      x1: 24, y1: y + 13, x2: 290, y2: y + 13, stroke: THEME.text, "stroke-width": 1.5, opacity: 0,
    }, svg);
    rows.push({ raw, key, badge, badgeText, strike });
  });

  const outPanel = createPanel(svg, 656, 60, 120, 180, "结果集", 5);
  const resultEls = outPanel.rows.map((r) => ({ rect: r.rect, base: THEME.sorted }));

  return {
    svg,
    elementCount: urls.length + 5,
    stats(state) {
      const out = state.lists.out || [];
      return `扫描 ${state.metrics.scanned || 0}/${urls.length} · 结果 ${out.length} 条`;
    },
    render({ stateA, stateB, t, ent, waveT }) {
      const ease = easeInOutCubic(t);
      urls.forEach((u, i) => {
        const r = rows[i];
        const decision = stateB.decisions[i] === undefined ? stateA.decisions[i] : stateB.decisions[i];
        const k = stateB.keys[i] !== undefined ? stateB.keys[i] : stateA.keys[i];
        r.key.textContent = k === undefined ? "" : shorten(k, 26);
        const normed = k !== undefined;
        let fill = THEME.bar;
        let label = "";
        if (decision === "keep") { fill = THEME.sorted; label = "保留"; }
        else if (decision === "drop") { fill = THEME.dim; label = "重复"; }
        else if (decision === "pending") { fill = THEME.written; label = "归一化"; }
        r.badge.setAttribute("fill", fill);
        r.badge.setAttribute("opacity", normed ? ent(i) : 0);
        r.badgeText.textContent = label;
        r.badgeText.setAttribute("fill", inkOn(fill) || THEME.text);
        r.badgeText.setAttribute("opacity", normed ? ent(i) : 0);
        r.key.setAttribute("opacity", normed ? ease * ent(i) : 0);
        r.strike.setAttribute("opacity", decision === "drop" ? 0.9 : 0);
        r.raw.setAttribute("fill", decision === "drop" ? THEME.dim : THEME.muted);
      });

      const out = stateB.lists.out || [];
      out.slice(0, 5).forEach((v, idx) => {
        outPanel.set(idx, { label: shorten(normalizeUrl(v), 16), value: "", fill: THEME.sorted, opacity: ent(urls.length + idx) });
      });
      for (let idx = out.length; idx < 5; idx++) outPanel.set(idx, { label: null });
      applyWave(resultEls.slice(0, Math.min(out.length, 5)), waveT);
    },
  };
}

const RENDERERS = {
  vector: vectorRenderer,
  rerank: rerankRenderer,
  ctx: ctxRenderer,
  router: routerRenderer,
  workflow: workflowRenderer,
  dedup: dedupRenderer,
};

/* 经典算法动画（二分 / 双指针 / 链表…）的渲染器在 render-classic.js，
 * 这里兜底转发，调用方（player.js）只认这一个入口。 */
export function createSceneRenderer(kind, input) {
  const fn = RENDERERS[kind];
  if (fn) return fn(input);
  return createClassicRenderer(kind, input);
}
