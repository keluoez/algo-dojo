---
slug: p-lc55
lc: 55
title: 跳跃游戏
difficulty: 2
topics: [algo-greedy]
tags: [贪心, 覆盖范围]
entry: can_jump
starter_code: |
  def can_jump(nums: list[int]) -> bool:
      pass
solution_code: |
  def can_jump(nums: list[int]) -> bool:
      reachable = 0
      for i, num in enumerate(nums):
          if i > reachable:
              return False
          reachable = max(reachable, i + num)
      return True
tests:
  - {desc: "可以到达", args: [[2, 3, 1, 1, 4]], expected: true}
  - {desc: "被零卡住", args: [[3, 2, 1, 0, 4]], expected: false}
  - {desc: "单元素", args: [[0]], expected: true}
  - {desc: "零在终点前", args: [[2, 0, 0]], expected: true}
  - {desc: "开头就断", args: [[0, 1]], expected: false}
---

数组 `nums` 中，nums[i] 表示从下标 i 处**最多可以向右跳跃的长度**。初始位于下标 0，判断是否能到达最后一个下标。

**提示**：不必关心"具体怎么跳"，维护"目前能到达的最远位置"即可；遍历中某个格子已经在最远位置之外意味着什么？

--- 题解 ---

## 思路：最远覆盖范围

reachable 表示扫描到当前位置时，**理论上能到达的最远下标**：

- 站在 i，若 `i > reachable`，说明走到了一个根本到不了的位置，失败；
- 否则用 i+nums[i] 扩展 reachable。

只要 reachable 一直罩得住遍历位置，扫描结束就说明终点可达（reachable >= n-1 时还可提前返回）。

## 贪心的"安全表述"

贪心正确性常被质疑，这里等价于一个显然的不变量："reachable 以内的每个位置都可达"。每一步只是把这个可达闭包向右扩张，不存在"跳错一步满盘皆输"的决策——所以局部扩展必然安全。

## 复杂度

- 时间 O(n)，空间 O(1)。

## 对比 DP

朴素 DP（f[i]=能否到 i）也是 O(n)，但要回头看所有前驱就是 O(n²)；贪心把"能不能到"压缩成一个不断右移的边界。LC45 进一步问最少跳几次，则在同一思路上按"跳跃轮次"分层。

## 易错点

- 判断顺序不能反：必须先确认 i 可达，再用它扩展。
- nums=[0] 答案为 true（起点即终点）。
