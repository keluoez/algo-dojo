/* 排序算法动画脚本（P0 六个）。
 *
 * 约定：每个 buildXxx(input) 都是纯函数，只依赖入参，产出确定的 Step 序列。
 * 同一份实现在浏览器里回放、在 Remotion 里逐帧渲染，两边画面必须完全一致。
 *
 * 视觉语义（教学上不能骗人）：
 * - 绿色 = 已就位的**最终位置**，不是"局部有序"
 *   （所以归并的中间结果不上绿，只有最后一趟整体有序才上绿）
 * - 交换 / 写入都如实反映数组真实变化，不做"看起来更顺"的简化
 * - 插入排序的暂存元素用"手里拿着 key"表达，避免位移造成的重复值误导
 */
import { OP, MARK_KIND } from "./protocol.js";

/* ---------------- 冒泡排序 ---------------- */

export function bubbleSteps(input) {
  const a = [...input];
  const steps = [];
  const n = a.length;
  if (n === 0) return steps;

  for (let pass = 0; pass < n - 1; pass++) {
    let swapped = false;
    for (let i = 0; i < n - 1 - pass; i++) {
      steps.push({ op: OP.COMPARE, i, j: i + 1 });
      if (a[i] > a[i + 1]) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        steps.push({ op: OP.SWAP, i, j: i + 1 });
        swapped = true;
      }
    }
    // 每趟结束，未排序区间的最大值已经"冒"到末尾，位置敲定
    steps.push({ op: OP.MARK, i: n - 1 - pass, kind: MARK_KIND.SORTED });
    if (!swapped) {
      // 这一趟一次都没换：剩下的一整段已经有序
      for (let k = n - 2 - pass; k >= 0; k--) {
        steps.push({ op: OP.MARK, i: k, kind: MARK_KIND.SORTED });
      }
      steps.push({ op: OP.NOTE, text: "整趟没有发生交换 —— 已经有序，提前结束" });
      return steps;
    }
  }
  steps.push({ op: OP.MARK, i: 0, kind: MARK_KIND.SORTED });
  steps.push({ op: OP.NOTE, text: "排序完成：每趟把剩余最大值冒到末尾" });
  return steps;
}

/* ---------------- 选择排序 ---------------- */

export function selectionSteps(input) {
  const a = [...input];
  const steps = [];
  const n = a.length;
  if (n === 0) return steps;

  for (let i = 0; i < n - 1; i++) {
    let min = i;
    steps.push({ op: OP.MARK, i: min, kind: MARK_KIND.MIN });
    for (let j = i + 1; j < n; j++) {
      steps.push({ op: OP.COMPARE, i: j, j: min });
      if (a[j] < a[min]) {
        steps.push({ op: OP.UNMARK, i: min, kind: MARK_KIND.MIN });
        min = j;
        steps.push({ op: OP.MARK, i: min, kind: MARK_KIND.MIN });
      }
    }
    if (min !== i) {
      [a[i], a[min]] = [a[min], a[i]];
      steps.push({ op: OP.SWAP, i, j: min });
    }
    steps.push({ op: OP.UNMARK, i: min, kind: MARK_KIND.MIN });
    steps.push({ op: OP.MARK, i, kind: MARK_KIND.SORTED });
  }
  steps.push({ op: OP.MARK, i: n - 1, kind: MARK_KIND.SORTED });
  steps.push({ op: OP.NOTE, text: "排序完成：每趟只交换一次，交换次数最少" });
  return steps;
}

/* ---------------- 插入排序 ---------------- */

