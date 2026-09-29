---
slug: p-lc39
lc: 39
title: 组合总和
difficulty: 2
topics: [algo-dfs]
tags: [回溯, 组合, 剪枝]
entry: combination_sum
starter_code: |
  def combination_sum(candidates: list[int], target: int) -> list[list[int]]:
      pass
solution_code: |
  def combination_sum(candidates: list[int], target: int) -> list[list[int]]:
      candidates.sort()
      result = []
      path = []

      def backtrack(start, remain):
          if remain == 0:
              result.append(path[:])
              return
          for i in range(start, len(candidates)):
              num = candidates[i]
              if num > remain:
                  break
              path.append(num)
              backtrack(i, remain - num)
              path.pop()

      backtrack(0, target)
      return result
tests:
  - {desc: "经典用例", args: [[2, 3, 6, 7], 7], expected: [[2, 2, 3], [7]], unordered: true}
  - {desc: "多种组合", args: [[2, 3, 5], 8], expected: [[2, 2, 2, 2], [2, 3, 3], [3, 5]], unordered: true}
  - {desc: "无解", args: [[2], 1], expected: []}
  - {desc: "单元素自凑", args: [[3], 3], expected: [[3]]}
---

给定一个**无重复元素**的整数数组 `candidates` 和目标数 `target`，找出所有可以使数字和为 target 的组合。`candidates` 中的**同一个数字可以无限制重复被选取**；解集不能含重复组合。

**提示**：为避免 [2,3,2] 和 [2,2,3] 这类重复，递归时的起点应该怎么传？允许重复选自己意味着什么？

--- 题解 ---

## 思路：排序 + start 下标 + 剪枝

与全排列不同，组合不看顺序，所以每一层只从 `start` 往后选，天然排除"回头路"，每个组合只按非递减顺序生成一次。允许重复选取，所以下一层起点传 `i` 而非 `i+1`。

先排序，利用单调性剪枝：当前 num > remain 时，后面的更大，直接 break。

## 复杂度

- 时间取决于解空间大小，最坏与可行组合数线性相关（每个组合输出代价 O(k)）。
- 空间 O(target/min)：递归深度上限（不含结果）。

## 排列 vs 组合：回溯的两个关键旋钮

- 在乎顺序 → 每层从头扫描 + used 数组（LC46）；
- 不在乎顺序 → start 下标限制只往后选；
- 元素不可复用 → start 传 i+1；可复用 → 传 i。

## 易错点

- 不排序也能做，但 num>remain 时只能 continue 不能 break，剪枝效率不同。
- 起点传错（i+1）会漏掉同元素重复使用的组合。
