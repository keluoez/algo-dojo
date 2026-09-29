---
slug: p-lc45
lc: 45
title: 跳跃游戏 II
difficulty: 3
topics: [algo-greedy]
tags: [贪心, 分层BFS]
entry: jump
starter_code: |
  def jump(nums: list[int]) -> int:
      # 题目保证总能到达终点，求最少跳跃次数
      pass
solution_code: |
  def jump(nums: list[int]) -> int:
      jumps = 0
      end = 0
      farthest = 0
      for i in range(len(nums) - 1):
          farthest = max(farthest, i + nums[i])
          if i == end:
              jumps += 1
              end = farthest
      return jumps
tests:
  - {desc: "经典用例", args: [[2, 3, 1, 1, 4]], expected: 2}
  - {desc: "两步连跳", args: [[2, 3, 0, 1, 4]], expected: 2}
  - {desc: "终点即起点", args: [[1]], expected: 0}
  - {desc: "只能逐步走", args: [[1, 1, 1, 1]], expected: 3}
---

设定同 LC55，但题目**保证一定能到达**最后一个下标，求使用的**最少跳跃次数**。

**提示**：把"同一跳能覆盖的位置范围"看成 BFS 的一层——扫描完这一层时，下一跳的边界在哪里？为什么走到边界才 +1？

--- 题解 ---

## 思路：按"跳"分层的贪心（隐式 BFS）

- end：当前这一跳最多能到哪里；
- farthest：扫描中发现的"再跳一下能到的最远位置"。

i 从左扫到 end 的过程中不断更新 farthest；i==end 时这一层看完，必须起跳一次（jumps+1），并把新一层边界 end 推到 farthest。

只遍历到 n-2：站在最后一个位置上不需要再跳，避免在终点处多计一次。

## 正确性直觉

end 是 BFS 第 k 层的边界，farthest 是第 k+1 层的边界。BFS 的层数即最短路径，这里一次线性扫描就把所有层边界算完，不需要真的建队列。

## 复杂度

- 时间 O(n)，空间 O(1)。

## 易错点

- 在 i 触及 end 时再跳，而不是每次 farthest 更新就跳。
- 循环不含终点，否则 [1] 之外的末尾边界会触发多余一跳。
