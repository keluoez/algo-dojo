---
slug: p-app-vector-search
title: RAG 向量检索（暴力 Top-K）
difficulty: 2
topics: [ds-heap]
tags: [RAG, 余弦相似度, Top-K, 向量检索]
entry: vector_search
starter_code: |
  def vector_search(vectors, query, k):
      # 返回与 query 余弦相似度最高的 k 个下标，相似度降序；同分下标小者在前
      pass
solution_code: |
  import heapq
  import math

  def vector_search(vectors, query, k):
      if k <= 0:
          return []
      qn = math.sqrt(sum(x * x for x in query)) or 1.0
      heap = []                       # (相似度, -下标) 小顶堆，容量 k
      for i, v in enumerate(vectors):
          dot = sum(a * b for a, b in zip(v, query))
          vn = math.sqrt(sum(x * x for x in v)) or 1.0
          sim = dot / (qn * vn)
          if len(heap) < k:
              heapq.heappush(heap, (sim, -i))
          elif (sim, -i) > heap[0]:   # 比堆里最差的强，淘汰堆顶
              heapq.heapreplace(heap, (sim, -i))
      ranked = sorted(heap, key=lambda t: (-t[0], -t[1]))
      return [-i for _, i in ranked]
tests:
  - desc: 基础 Top-K
    args: [[[1, 0], [0, 1], [1, 1]], [1, 0], 2]
    expected: [0, 2]
  - desc: 同分保留下标小的
    args: [[[1, 0], [2, 0], [0, 1]], [1, 0], 2]
    expected: [0, 1]
  - desc: k 超过向量数全部返回
    args: [[[1, 0], [0, 1], [1, 1]], [1, 0], 5]
    expected: [0, 2, 1]
  - desc: 方向相反相似度为负
    args: [[[-1, 0], [1, 0]], [1, 0], 1]
    expected: [1]
bench:
  scales: [100, 500, 2000, 5000]
  generator: |
    import random
    def make_input(n):
        dim = 16
        vecs = [[random.uniform(-1, 1) for _ in range(dim)] for _ in range(n)]
        q = [random.uniform(-1, 1) for _ in range(dim)]
        return (vecs, q, 10)
---

RAG（检索增强生成）的检索阶段：知识库的每条文档已由 embedding 模型转成向量，用户提问的 `query` 也是一个同维度向量。**第一版检索器**就是暴力扫描——对每个库向量算与 query 的**余弦相似度**，取最高的 k 个作为候选上下文。

实现 `vector_search(vectors, query, k)`：

- 相似度 = 点积 / (|a| × |b|)；
- 返回相似度最高的 k 个向量的**下标**，按相似度**降序**；同分时下标小者在前；
- k 超过向量总数时返回全部；k ≤ 0 返回空列表。

**提示**：扫描是必须的 O(n·d)，但"维护前 k 名"不必排序——用大小固定为 k 的小顶堆，堆顶是"当前第 k 名"，新分数只有打过它才进堆。这正是生产检索层（HNSW/IVF 之前的功能基线）的写法。

--- 题解 ---

## 思路：一趟扫描 + 容量 k 的小顶堆

1. 预计算 query 的模长（循环外，只算一次）；
2. 每个向量算一次余弦相似度（点积除以两个模长，零向量模长按 1 处理防除零）；
3. 维护容量 k 的小顶堆：堆顶是当前入围者中**最差**的一个。新相似度（连同下标）若比堆顶强，就淘汰堆顶换进来。

**tie-break 的巧劲**：堆元素是 `(sim, -下标)`。Python 元组比较先比 sim，再比第二项——同分时 `-下标` 大（即下标小）的更强，恰好实现"同分下标小者胜"。

最终把堆内 k 个按 `(-sim, 下标)` 排序输出即降序榜单。

## 复杂度

- 时间 O(n·d + n·log k)：d 是向量维度，堆操作每次 O(log k)。
- 空间 O(k)：堆不随库大小增长——库有一亿条向量时也一样。
- 暴力扫在几万条规模完全可用；再往上就要换近似最近邻索引（HNSW、IVF-PQ），那是"用召回率换速度"的另一套工程权衡。

## 易错点

- query 模长必须**循环外算一次**，写在循环里是 n 倍浪费（bench 里能直接测出差距）。
- 堆里存 `-下标` 是 tie-break 的关键，直接存下标会同分保留大下标。
- `heapreplace` 只在"比堆顶强"时调用，无条件替换会把好的挤掉。
