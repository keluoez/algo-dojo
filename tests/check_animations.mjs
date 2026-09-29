/* 动画算法层测试（Node ESM）。
 *
 * 动画的逻辑错误用肉眼很难发现——排序结果看着"差不多"其实错了，
 * 或者高亮的格子里其实已经被覆盖成别的值。这些都必须靠断言兜住：
 *   1. 每一步的索引都指向真实存在的格子（不越界、不指空）
 *   2. 任意一帧都不能出现"凭空造值"或"同一个值出现两份"的幻影
 *      （空位是允许的：插入排序把元素取在手里时，原位置就是空位）
 *   3. 终态必须真的有序
 *   4. 同一个输入两次构建必须逐字节相同（Remotion 逐帧渲染的前提）
 *   5. 教学结论必须成立（冒泡逆序比近乎有序多干活、快排在规模上碾压冒泡…）
 *
 * 运行：node tests/check_animations.mjs
 */
import { SORTS, buildStepsFor } from "../frontend/js/anim/sorts.js";
import { ANIMATIONS, algosOf } from "../frontend/js/anim/registry.js";
import {
  OP, MARK_KIND, INPUT_PRESETS, presetValues,
  buildStates, roleOf, summarize, isSorted,
} from "../frontend/js/anim/protocol.js";

const OPS = new Set(Object.values(OP));
const failures = [];

