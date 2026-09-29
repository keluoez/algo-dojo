---
slug: p-lc1
lc: 1
title: 两数之和
difficulty: 1
topics: [ds-hash]
tags: [哈希表, 一次遍历]
entry: two_sum
starter_code: |
  def two_sum(nums, target):
      # 返回和为 target 的两个元素下标（顺序任意）
      pass
solution_code: |
  def two_sum(nums, target):
      seen = {}                       # 值 -> 下标
      for i, x in enumerate(nums):
          need = target - x
          if need in seen:
              return [seen[need], i]
          seen[x] = i
tests:
  - desc: 基础示例
    args: [[2, 7, 11, 15], 9]
    expected: [0, 1]
    unordered: true
  - desc: 解不在开头
    args: [[3, 2, 4], 6]
    expected: [1, 2]
    unordered: true
  - desc: 相邻两数
    args: [[3, 3], 6]
    expected: [0, 1]
    unordered: true
bench:
  scales: [100, 1000, 5000, 10000]
  generator: |
    import random
    def make_input(n):
        nums = random.sample(range(n * 10), n)
        # 答案对取内部两个位置，防止暴力法第一层就命中而测不出 n²
        i, j = random.sample(range(1, n - 1), 2)
        target = nums[i] + nums[j]
        return (nums, target)
---

给定整数数组 `nums` 和目标值 `target`，数组中**恰好存在一对**元素和为目标值，返回这两个元素的下标。同一元素不能使用两次。

**提示**：先想暴力法 O(n²)，再思考"我对每个元素，真正想快速知道的是什么信息"。

--- 题解 ---

## 思路：查表代替双重循环

遍历到 `x` 时，我真正想知道的是："`target - x` 之前出现过吗、下标是几？"——这是一次哈希查找，O(1)。

用 `seen` 记录已扫描的值到下标的映射：

1. `need = target - x` 在 `seen` 中 → 直接返回两个下标；
2. 否则把当前值 `x → i` 存入，继续扫描。

只遍历一次，每个元素做一次哈希读写。

## 复杂度

- 时间 O(n)：一趟扫描，哈希平均 O(1)。
- 空间 O(n)：最坏 `seen` 存满。
- 对比暴力 O(n²)：可在"性能实测"标签页用暴力解法（双重循环）与哈希解法跑同组数据，观察 n 变大时的差距。

## 易错点

- 必须先查再存，否则同一元素可能和自己配对。
- key 是元素值、value 才是下标，别写反。
