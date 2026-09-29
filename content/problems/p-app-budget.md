---
slug: p-app-budget
title: 预算内的最优采购清单
difficulty: 2
topics: [algo-dp]
tags: [动态规划, 01 背包]
entry: best_value
starter_code: |
  def best_value(items, budget):
      # items: [价格, 重要度] 列表；总价格不超过 budget 的前提下重要度总和最大
      pass
solution_code: |
  def best_value(items, budget):
      # dp[b] = 预算恰好在 b 以内能取得的最大重要度和（滚动一维）
      dp = [0] * (budget + 1)
      for cost, val in items:
          for b in range(budget, cost - 1, -1):   # 倒序：每件商品只选一次
              cand = dp[b - cost] + val
              if cand > dp[b]:
                  dp[b] = cand
      return dp[budget]
tests:
  - desc: 基础示例
    args: [[[1, 2], [2, 3], [3, 6]], 5]
    expected: 9
  - desc: 预算为零
    args: [[[1, 2], [2, 3]], 0]
    expected: 0
  - desc: 什么都买不起
    args: [[[10, 100]], 5]
    expected: 0
  - desc: 放弃贵的选组合
    args: [[[5, 10], [4, 40], [6, 30], [3, 50]], 10]
    expected: 90
bench:
  scales: [50, 200, 1000, 5000]
  generator: |
    import random
    def make_input(n):
        items = [[random.randint(1, 50), random.randint(1, 100)] for _ in range(n)]
        return (items, 200)
---

部门拿到一笔采购预算 `budget`，候选设备清单 `items` 中每台设备标着 `[价格, 重要度]`。每台设备**最多买一台**，在总价格**不超过预算**的前提下，让买到设备的重要度总和最大。返回这个最大总和（一台都买不起时为 0）。

**提示**：这是 01 背包的标准形态。想一想 DP 状态 `dp[i][b]`（前 i 台、预算 b）怎么滚成一维数组，以及内层循环为什么必须**倒序**。

--- 题解 ---

## 思路：01 背包，一维滚动

定义 `dp[b]`：预算上限为 `b` 时能取得的最大重要度和。逐台设备更新：

- 不选第 i 台：`dp[b]` 不变；
- 选第 i 台：`dp[b] = dp[b - cost] + val`。

二者取大。关键在**内层 b 倒序**（从 `budget` 到 `cost`）：`dp[b - cost]` 必须是"还没考虑过第 i 台"的旧值；若正序更新，`dp[b - cost]` 可能已掺入第 i 台的贡献，等于同一台设备被买了两次——那就变成完全背包了。

## 复杂度

- 时间 O(n × budget)，空间 O(budget)（二维写法 O(n × budget) 可滚动优化掉物品维）。
- 与题目规模的适配：n ≤ 5000、budget ≤ 200 时千万级基本操作，可跑；若 budget 高达 10⁹ 则 DP 不可行，需要另想凸优化/贪心（超出本题范围）。

## 易错点

- 内层必须**倒序**，这是 01 背包与完全背包在代码上的唯一区别，也是本题的核心考点。
- 约束是"**不超过**预算"，不是恰好花光：`dp` 初始化为全 0（而不是负无穷），含义是"预算以内"。
- 每台设备**至多一台**，输入里同一台不会重复出现，不需要去重。
