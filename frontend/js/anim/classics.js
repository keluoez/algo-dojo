/* 经典算法场景动画的脚本层：buildSteps(input) -> Step[]。
 *
 * 与 Agent 场景（agents.js）同一套协议，只是这些算法有"指针 / 窗口 / 判定"，
 * 光靠数组下标说不清，所以走场景视图（渲染器在 render-classic.js）。
 *
 * 为什么不用柱状图视图的 COMPARE：COMPARE 的字幕由 describeStep 自动生成、
 * 且读的是 state.array（场景态的 array 是空的），会打出 "a[3]=undefined"。
 * 场景脚本一律用 FOCUS / DECIDE / SET_METRIC / SET_LIST 这些"自带 note"的事件。
 *
 * 每条脚本末尾都用 SET_LIST 交出答案，测试拿它与暴力解/手算结果比对。
 */
import { OP } from "./protocol.js?v=16";

const note = (text) => ({ op: OP.NOTE, text });

/* ---------------- 1. 计数排序：两次遍历 + 一次写回 ---------------- */

export function countingSteps({ values }) {
  const steps = [];
  const n = values.length;
  if (n === 0) return steps;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min + 1;
  const count = new Array(span).fill(0);

  steps.push(note(`值域 [${min}, ${max}]：先数每个值出现几次，不比较任何两个数`));

  values.forEach((v, i) => {
    count[v - min] += 1;
    steps.push({
      op: OP.DECIDE, i, keep: "counted",
      note: `数到 a[${i}]=${v}：count[${v}] = ${count[v - min]}`,
    });
    steps.push({ op: OP.SET_LIST, name: "count", values: [...count] });
    steps.push({ op: OP.SET_METRIC, name: "counted", value: i + 1 });
  });

  steps.push(note("前缀和：count 累加后，count[v] 就是「最后一个 v 该去的下标 + 1」"));
  let acc = 0;
  for (let k = 0; k < span; k++) {
    acc += count[k];
    count[k] = acc;
  }
  steps.push({ op: OP.SET_LIST, name: "prefix", values: [...count] });

  steps.push(note("倒着放：从尾部往前填，相等的键保持原相对顺序（稳定）"));
  const out = new Array(n).fill(null);
  const prefix = [...count];
  for (let i = n - 1; i >= 0; i--) {
    const v = values[i];
    const pos = prefix[v - min] - 1;
    out[pos] = v;
    prefix[v - min] -= 1;
    steps.push({
      op: OP.DECIDE, i, keep: "placed",
      note: `a[${i}]=${v} 放到输出位 ${pos}（count[${v}] 用掉一个，剩 ${prefix[v - min]}）`,
    });
    steps.push({ op: OP.SET_LIST, name: "out", values: [...out] });
    steps.push({ op: OP.SET_METRIC, name: "placed", value: n - i });
  }

  steps.push({
    op: OP.SET_LIST, name: "answer", values: [...out],
    note: `排序完成：${out.join("、")} —— 全程没有一次元素间的比较`,
  });
  return steps;
}

/* ---------------- 2. 二分查找 ---------------- */

