/* 算法动画事件协议（Step Protocol）。
 *
 * 每个算法导出纯函数 buildSteps(input) -> Step[]，事件是原子的、只描述
 * "发生了什么"，不含任何渲染细节。同一份 Step 数组同时驱动：
 *   - 浏览器播放器（可单步 / 变速 / 回退 / 赛跑）
 *   - Remotion 逐帧渲染（要求确定性：同一 step 序列必须产出同一画面）
 *
 * 之所以强调确定性：Remotion 是逐帧独立渲染的，任何依赖"上一帧内存状态"的
 * 写法都会在并行渲染下崩掉，所以状态一律由 steps 前缀归约出来（buildStates）。
 */

export const OP = {
  COMPARE: "compare",   // {i, j, vs?}  j 为 null 表示"与手里暂存的值比较"
  SWAP: "swap",         // {i, j}
  SET: "set",           // {i, value} 写入（把暂存值填回空位）
  HOLE: "hole",         // {i} 取出元素，该位置变空位（插入排序的"暂存"）
  SHIFT: "shift",       // {from, to} 原子后移：抄进空位 + 源位置变空位
  SET_RANGE: "setRange",// {lo, values} 原子写回一段（归并合并结果）
  MARK: "mark",         // {i, kind} kind 见 MARK_KIND
  UNMARK: "unmark",     // {i, kind}
  RANGE: "range",       // {lo, hi} 当前考察区间，区间外暗化
  POINTER: "pointer",   // {name, at} 命名指针（双指针 / 二分 / 滑窗）
  NOTE: "note",         // {text} 字幕

  /* 以下为"场景视图"（向量检索 / 路由 / 工作流 / 去重 …）通用的事件。
   * 排序视图只用数组下标就能描述一切，而这些视图有面板、树、图、决策结果，
   * 需要一组与"元素 id"绑定的通用事件来承载。 */
  FOCUS: "focus",           // {ids} 当前聚焦的元素 id（相当于"正在看谁"）
  SET_LIST: "setList",      // {name, values} 更新一个命名面板（堆 / 结果 / 映射表）
  SET_METRIC: "metric",     // {name, value} 更新一个计数器（已评分 / 已用 token）
  SCORE: "score",           // {i, sim} 给候选 i 打一个相似度分
  DECIDE: "decide",         // {i, keep, key?} 对元素 i 做出保留/丢弃决策
  LAYER: "layer",           // {batch} 追加一批可并行任务（拓扑分层）
  WALK: "walk",             // {to, best} 沿树/前缀走一步，to 为路径段数组，best 为当前最优
  TRIE_ADD: "trieAdd",      // {path, handler} 往路由树里注册一条前缀
};

/* 为什么要有 HOLE / SHIFT / SET_RANGE 这三个"原子复合"操作：
 * 移位式插入排序与归并写回，如果拆成逐格 set，中间帧会出现同一个值
 * 存在两份的"幻影重复"（数组不是输入的排列），学习者会以为数据被复制了。
 * 复合操作把这类变化收在一次 step 里，保证任意帧边界上数据都自洽。 */

export const MARK_KIND = {
  SORTED: "sorted",
  PIVOT: "pivot",
  KEY: "key",
  ACTIVE: "active",
  MIN: "min",
};

/* 输入预设：同一算法换个输入，教学效果完全不同（对比冒泡的最好 / 最坏情况）。 */
export const INPUT_PRESETS = {
  random: { label: "随机", values: [5, 2, 9, 1, 7, 3, 8, 4] },
  nearly: { label: "近乎有序", values: [1, 2, 3, 5, 4, 6, 7, 8] },
  reversed: { label: "完全逆序", values: [8, 7, 6, 5, 4, 3, 2, 1] },
  few: { label: "少量重复", values: [3, 1, 4, 1, 5, 9, 3, 1] },
};

export function presetValues(name) {
  return [...(INPUT_PRESETS[name] || INPUT_PRESETS.random).values];
}

/* 赛跑模式专用输入：规模要够大，O(n²) 与 O(n log n) 的差距才看得出来。
 * 8 个元素时快排甚至可能比冒泡比较得更多（双指针要跟基准反复比），
 * 那种规模下的"赛跑"是没有说服力的。 */
export const RACE_INPUT = [
  37, 12, 88, 5, 63, 21, 74, 9, 45, 96,
  30, 58, 3, 81, 17, 69, 26, 52, 41, 77,
];

/* ---------------- 状态与归约 ---------------- */

