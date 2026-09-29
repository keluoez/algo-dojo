---
slug: algo-sort
category: algorithm
title: 排序与快速选择
subtitle: 让数据有序，以及利用划分思想只找第 k 个
order: 3
difficulty: 2
tags: [排序, 快速排序, 归并排序, 快速选择]
related_problems: [p-lc912, p-lc215]
quizzes:
  - q: 比较排序在最坏情况下的时间下界是？
    options: [O(n log n), O(n), O(log n), O(n²)]
    answer: 0
    explain: 基于比较的排序每次比较只给出 1 bit 信息，可证明下界 n log n。
  - q: 快排的核心思想是？
    options:
      - 选基准做划分，小的左右的右，再递归两半（分治）
      - 相邻元素逐个交换
      - 按桶分散再收集
      - 不断合并有序段
    answer: 0
    explain: 平均 O(n log n)，最坏 O(n²)，常数小、实践最快。
  - q: 归并排序相比快排的突出特点是？
    options:
      - 稳定且最坏 O(n log n)，需要 O(n) 辅助空间
      - 原地 O(1) 空间
      - 平均更快
      - 不需要递归
    answer: 0
    explain: 合并时左右两半都有序，稳定排序靠它；逆序对也在合并时统计。
  - q: 快速选择（quickselect）求第 k 小，平均复杂度是？
    options: [O(n), O(n log n), O(n²), O(log n)]
    answer: 0
    explain: 只递归一半，n + n/2 + n/4 … 收敛于 2n。
---

## 一句话理解

排序的**算法思想**：通过系统性的比较与交换消除"逆序"，让数据可用上二分、范围查询等有序红利。快排是"分"（划分后递归），归并是"合"（递归后合并），快速选择则是**只递归包含目标的那一半**。

## 核心思想

**快速排序**：选基准 pivot，一轮划分让小元素在左、大元素在右，再对两半递归：

```python
def quick_sort(nums, left, right):
    if left >= right:
        return
    pivot = nums[(left + right) // 2]
    i, j = left, right
    while i <= j:
        while nums[i] < pivot: i += 1
        while nums[j] > pivot: j -= 1
        if i <= j:
            nums[i], nums[j] = nums[j], nums[i]
            i += 1; j -= 1
    quick_sort(nums, left, j)
    quick_sort(nums, i, right)
```

平均 O(n log n)、原地、缓存友好；最坏（基准总最差）O(n²)，随机化或取中点基准可规避大部分风险。不稳定。

**归并排序**：先递归切成两半各自有序，再双指针合并：

```python
def merge_sort(nums):
    if len(nums) <= 1:
        return nums
    mid = len(nums) // 2
    left = merge_sort(nums[:mid])
    right = merge_sort(nums[mid:])
    return merge(left, right)

def merge(left, right):
    result, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:          # <= 保证稳定性
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    return result + left[i:] + right[j:]
```

最坏也 O(n log n)、稳定；代价 O(n) 额外空间。**逆序对**计数就是合并时发现右侧元素更小，累加左半剩余量。

**堆排序**：建堆后反复把堆顶换到末尾再下沉，原地 O(n log n)，不稳定。

**快速选择**：复用快排的划分；基准落位下标 p：p==k 即答案，p>k 只递归左边，否则只递归右边，平均 O(n)。

**非比较排序（了解）**：计数排序（值范围小）、桶排序（分布均匀）、基数排序（按位），可突破 n log n 下界，但对数据形态有要求。

## 现实中的典型案例

- 任何报表/列表展示前的排序；数据库查询的 ORDER BY。
- 归并思想用于**外部排序**：大文件装不进内存，分块排序后多路归并。
- TopK/中位数的流式近似、日志按时戳归并。
- 电商按价格/销量排序、竞赛排名（稳定排序保证同分按报名先后）。

## 什么时候用

- 手写排序/考察分治：快排默认；要求稳定或保证最坏性能：归并。
- 只需要第 k 个值：快速选择或大小为 k 的堆，不必全排序。
- 值是小范围整数（年龄、分数段）：计数排序 O(n+k)。
- Python 工程代码直接用内置 `sorted()`（Timsort，归并+插入的混合，稳定且实战极快）。

## 易错点

- 快排递归边界和指针交换后 i/j 的自增要一致，否则越界或死循环。
- 归并的稳定性来自"相等时先取左边"，别写成 `<`。
- 快选的 k 要先统一是"第 k 小（0 基还是 1 基）"。
- 非比较排序必须确认值域假设成立，否则空间爆炸。
