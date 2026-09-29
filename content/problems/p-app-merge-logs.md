---
slug: p-app-merge-logs
title: 日志归档的最小总代价
difficulty: 1
topics: [algo-greedy, ds-heap]
tags: [贪心, 最小堆, 哈夫曼思想]
entry: merge_cost
starter_code: |
  def merge_cost(sizes):
      # 每次把两堆合成一堆，代价为两堆之和；返回全部合一的最小总代价
      pass
solution_code: |
  import heapq

  def merge_cost(sizes):
      heap = list(sizes)
      heapq.heapify(heap)
      total = 0
      while len(heap) > 1:
          merged = heapq.heappop(heap) + heapq.heappop(heap)  # 永远先合并最小的两堆
          total += merged
          heapq.heappush(heap, merged)
      return total
tests:
  - desc: 基础示例
    args: [[1, 2, 3]]
    expected: 9
  - desc: 贪心选择影响结果
    args: [[4, 3, 2, 4]]
    expected: 26
  - desc: 均等大小
    args: [[1, 1, 1, 1]]
    expected: 8
  - desc: 只有一堆无需合并
    args: [[10]]
    expected: 0
  - desc: 两堆
    args: [[5, 5]]
    expected: 10
bench:
  scales: [100, 1000, 5000, 10000]
  generator: |
    import random
    def make_input(n):
        return ([random.randint(1, 1000) for _ in range(n)],)
---

运维团队要把分散的日志文件归档成一份大文件。服务器上每次归档操作只能**把两堆文件合并成一堆**，代价等于两堆的大小之和（搬运量）。给定每堆的初始大小 `sizes`，求把全部堆合并成一堆的**最小总代价**。

**提示**：反例体会一下——`[3, 2, 4, 4]` 如果上来就合并最大的两堆（4+4=8，再 8+5=13，再 13+3=16），总代价 8+13+16=37；而"每次都合并当前最小的两堆"只要 26。一个元素越**早**被合并，它的大小就会被后续每次合并**重复计入**——所以应该让谁尽早合并、谁尽量拖到最后？

--- 题解 ---

## 思路：每次合并最小的两堆（哈夫曼贪心）

观察代价结构：一堆文件的大小，会被它参与的**每一次**后续合并重复计费。因此：

- **小的堆应该早合并**（它们反正要被计费很多次，让每次计费的基数尽量小）；
- **大的堆尽量拖到最后**（只被计费一两次）。

这正是哈夫曼编码的构造思想（哈夫曼树中，频率低的叶子在深处）。实现上用小顶堆：每次弹出最小的两堆合并、结果放回堆中，直到只剩一堆。

用交换论证可以严格证明：任何"先合并了非最小两堆"的方案，把这对操作换成最小两堆，总代价不会变大。

## 复杂度

- 时间 O(n log n)：n-1 次合并，每次堆操作 O(log n)。
- 空间 O(n)。

## 易错点

- 顺序合并（从头到尾两两扫）是错的：`[6, 2, 1]` 顺序合并代价 (6+2)+(8+1)=17，贪心 (1+2)+(3+6)=12。
- 只有 1 堆时答案为 0，不要试图弹出两堆。
- 代价是**累计**的合并代价，不是最后一次合并的代价，也不是总和。
