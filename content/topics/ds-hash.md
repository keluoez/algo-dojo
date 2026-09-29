---
slug: ds-hash
category: data-structure
title: 哈希表
subtitle: 用空间换时间，O(1) 的查找、计数与去重
order: 4
difficulty: 1
tags: [哈希表, 计数, 去重, 前缀和]
related_problems: [p-lc1, p-lc560, p-lc721, p-app-rerank, p-app-dedup]
quizzes:
  - q: 哈希表平均情况下查找一个 key 的时间复杂度是？
    options: [O(1), O(log n), O(n), O(n log n)]
    answer: 0
    explain: 哈希函数直接定位桶位；最坏（全部冲突）才退化为 O(n)。
  - q: 两个不同 key 哈希到同一个位置，称为？常见解决办法是？
    options:
      - 哈希冲突；链地址法 / 开放寻址法
      - 缓存击穿；加锁
      - 负载不均；扩容
      - 递归过深；改迭代
    answer: 0
    explain: Python dict 使用开放寻址（探测下一个空位）。
  - q: 判断一个数组里是否存在重复元素，哈希集合相比排序的典型优势是？
    options: [平均 O(n) 时间且不改动原数组, 一定更省内存, 能同时排序, 不依赖哈希函数]
    answer: 0
    explain: 一趟扫描查集合；排序通常 O(n log n)。
  - q: '"前缀和 + 哈希"组合主要用来解决哪类问题？'
    options:
      - 和为某值的连续子数组个数
      - 数组最大值
      - 链表是否有环
      - 二叉树高度
    answer: 0
    explain: 对每个前缀和，查之前是否出现过 prefix-k（如 LC560）。
operations:
  - name: 写入键值对
    kind: 增
    desc: 平均 O(1)。key 必须可哈希——list、dict、set 都不行，要换成 tuple / frozenset。
    code: |
      def put(table, key, value):
          table[key] = value
          return table
    demo: |
      table = {}
      put(table, "北京", 2154)
      put(table, "上海", 2487)
      print(table)
      print(put(table, (1, 2), "元组当 key 可以"))
    output: "{'北京': 2154, '上海': 2487}\n{'北京': 2154, '上海': 2487, (1, 2): '元组当 key 可以'}"

  - name: 更新（存在则累加，不存在则新建）
    kind: 改
    desc: 平均 O(1)。get(key, 0) 免掉一次 if 判断，是计数写法的标配。
    code: |
      def upsert(table, key, delta):
          table[key] = table.get(key, 0) + delta
          return table
    demo: |
      table = {"a": 1}
      upsert(table, "a", 5)     # 已存在：1 + 5
      upsert(table, "b", 2)     # 不存在：0 + 2
      print(table)
    output: "{'a': 6, 'b': 2}"

  - name: 按 key 取值
    kind: 查
    desc: 平均 O(1)。用 get 而不是 []，key 不存在时给默认值而不是抛 KeyError。
    code: |
      def get_value(table, key, default=None):
          return table.get(key, default)
    demo: |
      table = {"a": 1}
      print(get_value(table, "a"), get_value(table, "z", -1))
    output: "1 -1"

  - name: 删除 key
    kind: 删
    desc: 平均 O(1)。pop(key, None) 同时拿到被删的值，且 key 不存在时不报错。
    code: |
      def remove_key(table, key):
          return table.pop(key, None)
    demo: |
      table = {"a": 1, "b": 2}
      print(remove_key(table, "a"), remove_key(table, "z"), table)
    output: "1 None {'b': 2}"

  - name: 存在性判断与去重（set）
    kind: 查
    desc: 平均 O(1)。一趟 O(n) 判重；排序判重是 O(n log n) 且会打乱顺序。
    code: |
      def has_duplicate(nums):
          seen = set()
          for x in nums:
              if x in seen:
                  return True
              seen.add(x)
          return False
    demo: |
      print(has_duplicate([1, 2, 3, 2]), has_duplicate([1, 2, 3]))
      print(sorted(set([1, 2, 2, 3, 3, 3])))
    output: "True False\n[1, 2, 3]"

  - name: 计数（Counter）
    kind: 增
    desc: O(n)。Counter 本质是 dict 的语法糖，most_common 内部走堆/排序。
    code: |
      from collections import Counter


      def count_freq(nums):
          return Counter(nums)
    demo: |
      cnt = count_freq([1, 2, 2, 3, 3, 3])
      print(dict(cnt), cnt[3], cnt.most_common(1))
    output: "{1: 1, 2: 2, 3: 3} 3 [(3, 3)]"

  - name: 前缀和 + 哈希：统计和为 k 的子数组
    kind: 查
    desc: 'O(n)。对每个前缀和 prefix，查历史里 prefix-k 出现过几次；初始 {0: 1} 不能漏。'
    code: |
      def subarray_sum(nums, k):
          count, prefix = 0, 0
          seen = {0: 1}                        # 从头开始的子数组也要算进去
          for x in nums:
              prefix += x
              count += seen.get(prefix - k, 0)
              seen[prefix] = seen.get(prefix, 0) + 1
          return count
    demo: |
      print(subarray_sum([1, 1, 1], 2))        # [1,1] 有两段
      print(subarray_sum([3, 4, 7, 2, -3, 1, 4, 2], 7))
    output: "2\n4"