export function insertionSteps(input) {
  const a = [...input];
  const steps = [];
  const n = a.length;
  if (n === 0) return steps;

  steps.push({ op: OP.MARK, i: 0, kind: MARK_KIND.SORTED });
  for (let i = 1; i < n; i++) {
    const key = a[i];
    // 先打标记（此刻 a[i] 还是 key），再把该位置挖成空位，避免出现两份重复值
    steps.push({ op: OP.MARK, i, kind: MARK_KIND.KEY });
    steps.push({ op: OP.HOLE, i });
    a[i] = null;

    let hole = i;
    let j = i - 1;
    while (j >= 0) {
      steps.push({ op: OP.COMPARE, i: j, j: null, vs: "key" });
      if (a[j] > key) {
        steps.push({ op: OP.SHIFT, from: j, to: hole });
        a[hole] = a[j];
        a[j] = null;
        // 空位左移，"手里拿着 key"的标记跟着走
        steps.push({ op: OP.UNMARK, i: hole, kind: MARK_KIND.KEY });
        hole = j;
        steps.push({ op: OP.MARK, i: hole, kind: MARK_KIND.KEY });
        j--;
      } else {
        break;
      }
    }
    a[hole] = key;
    steps.push({ op: OP.SET, i: hole, value: key });
    steps.push({ op: OP.UNMARK, i: hole, kind: MARK_KIND.KEY });
    // 处理完第 i 个元素后，前 i+1 个就是全局最小的 i+1 个，且已排好序
    steps.push({ op: OP.MARK, i, kind: MARK_KIND.SORTED });
  }
  steps.push({ op: OP.NOTE, text: "排序完成：像整理扑克牌，把每张新牌插到该在的位置" });
  return steps;
}

/* ---------------- 归并排序 ---------------- */

export function mergeSteps(input) {
  const a = [...input];
  const steps = [];

  const sort = (lo, hi) => {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    steps.push({ op: OP.RANGE, lo, hi });
    steps.push({ op: OP.NOTE, text: `拆分 [${lo}, ${hi}] → [${lo}, ${mid}] 与 [${mid + 1}, ${hi}]` });
    sort(lo, mid);
    sort(mid + 1, hi);

    // 先合并到临时结果，再**一次性**写回：逐格写会在中间帧出现同一值两份的
    // "幻影重复"（等于告诉学习者数据被复制了），也让比较高亮指到已被覆盖的格子
    const result = [];
    let i = lo;
    let j = mid + 1;
    while (i <= mid && j <= hi) {
      steps.push({ op: OP.COMPARE, i, j });
      if (a[i] <= a[j]) result.push(a[i++]);
      else result.push(a[j++]);
    }
    while (i <= mid) result.push(a[i++]);
    while (j <= hi) result.push(a[j++]);
    steps.push({ op: OP.SET_RANGE, lo, values: result });
    for (let k = 0; k < result.length; k++) a[lo + k] = result[k];
    steps.push({ op: OP.NOTE, text: `合并 [${lo}, ${hi}] 完成（局部有序，尚未到最终位置）` });
  };

  sort(0, a.length - 1);
  for (let k = 0; k < a.length; k++) steps.push({ op: OP.MARK, i: k, kind: MARK_KIND.SORTED });
  steps.push({ op: OP.NOTE, text: "排序完成：先分到只剩一个元素，再两两合并回有序整体" });
  return steps;
}

/* ---------------- 快速排序（Hoare 双指针 + 中点基准，与知识点正文一致） ---------------- */

export function quickSteps(input) {
  const a = [...input];
  const steps = [];

  const sort = (left, right) => {
    if (left >= right) return;
    const pivotIdx = (left + right) >> 1;
    const pivot = a[pivotIdx];
    steps.push({ op: OP.RANGE, lo: left, hi: right });
    steps.push({ op: OP.MARK, i: pivotIdx, kind: MARK_KIND.PIVOT });
    let pivotPos = pivotIdx;
    let i = left;
    let j = right;

    while (i <= j) {
      while (i <= j) {
        steps.push({ op: OP.COMPARE, i, j: null, vs: "pivot" });
        if (a[i] < pivot) i++;
        else break;
      }
      while (i <= j) {
        steps.push({ op: OP.COMPARE, i: j, j: null, vs: "pivot" });
        if (a[j] > pivot) j--;
        else break;
      }
      if (i <= j) {
        const oldPos = pivotPos;
        [a[i], a[j]] = [a[j], a[i]];
        if (pivotPos === i) pivotPos = j;
        else if (pivotPos === j) pivotPos = i;
        steps.push({ op: OP.SWAP, i, j });
        if (pivotPos !== oldPos) {
          // 基准元素被换走了，标记跟着走，不能让它指着一个已经不是基准的格子
          steps.push({ op: OP.UNMARK, i: oldPos, kind: MARK_KIND.PIVOT });
          steps.push({ op: OP.MARK, i: pivotPos, kind: MARK_KIND.PIVOT });
        }
        i++;
        j--;
      }
    }
    steps.push({ op: OP.UNMARK, i: pivotPos, kind: MARK_KIND.PIVOT });
    sort(left, j);
    sort(i, right);
  };

  sort(0, a.length - 1);
  for (let k = 0; k < a.length; k++) steps.push({ op: OP.MARK, i: k, kind: MARK_KIND.SORTED });
  steps.push({ op: OP.NOTE, text: "排序完成：每趟划分把小的甩到左边，再只递归两边" });
  return steps;
}

