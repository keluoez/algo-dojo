/* 场景动画渲染层 DOM 测试（Node + 共享 DOM stub，不依赖浏览器）。
 *
 * check_agent_animations.mjs 只保证"步骤与答案对"，这里保证"画面真的画出来了"：
 *   1. 六个场景都能挂载，且 SVG 里真的有内容（不是空舞台）
 *   2. 入场动效结束后元素可见（不是永远 opacity:0 的隐形画面）
 *   3. 单步前进/后退不抛异常 —— 场景态字段多，最容易在这里炸
 *   4. 播放到头：完成徽章出现、字幕非空、统计文案非空
 *   5. 渲染确定性：同一时钟下两遍渲染出的 SVG 逐属性一致
 *      （Remotion 逐帧渲染的前提，也是"可回退"的前提）
 *
 * 运行：node tests/check_scene_dom.mjs
 */
import {
  installDomStub, pumpFrames, FakeNode, clock, createChecker,
} from "./dom_stub.mjs";

installDomStub();

const { mountPlayer } = await import("../frontend/js/anim/player.js");
const { ANIMATIONS } = await import("../frontend/js/anim/registry.js");
const { SCENE_INPUTS } = await import("../frontend/js/anim/scenes.js");
const { THEME } = await import("../frontend/js/anim/theme.js");

const { ok, section, finish } = createChecker();

const SCENES = ANIMATIONS.filter((a) => a.view === "scene");

/* ---------------- 可读性：浅色文字压在亮色块上 = 看不见 ----------------
 * 实测 bug：Top-K 面板行底色是 sorted(#34D399)，数值文字却还是 muted(#93A4BF)，
 * 投影到大屏上分数基本读不出来。亮底必须换深色墨。
 * 这里用包围盒近似做静态检查：文字锚点中心落进亮色矩形内、且文字是浅色 → 违规。 */

const BRIGHT_FILLS = new Set(
  [THEME.sorted, THEME.comparing, THEME.written, THEME.swapping, THEME.key].map((c) => c.toUpperCase()),
);
const LIGHT_TEXT_FILLS = new Set([THEME.text, THEME.muted, THEME.barText].map((c) => c.toUpperCase()));

const attrNum = (n, k, d) => {
  const v = n.getAttribute(k);
  return v === null || v === "" ? d : parseFloat(v);
};
const visible = (n) => attrNum(n, "opacity", 1) > 0.5;

/* 与对比度同类的问题：两个"内容块"互相盖住。
 * 实测 bug：Trie 场景的「最长匹配」结果框压在最深一层节点上，节点标签被挡住。
 *
 * 口径：渲染器把"容器底板"（舞台底、面板底、卡片底、进度条轨道）标了 class="scene-chrome"，
 * 这些天生要被盖，不算数；其余可见矩形都是内容块，两两重叠超过 25% 就算压盖。
 * 靠按底色过滤是不行的——被压的那块和压上去的那块往往同色，一过滤等于没测。 */
const isChrome = (n) => String(n.getAttribute("class") || "").split(/\s+/).includes("scene-chrome");

function overlapViolations(svg) {
  const boxes = [];
  (function walk(n) {
    if (n.tagName === "rect" && visible(n) && !isChrome(n)) {
      const w = attrNum(n, "width", 0);
      const h = attrNum(n, "height", 0);
      if (w > 4 && h > 4) {
        boxes.push({ x: attrNum(n, "x", 0), y: attrNum(n, "y", 0), w, h, fill: n.getAttribute("fill") });
      }
    }
    n.children.forEach(walk);
  })(svg);

  const bad = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const ow = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ow <= 0 || oh <= 0) continue;
      const ratio = (ow * oh) / Math.min(a.w * a.h, b.w * b.h);
      if (ratio > 0.25) {
        bad.push(`(${a.x},${a.y},${a.w}×${a.h}) 与 (${b.x},${b.y},${b.w}×${b.h}) 重叠 ${(ratio * 100).toFixed(0)}%`);
      }
    }
  }
  return bad;
}