export function createState(input) {
  return {
    array: [...input],
    comparing: [],      // 正在比较的下标
    swapping: [],       // 正在交换的下标
    written: [],        // 正在写入的下标
    held: null,         // 手里暂存的值（插入排序的 key / 快排的基准）
    holdKind: null,     // 'key' | 'pivot'
    marks: {},          // 下标 -> [kind]
    range: null,        // {lo, hi}
    pointers: {},       // name -> 下标
    note: "",
    compares: 0,
    swaps: 0,
    writes: 0,

    /* 场景视图专用字段（排序动画用不到，保持为空即可） */
    focus: [],       // 当前聚焦的元素 id
    lists: {},       // 命名面板：{heap: [...], out: [...], map: [...], top: [...]}
    metrics: {},     // 命名计数器：{scored: 5, used: 40, done: 3}
    scores: {},      // 元素 id -> 相似度分数
    decisions: {},   // 元素 id -> 'keep' | 'drop' | 'pending'
    keys: {},        // 元素 id -> 归一化键（去重用）
    layers: [],      // 分批结果：[[...batch1], [...batch2]]
    walk: [],        // 当前走过的路径段
    best: null,      // 当前最优结果（最长前缀命中的 handler）
    trie: [],        // 已注册的前缀：{path, handler}
  };
}

function withMarks(marks, i, kind, add) {
  const next = { ...marks };
  const list = new Set(next[i] || []);
  if (add) list.add(kind);
  else list.delete(kind);
  if (list.size) next[i] = [...list];
  else delete next[i];
  return next;
}

function markRange(marks, lo, hi, kind) {
  let next = marks;
  for (let i = lo; i <= hi; i++) next = withMarks(next, i, kind, true);
  return next;
}

/* 归约一步：纯函数，返回新状态。 */
export function applyStep(state, step) {
  const s = { ...state };
  switch (step.op) {
    case OP.COMPARE:
      s.compares = state.compares + 1;
      s.comparing = step.j === null || step.j === undefined ? [step.i] : [step.i, step.j];
      s.swapping = [];
      s.written = [];
      s.note = describeStep(step, state);
      break;
    case OP.SWAP:
      s.swaps = state.swaps + 1;
      s.swapping = [step.i, step.j];
      s.comparing = [];
      s.written = [];
      {
        const arr = [...state.array];
        [arr[step.i], arr[step.j]] = [arr[step.j], arr[step.i]];
        s.array = arr;
      }
      s.note = `交换 a[${step.i}] 与 a[${step.j}]`;
      break;
    case OP.SET:
      s.writes = state.writes + 1;
      s.written = [step.i];
      s.comparing = [];
      s.swapping = [];
      {
        const arr = [...state.array];
        arr[step.i] = step.value;
        s.array = arr;
      }
      s.note = `写入 a[${step.i}] = ${step.value}`;
      break;
    case OP.HOLE:
      s.written = [step.i];
      s.comparing = [];
      s.swapping = [];
      {
        const arr = [...state.array];
        arr[step.i] = null;
        s.array = arr;
      }
      s.note = `取出 a[${step.i}]=${state.array[step.i]} 暂存，该位置空出`;
      break;
    case OP.SHIFT:
      s.writes = state.writes + 1;
      s.written = [step.to];
      s.comparing = [];
      s.swapping = [];
      {
        const arr = [...state.array];
        arr[step.to] = arr[step.from];
        arr[step.from] = null;
        s.array = arr;
      }
      s.note = `a[${step.from}] 后移到 a[${step.to}]`;
      break;
    case OP.SET_RANGE:
      s.writes = state.writes + step.values.length;
      s.written = step.values.map((_, k) => step.lo + k);
      s.comparing = [];
      s.swapping = [];
      {
        const arr = [...state.array];
        step.values.forEach((v, k) => { arr[step.lo + k] = v; });
        s.array = arr;
      }
      s.note = `合并结果写回 [${step.lo}, ${step.lo + step.values.length - 1}]`;
      break;
    case OP.MARK:
      s.marks = withMarks(state.marks, step.i, step.kind, true);
      if (step.kind === MARK_KIND.KEY || step.kind === MARK_KIND.PIVOT) {
        s.held = state.array[step.i];
        s.holdKind = step.kind;
      }
      if (step.note) s.note = step.note;
      break;
    case OP.UNMARK:
      s.marks = withMarks(state.marks, step.i, step.kind, false);
      if (state.holdKind === step.kind) {
        s.held = null;
        s.holdKind = null;
      }
      break;
    /* RANGE / POINTER 也接受 note：指针类动画里"移动指针"这一步本身就是
     * 要说的话（"第 2 轮：区间 [3, 4]"），不带的话这一帧会残留上一帧的字幕。 */
    case OP.RANGE:
      s.range = { lo: step.lo, hi: step.hi };
      if (step.note) s.note = step.note;
      break;
    case OP.POINTER:
      s.pointers = { ...state.pointers, [step.name]: step.at };
      if (step.note) s.note = step.note;
      break;
    case OP.NOTE:
      s.note = step.text || "";
      break;
    /* ---- 场景视图事件 ---- */
    case OP.FOCUS:
      s.focus = [...(step.ids || [])];
      if (step.note) s.note = step.note;
      break;
    case OP.SET_LIST:
      s.lists = { ...state.lists, [step.name]: step.values };
      if (step.note) s.note = step.note;
      break;
    case OP.SET_METRIC:
      s.metrics = { ...state.metrics, [step.name]: step.value };
      if (step.note) s.note = step.note;
      break;
    case OP.SCORE:
      s.scores = { ...state.scores, [step.i]: step.sim };
      if (step.note) s.note = step.note;
      break;
    case OP.DECIDE:
      s.decisions = { ...state.decisions, [step.i]: step.keep };
      if (step.key !== undefined) s.keys = { ...state.keys, [step.i]: step.key };
      if (step.note) s.note = step.note;
      break;
    case OP.LAYER:
      s.layers = [...state.layers, [...step.batch]];
      if (step.note) s.note = step.note;
      break;
    case OP.WALK:
      s.walk = [...(step.to || [])];
      s.best = step.best === undefined ? null : step.best;
      if (step.note) s.note = step.note;
      break;
    case OP.TRIE_ADD:
      s.trie = [...state.trie, { path: step.path, handler: step.handler }];
      if (step.note) s.note = step.note;
      break;
    default:
      throw new Error(`未知 step.op: ${step.op}`);
  }
  return s;
}

