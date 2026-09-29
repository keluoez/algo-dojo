---
slug: p-lc70
lc: 70
title: 爬楼梯
difficulty: 1
topics: [algo-dp]
tags: [线性DP, 斐波那契]
entry: climb_stairs
starter_code: |
  def climb_stairs(n: int) -> int:
      pass
solution_code: |
  def climb_stairs(n: int) -> int:
      prev, curr = 1, 1
      for _ in range(2, n + 1):
          prev, curr = curr, prev + curr
      return curr
tests:
  - {desc: "2 阶", args: [2], expected: 2}
  - {desc: "3 阶", args: [3], expected: 3}
  - {desc: "5 阶", args: [5], expected: 8}
  - {desc: "1 阶", args: [1], expected: 1}
---

你需要爬 n 阶楼梯到达楼顶。每次可以爬 **1 阶或 2 阶**，问有多少种不同的方法可以爬到楼顶。

**提示**：到达第 i 阶的最后一步只有两种来源——从 i-1 跨 1 阶，或从 i-2 跨 2 阶。这就是状态转移方程的全部。

--- 题解 ---

## 思路：线性 DP（斐波那契递推）

定义 f[i] = 到达第 i 阶的方法数。最后一步只可能来自 i-1 或 i-2：

```
f[i] = f[i-1] + f[i-2]
```

初值 f[0]=1（站在起点有一种"空方法"），f[1]=1。代码只依赖前两项，用两个滚动变量即可，空间 O(1)。

## DP 三要素（本题是最小模板）

1. **状态定义**：f[i] 是什么（到 i 的方法数）；
2. **转移方程**：f[i] 由哪些更早状态推出；
3. **base case**：最小问题的答案。

写任何 DP 先把这三件事写在纸上，再决定遍历顺序和空间优化。

## 复杂度

- 时间 O(n)，空间 O(1)。

## 易错点

- 混淆下标：f[0]=1 是"到达 0 阶"的空方法，不是 0。
- 每次爬 1/2/3 阶时方程相应加 f[i-3]，思路不变。
