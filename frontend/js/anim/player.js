/* 算法动画播放器：深色高对比"视频风"，与 Remotion 成片共用配色与状态归约。
 *
 * 动效设计（参考 Remotion 社区主流手法与 Sound of Sorting）：
 * - budget 是【浮点进度】：渲染时在相邻两个状态之间插值，交换沿抛物线、
 *   写入弹簧生长、暂存升空淡出 —— 不再是每秒 4 次的硬切
 * - 运动信息直接由 step 类型推导（SWAP/SHIFT/SET/HOLE/SET_RANGE），
 *   Step 协议与 buildStates 不需要任何改动，画面仍是 (steps, budget) 的纯函数
 * - 回弹用克制型弹簧 springSoft（约 4% 过冲），长时间看不累
 * - 音效（默认关）：比较/交换的值 → 音高，完成时上升琶音，见 audio.js
 * - 入场错峰弹入、完成时绿色波浪扫过 + 闪光
 * - 支持键盘：空格播放暂停，← → 单步
 */
import { THEME, barColor } from "./theme.js?v=16";
import { buildStates, roleOf, presetValues, RACE_INPUT, MARK_KIND } from "./protocol.js?v=16";
import { SORTS, buildStepsFor } from "./sorts.js?v=16";
import { getAnimation } from "./registry.js?v=16";
import { setSoundEnabled, soundEnabled, stepSound, arpeggio, confirmTone } from "./audio.js?v=16";
import { easeInOutCubic, springSoft, mixHex } from "./motion.js?v=16";
import { buildSceneSteps, SCENES, SCENE_INPUTS } from "./scenes.js?v=16";
import { createSceneRenderer } from "./render-scene.js?v=16";

const SPEEDS = [0.5, 1, 2, 4, 8];
const BASE_STEPS_PER_SEC = 4;   // 1x 的时候每秒推进 4 步

const ENTRANCE_STAGGER = 40;    // 入场：每根柱子依次晚 40ms
const ENTRANCE_DUR = 380;       // 入场：单根柱子弹入时长
const WAVE_SWEEP = 0.55;        // 完成绿浪：扫完全部柱子用时（秒）
const WAVE_FLASH = 0.3;         // 完成绿浪：单根柱子闪光时长（秒）

const HOLD_LABEL = { [MARK_KIND.KEY]: "暂存", [MARK_KIND.PIVOT]: "基准" };

/* 缓动函数在 motion.js（与场景渲染器、Remotion 侧共用一套） */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* ---------------- 单条轨道：一个算法在一个输入上的播放 ---------------- */