/* 越界与脏值：画到画布外、或者算出 NaN / undefined 的元素。
 * 这类问题肉眼在 800×300 缩略图上看不出来，投到 1080p 大屏上就是"缺了一块"
 * 或者"undefined 直接印在屏幕上"。数值属性一律要有限，几何一律要落在画布内。 */
function boundsViolations(svg) {
  const bad = [];
  (function walk(n) {
    if (n.tagName !== "rect" && n.tagName !== "text" && n.tagName !== "line" && n.tagName !== "path") {
      n.children.forEach(walk);
      return;
    }
    for (const [k, v] of Object.entries(n.attrs)) {
      if (typeof v !== "string") continue;
      if (/^(x|y|x1|y1|x2|y2|width|height|cx|cy|rx|ry|opacity)$/.test(k)) {
        const num = parseFloat(v);
        if (!Number.isFinite(num)) bad.push(`${n.tagName} 的 ${k}="${v}" 不是有限数`);
      }
    }
    const str = String(n.textContent || "");
    if (/undefined|NaN|null/.test(str)) bad.push(`${n.tagName} 文本出现脏值：「${str}」`);

    if (n.tagName === "rect") {
      const x = attrNum(n, "x", 0);
      const y = attrNum(n, "y", 0);
      const w = attrNum(n, "width", 0);
      const h = attrNum(n, "height", 0);
      if (x < -2 || y < -2 || x + w > 802 || y + h > 302) {
        bad.push(`rect 越界：(${x.toFixed(0)},${y.toFixed(0)},${w.toFixed(0)}×${h.toFixed(0)})`);
      }
      if (w < 0 || h < 0) bad.push(`rect 尺寸为负：${w}×${h}`);
    }
    if (n.tagName === "text") {
      const x = attrNum(n, "x", 0);
      const y = attrNum(n, "y", 0);
      if (x < -2 || x > 802 || y < -2 || y > 302) bad.push(`text 越界：(${x.toFixed(0)},${y.toFixed(0)})`);
    }
    n.children.forEach(walk);
  })(svg);
  return bad;
}

function contrastViolations(svg) {
  const rects = [];
  const texts = [];
  (function walk(n) {
    if (n.tagName === "rect") rects.push(n);
    else if (n.tagName === "text") texts.push(n);
    n.children.forEach(walk);
  })(svg);

  const bad = [];
  for (const t of texts) {
    const fill = (t.getAttribute("fill") || "").toUpperCase();
    if (!LIGHT_TEXT_FILLS.has(fill) || !visible(t)) continue;
    const str = t.textContent.trim();
    if (!str) continue;
    const anchor = t.getAttribute("text-anchor") || "middle";
    const w = str.length * 6.2;                       // 12px 字号下的粗略字宽
    const x = attrNum(t, "x", 0);
    const cx = anchor === "start" ? x + w / 2 : (anchor === "end" ? x - w / 2 : x);
    const cy = attrNum(t, "y", 0);
    for (const r of rects) {
      if (!visible(r)) continue;
      if (!BRIGHT_FILLS.has((r.getAttribute("fill") || "").toUpperCase())) continue;
      const rx = attrNum(r, "x", 0);
      const ry = attrNum(r, "y", 0);
      if (cx >= rx && cx <= rx + attrNum(r, "width", 0)
          && cy >= ry && cy <= ry + attrNum(r, "height", 0)) {
        bad.push(`「${str}」${fill} 压在 ${r.getAttribute("fill")} 上`);
        break;
      }
    }
  }
  return bad;
}

/* 把 SVG 树压成可比较的字符串：标签 + 全部属性 + 文本（顺序敏感，因为绘制顺序即层序） */
function serialize(node) {
  const attrs = Object.entries(node.attrs).map(([k, v]) => `${k}=${v}`).join(" ");
  const own = `${node.tagName}[${attrs}]{${node.textContent}}`;
  return `${own}(${node.children.map(serialize).join(",")})`;
}

