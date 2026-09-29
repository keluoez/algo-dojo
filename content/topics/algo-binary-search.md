---
slug: algo-binary-search
category: algorithm
title: 二分查找
subtitle: 利用单调性每次砍掉一半，以及"二分答案"思想
order: 2
difficulty: 2
tags: [二分查找, 边界处理, 二分答案]
related_problems: [p-lc704, p-lc33, p-lc34, p-lc875, p-lc1011]
quizzes:
  - q: 在长度 n 的有序数组中二分查找，时间复杂度是？
    options: [O(log n), O(1), O(n), O(n log n)]
    answer: 0
    explain: 每轮搜索区间减半。
  - q: 使用前提中最重要的一条是？
    options:
      - 查找空间具有单调性（有序或判定结果单调）
      - 元素必须是整数
      - 数组长度为偶数
      - 不能有重复元素
    answer: 0
    explain: 单调才保证砍掉一半不丢解。
  - q: 循环写法里 left/right 的更新要避免什么致命错误？
    options:
      - mid 边界处理不当导致死循环（left 直接赋 mid）
      - 必须用递归
      - right 只能加 1
      - 不能有重复元素
    answer: 0
    explain: 区间只剩两元素时 left=mid 可能永不收敛。
  - q: '"二分答案"思想是指？'
    options:
      - 把最优化问题转成"某个答案可不可行"的判定问题，再二分
      - 对答案数组排序
      - 用两个指针找答案
      - 随机猜答案
    answer: 0
    explain: 如珂珂吃香蕉：二分速度，判定该速度能否按时吃完。
---

## 一句话理解

二分查找的**算法思想**：在一个**单调**的搜索空间里，每轮看中点，凭一次比较永久排除一半可能性。关键词不是"有序数组"，而是"单调性"——这也是它能扩展到旋转数组和二分答案的原因。

## 核心思想与模板

**基础模板（闭区间）**：

```python
def search(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = left + (right - left) // 2   # 防溢出写法（Python 无溢出，但是好习惯）
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            left = mid + 1                 # mid 已确认不是，直接 mid+1
        else:
            right = mid - 1
    return -1
```

**左右边界**：当目标值出现多次，找"第一个 ≥ target"时，中点命中也不急于返回，继续把 right 压向左边；最后检查 left 合法性。LC34 的两个位置就是"下界"和"上界"各做一次。

**旋转数组（LC33）**：数组分成两段各自有序。先判断 `mid` 落在**哪一段有序区间**，再判断 target 在不在这段里——本质仍是用单调性排除一半。

**二分答案**：当题目要求"最小/最大的某个值"，且能写出 `feasible(x)` 判断"答案取 x 行不行"，而可行性随 x 单调（越快的速度越能吃完、越大的运力越能运完），就在答案范围上二分，把最优化问题变成判定问题。

```python
def min_eating_speed(piles, h):
    def feasible(speed):
        return sum((p + speed - 1) // speed for p in piles) <= h

    left, right = 1, max(piles)
    while left < right:
        mid = (left + right) // 2
        if feasible(mid):
            right = mid                    # mid 可行，但可能还有更小的
        else:
            left = mid + 1
    return left
```

## 现实中的典型案例

- 查字典 / 翻书找页码：天然二分。
- Git 的 `git bisect`：二分提交历史，快速定位哪次提交引入了 bug。
- 服务容量规划：二分"最少要开多少台机器才能扛住流量"。
- 工业场景：给定传送带速度，判定当天产量能否达标，找最低可行速度。
- 版本灰度中二分判断问题出在哪个范围。

## 什么时候用

- 搜索空间有序，或能按值分成单调两段。
- 最优化问题能写出**单调的可行性判定** → 二分答案。
- 每次判断代价高（长数组扫描、外部调用），二分能把判断次数压到 log 级别。

## 易错点

- `mid + 1` / `mid - 1` 与循环终止条件是配套的，混用会死循环或漏解。
- 旋转数组先判断"哪半边有序"，嵌套的比较对象是区间端点不是 target 相邻元素。
- 二分答案的上界要保证一定可行（如 max(piles)），下界通常 1。
- 整数溢出在 Python 不存在，但计算 mid 的写法保持统一便于跨语言迁移。
