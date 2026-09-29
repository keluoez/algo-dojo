---
slug: p-lc34
lc: 34
title: 在排序数组中查找元素的第一个和最后一个位置
difficulty: 2
topics: [algo-binary-search]
tags: [二分, 边界查找]
entry: search_range
starter_code: |
  def search_range(nums: list[int], target: int) -> list[int]:
      pass
solution_code: |
  def search_range(nums: list[int], target: int) -> list[int]:
      def lower_bound(goal):
          # 第一个 >= goal 的位置
          left, right = 0, len(nums)
          while left < right:
              mid = (left + right) // 2
              if nums[mid] < goal:
                  left = mid + 1
              else:
                  right = mid
          return left

      start = lower_bound(target)
      if start == len(nums) or nums[start] != target:
          return [-1, -1]
      end = lower_bound(target + 1) - 1
      return [start, end]
tests:
  - {desc: "出现多次", args: [[5, 7, 7, 8, 8, 10], 8], expected: [3, 4]}
  - {desc: "目标不存在", args: [[5, 7, 7, 8, 8, 10], 6], expected: [-1, -1]}
  - {desc: "空数组", args: [[], 0], expected: [-1, -1]}
  - {desc: "出现一次", args: [[1, 2, 3], 2], expected: [1, 1]}
  - {desc: "全部相同", args: [[2, 2, 2], 2], expected: [0, 2]}
---

给定一个按照非递减顺序排列的整数数组 `nums` 和目标值 `target`，找出 target 在数组中的**开始位置和结束位置**；不存在返回 `[-1,-1]`。要求 O(log n)。

**提示**：两次二分各回答一个问题——"第一个 >= target" 和 "第一个 > target"，比在一个二分里同时维护两个边界更不容易错。

--- 题解 ---

## 思路：lower_bound 两次

定义 `lower_bound(goal)` 返回第一个 `>= goal` 的位置（左闭右开区间模板）：

- 起点 = lower_bound(target)，先验证该位置确实等于 target，否则直接 [-1,-1]；
- 终点 = lower_bound(target+1) - 1：第一个比 target 大的位置的前一个，即最后一个 target。

整数数组上 target+1 严格大于 target；即使 target 是数组最大值，lower_bound 返回 len(nums)，减 1 仍是合法的最后位置。

## 为什么右开模板适合找边界

`right` 初始为 len(nums)，循环 `left < right`，命中时 `right = mid` 而不是 mid-1——因为我们不是"排除"mid，而是要把答案**压到**最左。一个 lower_bound 同时解决"第一个"和"最后一个"两类问题，这是它比开区间模板通用的地方。

## 复杂度

- 时间 O(log n)（常数次二分），空间 O(1)。