/** 收集树里所有 rect 的 opacity，用来判断"画面有没有真的出现" */
function opacities(node, out = []) {
  if (node.tagName === "rect") {
    const v = node.getAttribute("opacity");
    out.push(v === null ? 1 : parseFloat(v));
  }
  node.children.forEach((c) => opacities(c, out));
  return out;
}

/* "墨量"：Σ(高度 × 透明度)，只算内容块（排除容器底板）。
 * 入场动效有的是长高、有的是淡入，单看 opacity 或单看 height 都会漏，
 * 乘积把两种都覆盖到，且不受"柱子被调暗"之外的因素误导。 */
function inkOf(node) {
  let sum = 0;
  (function walk(n) {
    if (n.tagName === "rect" && !isChrome(n)) {
      const op = attrNum(n, "opacity", 1);
      sum += attrNum(n, "height", 0) * attrNum(n, "width", 0) * op;
    }
    n.children.forEach(walk);
  })(node);
  return sum;
}

function mountAt(key, t0) {
  clock.now = t0;
  const host = new FakeNode("div");
  const player = mountPlayer(host, key);
  const root = host.children[0];
  const wrap = root.children[0].children[0];
  const stage = wrap.children[wrap.children.length - 1];
  const svg = stage.children[0];
  const head = wrap.children[0];
  const badge = head.children[2].children[0];
  const stats = head.children[2].children[1];
  const controls = root.children[1];
  const [playBtn, backBtn, fwdBtn, progress, stepLabel] = controls.children;
  const noteLine = root.children[2];
  return { host, player, root, svg, badge, stats, playBtn, backBtn, fwdBtn, progress, stepLabel, noteLine };
}

ok(SCENES.length === 14, `目录里共 ${SCENES.length} 个场景动画（应为 14：6 个 Agent + 8 个经典算法）`);