export function binarySearchSteps({ values, target }) {
  const steps = [];
  let lo = 0;
  let hi = values.length - 1;
  let round = 0;
  steps.push(note(`在 ${values.length} 个有序元素里找 ${target}：每轮砍掉一半区间`));

  let hit = -1;
  while (lo <= hi) {
    round += 1;
    const mid = (lo + hi) >> 1;
    const v = values[mid];
    steps.push({ op: OP.RANGE, lo, hi, note: `第 ${round} 轮：区间 [${lo}, ${hi}]` });
    steps.push({ op: OP.POINTER, name: "lo", at: lo });
    steps.push({ op: OP.POINTER, name: "hi", at: hi });
    steps.push({ op: OP.POINTER, name: "mid", at: mid });
    steps.push({ op: OP.SET_METRIC, name: "round", value: round });
    if (v === target) {
      hit = mid;
      steps.push({
        op: OP.DECIDE, i: mid, keep: "hit",
        note: `a[${mid}]=${v} 就是 ${target} —— 命中，第 ${round} 轮结束`,
      });
      break;
    }
    if (v < target) {
      steps.push({
        op: OP.DECIDE, i: mid, keep: "tooSmall",
        note: `a[${mid}]=${v} < ${target}：mid 和它左边都太小，lo 跳到 ${mid + 1}`,
      });
      lo = mid + 1;
    } else {
      steps.push({
        op: OP.DECIDE, i: mid, keep: "tooBig",
        note: `a[${mid}]=${v} > ${target}：mid 和它右边都太大，hi 退到 ${mid - 1}`,
      });
      hi = mid - 1;
    }
  }

  if (hit < 0) {
    steps.push(note(`区间空了（lo=${lo} > hi=${hi}）：${target} 不在数组里`));
  }
  steps.push({
    op: OP.SET_LIST, name: "answer", values: [hit],
    note: hit >= 0 ? `找到：下标 ${hit}，用了 ${round} 轮（log₂${values.length} ≈ ${Math.ceil(Math.log2(values.length))}）`
      : `未找到：返回 -1`,
  });
  return steps;
}

/* ---------------- 3. 二分答案：在"答案空间"上二分 ---------------- */

export function binaryAnswerSteps({ piles, hours }) {
  const steps = [];
  const need = (k) => piles.reduce((s, p) => s + Math.ceil(p / k), 0);
  let lo = 1;
  let hi = Math.max(...piles);
  let ans = hi;
  let round = 0;

  steps.push(note(`找最小速度 k：使得吃完所有堆的耗时 ≤ ${hours} 小时。k 越大越快 —— 单调，可以二分`));

  while (lo <= hi) {
    round += 1;
    const mid = (lo + hi) >> 1;
    const h = need(mid);
    const ok = h <= hours;
    steps.push({ op: OP.SET_METRIC, name: "k", value: mid });
    steps.push({ op: OP.SET_METRIC, name: "hours", value: h });
    steps.push({ op: OP.SET_METRIC, name: "lo", value: lo });
    steps.push({ op: OP.SET_METRIC, name: "hi", value: hi });
    steps.push({ op: OP.SET_METRIC, name: "round", value: round });
    if (ok) {
      ans = mid;
      steps.push({
        op: OP.SET_LIST, name: "verdict", values: ["可行"],
        note: `k=${mid}：需要 ${h} 小时 ≤ ${hours} —— 可行，先记下答案再往左找更小的`,
      });
      hi = mid - 1;
    } else {
      steps.push({
        op: OP.SET_LIST, name: "verdict", values: ["太慢"],
        note: `k=${mid}：需要 ${h} 小时 > ${hours} —— 太慢，只能往右提速`,
      });
      lo = mid + 1;
    }
  }

  steps.push({
    op: OP.SET_LIST, name: "answer", values: [ans],
    note: `最小可行速度 k=${ans}（耗时 ${need(ans)} 小时）—— 二分答案：判定函数单调，就能对答案本身二分`,
  });
  return steps;
}

/* ---------------- 4. 盛水双指针 ---------------- */

export function twoWaterSteps({ height }) {
  const steps = [];
  const n = height.length;
  let l = 0;
  let r = n - 1;
  let best = 0;

  steps.push(note("容量 = 两边界中较矮的那个 × 宽度。移动长边只会变窄、不可能变高，所以只移动短边"));

  while (l < r) {
    const area = Math.min(height[l], height[r]) * (r - l);
    const newBest = Math.max(best, area);
    steps.push({ op: OP.RANGE, lo: l, hi: r });
    steps.push({ op: OP.POINTER, name: "l", at: l });
    steps.push({ op: OP.POINTER, name: "r", at: r });
    steps.push({ op: OP.SET_METRIC, name: "area", value: area });
    steps.push({ op: OP.SET_METRIC, name: "best", value: newBest });

    const drop = height[l] <= height[r] ? l : r;
    const other = drop === l ? r : l;
    steps.push({
      op: OP.DECIDE, i: drop, keep: "drop",
      note: `h[${l}]=${height[l]} vs h[${r}]=${height[r]}：容量 ${area}。`
        + `窄边是 ${drop}（高 ${height[drop]}），留着它宽度再大也涨不上去 → 淘汰 ${drop}`
        + (newBest > best ? `，最大容量刷新为 ${newBest}` : ""),
    });
    best = newBest;
    if (drop === l) l += 1; else r -= 1;
    steps.push({ op: OP.SET_METRIC, name: "width", value: other - (drop === l ? l : r) });
  }

  steps.push({
    op: OP.SET_LIST, name: "answer", values: [best],
    note: `最大容量 ${best}：每轮淘汰一个窄边，O(n) 扫完`,
  });
  return steps;
}

