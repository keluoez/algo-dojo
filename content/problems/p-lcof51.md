---
slug: p-lcof51
lc: null
title: 数组中的逆序对（剑指 Offer 51）
difficulty: 3
topics: [algo-divide, algo-sort]
tags: [归并排序, 分治]
entry: reverse_pairs
starter_code: |
  def reverse_pairs(nums: list[int]) -> int:
      pass
solution_code: |
  def reverse_pairs(nums: list[int]) -> int:
      aux = nums[:]
      count = 0

      def merge_sort(left, right):
          nonlocal count
          if right - left <= 1:
              return
          mid = (left + right) // 2
          merge_sort(left, mid)
          merge_sort(mid, right)
          i, j, k = left, mid, left
          while i < mid and j < right:
              if nums[i] <= nums[j]:
                  aux[k] = nums[i]
                  i += 1
              else:
                  aux[k] = nums[j]
                  j += 1
                  count += mid - i
              k += 1
          while i < mid:
              aux[k] = nums[i]
              i += 1
              k += 1
          while j < right:
              aux[k] = nums[j]
              j += 1
              k += 1
          nums[left:right] = aux[left:right]

      merge_sort(0, len(nums))
      return count
tests:
  - {desc: "经典用例", args: [[7, 5, 6, 4]], expected: 5}
  - {desc: "已排序零逆序", args: [[1, 2, 3, 4, 5]], expected: 0}
  - {desc: "完全逆序", args: [[5, 4, 3, 2, 1]], expected: 10}
  - {desc: "空数组", args: [[]], expected: 0}
  - {desc: "相等不算逆序", args: [[2, 2, 2]], expected: 0}
bench:
  scales: [500, 1000, 2000, 4000]
  generator: |
    import random
    def make_input(n):
        nums = random.sample(range(n * 10), n)
        return (nums,)
---

在数组中的两个数字，如果前面一个数字**大于**后面一个数字，则这两个数字组成一个逆序对。输入一个数组，求出数组中**逆序对的总数**。

**提示**：暴力双循环 O(n²)；归并排序合并两个有序半边时，一旦左半当前元素 > 右半当前元素，你能一次数出多少个逆序对？

--- 题解 ---

## 思路：归并排序中顺手计数

分治：两半内部的逆序对递归求出，剩下的是**跨两半**的逆序对，在合并阶段统计。

合并时左右指针比较：

- nums[i] <= nums[j]：取左侧，不产生逆序对；
- nums[i] > nums[j]：取右侧 nums[j]，此时左半从 i 到末尾**全都大于** nums[j]（左半有序），一次贡献 `mid - i` 个跨半逆序对。

这是分治"算跨边界代价"的经典动作——和快排划分统计、平面点对问题同构。

## 复杂度

- 时间 O(n log n)：归并排序本身的代价，计数完全搭便车。
- 空间 O(n)：辅助数组。

## 易错点

- 相等不算逆序对：比较必须用 `<=`，等于时取左侧，否则把相等对错算进去。
- 一次加 mid-i 而不是加 1，少这一句整个优化就没了。
- 归并结束记得把 aux 写回 nums，递归上层拿到的必须是有序段。