function makeTrack(algoKey, input, { showValueLabels }) {
  const meta = SORTS[algoKey];
  const steps = buildStepsFor(algoKey, input);
  const states = buildStates(input, steps);
  const maxValue = Math.max(...input);
  const n = input.length;
  const length = steps.length;

  const W = 800;
  const H = 300;
  const pad = { l: 20, r: 20, t: 34, b: 46 };
  const slot = (W - pad.l - pad.r) / n;
  const barW = Math.max(6, slot * 0.66);
  const baseline = H - pad.b;
  const usable = baseline - pad.t;

  const slotX = (i) => pad.l + slot * i + slot / 2;
  const hOf = (v) => Math.max(6, (v / maxValue) * usable);

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "anim-svg");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const bg = document.createElementNS(svgNS, "rect");
  bg.setAttribute("x", 0); bg.setAttribute("y", 0);
  bg.setAttribute("width", W); bg.setAttribute("height", H);
  bg.setAttribute("rx", 12);
  bg.setAttribute("fill", THEME.bg);
  svg.appendChild(bg);

  const bars = [];
  const labels = [];
  const slots = [];
  for (let i = 0; i < n; i++) {
    const cx = slotX(i);
    // 空位底槽：让"元素被取走"这件事看得见
    const holder = document.createElementNS(svgNS, "rect");
    holder.setAttribute("x", cx - barW / 2);
    holder.setAttribute("y", pad.t);
    holder.setAttribute("width", barW);
    holder.setAttribute("height", usable);
    holder.setAttribute("rx", 4);
    holder.setAttribute("fill", "none");
    holder.setAttribute("stroke", THEME.grid);
    holder.setAttribute("stroke-width", 1);
    holder.setAttribute("stroke-dasharray", "3 5");
    holder.setAttribute("opacity", 0);
    svg.appendChild(holder);
    slots.push(holder);

    const bar = document.createElementNS(svgNS, "rect");
    bar.setAttribute("x", cx - barW / 2);
    bar.setAttribute("width", barW);
    bar.setAttribute("rx", 4);
    bar.setAttribute("fill", THEME.bar);
    svg.appendChild(bar);
    bars.push(bar);

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", cx);
    label.setAttribute("y", baseline + 18);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", n > 14 ? 11 : 14);
    label.setAttribute("fill", THEME.muted);
    svg.appendChild(label);
    labels.push(label);
  }

  // 手里暂存值的悬浮标签
  const chip = document.createElementNS(svgNS, "g");
  chip.setAttribute("opacity", 0);
  const chipRect = document.createElementNS(svgNS, "rect");
  chipRect.setAttribute("rx", 6);
  chipRect.setAttribute("fill", THEME.key);
  chipRect.setAttribute("height", 24);
  const chipText = document.createElementNS(svgNS, "text");
  chipText.setAttribute("text-anchor", "middle");
  chipText.setAttribute("dominant-baseline", "central");
  chipText.setAttribute("font-size", 14);
  chipText.setAttribute("fill", "#1A1004");
  chip.appendChild(chipRect);
  chip.appendChild(chipText);
  svg.appendChild(chip);

  /* 找出某状态下"暂存/基准"标记所在的槽位（悬浮标签跟着它走）。 */
  function markedSlot(state) {
    const found = Object.keys(state.marks).find((i) =>
      (state.marks[i] || []).includes(state.holdKind || "")
    );
    return found === undefined ? null : Number(found);
  }

  function entranceFactor(i, now) {
    if (track.bornAt === null) return 1;
    const e = (now - track.bornAt - i * ENTRANCE_STAGGER) / ENTRANCE_DUR;
    if (e <= 0) return 0;
    if (e >= 1) return 1;
    return springSoft(e);
  }

  function entranceDone(now) {
    return track.bornAt === null || now - track.bornAt >= (n - 1) * ENTRANCE_STAGGER + ENTRANCE_DUR;
  }

  /* 渲染浮点进度 cursor：在 states[k] 与 states[k+1] 之间插值。
   * 返回 true 表示还有进行中的临时动效（入场 / 完成波浪），rAF 循环不能停。 */
  function renderAt(cursor, now) {
    const clamped = Math.max(0, Math.min(cursor, length));
    const k = Math.min(Math.floor(clamped), length);
    const isFinal = clamped >= length;
    const t = isFinal ? 0 : clamped - k;
    const ease = easeInOutCubic(t);
    const stateA = states[k];
    const stateB = states[Math.min(k + 1, length)];
    const step = isFinal ? null : steps[k];

    // 完成绿浪：doneAt 之后的墙钟时间驱动（一次性庆祝，不影响 scrub 的确定性）
    const waveT = track.doneAt === null ? null : (now - track.doneAt) / 1000;
    const waveActive = waveT !== null && waveT < WAVE_SWEEP + WAVE_FLASH;

    for (let i = 0; i < n; i++) {
      let value = stateA.array[i];
      let fromSlot = i;
      let toSlot = i;
      let lift = 0;
      let growT = null;      // SET：从 0 弹簧生长
      let fadeOut = false;   // HOLE：升空淡出
      let hFrom = null;      // SET_RANGE：原地高度插值
      let hTo = null;
      let hidden = false;    // SHIFT 源槽：元素已抄走，只剩空位
      let moving = false;

      if (step) {
        switch (step.op) {
          case "swap":
            if (i === step.i || i === step.j) {
              const other = i === step.i ? step.j : step.i;
              value = stateA.array[other];
              fromSlot = other;
              lift = Math.sin(Math.PI * ease) * Math.min(34, 10 + Math.abs(i - other) * slot * 0.35);
              moving = true;
            }
            break;
          case "shift":
            if (i === step.to) {
              value = stateA.array[step.from];
              fromSlot = step.from;
              lift = Math.sin(Math.PI * ease) * 10;
              moving = true;
            } else if (i === step.from) {
              hidden = true;
            }
            break;
          case "set":
            if (i === step.i) { value = step.value; growT = t; moving = true; }
            break;
          case "hole":
            if (i === step.i) fadeOut = true;
            break;
          case "setRange":
            if (i >= step.lo && i < step.lo + step.values.length) {
              hFrom = stateA.array[i] === null ? 0 : hOf(stateA.array[i]);
              hTo = hOf(stateB.array[i]);
              value = stateB.array[i];
            }
            break;
          default:
            break;
        }
      }

      // 颜色：运动中的柱子直接用"目标态"角色；静止柱子在 30% 处切换（比较高光早点亮）
      const roleState = moving ? stateB : (t < 0.3 ? stateA : stateB);
      const role = hidden ? "hole" : roleOf(roleState, i);

      // 高度
      let h;
      if (hFrom !== null) h = hFrom + (hTo - hFrom) * ease;
      else if (value === null || value === undefined || hidden) h = 0;
      else h = hOf(value);
      if (growT !== null) h *= springSoft(t);
      h *= entranceFactor(i, now);

      // 位置（含弧线抬升）
      const cx = slotX(fromSlot) + (slotX(toSlot) - slotX(fromSlot)) * ease;
      const rise = fadeOut ? ease * 18 : 0;

      const bar = bars[i];
      if (hidden || h <= 0.5) {
        bar.setAttribute("opacity", 0);
      } else {
        let fill = barColor(role);
        if (waveT !== null) {
          const local = (waveT - (i * WAVE_SWEEP) / n) / WAVE_FLASH;
          if (local > 0 && local < 1) fill = mixHex(fill, "#FFFFFF", Math.sin(Math.PI * local) * 0.75);
        }
        bar.setAttribute("x", cx - barW / 2);
        bar.setAttribute("y", baseline - h - lift - rise);
        bar.setAttribute("height", h);
        bar.setAttribute("fill", fill);
        const hot = role === "comparing" || role === "swapping" || role === "written";
        bar.setAttribute("stroke", hot ? "rgba(255,255,255,0.85)" : "none");
        bar.setAttribute("stroke-width", hot ? 1.5 : 0);
        bar.setAttribute("opacity", (role === "dim" ? 0.75 : 1) * (fadeOut ? 1 - ease : 1));
      }

      // 空位底槽淡入淡出
      const visA = stateA.array[i] === null ? 1 : 0;
      const visB = stateB.array[i] === null ? 1 : 0;
      slots[i].setAttribute("opacity", (visA + (visB - visA) * ease) * entranceFactor(i, now));

      // 数值标签：运动的柱子标签跟着走，其余在切换点换内容
      const labelState = t < 0.5 ? stateA : stateB;
      if (moving && value !== null && value !== undefined) {
        labels[i].setAttribute("x", cx);
        labels[i].textContent = showValueLabels ? String(value) : "";
        labels[i].setAttribute("fill", THEME.barText);
      } else {
        labels[i].setAttribute("x", slotX(i));
        const lv = labelState.array[i];
        labels[i].textContent = lv === null ? "空" : (showValueLabels ? String(lv) : "");
        labels[i].setAttribute("fill", lv === null ? THEME.grid : THEME.muted);
      }
    }

    // 悬浮标签：出现/消失随插值淡入淡出
    const heldA = stateA.held !== null;
    const heldB = stateB.held !== null;
    if (heldA || heldB) {
      const chipState = heldB ? stateB : stateA;
      const marked = markedSlot(chipState);
      if (marked !== null) {
        const text = `${HOLD_LABEL[chipState.holdKind] || "暂存"} ${chipState.held}`;
        chipText.textContent = text;
        const w = Math.max(56, text.length * 9 + 16);
        chipRect.setAttribute("x", slotX(marked) - w / 2);
        chipRect.setAttribute("width", w);
        chipRect.setAttribute("y", 6);
        chipText.setAttribute("x", slotX(marked));
        chipText.setAttribute("y", 18);
        chipText.setAttribute("fill", chipState.holdKind === MARK_KIND.PIVOT ? "#180A26" : "#1A1004");
        chipRect.setAttribute("fill", chipState.holdKind === MARK_KIND.PIVOT ? THEME.pivot : THEME.key);
        chip.setAttribute("opacity", (heldA ? 1 : 0) + ((heldB ? 1 : 0) - (heldA ? 1 : 0)) * ease);
      } else {
        chip.setAttribute("opacity", 0);
      }
    } else {
      chip.setAttribute("opacity", 0);
    }

    return !entranceDone(now) || waveActive;
  }

  const track = {
    algoKey, meta, steps, states, svg, length, maxValue, n,
    bornAt: null,      // 入场动效起点（墙钟）
    doneAt: null,      // 完成波浪起点（墙钟）
    celebrated: false, // 本轮播放是否已经庆祝过
    renderAt,
  };
  renderAt(0, performance.now());

  return track;
}

