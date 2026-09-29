---
slug: ds-array
category: data-structure
title: 数组与字符串
subtitle: 连续内存、随机访问，以及前缀和与差分两大预处理思想
order: 1
difficulty: 1
tags: [数组, 字符串, 前缀和, 差分]
related_problems: [p-lc1109]
quizzes:
  - q: 在连续存储的数组中，按下标随机访问一个元素的时间复杂度是？
    options: [O(1), O(log n), O(n), O(n²)]
    answer: 0
    explain: 元素地址 = 首地址 + 下标 × 元素大小，直接计算可得。
  - q: Python list 在尾部 append 元素的摊还时间复杂度是？
    options: [O(1), O(log n), O(n), O(n²)]
    answer: 0
    explain: 动态数组按倍增策略扩容，单次扩容 O(n) 摊到 n 次插入上，摊还 O(1)。
  - q: 对原数组求前缀和数组后，任意区间 [l, r] 的和可以在多长时间得到？
    options: [O(1), O(log n), O(n), O(r-l)]
    answer: 0
    explain: 区间和 = prefix[r+1] - prefix[l]，一次减法。
  - q: 差分数组主要用来高效解决哪类问题？
    options:
      - 多次对区间整体加一个数，最后求每个位置的值
      - 判断元素是否重复
      - 求数组最大值
      - 对数组排序
    answer: 0
    explain: 区间加只改差分两端两点，最后前缀和还原，复杂度 O(操作数+n)。
operations:
  - name: 尾部追加（append）
    kind: 增
    desc: 摊还 O(1)。容量不够时才扩容搬迁，单次 O(n) 摊到很多次插入上。
    code: |
      def push_back(arr, val):
          arr.append(val)
          return arr
    demo: |
      print(push_back([1, 2], 3))
    output: "[1, 2, 3]"

  - name: 按下标插入（insert_at）
    kind: 增
    desc: O(n)。尾部先垫一个位置，再从后往前整体右移一格——正着挪会互相覆盖。
    code: |
      def insert_at(arr, index, val):
          arr.append(None)                       # 先撑出长度
          for i in range(len(arr) - 1, index, -1):
              arr[i] = arr[i - 1]                # 倒着挪才不丢数据
          arr[index] = val
          return arr
    demo: |
      print(insert_at([1, 2, 4], 2, 3))
    output: "[1, 2, 3, 4]"

  - name: 按下标删除（remove_at）
    kind: 删
    desc: O(n)。从左往右把后面元素往前盖一格，再把多余的尾巴弹掉。
    code: |
      def remove_at(arr, index):
          for i in range(index, len(arr) - 1):
              arr[i] = arr[i + 1]
          arr.pop()                              # 长度减一
          return arr
    demo: |
      print(remove_at([1, 2, 3, 4], 1))
    output: "[1, 3, 4]"

  - name: 按下标改值
    kind: 改
    desc: O(1)。地址直接算出来，改一个元素不牵动任何邻居。
    code: |
      def set_at(arr, index, val):
          arr[index] = val
          return arr
    demo: |
      arr = [1, 2, 3]
      arr = set_at(arr, 1, 20)
      print(arr, arr[1])
    output: "[1, 20, 3] 20"

  - name: 区间整体加（差分）
    kind: 改
    desc: O(1) 打标记。只在两端改两个点，最后一次前缀和还原出每个位置的增量。
    code: |
      def range_add(arr, left, right, value):
          diff = [0] * (len(arr) + 1)
          diff[left] += value
          diff[right + 1] -= value              # 右边界 +1，最容易漏
          cur, out = 0, []
          for i in range(len(arr)):
              cur += diff[i]
              out.append(arr[i] + cur)
          return out
    demo: |
      print(range_add([4, 2, -1, 3], 1, 3, 10))   # 下标 1..3 各加 10
    output: "[4, 12, 9, 13]"

  - name: 按值查找（find_index）
    kind: 查
    desc: O(n)。数组按下标访问是 O(1)，但按值查找只能逐个扫——这是它弱于哈希的地方。
    code: |
      def find_index(arr, val):
          for i, x in enumerate(arr):
              if x == val:
                  return i
          return -1
    demo: |
      arr = [10, 20, 30]
      print(arr[2], find_index(arr, 30), find_index(arr, 99))
    output: "30 2 -1"

  - name: 区间求和（前缀和）
    kind: 查
    desc: 预处理 O(n)，之后任意区间和 O(1)：prefix[r+1] - prefix[l]。
    code: |
      def build_prefix(arr):
          prefix = [0]
          for x in arr:
              prefix.append(prefix[-1] + x)
          return prefix


      def range_sum(prefix, left, right):
          return prefix[right + 1] - prefix[left]
    demo: |
      arr = [4, 2, -1, 3]
      prefix = build_prefix(arr)
      print(prefix, range_sum(prefix, 1, 3))
    output: "[0, 4, 6, 5, 8] 4"
