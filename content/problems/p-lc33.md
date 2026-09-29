---
slug: p-lc33
lc: 33
title: 搜索旋转排序数组
difficulty: 2
topics: [algo-binary-search]
tags: [二分, 旋转数组]
entry: search
starter_code: |
  def search(nums: list[int], target: int) -> int:
      pass
solution_code: |
  def search(nums: list[int], target: int) -> int:
      left, right = 0, len(nums) - 1
      while left <= right:
          mid = (left + right) // 2
          if nums[mid] == target:
              return mid
          if nums[left] <= nums[mid]:
              # 左半段有序
              if nums[left] <= target < nums[mid]:
                  right = mid - 1
              else:
                  left = mid + 1
          else:
              # 右半段有序
              if nums[mid] < target <= nums[right]:
                  left = mid + 1
              else:
                  right = mid - 1
      return -1
tests:
  - {desc: "旋转点在目标左侧", args: [[4, 5, 6, 7, 0, 1, 2], 0], expected: 4}
  - {desc: "目标不存在", args: [[4, 5, 6, 7, 0, 1, 2], 3], expected: -1}
  - {desc: "未旋转数组", args: [[1, 2, 3, 4, 5], 1], expected: 0}
  - {desc: "单元素命中", args: [[1], 1], expected: 0}
  - {desc: "两元素取后者", args: [[3, 1], 1], expected: 1}
---

升序数组 `nums` 在某个下标处被旋转（如 `[0,1,2,4,5,6,7]` → `[4,5,6,7,0,1,2]`，数组中**无重复元素**）。给定 target，存在返回下标，否则 -1，要求 O(log n)。

**提示**：整体无序，但从中点切一刀，两半边中是否至少有一边一定有序？如何利用这一点决定往哪边找？

--- 题解 ---

## 思路：二分 + 判断哪边有序

旋转数组从 mid 切开，左右两半**至少有一半是严格有序的**：

- `nums[left] <= nums[mid]` → 左半有序，target 若落在 `[nums[left], nums[mid])` 区间内就在左半，否则去右半；
- 否则右半有序，同理判断 target 是否在 `(nums[mid], nums[right]]`。

注意比较时把 mid 本身排除（它已在开头单独判断过），区间用半开形式。

## 复杂度

- 时间 O(log n)，空间 O(1)。

## 易错点

- 判断左半有序用 `<=` 而非 `<`：left==mid（区间只剩两个元素）时左半也视为有序。
- target 区间判断的等号边界要与"mid 已排除"保持一致，写成闭区间容易漏解或重复判断。