function check(name, cond, extra = "") {
  if (!cond) failures.push(`${name} ${extra}`);
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && extra ? `  ${extra}` : ""}`);
}

const sortedCopy = (arr) => [...arr].sort((x, y) => x - y);
const sameArray = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 多重集包含：sub 里每个值都能在 base 里找到（允许 base 有剩余） */
function subsetMultiset(sub, base) {
  const pool = [...base].sort((x, y) => x - y);
  for (const v of [...sub].sort((x, y) => x - y)) {
    const idx = pool.indexOf(v);
    if (idx < 0) return false;
    pool.splice(idx, 1);
  }
  return true;
}

function validateSteps(label, input, steps) {
  const n = input.length;
  const problems = [];
  const written = [];

  steps.forEach((step, idx) => {
    const at = `第 ${idx} 步 ${step.op}`;
    if (!OPS.has(step.op)) problems.push(`${at} 未知操作`);
    const oneIndex = { [OP.COMPARE]: 1, [OP.SET]: 1, [OP.HOLE]: 1, [OP.MARK]: 1, [OP.UNMARK]: 1 };
    if (oneIndex[step.op] && !(Number.isInteger(step.i) && step.i >= 0 && step.i < n)) {
      problems.push(`${at} 的 i=${step.i} 越界（n=${n}）`);
    }
    if (step.op === OP.SWAP && ![step.i, step.j].every((x) => Number.isInteger(x) && x >= 0 && x < n)) {
      problems.push(`${at} 的下标越界：${step.i},${step.j}`);
    }
    if (step.op === OP.COMPARE && step.j !== null && step.j !== undefined
        && !(Number.isInteger(step.j) && step.j >= 0 && step.j < n)) {
      problems.push(`${at} 的 j=${step.j} 越界`);
    }
    if (step.op === OP.SHIFT && ![step.from, step.to].every((x) => Number.isInteger(x) && x >= 0 && x < n)) {
      problems.push(`${at} 的下标越界：${step.from}→${step.to}`);
    }
    if (step.op === OP.SET_RANGE) {
      const hi = step.lo + step.values.length - 1;
      if (!(step.lo >= 0 && hi < n && step.values.length > 0)) {
        problems.push(`${at} 的区间越界：[${step.lo}, ${hi}]（n=${n}）`);
      }
      written.push(...step.values);
    }
    if (step.op === OP.SET) {
      if (typeof step.value !== "number") problems.push(`${at} 缺少数值 value`);
      else written.push(step.value);
    }
    if (step.op === OP.MARK && !Object.values(MARK_KIND).includes(step.kind)) {
      problems.push(`${at} 的 kind=${step.kind} 非法`);
    }
  });

  const states = buildStates(input, steps);
  if (states.length !== steps.length + 1) {
    problems.push(`状态数 ${states.length} ≠ 步数 ${steps.length} + 1`);
  }
  states.forEach((state, idx) => {
    const present = state.array.filter((v) => v !== null);
    if (!subsetMultiset(present, input)) {
      problems.push(`第 ${idx} 帧出现输入里没有的值：${JSON.stringify(state.array)}`);
    }
    if (present.length + state.array.filter((v) => v === null).length !== n) {
      problems.push(`第 ${idx} 帧格子数不对`);
    }
    if (state.array.filter((v) => v === null).length > 1) {
      problems.push(`第 ${idx} 帧出现多个空位`);
    }
    state.array.forEach((_, i) => {
      if (!roleOf(state, i)) problems.push(`第 ${idx} 帧 roleOf(${i}) 非法`);
    });
  });

  const final = states[states.length - 1].array;
  if (!isSorted(final)) problems.push(`终态未排序：${JSON.stringify(final)}`);
  if (!sameArray(final, sortedCopy(input))) {
    problems.push(`终态不是输入的排序结果：${JSON.stringify(final)}`);
  }
  // 写入的值必须在输入里存在（累计日志里允许同一个值被写多次：
  // 归并的不同层会把同一个值反复搬到新位置）
  if (!written.every((v) => input.includes(v))) {
    const bad = written.filter((v) => !input.includes(v));
    problems.push(`有写入的值不属于输入数据：${JSON.stringify(bad.slice(0, 5))}`);
  }
  return problems;
}

/* ---------------- 1. 六个算法 × 四种输入 ---------------- */

for (const meta of Object.values(SORTS)) {
  for (const presetName of Object.keys(INPUT_PRESETS)) {
    const input = presetValues(presetName);
    const steps = meta.build(input);
    const problems = validateSteps(`${meta.title}/${presetName}`, input, steps);
    check(`${meta.title} · ${INPUT_PRESETS[presetName].label} · 协议与终态`,
          problems.length === 0, problems.slice(0, 2).join("；"));
    check(`${meta.title} · ${INPUT_PRESETS[presetName].label} · 有实际动作`,
          steps.length > 0 && summarize(input, steps).compares > 0);
  }
}

/* ---------------- 2. 边界输入不崩、不越界 ---------------- */

const EDGES = [["空数组", []], ["单元素", [7]], ["已排序", [1, 2, 3, 4]],
               ["全相等", [3, 3, 3, 3]], ["含负数", [-1, 5, -3, 0]]];
for (const meta of Object.values(SORTS)) {
  for (const [label, input] of EDGES) {
    let steps;
    try {
      steps = meta.build(input);
    } catch (e) {
      check(`${meta.title} · ${label} 不抛异常`, false, String(e && e.message));
      continue;
    }
    const problems = validateSteps(`${meta.title}/${label}`, input, steps);
    check(`${meta.title} · ${label}`, problems.length === 0, problems.slice(0, 2).join("；"));
  }
}

/* ---------------- 3. 确定性（Remotion 逐帧渲染的前提） ---------------- */

for (const meta of Object.values(SORTS)) {
  const input = presetValues("random");
  check(`${meta.title} · 两次构建完全一致`,
        JSON.stringify(meta.build(input)) === JSON.stringify(meta.build(input)));
  check(`${meta.title} · 状态归约可复现`,
        JSON.stringify(buildStates(input, meta.build(input)).slice(0, 6))
        === JSON.stringify(buildStates(input, meta.build(input)).slice(0, 6)));
}

/* ---------------- 4. 教学结论必须成立 ---------------- */

const bubbleBest = buildStepsFor("bubble", presetValues("nearly")).length;
const bubbleWorst = buildStepsFor("bubble", presetValues("reversed")).length;
check("冒泡：近乎有序 明显少于 完全逆序（提前结束真的生效）",
      bubbleBest < bubbleWorst * 0.6, `${bubbleBest} vs ${bubbleWorst}`);

const insNearly = buildStepsFor("insertion", presetValues("nearly")).length;
const insReversed = buildStepsFor("insertion", presetValues("reversed")).length;
check("插入：近乎有序 明显少于 完全逆序",
      insNearly < insReversed * 0.6, `${insNearly} vs ${insReversed}`);

// 小规模（8 个元素）下 O(n²) 和 O(n log n) 看不出差距，这正是"要有赛跑模式"的理由：
// 结论必须在有意义的规模上成立
function lcgInput(n, seed = 20260926) {
  const out = [];
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out.push(x % 1000);
  }
  return out;
}
const big = lcgInput(64);
const cost = (key) => summarize(big, buildStepsFor(key, big));
check("规模 64 下：快排比较次数碾压冒泡（赛跑模式的说服力来源）",
      cost("quick").compares * 2 < cost("bubble").compares,
      `快排 ${cost("quick").compares} vs 冒泡 ${cost("bubble").compares}`);
check("规模 64 下：归并比较次数同样远少于冒泡",
      cost("merge").compares * 2 < cost("bubble").compares,
      `归并 ${cost("merge").compares} vs 冒泡 ${cost("bubble").compares}`);

const n = 8;
const upper = n * Math.ceil(Math.log2(n));
for (const preset of ["random", "reversed"]) {
  const c = summarize(presetValues(preset), buildStepsFor("merge", presetValues(preset))).compares;
  check(`归并 · ${preset} · 比较次数落在 O(n log n) 量级`,
        c > 0 && c <= upper, `${c} 应 ≤ ${upper}`);
}
check("选择排序的交换次数最少（≤ n-1）",
      summarize(presetValues("random"), buildStepsFor("selection", presetValues("random"))).swaps <= 7);
check("插入排序在近乎有序时写入次数远少于逆序",
      summarize(presetValues("nearly"), buildStepsFor("insertion", presetValues("nearly"))).writes
      < summarize(presetValues("reversed"), buildStepsFor("insertion", presetValues("reversed"))).writes);

/* ---------------- 5. 目录与赛跑条目 ---------------- */

/* 目录里除了柱状图排序动画，还有 Agent 实战场景动画（view:"scene"，algo 为 null，
 * 步骤由 AGENT_BUILDERS 生成而非 SORTS）。柱状图的断言只对柱状图条目生效，
 * 场景动画由 tests/check_agent_animations.mjs 单独把关。 */
const BAR_ANIMATIONS = ANIMATIONS.filter((a) => a.view !== "scene");
const SCENE_ANIMATIONS = ANIMATIONS.filter((a) => a.view === "scene");

const keys = ANIMATIONS.map((a) => a.key);
check("动画 key 唯一", new Set(keys).size === keys.length);
check("柱状图条目都能取到算法", BAR_ANIMATIONS.every((a) => algosOf(a).every((k) => SORTS[k])));
check("目录条目都挂了知识点", ANIMATIONS.every((a) => a.topics.length > 0));
check("存在赛跑条目", ANIMATIONS.some((a) => a.mode === "race"));

const raceInput = presetValues("random");
for (const anim of BAR_ANIMATIONS) {
  const results = algosOf(anim).map((k) => summarize(raceInput, buildStepsFor(k, raceInput)));
  check(`${anim.title} · 两侧都排好且结果一致`,
        results.every((r) => r.sorted)
        && (results.length < 2 || sameArray(results[0].array, results[1].array)));
}

/* 场景条目至少在目录层是完整的：有 kind、有输入样例、挂了分组。
 * 配套题目允许为空（比如盛水双指针内容里暂时没有对应题目），
 * 但一旦挂了就必须是非空 slug —— 挂个空串会渲染出一个跳转不了的死链接。 */
check("存在场景条目", SCENE_ANIMATIONS.length > 0);
check("场景条目都有 kind、分组与输入样例",
      SCENE_ANIMATIONS.every((a) => a.kind && a.group && a.input));
check("problem 要么为空要么是非空 slug",
      SCENE_ANIMATIONS.every((a) => a.problem === null || (typeof a.problem === "string" && a.problem.length > 0)));
const withProblem = SCENE_ANIMATIONS.filter((a) => a.problem).length;
check("大部分场景挂了配套题目",
      withProblem >= SCENE_ANIMATIONS.length - 2,
      `${withProblem}/${SCENE_ANIMATIONS.length} 个有配套题目`);

/* ---------------- 汇总 ---------------- */

console.log(`\n失败 ${failures.length} 项`);
failures.forEach((f) => console.log(`  ✗ ${f}`));
process.exit(failures.length ? 1 : 0);