---

## 一句话理解

数组是**一段连续内存里同类型元素的序列**，支持 O(1) 随机访问；字符串可以理解为字符组成的只读数组。前缀和与差分是建立在数组上的两个"以空间换时间"的预处理技巧。

## 核心概念

**内存模型**：数组元素紧挨着存放，第 i 个元素的地址可以直接算出来，所以：

- 随机访问（`arr[i]`）O(1)
- 在中间插入/删除需要挪动元素，O(n)
- Python 的 `list` 是**动态数组**：容量不够时按倍增策略申请新空间并整体搬迁，所以尾部 `append` 的**摊还**代价是 O(1)，但偶尔一次插入会触发 O(n) 扩容。

**前缀和**：先花 O(n) 预处理 `prefix[i]`（前 i 个元素之和），之后任意区间和 O(1)：

```python
nums = [4, 2, -1, 3]
prefix = [0]
for x in nums:
    prefix.append(prefix[-1] + x)
# 区间 [l, r]（闭区间）的和：
l, r = 1, 3
print(prefix[r + 1] - prefix[l])   # 2 + (-1) + 3 = 4
```

**差分数组**：前缀和的"逆运算"。要支持"区间整体加 v"，只需在差分两端改两个点：

```python
diff = [0] * (len(nums) + 1)

def range_add(left, right, value):
    diff[left] += value
    diff[right + 1] -= value

range_add(1, 3, 10)   # 下标 1..3 各加 10
range_add(0, 1, 5)    # 下标 0..1 各加 5

# 最后前缀和还原，得到每个位置被加的总量
cur, result = 0, []
for i in range(len(nums)):
    cur += diff[i]
    result.append(nums[i] + cur)
```

**字符串基本处理**：拼接、切片、分割。注意 Python 字符串不可变，循环里用 `+=` 拼接会反复生成新对象（O(n²) 风险），应先放进 list 再 `''.join(parts)`。

## 现实中的典型案例

- **前缀和**：财务报表要随时回答"2 月到 8 月总支出"；视频 App 的"累计观看时长"曲线；热力图上任意矩形区域的人口数。
- **差分**：航班座位被多个订单区间反复加锁；网约车补贴"对 3 公里到 8 公里区间统一加价"；游戏里一段范围内所有怪物同时加 buff。
- **字符串处理**：日志按分隔符切分字段；搜索引擎统计关键词在文档中的位置。

## 什么时候用

- 需要**反复查询区间和** → 先建前缀和。
- 需要**反复对区间整体加减**、最后一次性看结果 → 差分数组。
- 元素数量确定、需要 O(1) 随机访问或遍历时，数组是默认选择；若需要频繁在任意位置插入删除，考虑链表。

## 易错点

- 前缀和下标约定：`prefix[k]` 到底是"前 k 个"还是"下标 0..k"，先定清楚再写区间公式。
- 差分时 `diff[right+1] -= value`，右边界 +1 容易漏。
- 原地修改数组时，新值覆盖旧值会影响后续计算——预处理数组一般单独开辟。