/* ---------------- 场景轨道：向量检索 / 路由 / 工作流 / 去重等非柱状图视图 ----------------
 * 与柱状图轨道共享浮点进度、入场错峰、完成绿浪，只是渲染交给 render-scene.js。 */

function makeSceneTrack(anim) {
  const kind = anim.kind;
  const input = anim.input || SCENE_INPUTS[kind];
  const steps = buildSceneSteps(kind, input);
  const states = buildStates([], steps);
  const renderer = createSceneRenderer(kind, input);
  const n = renderer.elementCount || 8;
  const meta = SCENES[kind];

  const track = {
    algoKey: kind,
    meta: {
      title: meta.title,
      time: meta.time,
      space: meta.space,
      stable: true,
      footnote: `${meta.time} · 空间 ${meta.space}`,
    },
    steps, states, length: steps.length, maxValue: 1, n,
    svg: renderer.svg,
    bornAt: null,
    doneAt: null,
    celebrated: false,
    statsOf: (state) => renderer.stats(state),
    renderAt(cursor, now) {
      const clamped = Math.max(0, Math.min(cursor, steps.length));
      const k = Math.min(Math.floor(clamped), steps.length);
      const isFinal = clamped >= steps.length;
      const t = isFinal ? 0 : clamped - k;
      const stateA = states[k];
      const stateB = states[Math.min(k + 1, steps.length)];
      const step = isFinal ? null : steps[k];
      const ent = (i) => entranceFactor(track, i, now, n);
      const waveT = track.doneAt === null ? null : (now - track.doneAt) / 1000;
      renderer.render({ stateA, stateB, t, step, ent, waveT, isFinal });
      return !entranceDone(track, now, n) ||
        (waveT !== null && waveT < WAVE_SWEEP + WAVE_FLASH);
    },
  };
  return track;
}