/* ---------------- 5. 最长无重复子串（滑动窗口） ---------------- */

export function slidingWindowSteps({ chars }) {
  const steps = [];
  const s = chars.split("");
  const n = s.length;
  const last = {};
  let lo = 0;
  let best = 0;

  steps.push(note("右边界只前进，重复时把左边界直接跳到「上一个同名字符的下一位」—— 每个字符最多进出各一次"));

  s.forEach((c, hi) => {
    steps.push({ op: OP.POINTER, name: "hi", at: hi });
    if (last[c] !== undefined && last[c] >= lo) {
      const oldLo = lo;
      lo = last[c] + 1;
      steps.push({
        op: OP.DECIDE, i: hi, keep: "dup",
        note: `"${c}" 在窗口里已经有过（下标 ${last[c]}）：左边界从 ${oldLo} 跳到 ${lo}`,
      });
      steps.push({ op: OP.POINTER, name: "lo", at: lo });
    } else {
      steps.push({
        op: OP.DECIDE, i: hi, keep: "ok",
        note: `"${c}" 没在窗口里出现过，收进来：窗口 = "${s.slice(lo, hi + 1).join("")}"`,
      });
    }
    last[c] = hi;
    const len = hi - lo + 1;
    const newBest = Math.max(best, len);
    steps.push({ op: OP.RANGE, lo, hi });
    steps.push({ op: OP.SET_METRIC, name: "len", value: len });
    steps.push({ op: OP.SET_METRIC, name: "best", value: newBest });
    steps.push({ op: OP.SET_LIST, name: "window", values: s.slice(lo, hi + 1) });
    best = newBest;
  });

  steps.push({
    op: OP.SET_LIST, name: "answer", values: [best],
    note: `最长无重复子串长度 ${best}：全程 O(n)，右指针从不回退`,
  });
  return steps;
}

/* ---------------- 6. 跳跃游戏（贪心） ---------------- */

export function jumpGameSteps({ nums }) {
  const steps = [];
  let farthest = 0;
  steps.push(note("只维护「当前能到的最远下标」：走到 i 时若 i 已经超出最远范围，就断了"));

  for (let i = 0; i < nums.length; i++) {
    if (i > farthest) {
      steps.push({ op: OP.POINTER, name: "i", at: i });
      steps.push({
        op: OP.DECIDE, i, keep: "dead",
        note: `走到 ${i}，但最远只到 ${farthest} —— 中间断了，到不了终点`,
      });
      steps.push({ op: OP.SET_LIST, name: "answer", values: [0], note: "结论：false" });
      return steps;
    }
    steps.push({ op: OP.POINTER, name: "i", at: i });
    const reach = i + nums[i];
    const next = Math.max(farthest, reach);
    steps.push({
      op: OP.DECIDE, i, keep: "ok",
      note: `${i} 能跳 ${nums[i]} 步 → 到达 ${reach}；最远范围 ${farthest} → ${next}`
        + (next > farthest ? "（刷新）" : "（没变）"),
    });
    farthest = next;
    steps.push({ op: OP.SET_METRIC, name: "farthest", value: farthest });
    if (farthest >= nums.length - 1) {
      steps.push({
        op: OP.SET_METRIC, name: "reachEnd", value: 1,
        note: `最远范围已覆盖终点 ${nums.length - 1} —— 后面不用看了`,
      });
      break;
    }
  }

  steps.push({
    op: OP.SET_LIST, name: "answer", values: [1],
    note: "结论：true —— 贪心的关键是不去 DFS，只问「最远能到哪」",
  });
  return steps;
}

