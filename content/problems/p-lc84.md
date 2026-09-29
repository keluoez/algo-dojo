---
slug: p-lc84
lc: 84
title: 柱状图中最大的矩形
difficulty: 3
topics: [ds-stack-queue]
tags: [单调栈, 经典难题]
entry: largest_rectangle_area
starter_code: |
  def largest_rectangle_area(heights):
      # 每根柱子宽 1，求能勾勒出的最大矩形面积
      pass
solution_code: |
  def largest_rectangle_area(heights):
      # 末尾补 0：强制弹出栈中剩余柱子
      heights = heights + [0]
      stack = []          # 递增栈，存下标
      best = 0
      for i, h in enumerate(heights):
          while stack and heights[stack[-1]] > h:
              height = heights[stack.pop()]
              # 左边界：弹出后新栈顶；栈空说明左边界为 -1
              left = stack[-1] if stack else -1
              width = i - left - 1
              best = max(best, height * width)
          stack.append(i)
      return best
tests:
  - desc: 基础示例
    args: [[2, 1, 5, 6, 2, 3]]
    expected: 10
  - desc: 单根柱子
    args: [[4]]
    expected: 4
  - desc: 全部等高
    args: [[2, 2, 2]]
    expected: 6
  - desc: 递增
    args: [[1, 2, 3, 4, 5]]
    expected: 9
  - desc: 含零
    args: [[0, 9]]
    expected: 9
---

n 根宽度为 1 的柱子，高度为 `heights[i]`，求柱阵中能勾勒出的**最大矩形面积**。

**提示**：固定一根柱子作为矩形的高，矩形能向左右延伸多远？"左右两侧第一个比我矮的位置"——用什么结构批量求？

--- 题解 ---

## 思路：递增单调栈

以某根柱子为高的矩形，左右只能延伸到"第一个比它矮"的柱子内侧。维护**高度递增**的栈：当新柱子更矮要弹栈时，被弹柱子的左右边界同时确定：

- 右边界 = 当前 i；
- 左边界 = 弹出后的新栈顶（栈空则为 -1）；
- `width = i - left - 1`，面积 = height × width。

两个技巧：

1. heights **末尾补一个 0**，遍历结束自动弹出全部剩余柱子，不用写第二轮循环；
2. 栈内等高柱子用 `>` 还是 `>=`：配合补 0，用 `>` 保留等高新栈顶，计算更简洁。

## 复杂度

- 时间 O(n)：每根柱子进出一次。
- 空间 O(n)。

## 易错点

- 宽度公式里的两个 `-1`（两侧都是"第一个更矮"的位置，不含它）。
- 栈空时左边界是 -1，不是 0。
- 忘记处理遍历结束后栈中残余柱子（补 0 或再弹一轮）。