/* 入场的错峰弹簧（场景与柱状图共用） */
function entranceFactor(track, i, now, n) {
  if (track.bornAt === null) return 1;
  const e = (now - track.bornAt - i * ENTRANCE_STAGGER) / ENTRANCE_DUR;
  if (e <= 0) return 0;
  if (e >= 1) return 1;
  return springSoft(e);
}

function entranceDone(track, now, n) {
  return track.bornAt === null || now - track.bornAt >= (n - 1) * ENTRANCE_STAGGER + ENTRANCE_DUR;
}

/* ---------------- 播放器 ---------------- */

export function mountPlayer(host, animKey, options = {}) {
  const anim = getAnimation(animKey);
  if (!anim) throw new Error(`未知动画: ${animKey}`);

  const compact = !!options.compact;
  let preset = options.preset || "random";
  const inputFor = () => (anim.mode === "race" ? [...RACE_INPUT] : presetValues(preset));
  const showValueLabels = anim.mode === "race" ? false : inputFor().length <= 12;

  let tracks = [];
  let budget = 0;          // 浮点进度：整数部分是状态下标，小数部分是过渡进度
  let maxBudget = 0;
  let playing = false;
  let speed = 1;
  let raf = null;
  let lastTs = 0;

  const tracksHost = el("div", { class: `anim-tracks${anim.mode === "race" ? " is-race" : ""}` });

  const progress = el("input", {
    type: "range", min: 0, max: 100, value: 0, class: "anim-range",
  });
  const stepLabel = el("span", { class: "anim-stat" }, "步 0 / 0");
  const playBtn = el("button", { class: "anim-btn", title: "播放 / 暂停" }, "▶");
  const resetBtn = el("button", { class: "anim-btn", title: "回到开头" }, "↺");
  const backBtn = el("button", { class: "anim-btn", title: "上一步" }, "◀");
  const fwdBtn = el("button", { class: "anim-btn", title: "下一步" }, "▶︎");
  const speedBtn = el("button", { class: "anim-btn anim-btn-sm", title: "切换倍速" }, "1x");
  const soundBtn = el("button", {
    class: "anim-btn anim-btn-sm anim-sound off",
    title: "音效关（点击开启：被操作的值会发出对应音高的声音）",
  }, "♪");
  const noteLine = el("div", { class: "anim-note" }, "");

  const presetChips = el("div", { class: "anim-chips" });

  function trackHeader(track) {
    const stats = el("span", { class: "anim-stat" }, "");
    const badge = el("span", { class: "anim-badge", style: "display:none" }, "完成");
    return {
      node: el("div", { class: "anim-track-head" }, [
        el("span", { class: "anim-track-name" }, track.meta.title),
        el("span", { class: "anim-track-meta" }, track.meta.footnote
          || `${track.meta.time} · 空间 ${track.meta.space} · ${track.meta.stable ? "稳定" : "不稳定"}`),
        el("span", { class: "anim-track-right" }, [badge, stats]),
      ]),
      stats,
      badge,
    };
  }

  function build() {
    tracks = [];
    maxBudget = 0;
    tracksHost.innerHTML = "";
    const isScene = anim.view === "scene";
    const algos = isScene ? [anim.kind] : (anim.mode === "race" ? [anim.left, anim.right] : [anim.algo]);
    const input = isScene ? null : inputFor();

    algos.forEach((algoKey, index) => {
      const track = isScene ? makeSceneTrack(anim) : makeTrack(algoKey, input, { showValueLabels });
      const header = trackHeader(track);
      const legend = anim.mode === "race" && index === 0
        ? el("div", { class: "anim-race-hint" }, "两条轨道用同一节奏推进 —— 谁先排完、谁多做了多少比较，一目了然")
        : null;
      const wrap = el("div", { class: "anim-track" }, [
        ...(legend ? [legend] : []),
        header.node,
        el("div", { class: "anim-stage" }, [track.svg]),
      ]);
      tracksHost.appendChild(wrap);
      track.header = header;   // 不能用展开复制：renderAt 闭包引用的是原对象，bornAt/doneAt 要同步
      tracks.push(track);
      maxBudget = Math.max(maxBudget, track.length);
    });

    progress.max = maxBudget;
    budget = 0;
    const now = performance.now();
    tracks.forEach((tr) => { tr.bornAt = now; });   // 触发入场错峰弹入
    renderFrame(now);
    ensureLoop();
  }

  /* 当前用于"文字"（字幕 / 计数器）的状态：过渡期间用目标态，
   * 计数器在边界跨越瞬间 +1，和音效节拍对齐。 */
  function textStateOf(track) {
    const cursor = Math.min(budget, track.length);
    const k = Math.floor(cursor);
    return cursor - k < 1e-6 ? track.states[k] : track.states[k + 1];
  }

  function renderFrame(now) {
    let ephemeral = false;
    let note = "";
    tracks.forEach((track) => {
      const cursor = Math.min(budget, track.length);
      if (track.renderAt(cursor, now)) ephemeral = true;
      const text = textStateOf(track);
      const done = cursor >= track.length;
      track.header.stats.textContent = track.statsOf
        ? track.statsOf(text)
        : `比较 ${text.compares} · 交换 ${text.swaps}${text.writes ? ` · 写入 ${text.writes}` : ""}`
          + (done ? ` · 完成于第 ${track.length} 步` : "");
      track.header.badge.style.display = done ? "" : "none";
      if (!note && text.note) note = text.note;
    });

    progress.value = String(Math.round(budget));
    stepLabel.textContent = `步 ${Math.floor(budget)} / ${maxBudget}`;
    const finished = budget >= maxBudget;
    if (finished && anim.mode === "race") {
      const [left, right] = tracks;
      note = left.length === right.length
        ? `同时结束：两边步数相同，但比较次数 ${left.states[left.length].compares} vs ${right.states[right.length].compares}`
        : `${left.meta.title} 需要 ${left.length} 步，${right.meta.title} 只要 ${right.length} 步 —— 快 ${(left.length / right.length).toFixed(1)} 倍`;
    }
    noteLine.textContent = note || "点击播放，或用 ◀ ▶ 单步观察";
    return ephemeral;
  }

  /* 播放推进时的副作用：跨步音效 + 单轨道完成庆祝（绿浪 + 琶音）。
   * 整体 try/catch：音效是增强体验，任何音频异常都绝不能拖垮播放循环。 */
  function onBudgetAdvanced(prev, next) {
    try {
      if (soundEnabled()) {
        // 音效跟着"还没排完"的轨道走（赛跑时先听左边，左边完成后自动切到右边）
        const snd = tracks.find((tr) => next < tr.length) || tracks[0];
        if (snd) {
          const fired = [];
          for (let m = Math.floor(prev) + 1; m <= Math.floor(next) && m < snd.length; m++) fired.push(m);
          fired.slice(-2).forEach((m) => stepSound(snd.steps[m], snd.states[m], snd.maxValue));
        }
      }
      tracks.forEach((tr) => {
        if (!tr.celebrated && prev < tr.length && next >= tr.length) {
          tr.celebrated = true;
          tr.doneAt = performance.now();
          arpeggio(tr.states[tr.length].array, tr.maxValue);
        }
      });
    } catch {
      /* 音效失败静默降级，播放继续 */
    }
  }

  function frame(ts) {
    raf = null;
    const now = performance.now();
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if (playing) {
      const prev = budget;
      budget = Math.min(maxBudget, budget + dt * BASE_STEPS_PER_SEC * speed);
      onBudgetAdvanced(prev, budget);
      if (budget >= maxBudget) setPlaying(false);
    }
    const ephemeral = renderFrame(now);
    if (playing || ephemeral) raf = requestAnimationFrame(frame);
    else lastTs = 0;
  }

  function ensureLoop() {
    if (raf === null) { lastTs = 0; raf = requestAnimationFrame(frame); }
  }

  function setPlaying(on) {
    playing = on;
    playBtn.textContent = on ? "❚❚" : "▶";
  }

  function setBudget(next) {
    budget = Math.max(0, Math.min(maxBudget, next));
    // 拖回未完成区间后，允许重新庆祝
    tracks.forEach((tr) => {
      if (budget < tr.length) { tr.celebrated = false; tr.doneAt = null; }
    });
    if (budget >= maxBudget) setPlaying(false);
    if (renderFrame(performance.now())) ensureLoop();
  }

  function play() {
    if (budget >= maxBudget) {
      tracks.forEach((tr) => { tr.celebrated = false; tr.doneAt = null; });
      budget = 0;
    }
    setPlaying(true);
    ensureLoop();
  }

  function pause() {
    setPlaying(false);
  }

  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  resetBtn.addEventListener("click", () => { pause(); setBudget(0); });
  backBtn.addEventListener("click", () => { pause(); setBudget(Math.ceil(budget) - 1); });
  fwdBtn.addEventListener("click", () => { pause(); setBudget(Math.floor(budget) + 1); });
  speedBtn.addEventListener("click", () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    speedBtn.textContent = `${speed}x`;
  });
  soundBtn.addEventListener("click", () => {
    setSoundEnabled(!soundEnabled());
    // 读回真实状态：环境不支持音频时 setSoundEnabled 会保持关闭，按钮不做虚假开启
    const on = soundEnabled();
    soundBtn.classList.toggle("off", !on);
    soundBtn.title = on ? "音效开（点击关闭）" : "音效关（点击开启：被操作的值会发出对应音高的声音）";
    if (on) confirmTone();   // 立刻给一声确认音：听得到=音频通了，听不到=环境禁了音频
  });
  progress.addEventListener("input", () => { pause(); setBudget(Number(progress.value)); });

  /* 输入预设只对排序有意义：场景动画的输入取自 SCENE_INPUTS */
  if (anim.mode === "single" && anim.view !== "scene") {
    Object.entries(
      // 只保留 {label, values} 形式的预设
      { random: "随机", nearly: "近乎有序", reversed: "完全逆序", few: "少量重复" }
    ).forEach(([key, label]) => {
      const chip = el("button", { class: `anim-chip${key === preset ? " active" : ""}`, type: "button" }, label);
      chip.addEventListener("click", () => {
        preset = key;
        [...presetChips.children].forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        pause();
        build();
      });
      presetChips.appendChild(chip);
    });
  }

  const root = el("div", { class: `anim-player anim-dark${compact ? " is-compact" : ""}`, tabindex: 0 }, [
    tracksHost,
    el("div", { class: "anim-controls" }, [playBtn, backBtn, fwdBtn, progress, stepLabel, speedBtn, soundBtn, resetBtn]),
    noteLine,
    ...(anim.mode === "single" ? [el("div", { class: "anim-preset-row" }, [
      el("span", { class: "anim-stat" }, "输入："), presetChips,
    ])] : []),
  ]);

  root.addEventListener("keydown", (e) => {
    if (e.key === " ") { e.preventDefault(); playing ? pause() : play(); }
    if (e.key === "ArrowRight") { e.preventDefault(); pause(); setBudget(Math.floor(budget) + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); pause(); setBudget(Math.ceil(budget) - 1); }
  });

  host.appendChild(root);
  build();

  const handle = {
    destroy() {
      pause();
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      liveInstances.delete(handle);
      root.remove();
    },
    play,
    pause,
  };
  liveInstances.add(handle);
  return handle;
}

/* 切页时统一收掉播放器：rAF 不停会一直烧 CPU（和 ECharts 实例一个道理）。 */
const liveInstances = new Set();
window.addEventListener("app:before-unmount", () => {
  for (const instance of [...liveInstances]) instance.destroy();
});

/** 供非模块脚本（topic.js 等）调用的入口。 */
export function mountInto(host, animKey, options) {
  return mountPlayer(host, animKey, options);
}
