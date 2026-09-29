/* 动画目录：把算法脚本登记成可访问的"动画条目"，并挂到知识点 / 题目上。
 *
 * mode: "single" 单个算法；"race" 同一输入下两个算法赛跑（最能体现复杂度差异）
 * video: 由 Remotion 渲染出的成片路径，未渲染时为 null（页面自动隐藏成片入口）
 */
import { SORTS } from "./sorts.js?v=16";
import { SCENES, SCENE_INPUTS, SCENE_GROUPS } from "./scenes.js?v=16";

function entry(key, algo, extra = {}) {
  const meta = SORTS[algo];
  return {
    key,
    mode: "single",
    algo,
    title: meta.title,
    subtitle: meta.oneLine,
    time: meta.time,
    timeBest: meta.timeBest,
    space: meta.space,
    stable: meta.stable,
    topics: ["algo-sort"],
    video: null,
    ...extra,
  };
}

function race(key, left, right, extra = {}) {
  return {
    key,
    mode: "race",
    left,
    right,
    title: `${SORTS[left].title} vs ${SORTS[right].title}`,
    subtitle: "同一组输入、同一个节奏推进，直接看谁先排完、谁动得更多",
    topics: ["algo-sort"],
    video: null,
    ...extra,
  };
}

/* 场景动画（非柱状图）：向量检索 / 多路召回 / 上下文裁剪 / 路由 / 工作流 / 去重，
 * 以及经典算法里的二分 / 双指针 / 链表这类"有指针和面板"的动画。
 * problem 字段让动画页能直接跳到配套题目；group 决定动画中心里的小节。 */
function scene(key, kind, extra = {}) {
  const meta = SCENES[kind];
  return {
    key,
    mode: "single",
    view: "scene",
    kind,
    algo: null,
    title: meta.title,
    subtitle: meta.oneLine,
    time: meta.time,
    timeBest: "",
    space: meta.space,
    stable: true,
    topics: [meta.topic],
    problem: meta.problem,
    badge: meta.badge || null,
    group: meta.group || "agent",
    input: SCENE_INPUTS[kind],
    video: null,
    ...extra,
  };
}

export const ANIMATIONS = [
  entry("sort-bubble", "bubble", { order: 1 }),
  entry("sort-selection", "selection", { order: 2 }),
  entry("sort-insertion", "insertion", { order: 3 }),
  entry("sort-merge", "merge", { order: 4 }),
  entry("sort-quick", "quick", { order: 5 }),
  entry("sort-heap", "heap", { order: 6 }),
  race("race-bubble-quick", "bubble", "quick", { order: 7 }),
  race("race-insertion-merge", "insertion", "merge", { order: 8 }),
  race("race-selection-heap", "selection", "heap", { order: 9 }),
  scene("agent-vector-search", "vector", { order: 10 }),
  scene("agent-rerank", "rerank", { order: 11 }),
  scene("agent-ctx-window", "ctx", { order: 12 }),
  scene("agent-prefix-router", "router", { order: 13 }),
  scene("agent-workflow", "workflow", { order: 14 }),
  scene("agent-dedup", "dedup", { order: 15 }),

  /* 经典算法（P0/P1）：计数排序、二分、双指针、滑窗、贪心、链表 */
  scene("classic-counting", "counting", { order: 20 }),
  scene("classic-binary-search", "binary-search", { order: 21 }),
  scene("classic-binary-answer", "binary-answer", { order: 22 }),
  scene("classic-two-water", "two-water", { order: 23 }),
  scene("classic-sliding-window", "sliding-window", { order: 24 }),
  scene("classic-jump-game", "jump-game", { order: 25 }),
  scene("classic-reverse-list", "reverse-list", { order: 26 }),
  scene("classic-cycle-detect", "cycle-detect", { order: 27 }),
];

/* 动画中心的小节顺序：先排序（含柱状图那条主线）、再指针/窗口、链表，最后是 Agent 实战。 */
export const GROUP_ORDER = ["sort", "pointer", "list", "agent"];

export function groupLabel(group) {
  return SCENE_GROUPS[group] || group;
}

/** 场景动画按 group 分组，组内按 order 排 */
export function sceneGroups() {
  const out = [];
  GROUP_ORDER.forEach((g) => {
    const items = ANIMATIONS.filter((a) => a.view === "scene" && a.group === g)
      .sort((x, y) => (x.order || 0) - (y.order || 0));
    if (items.length) out.push({ group: g, label: groupLabel(g), items });
  });
  return out;
}

export function listAnimations(topic) {
  const items = topic ? ANIMATIONS.filter((a) => a.topics.includes(topic)) : [...ANIMATIONS];
  return items.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getAnimation(key) {
  return ANIMATIONS.find((a) => a.key === key) || null;
}

export function animationsOfTopic(topicSlug) {
  return listAnimations(topicSlug);
}

/** 条目涉及哪些算法（单个或赛跑的两个），用于取标题与统计。 */
export function algosOf(anim) {
  return anim.mode === "race" ? [anim.left, anim.right] : [anim.algo];
}