/* 字幕：把原子事件翻译成一句人话，播放器与成片共用。 */
export function describeStep(step, state) {
  const v = (i) => state.array[i];
  switch (step.op) {
    case OP.COMPARE:
      if (step.j === null || step.j === undefined) {
        return step.vs === "pivot"
          ? `a[${step.i}]=${v(step.i)} 与基准 ${state.held} 比较`
          : `a[${step.i}]=${v(step.i)} 与暂存值 ${state.held} 比较`;
      }
      return `比较 a[${step.i}]=${v(step.i)} 与 a[${step.j}]=${v(step.j)}`;
    case OP.SWAP:
      return `交换 a[${step.i}] 与 a[${step.j}]`;
    case OP.SET:
      return `写入 a[${step.i}] = ${step.value}`;
    case OP.HOLE:
      return `取出 a[${step.i}] 暂存，该位置空出`;
    case OP.SHIFT:
      return `a[${step.from}] 后移到 a[${step.to}]`;
    case OP.SET_RANGE:
      return `合并结果写回 [${step.lo}, ${step.lo + step.values.length - 1}]`;
    case OP.MARK:
      return {
        sorted: `a[${step.i}] 已就位`,
        pivot: `选定 a[${step.i}]=${v(step.i)} 作为基准`,
        key: `取出 a[${step.i}]=${v(step.i)} 暂存`,
        min: `记录当前最小值 a[${step.i}]=${v(step.i)}`,
        active: `进入区间 [${step.i}]`,
      }[step.kind] || "";
    case OP.RANGE:
      return `考察区间 [${step.lo}, ${step.hi}]`;
    case OP.NOTE:
      return step.text || "";
    case OP.FOCUS:
      return step.note || `聚焦 ${(step.ids || []).join("、")}`;
    case OP.SET_LIST:
      return step.note || `更新面板 ${step.name}`;
    case OP.SET_METRIC:
      return step.note || `${step.name} = ${step.value}`;
    case OP.SCORE:
      return step.note || `候选 ${step.i} 得分 ${step.sim}`;
    case OP.DECIDE:
      return step.note || `元素 ${step.i} → ${step.keep}`;
    case OP.LAYER:
      return step.note || `第 ${state.layers.length + 1} 批：${(step.batch || []).join("、")}`;
    case OP.WALK:
      return step.note || `走到 ${(step.to || []).join("/")}`;
    case OP.TRIE_ADD:
      return step.note || `注册 ${step.path}`;
    default:
      return "";
  }
}

/* 把 steps 前缀归约成每帧状态：states[k] 表示执行完前 k 步后的状态。
 * 播放器拖进度条 / Remotion 逐帧渲染都靠它拿到任意时刻的画面。 */
export function buildStates(input, steps) {
  const states = [createState(input)];
  let cur = states[0];
  for (const step of steps) {
    cur = applyStep(cur, step);
    states.push(cur);
  }
  return states;
}

/* 每个下标当前该用什么颜色：优先级见 theme.barColor 的注释。 */
export function roleOf(state, i) {
  if (state.array[i] === null) return "hole";   // 空位（插入排序暂存中）
  if (state.comparing.includes(i)) return "comparing";
  if (state.swapping.includes(i)) return "swapping";
  if (state.written.includes(i)) return "written";
  const kinds = state.marks[i] || [];
  if (kinds.includes(MARK_KIND.PIVOT)) return "pivot";
  if (kinds.includes(MARK_KIND.KEY)) return "key";
  if (state.range && (i < state.range.lo || i > state.range.hi)) return "dim";
  if (kinds.includes(MARK_KIND.SORTED)) return "sorted";
  return "bar";
}

/* 步数与统计：赛跑模式与结论文案要用。 */
export function summarize(input, steps) {
  const states = buildStates(input, steps);
  const last = states[states.length - 1];
  return {
    steps: steps.length,
    compares: last.compares,
    swaps: last.swaps,
    writes: last.writes,
    sorted: isSorted(last.array),
    array: last.array,
  };
}

export function isSorted(values) {
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > values[i]) return false;
  }
  return true;
}