for (const anim of SCENES) {
  section(`${anim.key}（${anim.title}）`);

  let ui;
  try {
    ui = mountAt(anim.key, 5000);
  } catch (e) {
    ok(false, `挂载不抛异常：${e && e.message}`);
    continue;
  }

  ok(ui.svg && ui.svg.children.length > 5,
     `SVG 已绘制内容（${ui.svg ? ui.svg.children.length : 0} 个节点）`);

  /* 入场错峰：两个条件缺一不可 ——
   *   1) 不能开播：一开播，"区间外调暗""决策后变灰"就会混进来，
   *      曾经测出 12 → 11 这种"反而变少"的假失败，测的是状态不是入场。
   *   2) 不能停在 budget=0：像 Trie 这种第 0 步还没注册任何节点的场景，
   *      开局本来就没东西可画，入场再怎么跑也量不出变化。
   * 所以先单步走到 40% 处（有内容了、但入场还没跑完），再纯靠推帧看墨量增长。 */
  const total = Number(ui.progress.getAttribute("max")) || 0;
  const target = Math.max(1, Math.round(total * 0.4));
  for (let k = 0; k < target; k++) ui.fwdBtn.click();
  const ink0 = inkOf(ui.svg);
  pumpFrames(60, 50);              // 3s，足够 (n-1)*stagger + duration；入场结束 rAF 会自己停
  const ink1 = inkOf(ui.svg);
  ok(ink1 > ink0, `${anim.key} · 入场让元素浮现（墨量 ${ink0.toFixed(0)} → ${ink1.toFixed(0)}）`);

  ui.playBtn.click();
  pumpFrames(36, 50);
  const endVisible = opacities(ui.svg).filter((v) => v > 0.9).length;
  ok(endVisible > 2, `播放到中途画面有内容元素（${endVisible} 个，> 背景底板 2）`);

  /* 单步前进 / 后退：场景态字段（lists/metrics/trie/layers…）最多，
   * 插值时最容易读到 undefined 而炸。每一步都必须平安无事。 */
  let stepErr = null;
  try {
    for (let k = 0; k < 6; k++) { ui.fwdBtn.click(); pumpFrames(1); }
    for (let k = 0; k < 3; k++) { ui.backBtn.click(); pumpFrames(1); }
  } catch (e) {
    stepErr = e && e.message;
  }
  ok(stepErr === null, `单步前进/后退不抛异常${stepErr ? `：${stepErr}` : ""}`);
  ok(/步 [0-9]+ \/ [0-9]+/.test(ui.stepLabel.textContent), `步数文案正常：${ui.stepLabel.textContent}`);

  /* 播到头 */
  ui.playBtn.click();
  let guard = 0;
  while (guard < 3000) { pumpFrames(1, 50); guard++; if (ui.badge.style.display === "") break; }
  ok(ui.badge.style.display === "", `播放到头出现完成徽章（用了 ${guard} 帧）`);
  ok(guard < 3000, "播放能在有限帧内结束（不会卡死 rAF）");
  ok(ui.noteLine.textContent.trim().length > 0,
     `末步字幕非空：「${ui.noteLine.textContent.slice(0, 32)}…」`);
  ok(ui.stats.textContent.trim().length > 0, `统计文案非空：「${ui.stats.textContent}」`);
  ok(contrastViolations(ui.svg).length === 0,
     `末态无"浅色字压亮色块"：${contrastViolations(ui.svg).slice(0, 2).join("；") || "0 处"}`);

  /* 逐帧扫一遍对比度：文字与底色是随状态变的，
   * 只看末态会漏掉中间帧的坏组合（比如"归一化"用的青色底）。 */
  ui.player.destroy();
  const scan = mountAt(anim.key, 60000);
  scan.backBtn.click();                       // 回到开头（连点无效也无妨）
  let stepErr2 = null;
  const allBad = new Set();
  const allOverlap = new Set();
  try {
    for (let guard3 = 0; guard3 < 200; guard3++) {
      contrastViolations(scan.svg).forEach((b) => allBad.add(b));
      overlapViolations(scan.svg).forEach((b) => allOverlap.add(b));
      boundsViolations(scan.svg).forEach((b) => allBad.add(`[越界] ${b}`));
      if (scan.badge.style.display === "") break;
      scan.fwdBtn.click();
      pumpFrames(2, 50);                      // 走完一步的过渡，取稳定帧
    }
  } catch (e) {
    stepErr2 = e && e.message;
  }
  ok(stepErr2 === null, `逐帧扫描不抛异常${stepErr2 ? `：${stepErr2}` : ""}`);
  ok(allBad.size === 0, `全程 ${allBad.size} 处对比度违规${allBad.size ? `：${[...allBad].slice(0, 2).join("；")}` : ""}`);
  ok(allOverlap.size === 0, `全程 ${allOverlap.size} 处内容块重叠${allOverlap.size ? `：${[...allOverlap].slice(0, 2).join("；")}` : ""}`);
  scan.player.destroy();
}

/* ---------------- 渲染确定性：同一时钟两遍，SVG 必须逐属性一致 ---------------- */

section("渲染确定性（同一时钟两遍渲染 → 同一张画面）");
for (const anim of SCENES) {
  const shot = (t0, frames) => {
    const ui = mountAt(anim.key, t0);
    pumpFrames(frames, 50);
    const s = serialize(ui.svg);
    ui.player.destroy();
    return s;
  };
  const a = shot(30000, 25);
  const b = shot(30000, 25);
  ok(a === b, `${anim.key} · 两遍渲染逐属性一致（${a.length} 字符）`);
}

/* ---------------- 输入样例与目录一致 ---------------- */

section("样例输入");
for (const anim of SCENES) {
  ok(anim.input && JSON.stringify(anim.input) === JSON.stringify(SCENE_INPUTS[anim.kind]),
     `${anim.key} · 条目样例 = SCENE_INPUTS[${anim.kind}]（测试与页面用的是同一组数据）`);
}

finish();
