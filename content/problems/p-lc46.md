---
slug: p-lc46
lc: 46
title: 全排列
difficulty: 2
topics: [algo-dfs]
tags: [回溯, 排列]
entry: permute
starter_code: |
  def permute(nums: list[int]) -> list[list[int]]:
      pass
solution_code: |
  def permute(nums: list[int]) -> list[list[int]]:
      result = []
      path = []
      used = [False] * len(nums)

      def backtrack():
          if len(path) == len(nums):
              result.append(path[:])
              return
          for i in range(len(nums)):
              if used[i]:
                  continue
              used[i] = True
              path.append(nums[i])
              backtrack()
              path.pop()
              used[i] = False

      backtrack()
      return result
tests:
  - {desc: "三元素", args: [[1, 2, 3]], expected: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]], unordered: true}
  - {desc: "单元素", args: [[1]], expected: [[1]]}
  - {desc: "两元素", args: [[0, 1]], expected: [[0, 1], [1, 0]], unordered: true}
---

给定一个**不含重复数字**的数组 `nums`，返回其所有可能的全排列（顺序不限）。

**提示**：回溯的"选择 → 递归 → 撤销"三步走；用 used 数组标记本路径已用元素，为什么撤销时 path 要存副本进结果？

--- 题解 ---

## 思路：回溯 = 多叉树的 DFS

把排列想成逐层填空：第 depth 层选一个还没用过的数。每个节点做三件事：

1. 选择：标记 used、追加 path；
2. 递归：进入下一层；
3. 撤销：弹出、解除标记——让同一层的兄弟选择能在干净的状态上开始。

path 长度达到 n 时是一个完整答案，`path[:]` 拷贝入结果（直接 append path 会在后续 pop 中被改掉）。

## 复杂度

- 时间 O(n · n!)：共 n! 个叶子，每个答案拷贝 O(n)。
- 空间 O(n)：递归栈 + path（不含结果存储）。

## 回溯统一框架

```
def backtrack(路径, 选择列表):
    if 满足结束条件: 记录路径; return
    for 选择 in 选择列表:
        做选择
        backtrack(...)
        撤销选择
```

组合、子集、分割、棋盘问题都是这一框架的变体，区别只在"选择列表怎么筛"和"何时记录答案"。

## 易错点

- 忘记拷贝 path 导致结果里全是空列表。
- 撤销操作与选择严格对称，顺序写反会污染其他分支。