---

## 一句话理解

哈希表把任意 key 通过**哈希函数**映射到数组下标，平均 O(1) 完成增删查；代价是额外空间和无序存储。Python 的 `dict` 和 `set` 就是哈希表。

## 核心概念

**工作原理**：

1. 对 key 算哈希值，再对桶数取模得到桶位；
2. 该位置没被占就直接放入；
3. **哈希冲突**（两个 key 落到同一位）的两种经典解法：
   - **链地址法**：桶位挂一个链表/小列表，冲突元素都挂上去；
   - **开放寻址法**：按规则探测下一个空位（Python dict 属于这一类，冲突时继续探测）。
4. 负载因子（占用比例）过高时扩容并重新哈希，保证平均 O(1)。

**三大适用场景**：

```python
from collections import Counter

nums = [1, 2, 2, 3, 3, 3]

# 1. 计数
cnt = Counter(nums)              # {1:1, 2:2, 3:3}

# 2. 去重 / 存在性判断
uniques = set(nums)
print(2 in uniques)              # True

# 3. 值 → 下标/配对信息的映射（两数之和）
def two_sum(nums, target):
    seen = {}                    # 值 -> 下标
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
```

**前缀和 + 哈希**：统计"和为 k 的子数组"时，遍历前缀和，查历史前缀中等于 `prefix-k` 的次数，一次遍历出答案。

## 现实中的典型案例

- Python 函数的**关键字参数**、对象的属性表（`__dict__`）。
- Redis 的核心数据结构之一就是哈希表；数据库的**哈希索引**、Memcached。
- 缓存系统（网页 → 缓存内容）、DNS 域名映射。
- 风控系统对用户 ID / 设备指纹秒级查重；编译器符号表。
- 输入法词库：拼音 → 候选词。

## 什么时候用

- 需要反复"给我这个 key 对应的值"或"它在不在集合里"。
- 需要统计频次、去重、找配对，且能用 O(n) 空间接受 O(n) 时间。
- key 有序遍历需求时改用平衡树/排序；需要海量数据持久化时用数据库或 Redis。

## 易错点

- 哈希表的 O(1) 是**平均**情况；key 全部冲突时退化 O(n)。
- 可变对象（list、dict）不能做 key，要用 tuple / frozenset。
- 前缀和计数时初始要放一个 `{0: 1}`，否则从头开始的子数组被漏掉。
- 遍历 dict 时不要修改它的大小（Python 3 会直接报错）。
