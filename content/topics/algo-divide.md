---
slug: algo-divide
category: algorithm
title: 分治算法
subtitle: 分而治之——切子问题、递归求解、合并答案
order: 7
difficulty: 2
tags: [分治, 归并, 逆序对]
related_problems: [p-lcof51, p-lc215]
quizzes:
  - q: 分治算法的三步走是？
    options:
      - 分解（切成同类子问题）→ 解决（递归）→ 合并（子问题答案汇总）
      - 排序 → 二分 → 输出
      - 枚举 → 剪枝 → 回溯
      - 贪心 → 验证 → 提交
    answer: 0
    explain: 归并排序是分治最标准的样板。
  - q: 分治与动态规划最核心的区别是？
    options:
      - 分治切出的子问题一般不重叠；DP 子问题大量重叠故需要缓存
      - 分治不能用递归
      - DP 不允许合并步骤
      - 两者完全等价
    answer: 0
    explain: 归并两半互不相干；斐波那契递归则子问题指数重叠。
  - q: '"数组中的逆序对"为什么适合在归并过程中统计？'
    options:
      - 合并发现右侧元素更小时，左半剩余元素都与它构成逆序，批量累加
      - 逆序对只能靠排序
      - 必须逐对 O(n²)
      - 用哈希直接计数
    answer: 0
    explain: 累加 mid-i+1，一趟合并统计完跨两半边的逆序对。
  - q: 快速选择/快排属于哪种范式？
    options: [分治（划分后递归处理）, 贪心, 纯 DP, 纯 BFS]
    answer: 0
    explain: 它们先按基准划分，再递归处理子区间。
---

## 一句话理解

分治的**算法思想**：把一个大问题**切成几个规模更小、结构相同**的子问题，递归解决后把答案合并回来。核心假设是"切开后子问题相互独立、且答案能合并"。

## 核心思想

**标准范式**（以归并排序为例）：

1. **分解**：从中间把数组切成两半；
2. **解决**：递归排序两半（长度 ≤1 时天然有序，base case）；
3. **合并**：双指针把两个有序段合成一个有序段。

**逆序对统计**：逆序对可能出现的三处——全在左半、全在右半、**跨两半**。前两者递归统计；跨两半的在合并双指针移动时统计：当右侧元素要被取出（它比左半当前元素小），左半从当前位置到末尾的所有元素都与它构成逆序对，批量累加：

```python
def reverse_pairs(nums):
    tmp = [0] * len(nums)

    def sort_count(left, right):
        if right - left <= 1:
            return 0
        mid = (left + right) // 2
        count = sort_count(left, mid) + sort_count(mid, right)
        # 合并并统计跨两半的逆序对
        i, j, k = left, mid, left
        while i < mid and j < right:
            if nums[i] <= nums[j]:
                tmp[k] = nums[i]; i += 1
            else:
                tmp[k] = nums[j]; j += 1
                count += mid - i     # 左半剩余元素都 > nums[j]
            k += 1
        while i < mid: tmp[k] = nums[i]; i += 1; k += 1
        while j < right: tmp[k] = nums[j]; j += 1; k += 1
        nums[left:right] = tmp[left:right]
        return count

    return sort_count(0, len(nums))
```

总复杂度与归并排序相同：O(n log n)。

**其他分治**：快排/快选（先划分再递归）、二叉树递归问题（左右子树即子问题）、数学上的大整数乘法（Karatsuba）。

## 现实中的典型案例

- **大数据外部排序**：大文件切块分发到多台机器排序后归并（MapReduce 的 reduce 侧合并）。
- 分布式聚合：各分片先局部统计，再逐级合并（计票、日志计数）。
- 体育赛事淘汰赛：分组出线后合并决出冠军（结构上的分治）。
- 图像/空间分块渲染、四叉树碰撞检测。

## 什么时候用

- 问题规模缩小后**结构不变**，且子问题之间相对独立。
- 存在自然的"合并"操作能把子答案汇总为整体答案。
- 子问题大量重叠时改用 DP；无法合并时退回普通递归枚举。

## 易错点

- base case 必须清晰（区间长度 0/1），否则递归不止。
- 逆序对计数的时机在**取右元素**那一刻，且累加的是 `mid - i` 不是 1。
- 合并需要辅助数组时，拷贝区间不要越界。
- 切片（`nums[:mid]`）会产生额外 O(n log n) 空间，追求 O(n) 空间用下标 + tmp。