/* ---------------- 7. 链表反转 ---------------- */

export function reverseListSteps({ values }) {
  const steps = [];
  const n = values.length;
  const next = values.map((_, i) => (i + 1 < n ? i + 1 : -1));
  let prev = -1;
  let cur = 0;
  let moved = 0;

  steps.push(note("三个指针：prev / cur / nxt。每轮只做一件事 —— 把 cur 的箭头掉头指向 prev"));

  while (cur !== -1) {
    const nxt = next[cur];
    steps.push({ op: OP.POINTER, name: "prev", at: prev });
    steps.push({ op: OP.POINTER, name: "cur", at: cur });
    steps.push({ op: OP.POINTER, name: "nxt", at: nxt });
    next[cur] = prev;
    moved += 1;
    steps.push({
      op: OP.SET_LIST, name: "next", values: [...next],
      note: `第 ${moved} 步：先存 nxt=${nxt === -1 ? "None" : nxt}，再把 ${cur} 的箭头指向 ${prev === -1 ? "None" : prev}`,
    });
    steps.push({ op: OP.SET_LIST, name: "done", values: [cur] });
    steps.push({ op: OP.SET_METRIC, name: "moved", value: moved });
    prev = cur;
    cur = nxt;
  }

  steps.push({ op: OP.POINTER, name: "prev", at: prev });
  steps.push({ op: OP.POINTER, name: "cur", at: cur });
  const order = [];
  for (let p = prev; p !== -1; p = next[p]) order.push(p);
  steps.push({
    op: OP.SET_LIST, name: "answer", values: order,
    note: `反转完成，新链头是 ${prev}：${order.map((i) => values[i]).join(" → ")}`,
  });
  return steps;
}

/* ---------------- 8. 快慢指针找环 ---------------- */

export function cycleSteps({ values, next: initNext }) {
  const steps = [];
  const next = [...initNext];
  let slow = 0;
  let fast = 0;
  let round = 0;

  steps.push(note("慢针每次走 1 步、快针每次走 2 步：有环就一定会在环里追上，像操场跑圈"));

  for (let guard = 0; guard < values.length * 3 + 5; guard++) {
    round += 1;
    slow = next[slow];
    let fastMid = next[fast];
    if (fastMid === -1 || slow === -1) {
      steps.push({ op: OP.POINTER, name: "fast", at: -1 });
      steps.push({
        op: OP.DECIDE, i: 0, keep: "none",
        note: `快针走到了 None —— 链表有终点，没有环`,
      });
      steps.push({ op: OP.SET_LIST, name: "answer", values: [-1], note: "结论：无环" });
      return steps;
    }
    fast = next[fastMid];
    if (fast === -1) {
      steps.push({ op: OP.POINTER, name: "fast", at: -1 });
      steps.push({
        op: OP.DECIDE, i: 0, keep: "none",
        note: `快针走到了 None —— 链表有终点，没有环`,
      });
      steps.push({ op: OP.SET_LIST, name: "answer", values: [-1], note: "结论：无环" });
      return steps;
    }
    steps.push({ op: OP.POINTER, name: "slow", at: slow });
    steps.push({ op: OP.POINTER, name: "fast", at: fast });
    steps.push({ op: OP.SET_METRIC, name: "round", value: round });
    steps.push({
      op: OP.DECIDE, i: slow, keep: slow === fast ? "meet" : "ok",
      note: slow === fast
        ? `第 ${round} 轮：慢针和快针都在 ${slow} —— 相遇，说明有环`
        : `第 ${round} 轮：慢针走到 ${slow}，快针走到 ${fast}，还没碰上`,
    });
    if (slow === fast) {
      steps.push({
        op: OP.SET_LIST, name: "answer", values: [slow],
        note: `相遇点 ${slow}。再从 ${slow} 和链头同时每次走一步，第二次相遇处就是环的入口`,
      });
      return steps;
    }
  }
  steps.push({ op: OP.SET_LIST, name: "answer", values: [-1], note: "超出步数上限，判定为无环" });
  return steps;
}

