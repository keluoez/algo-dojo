---
slug: p-lc62
lc: 62
title: 不同路径
difficulty: 2
topics: [algo-dp]
tags: [网格DP, 组合数学]
entry: unique_paths
starter_code: |
  def unique_paths(m: int, n: int) -> int:
      pass
solution_code: |
  def unique_paths(m: int, n: int) -> int:
      dp = [1] * n
      for _ in range(1, m):
          for j in range(1, n):
              dp[j] += dp[j - 1]
      return dp[-1]
tests:
  - {desc: "3x7", args: [3, 7], expected: 28}
  - {desc: "3x2", args: [3, 2], expected: 3}
  - {desc: "1x1", args: [1, 1], expected: 1}
  - {desc: "单行只能直走", args: [1, 5], expected: 1}
  - {desc: "4x4", args: [4, 4], expected: 20}
---

一个机器人位于 m 行 n 列网格的左上角，每次只能**向下或向右**移动一步，问到达右下角共有多少条不同的路径？

**提示**：到达格子 (i,j) 的路径只可能来自上方或左方；注意第一行和第一列的路径数都是 1。

--- 题解 ---

## 思路：网格 DP

dp[i][j] = 到达 (i,j) 的路径数，转移：

```
dp[i][j] = dp[i-1][j] + dp[i][j-1]
```

- 第一行：只能一路向右，全为 1；
- 第一列：只能一路向下，全为 1。

空间优化：逐行计算时，dp[j] 在更新前还是"上方"的值，dp[j-1] 已是"左方"的新值，一行数组原地累加即可。

## 数学视角

总共走 m-1 次下、n-1 次右，路径等价于在 m+n-2 步里选 m-1 步向下，即组合数 C(m+n-2, m-1)。数据规模不大时 DP 更直观；要求只走一趟 O(min(m,n)) 可用组合数连乘。

## 复杂度

- DP：时间 O(m·n)，空间 O(n)。

## 网格 DP 家族

本题（无障碍）→ LC63（有障碍，障碍格路径数为 0）→ LC64（最小路径和，加法换 min）→ 三角形/地下城游戏。状态和方向完全一致，只是格子上的"值"不同。

## 易错点

- dp[j] += dp[j-1] 利用了更新前后的双重身份，单独写二维则没有这个陷阱。
- m 或 n 为 1 时答案恒为 1，可用于快速自检。
