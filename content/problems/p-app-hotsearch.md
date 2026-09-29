---
slug: p-app-hotsearch
title: 实时热搜榜
difficulty: 2
topics: [ds-heap]
tags: [堆, Top-K, 哈希计数]
entry: top_search
starter_code: |
  def top_search(words, k):
      # 返回出现次数最多的 k 个词；同频按字典序升序
      pass
solution_code: |
  import heapq
  from collections import Counter

  def top_search(words, k):
      counts = Counter(words)
      # (-次数, 词)：最小堆弹出顺序 = 次数降序、同频字典序升序
      heap = [(-c, w) for w, c in counts.items()]
      heapq.heapify(heap)
      out = []
      for _ in range(min(k, len(heap))):
          _, w = heapq.heappop(heap)
          out.append(w)
      return out
tests:
  - desc: 同频按字典序
    args: [["i", "love", "leetcode", "i", "love", "coding"], 2]
    expected: ["i", "love"]
  - desc: k 超过不同词数时全部返回
    args: [["i", "love", "leetcode", "i", "love", "coding"], 3]
    expected: ["i", "love", "coding"]
  - desc: 四档频次各取一个
    args: [["the", "day", "is", "sunny", "the", "the", "the", "sunny", "is", "is"], 4]
    expected: ["the", "is", "sunny", "day"]
  - desc: 单一词
    args: [["a", "a"], 5]
    expected: ["a"]
bench:
  scales: [100, 1000, 5000, 10000]
  generator: |
    import random
    def make_input(n):
        pool = ["w%d" % i for i in range(max(2, n // 2))]
        words = [random.choice(pool) for _ in range(n)]
        return (words, 10)
---

搜索团队需要每分钟刷新一次**热搜榜**：给定一个词流（用户搜索词的列表 `words`，可能有大量重复），返回出现次数最多的 `k` 个词。

**同频并列时按字典序升序**排在前面（这是各大平台热搜榜 tie-break 的通行做法）。`k` 可能大于不同词的总数，此时返回全部词。

**提示**：先想"计数 + 完整排序"的 O(n log n) 做法哪里浪费了——我们只需要前 k 个，为什么要给后面 n-k 个也排序？想想《堆》一节的 Top-K 套路。

--- 题解 ---

## 思路：Counter 计数 + 堆做部分排序

1. `Counter` 一趟扫描统计词频 O(n)；
2. 全部词入一个小顶堆，堆序键是 `(-次数, 词)`：元组比较先比次数（取负后"最小"即次数最大），再比词（字典序小的先出）；
3. 弹 k 次即得答案。

堆在这里的作用是**部分排序**：完整排序要把 n 个不同词全排好，而弹 k 次只花 O(m log m) 建堆 + O(k log m)（m 为不同词数）。当 k ≪ m（热搜榜通常只取前 10~50）时明显省于 O(m log m) 的排序——大表见"性能实测"。

> 进阶：如果要处理的是持续到来的流式数据（榜单实时更新），改用**大小固定为 k 的小顶堆**（堆顶是榜单第 k 名，新词频次超过它才进堆），这正是生产系统里 Redis ZSET / 各类实时榜单的骨架。

## 复杂度

- 时间 O(n + m log m + k log m)：计数 O(n)，建堆 O(m)，弹 k 次。
- 空间 O(m)：堆存所有不同词。固定 k 小顶堆的流式版本只需 O(k)。

## 易错点

- 同频 tie-break：直接用 `(次数, 词)` 入堆会把同频中**字典序大**的排前面，必须把次数取负。
- `k` 大于不同词数时只弹 `min(k, m)` 次，别让 heappop 空堆抛 `IndexError`。
- Counter 的 key 是词、value 是次数，构建堆元组时别写反。