/* ---------------- 目录：构建器、默认输入、元信息 ---------------- */

export const CLASSIC_BUILDERS = {
  counting: (input) => countingSteps(input),
  "binary-search": (input) => binarySearchSteps(input),
  "binary-answer": (input) => binaryAnswerSteps(input),
  "two-water": (input) => twoWaterSteps(input),
  "sliding-window": (input) => slidingWindowSteps(input),
  "jump-game": (input) => jumpGameSteps(input),
  "reverse-list": (input) => reverseListSteps(input),
  "cycle-detect": (input) => cycleSteps(input),
};

export const CLASSIC_INPUTS = {
  counting: { values: [4, 2, 2, 8, 3, 3, 1] },
  "binary-search": { values: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], target: 23 },
  "binary-answer": { piles: [3, 6, 7, 11], hours: 8 },
  "two-water": { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] },
  "sliding-window": { chars: "abcabcbb" },
  "jump-game": { nums: [2, 3, 1, 1, 4] },
  "reverse-list": { values: [1, 2, 3, 4, 5] },
  "cycle-detect": { values: [3, 2, 0, -4], next: [1, 2, 3, 1] },
};

export const CLASSICS = {
  counting: {
    title: "计数排序",
    oneLine: "不比较任何两个元素：数次数 → 前缀和 → 倒着放，O(n + 值域)",
    time: "O(n + k)",
    space: "O(n + k)",
    topic: "algo-sort",
    problem: "p-lc912",
    badge: "排序",
    group: "sort",
  },
  "binary-search": {
    title: "二分查找",
    oneLine: "有序区间上取中点，每轮砍掉一半 —— log₂n 轮必出结果",
    time: "O(log n)",
    space: "O(1)",
    topic: "algo-binary-search",
    problem: "p-lc704",
    badge: "查找",
    group: "pointer",
  },
  "binary-answer": {
    title: "二分答案",
    oneLine: "答案本身有序时（越大越快），对答案二分 + 判定函数",
    time: "O(n log k)",
    space: "O(1)",
    topic: "algo-binary-search",
    problem: "p-lc875",
    badge: "查找",
    group: "pointer",
  },
  "two-water": {
    title: "盛水双指针",
    oneLine: "容量 = 窄边 × 宽度，每轮淘汰窄边 —— 只移动短边才是 O(n)",
    time: "O(n)",
    space: "O(1)",
    topic: "algo-two-pointers",
    problem: null,
    badge: "双指针",
    group: "pointer",
  },
  "sliding-window": {
    title: "最长无重复子串",
    oneLine: "右边界只前进，重复时左边界直接跳到上一个同字符的下一位",
    time: "O(n)",
    space: "O(字符集)",
    topic: "algo-two-pointers",
    problem: "p-lc3",
    badge: "滑窗",
    group: "pointer",
  },
  "jump-game": {
    title: "跳跃游戏（贪心）",
    oneLine: "只维护「最远能到哪」，不 DFS —— 覆盖到终点即成功",
    time: "O(n)",
    space: "O(1)",
    topic: "algo-greedy",
    problem: "p-lc55",
    badge: "贪心",
    group: "pointer",
  },
  "reverse-list": {
    title: "链表反转",
    oneLine: "prev / cur / nxt 三指针，每轮把一个箭头掉头",
    time: "O(n)",
    space: "O(1)",
    topic: "ds-linked-list",
    problem: "p-lc206",
    badge: "链表",
    group: "list",
  },
  "cycle-detect": {
    title: "快慢指针找环",
    oneLine: "慢针 1 步、快针 2 步，有环必在环内相遇",
    time: "O(n)",
    space: "O(1)",
    topic: "ds-linked-list",
    problem: "p-lc142",
    badge: "链表",
    group: "list",
  },
};

/** group 的展示名（动画中心按组分小节） */
export const CLASSIC_GROUPS = {
  sort: "排序（非比较型）",
  pointer: "指针、窗口与贪心",
  list: "链表",
};