/* ---------------- 堆排序 ---------------- */

export function heapSteps(input) {
  const a = [...input];
  const steps = [];
  const n = a.length;
  if (n === 0) return steps;

  const siftDown = (start, end) => {
    let root = start;
    while (root * 2 + 1 < end) {
      let child = root * 2 + 1;
      if (child + 1 < end) {
        steps.push({ op: OP.COMPARE, i: child, j: child + 1 });
        if (a[child] < a[child + 1]) child++;
      }
      steps.push({ op: OP.COMPARE, i: root, j: child });
      if (a[root] < a[child]) {
        [a[root], a[child]] = [a[child], a[root]];
        steps.push({ op: OP.SWAP, i: root, j: child });
        root = child;
      } else {
        break;
      }
    }
  };

  steps.push({ op: OP.NOTE, text: "第一步：从最后一个非叶结点开始下沉，建大顶堆" });
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) siftDown(i, n);

  steps.push({ op: OP.NOTE, text: "第二步：反复把堆顶（最大值）换到末尾，再让堆顶下沉" });
  for (let end = n - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end], a[0]];
    steps.push({ op: OP.SWAP, i: 0, j: end });
    steps.push({ op: OP.MARK, i: end, kind: MARK_KIND.SORTED });
    siftDown(0, end);
  }
  steps.push({ op: OP.MARK, i: 0, kind: MARK_KIND.SORTED });
  steps.push({ op: OP.NOTE, text: "排序完成：堆顶永远是最值，取出即就位" });
  return steps;
}

/* ---------------- 算法元数据 ---------------- */

export const SORTS = {
  bubble: {
    key: "bubble",
    title: "冒泡排序",
    oneLine: "相邻两个比大小，大的往后挪，每趟冒出一个最大值",
    time: "O(n²)",
    timeBest: "O(n)（已有序时一趟结束）",
    space: "O(1)",
    stable: true,
    build: bubbleSteps,
  },
  selection: {
    key: "selection",
    title: "选择排序",
    oneLine: "每趟从未排序区里挑出最小值，和区间头部交换",
    time: "O(n²)",
    timeBest: "O(n²)",
    space: "O(1)",
    stable: false,
    build: selectionSteps,
  },
  insertion: {
    key: "insertion",
    title: "插入排序",
    oneLine: "像整理扑克牌，把新元素插进左边已有序的部分",
    time: "O(n²)",
    timeBest: "O(n)（近乎有序时几乎不搬动）",
    space: "O(1)",
    stable: true,
    build: insertionSteps,
  },
  merge: {
    key: "merge",
    title: "归并排序",
    oneLine: "先分到只剩一个元素，再两两合并回有序整体",
    time: "O(n log n)",
    timeBest: "O(n log n)",
    space: "O(n)",
    stable: true,
    build: mergeSteps,
  },
  quick: {
    key: "quick",
    title: "快速排序",
    oneLine: "选基准做划分，小的甩到左边，再只递归两半",
    time: "平均 O(n log n)",
    timeBest: "最坏 O(n²)（基准总取到极值时）",
    space: "O(log n)",
    stable: false,
    build: quickSteps,
  },
  heap: {
    key: "heap",
    title: "堆排序",
    oneLine: "先建大顶堆，再反复取出堆顶放到末尾",
    time: "O(n log n)",
    timeBest: "O(n log n)",
    space: "O(1)",
    stable: false,
    build: heapSteps,
  },
};

export function buildStepsFor(key, input) {
  const algo = SORTS[key];
  if (!algo) throw new Error(`未知排序算法: ${key}`);
  return algo.build(input);
}
